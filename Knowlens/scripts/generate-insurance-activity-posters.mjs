import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activityTemplates } from "../src/lib/insurance-activity-templates.js";
import { buildInsurancePosterPrompt, createInsuranceTemplateFormState } from "../src/lib/insurance-poster-prompt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "insurance", "posters");
const manifestPath = path.join(outputDir, "huodong-generation-manifest.json");
const styleSourcePath = path.join(projectRoot, "src", "app", "insurance", "InsuranceTemplateGallery.tsx");
const providerTimeoutMs = Number.parseInt(process.env.INSURANCE_ACTIVITY_IMAGE_TIMEOUT_MS || "360000", 10);
const forceRegenerate = process.argv.includes("--force");
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const onlyImageSrc = onlyArg ? onlyArg.slice("--only=".length).trim() : "";

const sizeByRatio = {
  "1:1": "1024x1024",
  "16:9": "1536x864",
  "9:16": "864x1536",
  "4:3": "1344x1008",
  "3:4": "1008x1344",
};

const styleByImageSrc = {
  "huodong-01": "professional-blue",
  "huodong-02": "storybook-kids",
  "huodong-03": "handdrawn-care",
  "huodong-04": "data-explainer",
  "huodong-05": "medical-fresh",
  "huodong-06": "watercolor-story",
  "huodong-07": "light-luxury",
  "huodong-08": "premium-business",
  "huodong-09": "flat-illustration",
  "huodong-10": "black-gold",
};

function extractInsuranceStyles() {
  const source = readFileSync(styleSourcePath, "utf8");
  const marker = "const insuranceStyleOptions";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error("Cannot find insuranceStyleOptions.");
  }
  const arrayStart = source.indexOf("[", start);
  const arrayEnd = source.indexOf("\n];", arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) {
    throw new Error("Cannot parse insuranceStyleOptions array.");
  }
  const literal = source.slice(arrayStart, arrayEnd + 2);
  const styles = Function(`"use strict"; return (${literal});`)();
  return Object.fromEntries(styles.map((style) => [style.id, style]));
}

const insuranceStyles = extractInsuranceStyles();

function buildPromptWithInsuranceStyle(template) {
  const styleKey = Object.entries(styleByImageSrc).find(([needle]) => template.imageSrc.includes(needle))?.[1];
  const style = styleKey ? insuranceStyles[styleKey] : null;
  if (!style) {
    return buildInsurancePosterPrompt(template, template.primaryCategory);
  }
  return buildInsurancePosterPrompt(template, template.primaryCategory, {
    ...createInsuranceTemplateFormState(template),
    styleName: style.name,
    stylePrompt: style.prompt,
  });
}

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
  const envPath = path.join(projectRoot, ".env.local");
  const fileVars = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, "utf8")) : {};
  return {
    ...fileVars,
    ...process.env,
  };
}

function resolveGenerationsEndpoint(endpoint) {
  if (/\/images\/edits(?:$|\?)/i.test(endpoint)) {
    return endpoint.replace(/\/images\/edits(?=$|\?)/i, "/images/generations");
  }
  return endpoint;
}

function readNestedUrl(candidate) {
  if (!candidate) return "";
  if (typeof candidate === "string") return candidate.trim();
  if (typeof candidate !== "object") return "";
  return typeof candidate.url === "string" ? candidate.url.trim() : "";
}

function parseImageUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  const data = Array.isArray(payload.data) ? payload.data : [];
  if (data.length) {
    const url = readNestedUrl(data[0]);
    if (url) return url;
  }
  const images = Array.isArray(payload.images) ? payload.images : [];
  if (images.length) {
    const url = readNestedUrl(images[0]);
    if (url) return url;
  }
  if (typeof payload.url === "string" && payload.url.trim()) return payload.url.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  if (output.length) {
    const url = readNestedUrl(output[0]);
    if (url) return url;
  }
  if (payload.result && typeof payload.result === "object") {
    const url = readNestedUrl(payload.result);
    if (url) return url;
  }
  return "";
}

async function generateImage({ endpoint, apiKey, model, prompt, size }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);
  const response = await fetch(endpoint, {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality: "standard",
      n: 1,
      response_format: "url",
    }),
  }).finally(() => clearTimeout(timeout));
  const rawText = await response.text();
  let body = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body?.error?.message || rawText.slice(0, 500) || `HTTP ${response.status}`;
    throw new Error(message);
  }
  const imageUrl = parseImageUrl(body);
  if (!imageUrl) {
    throw new Error("Image provider response did not include an image URL.");
  }
  return { imageUrl };
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url, { headers: { Accept: "image/*" } });
  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!/^image\//i.test(contentType)) {
    throw new Error(`download returned non-image content type: ${contentType || "unknown"}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 10_000) {
    throw new Error(`downloaded image is unexpectedly small: ${buffer.byteLength} bytes`);
  }
  writeFileSync(outputPath, buffer);
  return { bytes: buffer.byteLength, contentType };
}

async function main() {
  const env = readEnv();
  const endpoint = resolveGenerationsEndpoint(
    env.IMAGE2_TUZI_PROVIDER_ENDPOINT || env.IMAGE2_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/generations",
  );
  const apiKey = env.IMAGE2_TUZI_PROVIDER_API_KEY || env.IMAGE2_PROVIDER_API_KEY || env.PAID_IMAGE_API_KEY || env.PAID_LLM_API_KEY || "";
  const model = env.IMAGE2_TUZI_PROVIDER_MODEL || env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";
  if (!apiKey) {
    throw new Error("Missing IMAGE2 provider API key.");
  }

  mkdirSync(outputDir, { recursive: true });
  const results = [];
  const failures = [];
  for (const template of activityTemplates) {
    if (onlyImageSrc && !template.imageSrc.includes(onlyImageSrc)) {
      continue;
    }
    const outputPath = path.join(projectRoot, "public", template.imageSrc.replace(/^\//, ""));
    const aspectRatio = template.aspectRatio || "9:16";
    const size = sizeByRatio[aspectRatio];
    if (!size) {
      throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
    }
    if (!forceRegenerate && existsSync(outputPath)) {
      const bytes = readFileSync(outputPath).byteLength;
      results.push({
        title: template.title,
        imageSrc: template.imageSrc,
        aspectRatio,
        size,
        bytes,
        contentType: "image/png",
        skipped: true,
      });
      process.stdout.write(`[skip] ${template.imageSrc} exists bytes=${bytes}\n`);
      continue;
    }
    const prompt = buildPromptWithInsuranceStyle(template);
    try {
      process.stdout.write(`[generate] ${template.imageSrc} ${aspectRatio} ${size}\n`);
      const generated = await generateImage({ endpoint, apiKey, model, prompt, size });
      const saved = await downloadImage(generated.imageUrl, outputPath);
      results.push({
        title: template.title,
        imageSrc: template.imageSrc,
        aspectRatio,
        size,
        bytes: saved.bytes,
        contentType: saved.contentType,
        generatedAt: new Date().toISOString(),
      });
      process.stdout.write(`[saved] ${template.imageSrc} bytes=${saved.bytes}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        title: template.title,
        imageSrc: template.imageSrc,
        aspectRatio,
        size,
        message,
      });
      process.stdout.write(`[failed] ${template.imageSrc} ${message}\n`);
    }
  }

  writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), results, failures }, null, 2));
  process.stdout.write(`[manifest] ${path.relative(projectRoot, manifestPath)}\n`);
  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
