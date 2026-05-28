import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const baseUrl = process.env.PIXFUN_TEST_BASE_URL || "http://127.0.0.1:3000";
const testEmail = (process.env.PIXFUN_TEST_EMAIL || "pixfunai@gmail.com").trim().toLowerCase();
const testName = process.env.PIXFUN_TEST_NAME || "Pixfun QA";
const targetCredits = Number.parseInt(process.env.PIXFUN_TEST_CREDITS || "3000", 10);
const outputDir = path.join(process.cwd(), "public", "test-output");
const reportId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class CookieJar {
  constructor() {
    this.map = new Map();
  }

  updateFromHeaders(headers) {
    const setCookies =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : headers.get("set-cookie")
          ? [headers.get("set-cookie")]
          : [];
    for (const line of setCookies) {
      const first = String(line || "").split(";")[0];
      const idx = first.indexOf("=");
      if (idx <= 0) continue;
      const name = first.slice(0, idx).trim();
      const value = first.slice(idx + 1).trim();
      if (name) this.map.set(name, value);
    }
  }

  toHeader() {
    return [...this.map.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}, jar = null) {
  const headers = new Headers(options.headers || {});
  if (jar) {
    const cookie = jar.toHeader();
    if (cookie) headers.set("cookie", cookie);
  }
  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (jar) {
    jar.updateFromHeaders(response.headers);
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data, text, headers: response.headers };
}

async function fetchBuffer(url, options = {}, jar = null) {
  const headers = new Headers(options.headers || {});
  if (jar) {
    const cookie = jar.toHeader();
    if (cookie) headers.set("cookie", cookie);
  }
  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (jar) {
    jar.updateFromHeaders(response.headers);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { ok: response.ok, status: response.status, bytes, headers: response.headers };
}

async function loginAsDevUser(email, name) {
  const jar = new CookieJar();
  const csrf = await fetchJson(`${baseUrl}/api/auth/csrf`, { method: "GET" }, jar);
  if (!csrf.ok || !csrf.data?.csrfToken) {
    throw new Error(`csrf failed: ${csrf.status} ${csrf.text.slice(0, 200)}`);
  }

  const form = new URLSearchParams();
  form.set("csrfToken", csrf.data.csrfToken);
  form.set("email", email);
  form.set("name", name);
  form.set("callbackUrl", "/app");
  form.set("json", "true");

  const signin = await fetchJson(
    `${baseUrl}/api/auth/callback/dev-login`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
    jar,
  );
  if (!signin.ok) {
    throw new Error(`dev-login failed: ${signin.status} ${signin.text.slice(0, 200)}`);
  }

  const session = await fetchJson(`${baseUrl}/api/auth/session`, { method: "GET" }, jar);
  if (!session.ok || !session.data?.user?.email) {
    throw new Error(`session failed: ${session.status} ${session.text.slice(0, 200)}`);
  }
  return {
    jar,
    user: {
      email: String(session.data.user.email).trim().toLowerCase(),
      name: String(session.data.user.name || name),
    },
  };
}

function getDbPath() {
  if (process.env.KNOWLENS_DB_PATH?.trim()) {
    return process.env.KNOWLENS_DB_PATH.trim();
  }
  return path.join(os.homedir(), ".knowlens", "shared", "knowlens.sqlite");
}

function ensureUserAndCredits(email, name, targetBalance) {
  const dbPath = getDbPath();
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();

  const userRow = db
    .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .get(email) ?? null;
  const userId = userRow?.id || `u-${randomUUID()}`;

  db.prepare(
    `INSERT INTO users (id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, 'user', ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at`,
  ).run(userId, email, name, now, now);

  const latestBalanceRow = db
    .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .get(email) ?? null;
  const currentBalance = Number.isFinite(latestBalanceRow?.balance) ? Number(latestBalanceRow.balance) : 80;
  const delta = targetBalance - currentBalance;

  if (delta !== 0) {
    const recordId = `record-${randomUUID()}`;
    db.prepare(
      `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, null, null)`,
    ).run(
      recordId,
      now,
      delta > 0 ? "topup" : "consume",
      `QA baseline balance set to ${targetBalance} credits`,
      delta,
      targetBalance,
      userId,
      email,
    );
  }

  return {
    userId,
    balanceBefore: currentBalance,
    balanceAfter: targetBalance,
  };
}

function insertProjectAndConsume(email, userId, input) {
  const db = new DatabaseSync(getDbPath());
  const now = new Date().toISOString();
  const projectId = `p-qa-${randomUUID()}`;
  db.prepare(
    `INSERT INTO projects (id, user_id, title, status, format, duration, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    projectId,
    userId,
    input.title,
    input.status || "Completed",
    input.format || null,
    input.duration || null,
    now,
    now,
  );

  const latestBalanceRow = db
    .prepare("SELECT balance FROM credit_records WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .get(email) ?? null;
  const currentBalance = Number.isFinite(latestBalanceRow?.balance) ? Number(latestBalanceRow.balance) : 80;
  const delta = -Math.abs(Number(input.consumeCredits || 0));
  const nextBalance = currentBalance + delta;
  if (delta !== 0) {
    db.prepare(
      `INSERT INTO credit_records (id, created_at, type, description, delta, balance, user_id, user_email, project_id, project_title)
       VALUES (?, ?, 'consume', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `record-${randomUUID()}`,
      now,
      input.consumeDesc || `${input.title} generation`,
      delta,
      nextBalance,
      userId,
      email,
      projectId,
      input.title,
    );
  }

  return {
    projectId,
    balanceAfter: delta !== 0 ? nextBalance : currentBalance,
  };
}

async function pollUploadJob(jobId, userEmail, jar, timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const jobsRes = await fetchJson(
      `${baseUrl}/api/upload/jobs?userEmail=${encodeURIComponent(userEmail)}`,
      { method: "GET" },
      jar,
    );
    if (!jobsRes.ok || !Array.isArray(jobsRes.data?.jobs)) {
      await sleep(1200);
      continue;
    }
    const job = jobsRes.data.jobs.find((item) => item.id === jobId);
    if (!job) {
      await sleep(1200);
      continue;
    }
    const status = String(job.status || "").toLowerCase();
    if (status === "done" || status === "failed") {
      return job;
    }
    await sleep(1600);
  }
  throw new Error(`upload job timeout: ${jobId}`);
}

function normalizePosterDraft(posterDraft, fallbackTopic) {
  const headline = String(posterDraft?.headline || `Visual Guide: ${fallbackTopic}`).trim();
  const subtitle = String(posterDraft?.subtitle || "Key structure and takeaways").trim();
  const body = String(posterDraft?.body || "Clear explanation with concise educational wording.").trim();
  return { headline, subtitle, body };
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const auth = await loginAsDevUser(testEmail, testName);
  const creditSetup = ensureUserAndCredits(testEmail, auth.user.name, targetCredits);

  const textPrompt = "Explain volcanic eruptions for students in a clear visual structure.";
  const startText = await fetchJson(
    `${baseUrl}/api/workspace/start`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: textPrompt,
        textModel: "gemini-2.5",
        imageModel: "gpt-image2",
        sources: [],
      }),
    },
    auth.jar,
  );
  if (!startText.ok || !startText.data?.ok) {
    throw new Error(`workspace/start(text) failed: ${startText.status} ${startText.text.slice(0, 180)}`);
  }

  const posterDraftRes = await fetchJson(
    `${baseUrl}/api/content/poster-draft`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "Volcanic Eruption Basics",
        prompt: textPrompt,
        textModel: "gemini-2.5",
        draftMode: "mock",
        direction: "poster",
        posterCount: 1,
        posterSizeLabel: "9:16",
      }),
    },
    auth.jar,
  );
  if (!posterDraftRes.ok || !posterDraftRes.data?.posterDraft) {
    throw new Error(`poster-draft failed: ${posterDraftRes.status} ${posterDraftRes.text.slice(0, 220)}`);
  }
  const posterDraft = normalizePosterDraft(posterDraftRes.data.posterDraft, "Volcanic Eruption Basics");

  const posterGen = await fetchJson(
    `${baseUrl}/api/workspace/generation-confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intent: "poster",
        outputs: 1,
        ratio: "9:16",
        imageModel: "gpt-image2",
        style: { id: "qa-clean", name: "Clean Science Infographic Style" },
        tasks: [
          {
            index: 1,
            outputType: "poster",
            aspectRatio: "9:16",
            stylePrompt: "Clean science infographic style.",
            contentTitle: posterDraft.headline,
            contentBody: `${posterDraft.subtitle}\n${posterDraft.body}`,
            visualHint: "Single clear focal composition.",
          },
        ],
      }),
    },
    auth.jar,
  );
  if (!posterGen.ok || !posterGen.data?.ok) {
    throw new Error(`generation-confirm(poster) failed: ${posterGen.status} ${posterGen.text.slice(0, 220)}`);
  }
  const posterImageUrl = String(posterGen.data?.generation?.results?.[0]?.imageUrl || "").trim();
  if (!posterImageUrl) {
    throw new Error(`generation-confirm(poster) returned no image URL: ${posterGen.text.slice(0, 220)}`);
  }

  const fileContent = `Photosynthesis converts light energy into chemical energy.
Key stages: light absorption, electron transport, ATP/NADPH production, carbon fixation.`;
  const file = new File([fileContent], `qa-input-${reportId}.txt`, { type: "text/plain" });
  const fileForm = new FormData();
  fileForm.append("userEmail", testEmail);
  fileForm.append("fileName", file.name);
  fileForm.append("mimeType", file.type);
  fileForm.append("fileSize", String(file.size));
  fileForm.append("sourceKind", "file");
  fileForm.append("file", file);

  const fileUpload = await fetchJson(
    `${baseUrl}/api/upload/jobs`,
    {
      method: "POST",
      body: fileForm,
    },
    auth.jar,
  );
  if (!fileUpload.ok || !fileUpload.data?.job?.jobId) {
    throw new Error(`upload(file) failed: ${fileUpload.status} ${fileUpload.text.slice(0, 200)}`);
  }
  const fileJob = await pollUploadJob(fileUpload.data.job.jobId, testEmail, auth.jar);

  const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const youtubeUpload = await fetchJson(
    `${baseUrl}/api/upload/jobs`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userEmail: testEmail,
        fileName: "youtube-link.txt",
        mimeType: "text/plain",
        fileSize: youtubeUrl.length,
        sourceKind: "youtube",
        sourceUrl: youtubeUrl,
      }),
    },
    auth.jar,
  );
  if (!youtubeUpload.ok || !youtubeUpload.data?.job?.jobId) {
    throw new Error(`upload(youtube) failed: ${youtubeUpload.status} ${youtubeUpload.text.slice(0, 200)}`);
  }
  const youtubeJob = await pollUploadJob(youtubeUpload.data.job.jobId, testEmail, auth.jar);

  const slides = [
    {
      title: "What Is Photosynthesis?",
      body: "Photosynthesis converts sunlight, water, and carbon dioxide into glucose and oxygen.",
      mainPoint: "Energy conversion in plants",
      visual: "Simple sunlight-leaf-energy flow",
    },
    {
      title: "Why It Matters",
      body: "It supports food chains, releases oxygen, and stores solar energy in biomass.",
      mainPoint: "Foundation of ecosystems",
      visual: "Ecosystem cycle and oxygen release",
    },
  ];

  const pptTasks = slides.map((slide, index) => ({
    index: index + 1,
    outputType: "ppt",
    aspectRatio: "16:9",
    stylePrompt: "Premium editorial infographic style.",
    contentTitle: String(slide.title || `Slide ${index + 1}`),
    contentBody: String(slide.body || slide.mainPoint || "Key educational explanation."),
    visualHint: String(slide.visual || "Clean instructional visual structure."),
  }));

  const pptGen = await fetchJson(
    `${baseUrl}/api/workspace/generation-confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intent: "ppt",
        outputs: pptTasks.length,
        ratio: "16:9",
        imageModel: "gpt-image2",
        style: { id: "qa-editorial", name: "Premium Editorial Infographic Style" },
        tasks: pptTasks,
      }),
    },
    auth.jar,
  );
  if (!pptGen.ok || !pptGen.data?.ok) {
    throw new Error(`generation-confirm(ppt) failed: ${pptGen.status} ${pptGen.text.slice(0, 220)}`);
  }
  const pptImageUrls = (pptGen.data?.generation?.results || [])
    .filter((item) => item?.ok && typeof item?.imageUrl === "string")
    .map((item) => item.imageUrl);
  if (pptImageUrls.length < 1) {
    throw new Error("generation-confirm(ppt) returned no successful image URLs");
  }

  const pptSlidesPayload = pptImageUrls.map((url, index) => ({
    page: index + 1,
    title: String(slides[index]?.title || `Slide ${index + 1}`),
    body: String(slides[index]?.body || slides[index]?.mainPoint || "Educational explanation."),
    imageSrc: url,
  }));

  const pptExport = await fetchBuffer(
    `${baseUrl}/api/export/ppt`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `KnowLens QA PPT ${reportId}`,
        slides: pptSlidesPayload,
      }),
    },
    auth.jar,
  );
  if (!pptExport.ok) {
    throw new Error(`export/ppt failed: ${pptExport.status}`);
  }
  const pptFilename = `qa-${reportId}.pptx`;
  const pptPath = path.join(outputDir, pptFilename);
  writeFileSync(pptPath, pptExport.bytes);
  const pptUrl = `${baseUrl}/test-output/${pptFilename}`;

  const textProject = insertProjectAndConsume(testEmail, creditSetup.userId, {
    title: `QA Text Project · ${new Date().toISOString()}`,
    format: "海报",
    status: "已完成",
    consumeCredits: 7,
    consumeDesc: "QA text prompt poster generation",
  });
  const fileProject = insertProjectAndConsume(testEmail, creditSetup.userId, {
    title: `QA File Project · ${new Date().toISOString()}`,
    format: "PPT",
    status: "已完成",
    consumeCredits: 13,
    consumeDesc: "QA file source PPT generation",
  });
  const youtubeProject = insertProjectAndConsume(testEmail, creditSetup.userId, {
    title: `QA YouTube Project · ${new Date().toISOString()}`,
    format: "视频",
    status: "进行中",
    duration: "00:48",
    consumeCredits: 6,
    consumeDesc: "QA YouTube source processing and storyboard check",
  });

  const summary = {
    ok: true,
    runId: reportId,
    testedUser: testEmail,
    credits: {
      before: creditSetup.balanceBefore,
      initializedTo: creditSetup.balanceAfter,
      afterFlows: youtubeProject.balanceAfter,
    },
    urls: {
      posterImageUrl,
      pptUrl,
      pptImageUrls,
    },
    uploadJobs: {
      file: {
        jobId: fileUpload.data.job.jobId,
        status: fileJob.status,
        excerpt: fileJob.result_excerpt || fileJob.resultExcerpt || fileJob.error_message || fileJob.errorMessage || "",
      },
      youtube: {
        jobId: youtubeUpload.data.job.jobId,
        status: youtubeJob.status,
        excerpt:
          youtubeJob.result_excerpt ||
          youtubeJob.resultExcerpt ||
          youtubeJob.error_message ||
          youtubeJob.errorMessage ||
          "",
        errorCode: youtubeJob.error_code || youtubeJob.errorCode || null,
      },
    },
    projects: [
      {
        id: textProject.projectId,
        title: "QA Text Project",
        format: "Poster",
      },
      {
        id: fileProject.projectId,
        title: "QA File Project",
        format: "PPT",
      },
      {
        id: youtubeProject.projectId,
        title: "QA YouTube Project",
        format: "Video",
      },
    ],
  };

  const jsonFilename = `qa-summary-${reportId}.json`;
  const jsonPath = path.join(outputDir, jsonFilename);
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  const summaryUrl = `${baseUrl}/test-output/${jsonFilename}`;

  console.log(`[QA_SUMMARY_URL] ${summaryUrl}`);
  console.log(`[QA_POSTER_URL] ${posterImageUrl}`);
  console.log(`[QA_PPT_URL] ${pptUrl}`);
  console.log(`[QA_USER] ${testEmail}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[QA_TEST_FAILED] ${message}`);
  process.exit(1);
});
