import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");

function parseEnvFile(content) {
  const result = {};
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const eq = line.indexOf("=");
      if (eq <= 0) return;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    });
  return result;
}

function readEnv() {
  const fileVars = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, "utf8")) : {};
  return {
    ...fileVars,
    ...process.env,
  };
}

function extractImageUrl(data) {
  if (!data || typeof data !== "object") return "";
  const obj = data;

  if (Array.isArray(obj.output)) {
    for (const out of obj.output) {
      if (!out || typeof out !== "object") continue;
      const content = Array.isArray(out.content) ? out.content : [];
      for (const item of content) {
        const url = typeof item?.url === "string" ? item.url.trim() : "";
        if (url) return url;
      }
    }
  }

  if (Array.isArray(obj.data)) {
    for (const item of obj.data) {
      const url = typeof item?.url === "string" ? item.url.trim() : "";
      if (url) return url;
    }
  }

  if (typeof obj.image === "string" && obj.image.trim()) return obj.image.trim();
  if (Array.isArray(obj.image)) {
    const first = obj.image.find((item) => typeof item === "string" && item.trim());
    if (first) return first.trim();
  }

  const text = obj?.choices?.[0]?.message?.content;
  if (typeof text === "string" && /^https?:\/\//i.test(text.trim())) {
    return text.trim();
  }

  return "";
}

function shouldAttachSeedImage(endpoint) {
  return /\/images\/edits(?:$|\?)/i.test(endpoint);
}

function resolveGenerationsEndpoint(endpoint) {
  if (/\/images\/edits(?:$|\?)/i.test(endpoint)) {
    return endpoint.replace(/\/images\/edits(?=$|\?)/i, "/images/generations");
  }
  return endpoint;
}

const SEED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnM5m8AAAAASUVORK5CYII=";

async function runRouteSmoke(baseUrl) {
  const target = `${baseUrl.replace(/\/$/, "")}/api/workspace/image2-smoke`;
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`[IMAGE2_SMOKE_HTTP_ERROR] status=${response.status}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  if (data?.ok && typeof data?.imageUrl === "string" && data.imageUrl.trim()) {
    console.log(`[IMAGE2_SMOKE_OK] endpoint=${data.endpoint}`);
    console.log(`[IMAGE2_SMOKE_URL] ${data.imageUrl.trim()}`);
    return;
  }

  const code = data?.error?.code || "IMAGE2_SMOKE_FAILED";
  const message = data?.error?.message || "Unknown failure";
  const detail = data?.error?.detail || "";
  console.error(`[${code}] ${message}`);
  if (detail) {
    console.error(detail);
  }
  process.exit(1);
}

async function runDirectSmoke() {
  const env = readEnv();
  const endpoint = env.IMAGE2_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/generations";
  const apiKey = env.IMAGE2_PROVIDER_API_KEY || env.PAID_IMAGE_API_KEY || env.PAID_LLM_API_KEY || "";
  const model = env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";
  const size = "1024x1792";

  if (!apiKey) {
    console.error("[IMAGE2_API_KEY_MISSING] Missing IMAGE2 provider API key.");
    process.exit(1);
  }

  async function call(targetEndpoint) {
    if (shouldAttachSeedImage(targetEndpoint)) {
      const formData = new FormData();
      formData.append("model", model);
      const seedBuffer = Buffer.from(SEED_PNG_BASE64, "base64");
      formData.append("image", new File([seedBuffer], "seed.png", { type: "image/png" }));
      formData.append(
        "messages",
        JSON.stringify([
          {
            role: "user",
            content:
              "Create a clean science-style poster cover with a simple geometric focal object on a light background.",
          },
        ]),
      );
      formData.append("size", size);
      formData.append("quality", "standard");
      formData.append("n", "1");
      formData.append("response_format", "url");
      return fetch(targetEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    }

    return fetch(targetEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt:
          "Create a clean science-style poster cover with a simple geometric focal object on a light background.",
        size,
        quality: "standard",
        n: 1,
        response_format: "url",
      }),
    });
  }

  const primaryResponse = await call(endpoint);
  const primaryRawText = await primaryResponse.text();
  let primaryBody = null;
  try {
    primaryBody = primaryRawText ? JSON.parse(primaryRawText) : null;
  } catch {
    primaryBody = null;
  }

  if (primaryResponse.ok) {
    const imageUrl = extractImageUrl(primaryBody);
    if (imageUrl) {
      console.log(`[IMAGE2_SMOKE_OK] endpoint=${endpoint}`);
      console.log(`[IMAGE2_SMOKE_URL] ${imageUrl}`);
      return;
    }
  }

  const shouldTryGenerationsFallback =
    shouldAttachSeedImage(endpoint) &&
    resolveGenerationsEndpoint(endpoint) !== endpoint &&
    (primaryResponse.status >= 500 ||
      primaryBody?.error?.code === "json_marshal_failed" ||
      /image is required/i.test(primaryBody?.error?.message || ""));

  if (shouldTryGenerationsFallback) {
    const fallbackEndpoint = resolveGenerationsEndpoint(endpoint);
    const fallbackResponse = await call(fallbackEndpoint);
    const fallbackRawText = await fallbackResponse.text();
    let fallbackBody = null;
    try {
      fallbackBody = fallbackRawText ? JSON.parse(fallbackRawText) : null;
    } catch {
      fallbackBody = null;
    }
    if (fallbackResponse.ok) {
      const imageUrl = extractImageUrl(fallbackBody);
      if (imageUrl) {
        console.log(`[IMAGE2_SMOKE_OK] endpoint=${fallbackEndpoint}`);
        console.log(`[IMAGE2_SMOKE_URL] ${imageUrl}`);
        return;
      }
    }
    const providerCode = fallbackBody?.error?.code || `IMAGE2_HTTP_${fallbackResponse.status}`;
    const providerMessage = fallbackBody?.error?.message || "Image provider request failed.";
    console.error(`[${providerCode}] ${providerMessage}`);
    if (fallbackRawText) {
      console.error(fallbackRawText.slice(0, 500));
    }
    process.exit(1);
  }

  const providerCode = primaryBody?.error?.code || `IMAGE2_HTTP_${primaryResponse.status}`;
  const providerMessage = primaryBody?.error?.message || "Image provider request failed.";
  console.error(`[${providerCode}] ${providerMessage}`);
  if (primaryRawText) {
    console.error(primaryRawText.slice(0, 500));
  }
  process.exit(1);
}

async function main() {
  try {
    const mode = (process.env.IMAGE2_SMOKE_MODE || "direct").trim().toLowerCase();
    if (mode === "route") {
      const baseUrl = process.env.IMAGE2_SMOKE_BASE_URL || "http://localhost:3000";
      await runRouteSmoke(baseUrl);
      return;
    }
    await runDirectSmoke();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown smoke error";
    console.error(`[IMAGE2_SMOKE_FETCH_ERROR] ${message}`);
    process.exit(1);
  }
}

main();
