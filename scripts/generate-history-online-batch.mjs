import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const baseUrl = (process.env.KNOWLENS_BATCH_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const batchUserEmail = (process.env.KNOWLENS_BATCH_USER_EMAIL || "local-dev@knowlens.ai").trim().toLowerCase();
const batchUserName = process.env.KNOWLENS_BATCH_USER_NAME || "KnowLens History Batch";
const providerPolicy = process.env.KNOWLENS_BATCH_PROVIDER_POLICY || "tuzi,duomi,gptsapi";
const concurrency = Math.max(1, Math.min(5, Number.parseInt(process.env.KNOWLENS_BATCH_CONCURRENCY || "5", 10) || 5));
const pollDelayMs = Math.max(3000, Number.parseInt(process.env.KNOWLENS_BATCH_POLL_DELAY_MS || "8000", 10) || 8000);
const jobTimeoutMs = Math.max(180000, Number.parseInt(process.env.KNOWLENS_BATCH_JOB_TIMEOUT_MS || "900000", 10) || 900000);
const reportDir = path.join(process.cwd(), "runtime-logs", "batch-reports");
const batchId = `history-online-${Date.now()}`;

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
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

const styles = [
  ["clean-science-infographic", "Premium Infographic", "Use the KnowLens Premium Infographic style with a warm editorial paper feel, elegant serif headline, clean sans body text, and polished educational hierarchy."],
  ["youtube-science-thumbnail", "Tech Dashboard", "Use the KnowLens Tech Dashboard style with a dark interface look, luminous contrast, compact metric framing, and clear high-impact labels."],
  ["cinematic-science-illustration", "Black Gold Tech", "Use the KnowLens Black Gold Tech style with matte black surfaces, gold-accented structure lines, premium contrast, and disciplined visual hierarchy."],
  ["minimal-line-art", "Isometric 3D", "Use the KnowLens Isometric 3D style with crisp spatial objects, soft shadows, clean geometry, and readable technical callouts."],
  ["hand-drawn-explainer", "Blueprint Diagram", "Use the KnowLens Blueprint Diagram style with deep blueprint tones, schematic lines, precise arrows, and structured engineering clarity."],
  ["cute-3d-educational", "Medical Illustration", "Use the KnowLens Medical Illustration style with clinical clarity, smooth educational illustration, soft gradients, and highly readable labels."],
  ["3d-isometric-tech", "Cinematic Science", "Use the KnowLens Cinematic Science style with documentary lighting, realistic texture, restrained science drama, and clean explanatory structure."],
  ["dark-premium-tech", "Dark Tech", "Use the KnowLens Dark Tech style with premium dark surfaces, cool white text, electric cyan accents, and polished digital precision."],
  ["technical-blueprint", "Minimal Flat", "Use the KnowLens Minimal Flat style with clean white space, flat vector forms, simple geometry, low noise, and large readable labels."],
  ["medical-educational-illustration", "Notebook Science", "Use the KnowLens Notebook Science style with warm paper texture, neat hand-drawn notes, subtle annotation marks, and organized study-page hierarchy."],
  ["premium-editorial-infographic", "Sketchnote", "Use the KnowLens Sketchnote style with hand-drawn marker headings, structured doodle icons, circled keywords, and a clean whiteboard learning feel."],
  ["premium-sketchnote-science", "Soft 3D", "Use the KnowLens Soft 3D style with rounded educational objects, gentle lighting, soft materials, and friendly high-readability composition."],
];

const topics = [
  ["Ancient Egypt Civilization Online History Infographic", "civilization overview", "premium-editorial-infographic", "Nile geography, pharaohs, pyramids, writing, religion, and long-term legacy for online history learning.", ["nile river", "pharaohs", "beliefs", "legacy"]],
  ["Ancient Greece Democracy Online History Infographic", "historical significance framework", "clean-science-infographic", "Explain how the polis, assembly, citizenship, debate, exclusion, and legacy shaped early democracy.", ["polis", "assembly", "citizenship", "legacy"]],
  ["Roman Empire Timeline Online History Infographic", "timeline infographic", "dark-premium-tech", "Organize expansion, imperial rule, major turning points, and decline in a clear Roman timeline.", ["republic to empire", "expansion", "turning points", "decline"]],
  ["Silk Road Trade Routes Online History Infographic", "trade route map", "hand-drawn-explainer", "Show trade routes, goods, cities, cultural exchange, and why the Silk Road mattered globally.", ["routes", "goods", "cities", "exchange"]],
  ["Medieval Feudalism System Online History Infographic", "system diagram", "technical-blueprint", "Map lords, vassals, land, obligations, peasants, military service, and social hierarchy in one system view.", ["lords", "vassals", "land", "obligations"]],
  ["Viking Exploration Online History Infographic", "people and places map", "minimal-line-art", "Explain Viking routes, ships, settlements, trade, raiding, and exploration across regions.", ["routes", "ships", "settlements", "impact"]],
  ["Black Death Causes and Impact Online History Infographic", "cause and effect map", "dark-premium-tech", "Trace disease spread, transmission context, mortality, labor change, and long-term historical effects.", ["spread", "mortality", "labor change", "social impact"]],
  ["Renaissance Ideas Online History Infographic", "historical significance framework", "clean-science-infographic", "Explain humanism, art, learning revival, patrons, print culture, and cultural change in Europe.", ["humanism", "art", "learning", "cultural change"]],
  ["Printing Press Revolution Online History Infographic", "invention impact map", "premium-editorial-infographic", "Show movable type, faster copying, literacy growth, religious debate, and knowledge circulation.", ["movable type", "book production", "literacy", "knowledge flow"]],
  ["Age of Exploration Online History Infographic", "event sequence infographic", "3d-isometric-tech", "Organize motives, voyages, navigation, encounters, empire building, and global consequences.", ["motives", "voyages", "navigation", "consequences"]],
  ["Columbian Exchange Online History Infographic", "before and after comparison", "minimal-line-art", "Compare crops, animals, disease, labor systems, and environmental change across continents.", ["crops", "disease", "labor", "environment"]],
  ["Scientific Revolution Online History Infographic", "turning point analysis", "youtube-science-thumbnail", "Explain observation, experimentation, major thinkers, new models of nature, and why knowledge changed.", ["observation", "experiments", "thinkers", "new worldview"]],
  ["Enlightenment Ideas Online History Infographic", "movement anatomy", "premium-sketchnote-science", "Map reason, rights, social contract, public debate, reform, and political influence.", ["reason", "rights", "social contract", "influence"]],
  ["American Revolution Timeline Online History Infographic", "timeline infographic", "dark-premium-tech", "Show colonial tensions, protests, war milestones, independence, and political outcomes.", ["tensions", "war", "independence", "outcomes"]],
  ["French Revolution Causes Online History Infographic", "conflict causes breakdown", "youtube-science-thumbnail", "Explain inequality, debt, food crisis, political conflict, revolutionary turning points, and results.", ["inequality", "debt", "crisis", "turning points"]],
  ["Industrial Revolution Online History Infographic", "historical significance framework", "technical-blueprint", "Connect mechanization, factories, cities, labor, transport, and global industrial change.", ["machines", "factories", "cities", "labor"]],
  ["Steam Engine Impact Online History Infographic", "invention impact map", "technical-blueprint", "Show how steam power changed mining, factories, railways, productivity, and movement.", ["steam power", "mining", "railways", "productivity"]],
  ["Transatlantic Slave Trade Online History Infographic", "cause and effect map", "clean-science-infographic", "Explain routes, forced migration, plantation economies, resistance, and long-term human consequences in a neutral educational tone.", ["routes", "forced migration", "economy", "long-term impact"]],
  ["American Civil War Causes Online History Infographic", "conflict causes breakdown", "dark-premium-tech", "Clarify slavery, federal-state tensions, sectional economies, secession, and war outbreak.", ["slavery", "sectional divide", "secession", "war outbreak"]],
  ["Women Suffrage Movement Online History Infographic", "movement anatomy", "premium-sketchnote-science", "Show demands, organizers, protest methods, legal change, and democratic significance.", ["demands", "organizers", "campaigns", "voting rights"]],
  ["World War I Causes Online History Infographic", "conflict causes breakdown", "cinematic-science-illustration", "Explain alliances, militarism, imperial rivalry, assassination, escalation, and wartime consequences.", ["alliances", "militarism", "assassination", "escalation"]],
  ["Treaty of Versailles Online History Infographic", "turning point analysis", "clean-science-infographic", "Organize treaty terms, reparations, territorial shifts, political resentment, and later impact.", ["terms", "reparations", "territory", "impact"]],
  ["Great Depression Online History Infographic", "cause and effect map", "youtube-science-thumbnail", "Trace market collapse, banking failure, unemployment, policy response, and global significance.", ["market crash", "banks", "unemployment", "policy response"]],
  ["World War II Timeline Online History Infographic", "timeline infographic", "cinematic-science-illustration", "Show major fronts, alliances, turning points, civilian impact, and war outcome with neutral educational framing.", ["alliances", "fronts", "turning points", "outcome"]],
  ["D-Day Normandy Landings Online History Infographic", "event sequence infographic", "3d-isometric-tech", "Explain planning, landing beaches, logistics, assault sequence, and strategic significance.", ["planning", "beaches", "logistics", "significance"]],
  ["United Nations Formation Online History Infographic", "historical significance framework", "clean-science-infographic", "Show wartime context, founding aims, charter principles, member cooperation, and global legacy.", ["wartime context", "founding aims", "charter", "legacy"]],
  ["Cold War Timeline Online History Infographic", "timeline infographic", "dark-premium-tech", "Map blocs, containment, proxy conflict, nuclear tension, détente, and the end of the Cold War.", ["blocs", "containment", "nuclear tension", "ending"]],
  ["Space Race Online History Infographic", "turning point analysis", "3d-isometric-tech", "Explain rivalry, satellites, moon missions, prestige, technology transfer, and global imagination.", ["rivalry", "satellites", "moon mission", "legacy"]],
  ["Civil Rights Movement Online History Infographic", "movement anatomy", "premium-sketchnote-science", "Show segregation context, organizers, nonviolent protest, legal victories, and continuing influence.", ["segregation", "organizers", "protest", "legal change"]],
  ["History of the Internet Online History Infographic", "legacy and influence map", "minimal-line-art", "Connect research networks, protocols, web growth, communication change, and social impact.", ["arpanet", "protocols", "web growth", "social impact"]],
];

const styleById = new Map(styles.map(([id, name, prompt]) => [id, { id, name, prompt }]));
const finalStatuses = new Set(["asset_ready", "failed", "timed_out", "billing_failed"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDbPath() {
  return process.env.KNOWLENS_DB_PATH?.trim() || path.join(os.homedir(), ".knowlens", "shared", "knowlens.sqlite");
}

function ensureUserAndProject(projectId, title) {
  const db = new DatabaseSync(getDbPath());
  const now = new Date().toISOString();
  const userRow = db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").get(batchUserEmail);
  const userId = userRow?.id || `u-${randomUUID()}`;
  db.prepare(
    `INSERT INTO users (id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, 'user', ?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
  ).run(userId, batchUserEmail, batchUserName, now, now);
  db.prepare(
    `INSERT OR REPLACE INTO projects (id, user_id, title, status, format, duration, updated_at, created_at)
     VALUES (?, ?, ?, '进行中', 'poster', null, ?, COALESCE((SELECT created_at FROM projects WHERE id = ?), ?))`,
  ).run(projectId, userId, title.slice(0, 120), now, projectId, now);
  db.close();
}

async function fetchJson(url, options = {}, jar = null) {
  const headers = new Headers(options.headers || {});
  if (jar) {
    const cookie = jar.toHeader();
    if (cookie) headers.set("cookie", cookie);
  }
  const response = await fetch(url, { ...options, headers });
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
  return { ok: response.ok, status: response.status, data, text };
}

async function loginAsDevUser() {
  const jar = new CookieJar();
  const csrf = await fetchJson(`${baseUrl}/api/auth/csrf`, { method: "GET" }, jar);
  if (!csrf.ok || !csrf.data?.csrfToken) {
    throw new Error(`csrf failed: ${csrf.status} ${csrf.text.slice(0, 160)}`);
  }
  const form = new URLSearchParams();
  form.set("csrfToken", csrf.data.csrfToken);
  form.set("email", batchUserEmail);
  form.set("name", batchUserName);
  form.set("callbackUrl", "/app");
  form.set("json", "true");
  const signin = await fetchJson(
    `${baseUrl}/api/auth/callback/dev-login`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() },
    jar,
  );
  if (!signin.ok) {
    throw new Error(`dev-login failed: ${signin.status} ${signin.text.slice(0, 160)}`);
  }
  return jar;
}

async function postWithOptionalAuth(pathname, payload, auth) {
  const doPost = (jar) =>
    fetchJson(
      `${baseUrl}${pathname}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
      jar,
    );
  let response = await doPost(auth.jar);
  if (response.status === 401 && !auth.jar) {
    auth.jar = await loginAsDevUser();
    response = await doPost(auth.jar);
  }
  return response;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function buildTask(topicRow, style) {
  const [topic, structureType, , summary, labels] = topicRow;
  const shortTitle = topic.replace(/\s+Online History Infographic$/i, "").trim();
  return {
    index: 1,
    outputType: "poster",
    aspectRatio: "9:16",
    stylePrompt: style.prompt,
    contentTitle: shortTitle,
    contentBody: `${summary} Structure type: ${structureType}. Keep the tone neutral, respectful, historically accurate, and clearly organized for online learning, student review, classroom teaching, and educational sharing.`,
    visibleText: {
      title: shortTitle,
      subtitle: "Online History Infographic",
      labels,
    },
    visualDesign: {
      layout: `${structureType} with one dominant hero visual and 4-6 concise learning sections`,
      mainVisual: `History online infographic about ${shortTitle}`,
      composition: "Large readable title, clear section hierarchy, mobile-first spacing, no dense microtext",
      textDensity: "medium",
      pageRole: "cover",
    },
    textStrategy: {
      mode: "guided",
      titleIdea: `${shortTitle} Online History Infographic`,
      keyConcepts: labels,
      language: "English",
      density: "medium",
      allowRewrite: true,
    },
    factualRules: [
      `Focus only on ${topic}.`,
      "Do not invent dates, names, places, or causal claims.",
      "Use an educational history-infographic structure, not a generic poster.",
    ],
    negativeRules: [
      "No propaganda tone",
      "No glorified violence",
      "No fantasy elements",
      "No unreadable tiny labels",
      "No dense paragraphs",
      "No fake archival quotations",
    ],
    visualHint: "Create a professional history online learning infographic suitable for mobile viewing with fewer, larger text blocks and strong visual hierarchy.",
  };
}

async function prepareAndActivate(topicRow, auth) {
  const [topic, structureType, styleId, summary] = topicRow;
  const style = styleById.get(styleId) || styleById.get("clean-science-infographic");
  const projectId = `p-history-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runId = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const idempotencyKey = `${batchId}:${slugify(topic)}`;
  ensureUserAndProject(projectId, topic);
  const preparePayload = {
    action: "prepare",
    projectId,
    projectTraceId: batchId,
    intent: "poster",
    normalizedDirection: "poster",
    normalizedCount: 1,
    normalizedRatio: "9:16",
    ratio: "9:16",
    imageModel: "gpt-image2",
    imageModelPolicy: providerPolicy,
    idempotencyKey,
    runId,
    style: { id: style.id, name: style.name, prompt: style.prompt },
    clientContext: {
      entrySource: "codex-history-batch",
      currentRoute: "/app?intent=generate",
      flowStage: "backend-batch",
      isNewProject: true,
      generationDirection: "poster",
      styleId: style.id,
      styleName: style.name,
      requestedCount: 1,
      taskCount: 1,
      inputType: "topic-list",
    },
    tasks: [buildTask(topicRow, style)],
  };
  const prepared = await postWithOptionalAuth("/api/workspace/image/generate-batch", preparePayload, auth);
  if (!prepared.ok || !prepared.data?.job?.id) {
    throw new Error(`prepare failed for "${topic}": ${prepared.status} ${prepared.text.slice(0, 220)}`);
  }
  const activatePayload = {
    action: "activate",
    jobId: prepared.data.job.id,
    projectId,
    projectTraceId: batchId,
    runId,
    intent: "poster",
    clientContext: { flowStage: "backend-batch-activate", styleName: style.name, structureType, summary },
  };
  const activated = await postWithOptionalAuth("/api/workspace/image/generate-batch", activatePayload, auth);
  if (!activated.ok || !activated.data?.job?.id) {
    throw new Error(`activate failed for "${topic}": ${activated.status} ${activated.text.slice(0, 220)}`);
  }
  return {
    topic,
    projectId,
    jobId: activated.data.job.id,
    runId,
    styleName: style.name,
    startedAt: Date.now(),
    workspaceUrl: `${baseUrl}/workspace?projectId=${encodeURIComponent(projectId)}`,
    lastStatus: activated.data.tasks?.[0]?.status || activated.data.job?.status || "queued",
  };
}

async function tickJob(job, auth) {
  const response = await postWithOptionalAuth("/api/workspace/image/tasks/run", { jobId: job.jobId }, auth);
  if (!response.ok || !response.data?.tasks?.length) {
    throw new Error(`tasks-run failed for "${job.topic}": ${response.status} ${response.text.slice(0, 220)}`);
  }
  const task = response.data.tasks[0];
  job.lastStatus = task.status || response.data.job?.status || job.lastStatus;
  job.renderUrl = task.renderUrl || task.imageUrl || job.renderUrl;
  job.error = task.error || response.data.error || null;
  job.terminal = finalStatuses.has(job.lastStatus);
  job.succeeded = job.lastStatus === "asset_ready";
  return job;
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const auth = { jar: null };
  const pending = [...topics];
  const active = [];
  const finished = [];

  while (pending.length > 0 || active.length > 0) {
    while (pending.length > 0 && active.length < concurrency) {
      const nextTopic = pending.shift();
      try {
        const job = await prepareAndActivate(nextTopic, auth);
        active.push(job);
        console.log(`started ${job.topic} | ${job.styleName} | ${job.workspaceUrl}`);
      } catch (error) {
        finished.push({
          topic: nextTopic[0],
          styleName: styleById.get(nextTopic[2])?.name || nextTopic[2],
          status: "failed_to_start",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (let index = active.length - 1; index >= 0; index -= 1) {
      const job = active[index];
      if (Date.now() - job.startedAt > jobTimeoutMs) {
        finished.push({ ...job, status: "timed_out", error: "job timeout" });
        active.splice(index, 1);
        continue;
      }
      try {
        await tickJob(job, auth);
        console.log(`progress ${job.topic} | ${job.lastStatus}`);
        if (job.terminal) {
          finished.push({ ...job, status: job.lastStatus });
          active.splice(index, 1);
        }
      } catch (error) {
        finished.push({
          ...job,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        active.splice(index, 1);
      }
      await sleep(1200);
    }

    if (active.length > 0) {
      await sleep(pollDelayMs);
    }
  }

  const report = {
    ok: true,
    batchId,
    baseUrl,
    batchUserEmail,
    providerPolicy,
    concurrency,
    totals: {
      requested: topics.length,
      succeeded: finished.filter((item) => item.status === "asset_ready").length,
      failed: finished.filter((item) => item.status !== "asset_ready").length,
    },
    items: finished,
    sampleWorkspaceLinks: finished.filter((item) => item.workspaceUrl).slice(0, 8).map((item) => item.workspaceUrl),
  };

  const reportPath = path.join(reportDir, `${batchId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`report ${reportPath}`);
  console.log(JSON.stringify(report.totals));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
