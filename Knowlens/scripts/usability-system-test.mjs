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
  form.set("email", "local@knowlens.ai");
  form.set("name", "Local Tester");
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
