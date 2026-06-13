import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function createTestDb() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "knowlens-image-state-"));
  const db = new DatabaseSync(path.join(dir, "state.sqlite"));
  db.exec(`
    CREATE TABLE image_generation_jobs (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      project_id TEXT,
      intent TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE image_generation_tasks (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      task_index INTEGER NOT NULL,
      status TEXT NOT NULL,
      render_url TEXT,
      asset_path TEXT,
      error_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return {
    db,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function insertJob(db, input) {
  db.prepare(
    `INSERT INTO image_generation_jobs (
      id, user_email, project_id, intent, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userEmail,
    input.projectId,
    input.intent,
    input.status || "completed",
    input.createdAt,
    input.updatedAt || input.createdAt,
  );
}

function insertTask(db, input) {
  const isReady = input.status === "asset_ready";
  db.prepare(
    `INSERT INTO image_generation_tasks (
      id, job_id, task_index, status, render_url, asset_path, error_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.jobId,
    input.index,
    input.status,
    input.renderUrl ?? (isReady ? `/api/workspace/image/assets/${input.id}` : null),
    input.assetPath ?? (isReady ? `runtime-logs/image-assets/workspace-images/project/${input.id}.png` : null),
    input.errorCode ?? null,
    input.createdAt,
    input.updatedAt || input.createdAt,
  );
}

function selectLatestProjectTasks(db, input) {
  const taskRows = db
    .prepare(
      `SELECT t.*
         FROM image_generation_tasks t
         JOIN image_generation_jobs j ON j.id = t.job_id
        WHERE j.user_email = ? AND j.project_id = ? AND j.intent = ?
        ORDER BY
          t.task_index ASC,
          CASE
            WHEN t.status = 'asset_ready'
             AND t.render_url IS NOT NULL
             AND t.render_url != ''
             AND t.asset_path IS NOT NULL
             AND t.asset_path != ''
            THEN 0
            ELSE 1
          END ASC,
          t.updated_at DESC,
          t.created_at DESC`,
    )
    .all(input.userEmail, input.projectId, input.intent);
  const latestByIndex = new Map();
  for (const task of taskRows) {
    if (!latestByIndex.has(task.task_index)) {
      latestByIndex.set(task.task_index, task);
    }
  }
  return Array.from(latestByIndex.values()).sort((a, b) => a.task_index - b.task_index);
}

test("project restore keeps all PPT pages when the latest job only contains a retried page", () => {
  const { db, cleanup } = createTestDb();
  try {
    const email = "local@knowlens.ai";
    const projectId = "p-test";
    insertJob(db, {
      id: "job-initial",
      userEmail: email,
      projectId,
      intent: "ppt",
      createdAt: "2026-06-02T10:00:00.000Z",
    });
    for (let index = 1; index <= 10; index += 1) {
      insertTask(db, {
        id: `task-${index}`,
        jobId: "job-initial",
        index,
        status: "asset_ready",
        createdAt: `2026-06-02T10:00:${String(index).padStart(2, "0")}.000Z`,
      });
    }

    insertJob(db, {
      id: "job-retry-slide-11",
      userEmail: email,
      projectId,
      intent: "ppt",
      createdAt: "2026-06-02T10:10:00.000Z",
    });
    insertTask(db, {
      id: "task-11-retry",
      jobId: "job-retry-slide-11",
      index: 11,
      status: "asset_ready",
      createdAt: "2026-06-02T10:10:01.000Z",
    });

    const tasks = selectLatestProjectTasks(db, { userEmail: email, projectId, intent: "ppt" });
    assert.deepEqual(
      tasks.map((task) => task.task_index),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
    assert.equal(tasks.every((task) => task.status === "asset_ready"), true);
  } finally {
    cleanup();
  }
});

test("project restore preserves the last persisted image when a later redraw fails", () => {
  const { db, cleanup } = createTestDb();
  try {
    const email = "local@knowlens.ai";
    const projectId = "p-test";
    insertJob(db, {
      id: "job-ready",
      userEmail: email,
      projectId,
      intent: "ppt",
      createdAt: "2026-06-02T10:00:00.000Z",
    });
    insertTask(db, {
      id: "task-3-ready",
      jobId: "job-ready",
      index: 3,
      status: "asset_ready",
      createdAt: "2026-06-02T10:00:03.000Z",
    });
    insertJob(db, {
      id: "job-redraw-failed",
      userEmail: email,
      projectId,
      intent: "ppt",
      status: "failed",
      createdAt: "2026-06-02T10:20:00.000Z",
    });
    insertTask(db, {
      id: "task-3-failed",
      jobId: "job-redraw-failed",
      index: 3,
      status: "failed",
      errorCode: "IMAGE_ALL_FAILED",
      createdAt: "2026-06-02T10:20:03.000Z",
    });

    const [task] = selectLatestProjectTasks(db, { userEmail: email, projectId, intent: "ppt" });
    assert.equal(task.id, "task-3-ready");
    assert.equal(task.status, "asset_ready");
    assert.match(task.render_url, /task-3-ready/);
  } finally {
    cleanup();
  }
});

test("project restore returns the latest failure only when a page has no persisted image", () => {
  const { db, cleanup } = createTestDb();
  try {
    const email = "local@knowlens.ai";
    const projectId = "p-test";
    insertJob(db, {
      id: "job-failed",
      userEmail: email,
      projectId,
      intent: "ppt",
      status: "failed",
      createdAt: "2026-06-02T10:00:00.000Z",
    });
    insertTask(db, {
      id: "task-2-failed-old",
      jobId: "job-failed",
      index: 2,
      status: "failed",
      errorCode: "IMG-500",
      createdAt: "2026-06-02T10:00:02.000Z",
    });
    insertTask(db, {
      id: "task-2-failed-new",
      jobId: "job-failed",
      index: 2,
      status: "failed",
      errorCode: "IMG-503",
      createdAt: "2026-06-02T10:05:02.000Z",
    });

    const [task] = selectLatestProjectTasks(db, { userEmail: email, projectId, intent: "ppt" });
    assert.equal(task.id, "task-2-failed-new");
    assert.equal(task.status, "failed");
    assert.equal(task.error_code, "IMG-503");
  } finally {
    cleanup();
  }
});

test("project restore keeps poster and PPT image states isolated by intent", () => {
  const { db, cleanup } = createTestDb();
  try {
    const email = "local@knowlens.ai";
    const projectId = "p-test";
    insertJob(db, {
      id: "job-poster",
      userEmail: email,
      projectId,
      intent: "poster",
      createdAt: "2026-06-02T10:00:00.000Z",
    });
    insertTask(db, {
      id: "poster-task-1",
      jobId: "job-poster",
      index: 1,
      status: "asset_ready",
      createdAt: "2026-06-02T10:00:01.000Z",
    });
    insertJob(db, {
      id: "job-ppt",
      userEmail: email,
      projectId,
      intent: "ppt",
      createdAt: "2026-06-02T10:01:00.000Z",
    });
    insertTask(db, {
      id: "ppt-task-1",
      jobId: "job-ppt",
      index: 1,
      status: "asset_ready",
      createdAt: "2026-06-02T10:01:01.000Z",
    });

    const pptTasks = selectLatestProjectTasks(db, { userEmail: email, projectId, intent: "ppt" });
    const posterTasks = selectLatestProjectTasks(db, { userEmail: email, projectId, intent: "poster" });
    assert.deepEqual(pptTasks.map((task) => task.id), ["ppt-task-1"]);
    assert.deepEqual(posterTasks.map((task) => task.id), ["poster-task-1"]);
  } finally {
    cleanup();
  }
});
