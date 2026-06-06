import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { hasManagedDatabase, pgAll, pgGet, pgRun } from "@/lib/server/postgres";

export type WorkspaceProjectPageOutputType = "poster" | "ppt" | "video";

export type WorkspaceProjectPageRow = {
  id: string;
  projectId: string;
  userEmail: string;
  pageIndex: number;
  outputType: WorkspaceProjectPageOutputType;
  pageRole: string | null;
  title: string;
  subtitle: string;
  body: string;
  visual: string;
  imagePromptDraft: string;
  imageTaskId: string | null;
  imageUrl: string | null;
  rawImageUrl: string | null;
  assetPath: string | null;
  status: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceProjectActivityRow = {
  projectId: string;
  outputType: WorkspaceProjectPageOutputType;
  title: string;
  updatedAt: string;
};

export type WorkspaceProjectSummaryRow = {
  projectId: string;
  userEmail: string;
  outputType: WorkspaceProjectPageOutputType;
  title: string;
  pageCount: number;
  generatedAssetCount: number;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceProjectPageInput = {
  index: number;
  outputType?: WorkspaceProjectPageOutputType | string;
  pageRole?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  visual?: string | null;
  imagePromptDraft?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined, max = 8000) {
  return (value || "").trim().slice(0, max);
}

function normalizeOptionalText(value: string | null | undefined, max = 1000) {
  const normalized = normalizeText(value, max);
  return normalized || null;
}

function normalizeOutputType(value: string | null | undefined): WorkspaceProjectPageOutputType {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "ppt" || normalized === "video" || normalized === "poster") {
    return normalized;
  }
  return "poster";
}

function mapPageRow(row: Record<string, unknown>): WorkspaceProjectPageRow {
  return {
    id: String(row.id || ""),
    projectId: String(row.project_id || ""),
    userEmail: String(row.user_email || ""),
    pageIndex: Number(row.page_index || 0),
    outputType: normalizeOutputType(String(row.output_type || "")),
    pageRole: typeof row.page_role === "string" ? row.page_role : null,
    title: String(row.title || ""),
    subtitle: String(row.subtitle || ""),
    body: String(row.body || ""),
    visual: String(row.visual || ""),
    imagePromptDraft: String(row.image_prompt_draft || ""),
    imageTaskId: typeof row.image_task_id === "string" ? row.image_task_id : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    rawImageUrl: typeof row.raw_image_url === "string" ? row.raw_image_url : null,
    assetPath: typeof row.asset_path === "string" ? row.asset_path : null,
    status: typeof row.status === "string" ? row.status : null,
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapProjectSummaryRow(row: Record<string, unknown>): WorkspaceProjectSummaryRow {
  return {
    projectId: String(row.project_id || ""),
    userEmail: String(row.user_email || ""),
    outputType: normalizeOutputType(String(row.output_type || "")),
    title: String(row.title || row.project_id || ""),
    pageCount: Number(row.page_count || 0),
    generatedAssetCount: Number(row.generated_asset_count || 0),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
  };
}

export async function upsertWorkspaceProjectPages(input: {
  projectId: string;
  userEmail: string;
  outputType: WorkspaceProjectPageOutputType | string;
  pages: WorkspaceProjectPageInput[];
}) {
  const projectId = normalizeText(input.projectId, 120);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const outputType = normalizeOutputType(input.outputType);
  const pages = input.pages
    .map((page) => ({
      ...page,
      index: Math.max(1, Math.round(Number(page.index || 0))),
      outputType: normalizeOutputType(page.outputType || outputType),
    }))
    .filter((page) => projectId && userEmail && page.index > 0);
  if (!projectId || !userEmail || !pages.length) {
    return 0;
  }

  const updatedAt = nowIso();
  const sqlText = `INSERT INTO workspace_project_pages (
      id, project_id, user_email, page_index, output_type, page_role, title, subtitle, body, visual,
      image_prompt_draft, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'draft_ready'), ?, ?)
    ON CONFLICT(project_id, user_email, output_type, page_index)
    DO UPDATE SET
      page_role = excluded.page_role,
      title = excluded.title,
      subtitle = excluded.subtitle,
      body = excluded.body,
      visual = excluded.visual,
      image_prompt_draft = excluded.image_prompt_draft,
      status = CASE
        WHEN workspace_project_pages.image_url IS NULL OR workspace_project_pages.image_url = ''
        THEN excluded.status
        ELSE workspace_project_pages.status
      END,
      updated_at = excluded.updated_at`;
  if (hasManagedDatabase()) {
    for (const page of pages) {
      await pgRun(sqlText, [
        `wpp-${randomUUID()}`,
        projectId,
        userEmail,
        page.index,
        page.outputType,
        normalizeOptionalText(page.pageRole, 80),
        normalizeText(page.title, 400),
        normalizeText(page.subtitle, 800),
        normalizeText(page.body, 12000),
        normalizeText(page.visual, 2000),
        normalizeText(page.imagePromptDraft, 2000),
        "draft_ready",
        updatedAt,
        updatedAt,
      ]);
    }
    return pages.length;
  }

  const { db } = getDb();
  const statement = db.prepare(
    sqlText,
  );
  for (const page of pages) {
    statement.run(
      `wpp-${randomUUID()}`,
      projectId,
      userEmail,
      page.index,
      page.outputType,
      normalizeOptionalText(page.pageRole, 80),
      normalizeText(page.title, 400),
      normalizeText(page.subtitle, 800),
      normalizeText(page.body, 12000),
      normalizeText(page.visual, 2000),
      normalizeText(page.imagePromptDraft, 2000),
      "draft_ready",
      updatedAt,
      updatedAt,
    );
  }
  return pages.length;
}

export async function bindWorkspaceProjectPageTask(input: {
  projectId: string;
  userEmail: string;
  outputType: WorkspaceProjectPageOutputType | string;
  pageIndex: number;
  taskId: string;
  status?: string;
}) {
  const projectId = normalizeText(input.projectId, 120);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const outputType = normalizeOutputType(input.outputType);
  const pageIndex = Math.max(1, Math.round(Number(input.pageIndex || 0)));
  const taskId = normalizeText(input.taskId, 120);
  if (!projectId || !userEmail || !pageIndex || !taskId) {
    return;
  }
  const sqlText = `UPDATE workspace_project_pages
     SET image_task_id = ?, status = ?, error_code = null, updated_at = ?
     WHERE project_id = ? AND user_email = ? AND output_type = ? AND page_index = ?`;
  const params = [taskId, normalizeText(input.status, 80) || "queued", nowIso(), projectId, userEmail, outputType, pageIndex];
  if (hasManagedDatabase()) {
    await pgRun(sqlText, params);
    return;
  }
  const { db } = getDb();
  db.prepare(sqlText).run(...params);
}

export async function updateWorkspaceProjectPageImage(input: {
  projectId: string;
  userEmail: string;
  outputType: WorkspaceProjectPageOutputType | string;
  pageIndex: number;
  taskId?: string | null;
  status: string;
  imageUrl?: string | null;
  rawImageUrl?: string | null;
  assetPath?: string | null;
  errorCode?: string | null;
}) {
  const projectId = normalizeText(input.projectId, 120);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const outputType = normalizeOutputType(input.outputType);
  const pageIndex = Math.max(1, Math.round(Number(input.pageIndex || 0)));
  if (!projectId || !userEmail || !pageIndex) {
    return;
  }
  const sqlText = `UPDATE workspace_project_pages
     SET image_task_id = COALESCE(?, image_task_id),
         image_url = COALESCE(?, image_url),
         raw_image_url = COALESCE(?, raw_image_url),
         asset_path = COALESCE(?, asset_path),
         status = ?,
         error_code = ?,
         updated_at = ?
     WHERE project_id = ? AND user_email = ? AND output_type = ? AND page_index = ?`;
  const params = [
    normalizeOptionalText(input.taskId, 120),
    normalizeOptionalText(input.imageUrl, 1200),
    normalizeOptionalText(input.rawImageUrl, 1200),
    normalizeOptionalText(input.assetPath, 1200),
    normalizeText(input.status, 80),
    normalizeOptionalText(input.errorCode, 120),
    nowIso(),
    projectId,
    userEmail,
    outputType,
    pageIndex,
  ];
  if (hasManagedDatabase()) {
    await pgRun(sqlText, params);
    return;
  }
  const { db } = getDb();
  db.prepare(sqlText).run(...params);
}

export async function listWorkspaceProjectPages(input: {
  projectId: string;
  userEmail: string;
  outputType?: WorkspaceProjectPageOutputType | string | null;
}) {
  const projectId = normalizeText(input.projectId, 120);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const outputType = input.outputType ? normalizeOutputType(input.outputType) : null;
  if (!projectId || !userEmail) {
    return [] as WorkspaceProjectPageRow[];
  }
  if (hasManagedDatabase()) {
    const rows = outputType
      ? await pgAll(
          `SELECT * FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ? AND output_type = ?
           ORDER BY page_index ASC`,
          [projectId, userEmail, outputType],
        )
      : await pgAll(
          `SELECT * FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ?
           ORDER BY output_type ASC, page_index ASC`,
          [projectId, userEmail],
        );
    return rows.map(mapPageRow);
  }
  const { db } = getDb();
  const rows = (outputType
    ? db
        .prepare(
          `SELECT * FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ? AND output_type = ?
           ORDER BY page_index ASC`,
        )
        .all(projectId, userEmail, outputType)
    : db
        .prepare(
          `SELECT * FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ?
           ORDER BY output_type ASC, page_index ASC`,
        )
        .all(projectId, userEmail)) as Array<Record<string, unknown>>;
  return rows.map(mapPageRow);
}

export async function searchWorkspaceProjectSummaries(input: {
  projectId?: string | null;
  userEmail?: string | null;
  outputType?: WorkspaceProjectPageOutputType | string | null;
  limit?: number | null;
}) {
  const projectId = normalizeText(input.projectId, 120);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const outputType = input.outputType ? normalizeOutputType(input.outputType) : null;
  const limit = Math.max(1, Math.min(80, Math.round(Number(input.limit || 24))));
  if (!projectId && !userEmail) {
    return [] as WorkspaceProjectSummaryRow[];
  }

  const where: string[] = [];
  const params: Array<string | number> = [];
  if (projectId) {
    where.push("project_id = ?");
    params.push(projectId);
  }
  if (userEmail) {
    where.push("user_email = ?");
    params.push(userEmail);
  }
  if (outputType) {
    where.push("output_type = ?");
    params.push(outputType);
  }

  const sqlText = `SELECT
      project_id,
      user_email,
      output_type,
      COALESCE(
        MAX(NULLIF(CASE WHEN page_role = 'cover' THEN title ELSE '' END, '')),
        MAX(NULLIF(title, '')),
        project_id
      ) AS title,
      COUNT(*) AS page_count,
      SUM(CASE
        WHEN COALESCE(image_url, '') != ''
          OR COALESCE(raw_image_url, '') != ''
          OR COALESCE(image_task_id, '') != ''
        THEN 1 ELSE 0
      END) AS generated_asset_count,
      MIN(created_at) AS created_at,
      MAX(updated_at) AS updated_at
    FROM workspace_project_pages
    WHERE ${where.join(" AND ")}
    GROUP BY project_id, user_email, output_type
    ORDER BY MAX(updated_at) DESC, MIN(created_at) DESC
    LIMIT ?`;
  const queryParams = [...params, limit];
  const rows = hasManagedDatabase()
    ? await pgAll(sqlText, queryParams)
    : (getDb().db.prepare(sqlText).all(...queryParams) as Array<Record<string, unknown>>);
  return rows.map(mapProjectSummaryRow);
}

export async function findWorkspaceProjectOwner(input: {
  projectId: string;
  outputType?: WorkspaceProjectPageOutputType | string | null;
}) {
  const [summary] = await searchWorkspaceProjectSummaries({
    projectId: input.projectId,
    outputType: input.outputType,
    limit: 1,
  });
  return summary?.userEmail || "";
}

export async function getWorkspaceProjectCover(input: {
  projectId: string;
  userEmail: string;
  outputType?: WorkspaceProjectPageOutputType | string | null;
}) {
  const projectId = normalizeText(input.projectId, 120);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const outputType = input.outputType ? normalizeOutputType(input.outputType) : null;
  if (!projectId || !userEmail) {
    return "";
  }
  if (hasManagedDatabase()) {
    const row = outputType
      ? await pgGet(
          `SELECT image_url FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ? AND output_type = ? AND image_url IS NOT NULL AND image_url != ''
           ORDER BY
             CASE WHEN page_role = 'cover' THEN 0 ELSE 1 END ASC,
             page_index ASC,
             updated_at DESC
           LIMIT 1`,
          [projectId, userEmail, outputType],
        )
      : await pgGet(
          `SELECT image_url FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ? AND image_url IS NOT NULL AND image_url != ''
           ORDER BY
             CASE WHEN page_role = 'cover' THEN 0 ELSE 1 END ASC,
             page_index ASC,
             updated_at DESC
           LIMIT 1`,
          [projectId, userEmail],
        );
    return String(row?.image_url || "").trim();
  }
  const { db } = getDb();
  const row = (outputType
    ? db
        .prepare(
          `SELECT image_url FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ? AND output_type = ? AND image_url IS NOT NULL AND image_url != ''
           ORDER BY
             CASE WHEN page_role = 'cover' THEN 0 ELSE 1 END ASC,
             page_index ASC,
             updated_at DESC
           LIMIT 1`,
        )
        .get(projectId, userEmail, outputType)
    : db
        .prepare(
          `SELECT image_url FROM workspace_project_pages
           WHERE project_id = ? AND user_email = ? AND image_url IS NOT NULL AND image_url != ''
           ORDER BY
             CASE WHEN page_role = 'cover' THEN 0 ELSE 1 END ASC,
             page_index ASC,
             updated_at DESC
           LIMIT 1`,
        )
        .get(projectId, userEmail)) as { image_url?: string } | undefined;
  return (row?.image_url || "").trim();
}

export async function listWorkspaceProjectActivityByUser(userEmailInput: string) {
  const userEmail = normalizeText(userEmailInput, 240).toLowerCase();
  if (!userEmail) {
    return [] as WorkspaceProjectActivityRow[];
  }

  const sqlText = `SELECT project_id, output_type, title, updated_at, created_at
    FROM workspace_project_pages
    WHERE user_email = ?
    ORDER BY updated_at DESC, created_at DESC`;

  const rows = hasManagedDatabase()
    ? await pgAll(sqlText, [userEmail])
    : ((getDb().db.prepare(sqlText).all(userEmail) as Array<Record<string, unknown>>));

  const seenProjectIds = new Set<string>();
  const activities: WorkspaceProjectActivityRow[] = [];
  for (const row of rows) {
    const projectId = String(row.project_id || "").trim();
    if (!projectId || seenProjectIds.has(projectId)) {
      continue;
    }
    seenProjectIds.add(projectId);
    activities.push({
      projectId,
      outputType: normalizeOutputType(String(row.output_type || "")),
      title: String(row.title || "").trim(),
      updatedAt: String(row.updated_at || row.created_at || ""),
    });
  }

  return activities;
}
