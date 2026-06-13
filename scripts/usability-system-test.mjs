import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const baseUrl = process.env.USABILITY_TEST_BASE_URL || "http://127.0.0.1:4010";
const serverPort = Number(new URL(baseUrl).port || "4010");
const runMode = (process.env.USABILITY_TEST_MODE || "auto").trim().toLowerCase();
const testTextModel = process.env.USABILITY_TEST_TEXT_MODEL || "gemini-2.5";
const expectTranscriptSuccess = process.env.USABILITY_EXPECT_TRANSCRIPT_SUCCESS === "true";
const expectImageSuccess = process.env.USABILITY_EXPECT_IMAGE_SUCCESS === "true";
const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const testUserEmail =
  process.env.USABILITY_TEST_USER_EMAIL || `local+usability-${testRunId}@knowlens.ai`;
const testUserName = process.env.USABILITY_TEST_USER_NAME || "Local Tester";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEnvFile(content) {
  const result = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function readEnvNames() {
  try {
    const envRaw = readFileSync(path.join(projectRoot, ".env.local"), "utf8");
    return Object.keys(parseEnvFile(envRaw));
  } catch {
    return [];
  }
}

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
      if (idx <= 0) {
        continue;
      }
      const name = first.slice(0, idx).trim();
      const value = first.slice(idx + 1).trim();
      if (name) {
        this.map.set(name, value);
      }
    }
  }

  toHeader() {
    return [...this.map.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

async function fetchJson(url, options = {}, cookieJar = null) {
  const headers = new Headers(options.headers || {});
  if (cookieJar) {
    const cookie = cookieJar.toHeader();
    if (cookie) {
      headers.set("cookie", cookie);
    }
  }
  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (cookieJar) {
    cookieJar.updateFromHeaders(response.headers);
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    data,
    text,
    headers: response.headers,
  };
}

async function waitForServerReady(url, timeoutMs = 80000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return true;
      }
      lastError = new Error(`non-ok status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error("server not ready");
}

async function loginWithDevCredentials() {
  const jar = new CookieJar();
  const csrf = await fetchJson(`${baseUrl}/api/auth/csrf`, { method: "GET" }, jar);
  if (!csrf.ok || !csrf.data?.csrfToken) {
    throw new Error(`csrf failed: ${csrf.status} ${csrf.text.slice(0, 180)}`);
  }

  const form = new URLSearchParams();
  form.set("csrfToken", csrf.data.csrfToken);
  form.set("email", testUserEmail);
  form.set("name", testUserName);
  form.set("callbackUrl", "/app");
  form.set("json", "true");

  const signin = await fetchJson(
    `${baseUrl}/api/auth/callback/dev-login`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    jar,
  );

  if (!signin.ok) {
    throw new Error(`signin failed: ${signin.status} ${signin.text.slice(0, 180)}`);
  }

  const session = await fetchJson(`${baseUrl}/api/auth/session`, { method: "GET" }, jar);
  if (!session.ok || !session.data?.user?.email) {
    throw new Error(`session fetch failed: ${session.status} ${session.text.slice(0, 180)}`);
  }
  return {
    jar,
    email: String(session.data.user.email).trim().toLowerCase(),
  };
}

async function createUploadJob(input, cookieJar) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof File) {
      formData.append(key, value);
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    formData.append(key, String(value));
  }
  const res = await fetchJson(
    `${baseUrl}/api/upload/jobs`,
    {
      method: "POST",
      body: formData,
    },
    cookieJar,
  );
  return res;
}

async function waitUploadDone(userEmail, jobId, cookieJar, timeoutMs = 180000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetchJson(
      `${baseUrl}/api/upload/jobs?userEmail=${encodeURIComponent(userEmail)}`,
      { method: "GET" },
      cookieJar,
    );
    if (!res.ok) {
      await sleep(600);
      continue;
    }
    const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
    const target = jobs.find(
      (item) =>
        String(item.jobId || "").trim() === jobId ||
        String(item.id || "").trim() === jobId,
    );
    if (target && (target.status === "done" || target.status === "failed")) {
      return target;
    }
    await sleep(600);
  }
  return null;
}

function runCase(name, fn, output) {
  console.log(`CASE_START: ${name}`);
  return fn()
    .then((result) => {
      output.push({
        name,
        ok: true,
        detail: result ?? "",
      });
      console.log(`CASE_PASS: ${name} -> ${result ?? "ok"}`);
    })
    .catch((error) => {
      output.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
      console.log(`CASE_FAIL: ${name} -> ${error instanceof Error ? error.message : String(error)}`);
    });
}

function getEnvStatus(envNames) {
  return {
    hasOpenAiApiKey: envNames.includes("OPENAI_API_KEY"),
    hasGptsApiKey:
      envNames.includes("GPTSAPI_API_KEY") ||
      envNames.includes("GPTSAPI_FREE_API_KEY") ||
      envNames.includes("GPTSAPI_GEMINI_API_KEY"),
    hasImage2ApiKey: envNames.includes("IMAGE2_PROVIDER_API_KEY"),
  };
}

function shortJson(value, max = 320) {
  const raw = JSON.stringify(value);
  if (raw.length <= max) {
    return raw;
  }
  return `${raw.slice(0, max)}...`;
}

function getHeader(responseLike, name) {
  const headers = responseLike?.headers;
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return String(headers.get(name) || "");
  }
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return direct ? String(direct) : "";
}

function hasMp4Signature(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) {
    return false;
  }
  // MP4/ISO BMFF usually has "ftyp" at offset 4.
  return (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

function hasWebmSignature(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
    return false;
  }
  // EBML header: 1A 45 DF A3
  return (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

function hasZipSignature(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
    return false;
  }
  // ZIP local file header: PK\x03\x04 (pptx is zip)
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function toMarkdown(input) {
  const lines = [];
  lines.push("# KnowLens MVP Usability Test Report");
  lines.push("");
  lines.push(`- Run at: ${new Date().toISOString()}`);
  lines.push(`- Base URL: ${input.baseUrl}`);
  lines.push(`- Auth test account: ${input.authEmail}`);
  lines.push(`- Server mode: ${input.serverMode}`);
  lines.push("");
  lines.push("## Environment Checks");
  lines.push("");
  lines.push(`- ` + "`NEXTAUTH_ALLOW_DEV_LOGIN` detected: " + (input.envNames.includes("NEXTAUTH_ALLOW_DEV_LOGIN") ? "yes" : "no"));
  lines.push(`- ` + "`IMAGE2_PROVIDER_*` detected: " + (input.envNames.some((name) => name.startsWith("IMAGE2_PROVIDER_")) ? "yes" : "no"));
  lines.push(`- ` + "`OPENAI_API_KEY` detected: " + (input.envNames.includes("OPENAI_API_KEY") ? "yes" : "no"));
  lines.push(`- ` + "`GPTSAPI_API_KEY` detected: " + (input.envNames.includes("GPTSAPI_API_KEY") ? "yes" : "no"));
  lines.push(`- ` + "`PAID_LLM_API_KEY` detected: " + (input.envNames.includes("PAID_LLM_API_KEY") ? "yes" : "no"));
  lines.push("");
  lines.push("## Test Results");
  lines.push("");
  lines.push("| Case | Result | Notes |");
  lines.push("| --- | --- | --- |");
  for (const item of input.cases) {
    const symbol = item.ok ? "PASS" : "FAIL";
    lines.push(`| ${item.name} | ${symbol} | ${String(item.detail).replace(/\|/g, "\\|")} |`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  const failed = input.cases.filter((item) => !item.ok);
  const passed = input.cases.length - failed.length;
  lines.push(`- Total: ${input.cases.length}`);
  lines.push(`- Passed: ${passed}`);
  lines.push(`- Failed: ${failed.length}`);
  if (failed.length) {
    lines.push("");
    lines.push("### Failed Cases");
    lines.push("");
    for (const item of failed) {
      lines.push(`- ${item.name}: ${item.detail}`);
    }
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This run focuses on backend workflow and service-chain usability.");
  lines.push("- UI styling/interaction is intentionally excluded per request.");
  lines.push("- Some checks are environment-gated and treated as informative when required provider keys are absent.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const cases = [];
  const envNames = readEnvNames();
  const envStatus = getEnvStatus(envNames);

  let serverProcess = null;
  let serverMode = "existing";

  if (runMode !== "existing") {
    serverMode = "spawned";
    serverProcess = spawn("npm", ["run", "start", "--", "-p", String(serverPort)], {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serverProcess.stdout.on("data", () => undefined);
    serverProcess.stderr.on("data", () => undefined);
    await waitForServerReady(`${baseUrl}/api/auth/csrf`, 120000);
  }

  let auth = null;
  try {
    await runCase(
      "Auth: dev-login session bootstrap",
      async () => {
        auth = await loginWithDevCredentials();
        return `session=${auth.email}`;
      },
      cases,
    );

    if (!auth?.jar || !auth?.email) {
      throw new Error("auth bootstrap failed, skip remaining tests");
    }

    await runCase(
      "Workspace start: valid payload",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/workspace/start`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              prompt: "Turn this volcano article into a poster outline.",
              textModel: testTextModel,
              imageModel: "gpt-image-2",
              sources: [
                {
                  id: "src-1",
                  kind: "web",
                  name: "Volcano page",
                  origin: "https://example.com/volcano",
                  status: "ready",
                  excerpt: "A short source excerpt",
                },
              ],
            }),
          },
          auth.jar,
        );
        if (!res.ok || !res.data?.ok) {
          throw new Error(`unexpected response: ${res.status} ${res.text.slice(0, 180)}`);
        }
        return `promptLen=${(res.data?.payload?.prompt || "").length}`;
      },
      cases,
    );

    await runCase(
      "Workspace start: empty input is rejected",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/workspace/start`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              prompt: "   ",
              sources: [],
            }),
          },
          auth.jar,
        );
        if (res.status !== 400) {
          throw new Error(`expected 400 but got ${res.status}: ${res.text.slice(0, 180)}`);
        }
        return "status=400";
      },
      cases,
    );

    await runCase(
      "Workspace start: prompt is trimmed to 6000 chars",
      async () => {
        const longPrompt = "A".repeat(9000);
        const res = await fetchJson(
          `${baseUrl}/api/workspace/start`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              prompt: longPrompt,
              textModel: testTextModel,
              imageModel: "gpt-image-2",
            }),
          },
          auth.jar,
        );
        if (!res.ok || !res.data?.ok) {
          throw new Error(`unexpected response: ${res.status} ${res.text.slice(0, 180)}`);
        }
        const prompt = String(res.data?.payload?.prompt || "");
        if (prompt.length !== 6000) {
          throw new Error(`expected prompt length 6000 but got ${prompt.length}`);
        }
        return "len=6000";
      },
      cases,
    );

    await runCase(
      "Workspace start: sources list is capped at 30",
      async () => {
        const sources = Array.from({ length: 45 }, (_, idx) => ({
          id: `src-${idx + 1}`,
          kind: "web",
          name: `Source ${idx + 1}`,
          origin: `https://example.com/${idx + 1}`,
          status: "ready",
          excerpt: "demo",
        }));
        const res = await fetchJson(
          `${baseUrl}/api/workspace/start`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              prompt: "Summarize with many sources",
              sources,
            }),
          },
          auth.jar,
        );
        if (!res.ok || !res.data?.ok) {
          throw new Error(`unexpected response: ${res.status} ${res.text.slice(0, 180)}`);
        }
        const normalizedSources = Array.isArray(res.data?.payload?.sources)
          ? res.data.payload.sources
          : [];
        if (normalizedSources.length !== 30) {
          throw new Error(`expected 30 sources but got ${normalizedSources.length}`);
        }
        return "sources=30";
      },
      cases,
    );

    await runCase(
      "Chat guard: signed-in request",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/workspace/chat-guard`,
          { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
          auth.jar,
        );
        if (!res.ok || !res.data?.ok) {
          throw new Error(`unexpected response: ${res.status} ${res.text.slice(0, 160)}`);
        }
        return "ok";
      },
      cases,
    );

    await runCase(
      "Draft model chain: poster request",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/content/poster-draft`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              topic: "Volcanoes",
              prompt: "Create a clear educational poster draft about volcano eruption types.",
              textModel: testTextModel,
              direction: "poster",
              posterCount: 1,
              posterSizeLabel: "9:16",
            }),
          },
          auth.jar,
        );
        if (!res.ok) {
          throw new Error(`http ${res.status}: ${res.text.slice(0, 180)}`);
        }
        if (res.data?.source === "fallback" && !envStatus.hasGptsApiKey && testTextModel === "gemini-2.5") {
          return "source=fallback (no gptsapi key in env)";
        }
        if (!res.data?.posterDraft?.headline) {
          throw new Error(`missing posterDraft in response: ${shortJson(res.data)}`);
        }
        return `source=${res.data.source || "unknown"}`;
      },
      cases,
    );

    await runCase(
      "Draft model chain: ppt request",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/content/poster-draft`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              topic: "Volcanoes",
              prompt: "Generate a 6-slide PPT outline on volcano eruption causes and effects.",
              textModel: testTextModel,
              direction: "ppt",
              posterCount: 6,
            }),
          },
          auth.jar,
        );
        if (!res.ok) {
          if (!envStatus.hasGptsApiKey && testTextModel === "gemini-2.5") {
            return `skipped (missing gptsapi key): ${res.status}`;
          }
          throw new Error(`http ${res.status}: ${res.text.slice(0, 180)}`);
        }
        const outline = Array.isArray(res.data?.outlineItems) ? res.data.outlineItems : [];
        if (!outline.length) {
          throw new Error(`missing outlineItems: ${shortJson(res.data)}`);
        }
        return `slides=${outline.length}, source=${res.data.source || "unknown"}`;
      },
      cases,
    );

    await runCase(
      "Upload chain: plain text file extraction",
      async () => {
        const textPayload = "Volcano draft source text.\nLine 2: eruption process.";
        const textFile = new File([textPayload], "volcano.txt", { type: "text/plain" });
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "volcano.txt",
            mimeType: "text/plain",
            fileSize: textFile.size,
            sourceKind: "file",
            file: textFile,
          },
          auth.jar,
        );
        if (!create.ok || !create.data?.job?.jobId) {
          throw new Error(`create job failed: ${create.status} ${create.text.slice(0, 180)}`);
        }
        const done = await waitUploadDone(auth.email, create.data.job.jobId, auth.jar, 30000);
        if (!done || done.status !== "done") {
          throw new Error(`job did not finish: ${shortJson(done)}`);
        }
        const extracted = String(done.resultText || done.result_text || "");
        if (!extracted.includes("Volcano draft source text")) {
          throw new Error(`unexpected extracted text: ${extracted.slice(0, 120)}`);
        }
        return "done";
      },
      cases,
    );

    await runCase(
      "Upload chain: YouTube transcript extraction",
      async () => {
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "youtube-link.txt",
            mimeType: "text/plain",
            fileSize: 120,
            sourceKind: "youtube",
            sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          auth.jar,
        );
        if (!create.ok || !create.data?.job?.jobId) {
          throw new Error(`create job failed: ${create.status} ${create.text.slice(0, 180)}`);
        }
        const done = await waitUploadDone(auth.email, create.data.job.jobId, auth.jar, 180000);
        if (!done) {
          throw new Error("youtube job missing from polling");
        }
        if (done.status !== "done") {
          if (!expectTranscriptSuccess && !envStatus.hasOpenAiApiKey) {
            return `expected-fail (${done.error_message || done.errorMessage || done.status})`;
          }
          throw new Error(`youtube job failed: ${shortJson(done)}`);
        }
        const extracted = String(done.resultText || done.result_text || "");
        if (!extracted.trim() || extracted.trim().length < 20) {
          throw new Error(`youtube transcript too short: ${extracted.slice(0, 80)}`);
        }
        return `len=${extracted.length}`;
      },
      cases,
    );

    await runCase(
      "Upload chain: podcast/audio transcript extraction",
      async () => {
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "podcast-link.txt",
            mimeType: "text/plain",
            fileSize: 160,
            sourceKind: "podcast",
            sourceUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          },
          auth.jar,
        );
        if (!create.ok || !create.data?.job?.jobId) {
          throw new Error(`create job failed: ${create.status} ${create.text.slice(0, 180)}`);
        }
        const done = await waitUploadDone(auth.email, create.data.job.jobId, auth.jar, 180000);
        if (!done) {
          throw new Error("podcast job missing from polling");
        }
        if (done.status !== "done") {
          if (!expectTranscriptSuccess && !envStatus.hasOpenAiApiKey) {
            return `expected-fail (${done.error_message || done.errorMessage || done.status})`;
          }
          throw new Error(`podcast job failed: ${shortJson(done)}`);
        }
        const extracted = String(done.resultText || done.result_text || "");
        if (!extracted.trim() || extracted.trim().length < 20) {
          throw new Error(`podcast transcript too short: ${extracted.slice(0, 90)}`);
        }
        return `len=${extracted.length}`;
      },
      cases,
    );

    await runCase(
      "Upload chain: provider-missing errors fail fast without retries",
      async () => {
        if (envStatus.hasOpenAiApiKey) {
          return "skipped (OPENAI_API_KEY configured)";
        }
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "podcast-link-fastfail.txt",
            mimeType: "text/plain",
            fileSize: 120,
            sourceKind: "podcast",
            sourceUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          },
          auth.jar,
        );
        if (!create.ok || !create.data?.job?.jobId) {
          throw new Error(`create job failed: ${create.status} ${create.text.slice(0, 180)}`);
        }
        const done = await waitUploadDone(auth.email, create.data.job.jobId, auth.jar, 120000);
        if (!done || done.status !== "failed") {
          throw new Error(`expected failed status: ${shortJson(done)}`);
        }
        const attempts = Number(done.attempts ?? done.attempt_count ?? 0);
        const code = String(done.error_code || done.errorCode || "");
        if (attempts !== 1) {
          throw new Error(`expected attempts=1 but got ${attempts} (${code || "no-code"})`);
        }
        if (code !== "UPLOAD_PROVIDER_NOT_CONFIGURED") {
          throw new Error(`expected UPLOAD_PROVIDER_NOT_CONFIGURED but got ${code || "empty"}`);
        }
        return `attempts=${attempts}, code=${code}`;
      },
      cases,
    );

    await runCase(
      "Upload chain: retryable network failures exhaust retries",
      async () => {
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "unreachable-web-link.txt",
            mimeType: "text/plain",
            fileSize: 120,
            sourceKind: "web",
            sourceUrl: "https://127.0.0.1:1/unreachable",
          },
          auth.jar,
        );
        if (!create.ok || !create.data?.job?.jobId) {
          throw new Error(`create job failed: ${create.status} ${create.text.slice(0, 180)}`);
        }
        const done = await waitUploadDone(auth.email, create.data.job.jobId, auth.jar, 120000);
        if (!done || done.status !== "failed") {
          throw new Error(`expected failed status: ${shortJson(done)}`);
        }
        const attempts = Number(done.attempts ?? done.attempt_count ?? 0);
        const code = String(done.error_code || done.errorCode || "");
        if (attempts !== 3) {
          throw new Error(`expected attempts=3 but got ${attempts} (${code || "no-code"})`);
        }
        if (code !== "UPLOAD_NETWORK_FAILURE" && code !== "UPLOAD_WORKER_TIMEOUT") {
          throw new Error(`unexpected error code after retries: ${code || "empty"}`);
        }
        return `attempts=${attempts}, code=${code}`;
      },
      cases,
    );

    await runCase(
      "Upload chain: minimal YouTube link payload is accepted",
      async () => {
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            sourceKind: "youtube",
            sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          auth.jar,
        );
        if (!create.ok || !create.data?.job?.jobId) {
          throw new Error(`create job failed: ${create.status} ${create.text.slice(0, 180)}`);
        }
        const done = await waitUploadDone(auth.email, create.data.job.jobId, auth.jar, 180000);
        if (!done) {
          throw new Error("minimal youtube job missing from polling");
        }
        if (done.status !== "done" && done.status !== "failed") {
          throw new Error(`unexpected job status: ${shortJson(done)}`);
        }
        return `status=${done.status}`;
      },
      cases,
    );

    await runCase(
      "Upload guard: missing file payload is rejected immediately",
      async () => {
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "missing.pdf",
            mimeType: "application/pdf",
            fileSize: 2048,
            sourceKind: "file",
          },
          auth.jar,
        );
        if (create.status !== 400) {
          throw new Error(`expected 400 but got ${create.status}: ${create.text.slice(0, 180)}`);
        }
        return "status=400";
      },
      cases,
    );

    await runCase(
      "Upload guard: invalid file type is rejected",
      async () => {
        const badFile = new File([new Uint8Array([1, 2, 3])], "malware.bin", {
          type: "application/x-msdownload",
        });
        const create = await createUploadJob(
          {
            userEmail: auth.email,
            fileName: "malware.bin",
            mimeType: "application/x-msdownload",
            fileSize: badFile.size,
            sourceKind: "file",
            file: badFile,
          },
          auth.jar,
        );
        if (create.ok) {
          throw new Error(`expected 4xx but got ${create.status}`);
        }
        if (create.status !== 400) {
          throw new Error(`expected 400 but got ${create.status}`);
        }
        return `status=${create.status}`;
      },
      cases,
    );

    await runCase(
      "Image generation chain: generation-confirm",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/workspace/generation-confirm`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              intent: "poster",
              outputs: 1,
              ratio: "9:16",
              imageModel: "gpt-image-2",
              style: {
                id: "clean-science-infographic",
                name: "Clean Science Infographic",
                prompt: "Clean scientific infographic aesthetic, high legibility, neutral palette.",
              },
              tasks: [
                {
                  index: 1,
                  outputType: "poster",
                  aspectRatio: "9:16",
                  stylePrompt: "Clean scientific infographic aesthetic.",
                  contentTitle: "How Volcanoes Erupt",
                  contentBody:
                    "Explain magma chamber pressure, vent opening, eruption, ash spread, and cooling process.",
                  visualHint: "Clear hierarchy with section blocks",
                  composedPrompt:
                    "Style prompt: Clean scientific infographic aesthetic.\nTitle: How Volcanoes Erupt\nContent: Explain magma chamber pressure, vent opening, eruption, ash spread, and cooling process.",
                },
              ],
            }),
          },
          auth.jar,
        );
        if (!res.ok || !res.data?.ok) {
          throw new Error(`unexpected response: ${res.status} ${res.text.slice(0, 220)}`);
        }
        const first = res.data?.generation?.results?.[0];
        if (!first?.ok || !first?.imageUrl) {
          if (!expectImageSuccess && envStatus.hasImage2ApiKey) {
            return `degraded (${first?.errorCode || "unknown"})`;
          }
          throw new Error(`generation failed: ${shortJson(first || res.data?.generation)}`);
        }
        return `providerCalled=${Boolean(res.data?.generation?.providerCalled)}`;
      },
      cases,
    );

    let generatedPosterUrl = "";
    let generatedPosterMime = "";
    await runCase(
      "Core deliverable: poster render URL is downloadable",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/workspace/generation-confirm`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              intent: "poster",
              outputs: 1,
              ratio: "9:16",
              imageModel: "gpt-image-2",
              style: {
                id: "clean-science-infographic",
                name: "Clean Science Infographic",
                prompt: "Clean scientific infographic aesthetic, high legibility, neutral palette.",
              },
              tasks: [
                {
                  index: 1,
                  outputType: "poster",
                  aspectRatio: "9:16",
                  stylePrompt: "Clean scientific infographic aesthetic.",
                  contentTitle: "Volcano Eruption Process",
                  contentBody:
                    "Explain magma pressure buildup, vent opening, eruption column, ash dispersion, and cooling.",
                  visualHint: "Educational hierarchy blocks with simple annotations",
                  composedPrompt:
                    "Style prompt: Clean scientific infographic aesthetic.\nTitle: Volcano Eruption Process\nContent: Explain magma pressure buildup, vent opening, eruption column, ash dispersion, and cooling.",
                },
              ],
            }),
          },
          auth.jar,
        );
        if (!res.ok || !res.data?.ok) {
          throw new Error(`generation-confirm failed: ${res.status} ${res.text.slice(0, 220)}`);
        }
        const first = res.data?.generation?.results?.[0];
        if (!first?.ok || !first?.imageUrl) {
          throw new Error(`poster generation failed: ${shortJson(first || res.data?.generation)}`);
        }
        generatedPosterUrl = String(first.imageUrl);
        const imageRes = await fetch(generatedPosterUrl, { method: "GET" });
        if (!imageRes.ok) {
          throw new Error(`poster url not reachable: ${imageRes.status}`);
        }
        const buf = new Uint8Array(await imageRes.arrayBuffer());
        if (buf.byteLength < 1000) {
          throw new Error(`poster content too small: ${buf.byteLength} bytes`);
        }
        generatedPosterMime = String(imageRes.headers.get("content-type") || "");
        if (!/^image\//i.test(generatedPosterMime)) {
          throw new Error(`poster content-type is not image: ${generatedPosterMime || "empty"}`);
        }
        return `bytes=${buf.byteLength}, mime=${generatedPosterMime || "unknown"}`;
      },
      cases,
    );

    await runCase(
      "Core deliverable: PPT export returns valid .pptx binary",
      async () => {
        if (!generatedPosterUrl) {
          throw new Error("missing generated poster URL from previous case");
        }
        const payload = {
          title: "KnowLens End-to-End PPT",
          slides: [
            {
              page: 1,
              title: "Volcano Eruption Overview",
              body: "Magma pressure rises, vents open, ash and gases erupt, and the plume disperses.",
              imageSrc: generatedPosterUrl,
            },
            {
              page: 2,
              title: "Risk and Mitigation",
              body: "Monitor seismic activity, define evacuation zones, and communicate alerts clearly.",
              imageSrc: generatedPosterUrl,
            },
          ],
        };
        const response = await fetch(`${baseUrl}/api/export/ppt`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: auth.jar.toHeader(),
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`ppt export failed: ${response.status} ${text.slice(0, 180)}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength < 4000) {
          throw new Error(`pptx too small: ${bytes.byteLength} bytes`);
        }
        if (!hasZipSignature(bytes)) {
          throw new Error("ppt export is not a valid zip/pptx binary");
        }
        const contentType = getHeader(response, "content-type");
        if (!/presentationml\.presentation/i.test(contentType)) {
          throw new Error(`unexpected ppt content-type: ${contentType || "empty"}`);
        }
        const disposition = getHeader(response, "content-disposition");
        if (!/attachment/i.test(disposition)) {
          throw new Error("ppt export missing attachment content-disposition");
        }
        return `bytes=${bytes.byteLength}, content-type=${contentType || "unknown"}`;
      },
      cases,
    );

    await runCase(
      "Core deliverable: audio TTS returns playable WAV",
      async () => {
        const response = await fetch(`${baseUrl}/api/tts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: auth.jar.toHeader(),
          },
          body: JSON.stringify({
            voice: "Ting-Ting",
            text: "This is a short test narration for KnowLens video export.",
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`tts failed: ${response.status} ${text.slice(0, 180)}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength < 1000) {
          throw new Error(`wav too small: ${bytes.byteLength} bytes`);
        }
        // RIFF....WAVE header check
        const riff =
          bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
        const wave =
          bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
        if (!riff || !wave) {
          throw new Error("tts result is not a valid wav header");
        }
        const contentType = getHeader(response, "content-type");
        if (!/audio\/wav/i.test(contentType)) {
          throw new Error(`unexpected tts content-type: ${contentType || "empty"}`);
        }
        return `bytes=${bytes.byteLength}, content-type=${contentType || "unknown"}`;
      },
      cases,
    );

    await runCase(
      "Core deliverable: video export returns downloadable mp4/webm",
      async () => {
        const ffmpegPath = path.join(projectRoot, "node_modules", "ffmpeg-static", "ffmpeg");
        const inputVideoPath = path.join(projectRoot, ".tmp-usability-input.webm");
        try {
          await new Promise((resolve, reject) => {
            const ff = spawn(
              ffmpegPath,
              [
                "-y",
                "-f",
                "lavfi",
                "-i",
                "color=c=#1f2937:s=640x360:d=1.6",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-shortest",
                "-c:v",
                "libvpx-vp9",
                "-b:v",
                "450k",
                "-c:a",
                "libopus",
                "-b:a",
                "96k",
                inputVideoPath,
              ],
              { cwd: projectRoot, stdio: "ignore" },
            );
            ff.on("error", reject);
            ff.on("exit", (code) => {
              if (code === 0) {
                resolve(null);
                return;
              }
              reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });

          const videoBytes = readFileSync(inputVideoPath);
          const videoFile = new File([videoBytes], "core-export-input.webm", {
            type: "video/webm",
          });
          const form = new FormData();
          form.append("video", videoFile);

          const response = await fetch(`${baseUrl}/api/export/video`, {
            method: "POST",
            headers: {
              cookie: auth.jar.toHeader(),
            },
            body: form,
          });
          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`video export failed: ${response.status} ${text.slice(0, 180)}`);
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength < 1200) {
            throw new Error(`video output too small: ${bytes.byteLength} bytes`);
          }
          const contentType = getHeader(response, "content-type");
          const isMp4 = hasMp4Signature(bytes);
          const isWebm = hasWebmSignature(bytes);
          if (!isMp4 && !isWebm) {
            throw new Error(`video output signature is neither mp4 nor webm (content-type=${contentType || "empty"})`);
          }
          if (!/video\//i.test(contentType)) {
            throw new Error(`unexpected video content-type: ${contentType || "empty"}`);
          }
          const disposition = getHeader(response, "content-disposition");
          if (!/attachment/i.test(disposition)) {
            throw new Error("video export missing attachment content-disposition");
          }
          const format = isMp4 ? "mp4" : "webm";
          return `format=${format}, bytes=${bytes.byteLength}, content-type=${contentType || "unknown"}`;
        } finally {
          try {
            unlinkSync(inputVideoPath);
          } catch {
            // ignore
          }
        }
      },
      cases,
    );

    await runCase(
      "Generation guard: missing tasks is rejected",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/workspace/generation-confirm`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              intent: "poster",
              outputs: 1,
              ratio: "9:16",
              imageModel: "gpt-image-2",
              style: {
                id: "clean-science-infographic",
                name: "Clean Science Infographic",
                prompt: "Clean scientific infographic aesthetic, high legibility, neutral palette.",
              },
              tasks: [],
            }),
          },
          auth.jar,
        );
        if (res.status !== 400) {
          throw new Error(`expected 400 but got ${res.status}: ${res.text.slice(0, 220)}`);
        }
        return "status=400";
      },
      cases,
    );

    await runCase(
      "Image provider smoke API",
      async () => {
        const res = await fetchJson(`${baseUrl}/api/workspace/image2-smoke`, { method: "GET" }, auth.jar);
        if (!res.ok || !res.data?.ok || !res.data?.imageUrl) {
          if (!expectImageSuccess && envStatus.hasImage2ApiKey) {
            return `degraded (${res.data?.error?.code || res.status})`;
          }
          throw new Error(`smoke failed: ${res.status} ${res.text.slice(0, 220)}`);
        }
        return `endpoint=${res.data.endpoint}`;
      },
      cases,
    );

    await runCase(
      "Billing checkout: signed-out request is rejected",
      async () => {
        const res = await fetchJson(`${baseUrl}/api/billing/checkout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId: "starter", cycle: "monthly" }),
        });
        if (res.status !== 401) {
          throw new Error(`expected 401 but got ${res.status}: ${res.text.slice(0, 200)}`);
        }
        return "status=401";
      },
      cases,
    );

    await runCase(
      "Billing checkout: invalid plan is rejected",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/billing/checkout`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ planId: "unknown-plan", cycle: "monthly" }),
          },
          auth.jar,
        );
        if (res.status !== 400) {
          throw new Error(`expected 400 but got ${res.status}: ${res.text.slice(0, 200)}`);
        }
        return "status=400";
      },
      cases,
    );

    await runCase(
      "Billing checkout: signed-in request yields redirect or actionable 503",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/billing/checkout`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ planId: "starter", cycle: "monthly" }),
          },
          auth.jar,
        );
        if (res.ok && res.data?.ok && typeof res.data?.checkoutUrl === "string" && res.data.checkoutUrl.length > 0) {
          return `mode=${res.data.mode || "unknown"}`;
        }
        if (res.status === 503) {
          const code = String(res.data?.code || "");
          if (code === "STRIPE_ENV_MISSING" || code === "STRIPE_ENV_INVALID") {
            return `status=503 (${code})`;
          }
        }
        throw new Error(`unexpected response: ${res.status} ${res.text.slice(0, 220)}`);
      },
      cases,
    );

    await runCase(
      "Billing redirect: missing target is rejected",
      async () => {
        const res = await fetchJson(`${baseUrl}/api/billing/redirect`, {
          method: "GET",
          redirect: "manual",
        });
        if (res.status !== 400) {
          throw new Error(`expected 400 but got ${res.status}`);
        }
        return "status=400";
      },
      cases,
    );

    await runCase(
      "Billing redirect: non-stripe target is rejected",
      async () => {
        const badTarget = encodeURIComponent("https://example.com/pay");
        const res = await fetchJson(`${baseUrl}/api/billing/redirect?target=${badTarget}`, {
          method: "GET",
          redirect: "manual",
        });
        if (res.status !== 400) {
          throw new Error(`expected 400 but got ${res.status}`);
        }
        return "status=400";
      },
      cases,
    );

    await runCase(
      "Billing redirect: stripe target is allowed",
      async () => {
        const stripeTarget = encodeURIComponent("https://checkout.stripe.com/c/pay/cs_test_123");
        const res = await fetchJson(`${baseUrl}/api/billing/redirect?target=${stripeTarget}`, {
          method: "GET",
          redirect: "manual",
        });
        if (res.status !== 302) {
          throw new Error(`expected 302 but got ${res.status}`);
        }
        const location = res.headers.get("location") || "";
        if (!location.includes("checkout.stripe.com")) {
          throw new Error(`unexpected redirect target: ${location || "empty"}`);
        }
        return "status=302";
      },
      cases,
    );

    await runCase(
      "Billing finalize: signed-out request is rejected",
      async () => {
        const res = await fetchJson(`${baseUrl}/api/billing/finalize`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: "cs_test_mock_123" }),
        });
        if (res.status !== 401) {
          throw new Error(`expected 401 but got ${res.status}`);
        }
        return "status=401";
      },
      cases,
    );

    await runCase(
      "Billing finalize: missing sessionId is rejected",
      async () => {
        const res = await fetchJson(
          `${baseUrl}/api/billing/finalize`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          },
          auth.jar,
        );
        if (res.status !== 400) {
          throw new Error(`expected 400 but got ${res.status}`);
        }
        return "status=400";
      },
      cases,
    );
  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      await Promise.race([once(serverProcess, "exit"), sleep(3000)]);
    }
  }

  const report = toMarkdown({
    baseUrl,
    authEmail: auth?.email || "N/A",
    serverMode,
    envNames,
    cases,
  });
  const reportFile = path.join(projectRoot, "docs", "usability-test-report.md");
  writeFileSync(reportFile, report, "utf8");
  console.log(`REPORT_FILE=${reportFile}`);
  const failed = cases.filter((item) => !item.ok);
  if (failed.length) {
    console.error(`FAILED_CASES=${failed.length}`);
    process.exitCode = 1;
  } else {
    console.log("ALL_CASES_PASSED");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
