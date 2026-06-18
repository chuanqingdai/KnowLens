import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildInsurancePosterPrompt, createInsuranceTemplateFormState } from "../src/lib/insurance-poster-prompt.js";

// Fixed approved entrypoint for insurance poster generation.
// For new categories, reuse this script instead of creating a new generate-insurance-*-posters.mjs command:
// node scripts/generate-insurance-critical-illness-posters.mjs --template-module=src/lib/insurance-xxx-templates.js --template-export=xxxTemplates --manifest=xxx-generation-manifest.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "insurance", "posters");
const styleSourcePath = path.join(projectRoot, "src", "app", "insurance", "InsuranceTemplateGallery.tsx");
const forceRegenerate = process.argv.includes("--force");
const normalizeExisting = process.argv.includes("--normalize-existing");
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const onlyImageSrc = onlyArg ? onlyArg.slice("--only=".length).trim() : "";
const onlyImageSrcs = onlyImageSrc.split(",").map((item) => item.trim()).filter(Boolean);
const templateModuleArg = readCliValue("--template-module") || "src/lib/insurance-critical-illness-templates.js";
const templateExportArg = readCliValue("--template-export") || "criticalIllnessTemplates";
const manifestArg = readCliValue("--manifest");
const timeoutEnvArg = readCliValue("--timeout-env") || "INSURANCE_CRITICAL_IMAGE_TIMEOUT_MS";
const providerTimeoutMs = Number.parseInt(process.env[timeoutEnvArg] || "360000", 10);

const sizeByRatio = {
  "9:16": "864x1536",
  "3:4": "1008x1344",
};

const outputSizeByRatio = {
  "9:16": { width: 864, height: 1536 },
  "3:4": { width: 1008, height: 1344 },
};

const styleByImageSrc = {
  "zhongji-01": "professional-blue",
  "zhongji-02": "storybook-kids",
  "zhongji-03": "minimal-white",
  "zhongji-04": "handdrawn-care",
  "zhongji-05": "medical-fresh",
  "zhongji-06": "glassmorphism",
  "zhongji-07": "premium-business",
  "zhongji-08": "light-luxury",
  "zhongji-09": "flat-illustration",
  "zhongji-10": "data-explainer",
};

function readCliValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1).trim() : "";
}

function resolveTemplateModulePath(value) {
  const normalized = value.replace(/^\.?\//, "");
  if (!/^src\/lib\/insurance-[a-z0-9-]+-templates\.js$/i.test(normalized)) {
    throw new Error(`Unsupported template module path: ${value}`);
  }
  return path.join(projectRoot, normalized);
}

const fallbackInsuranceStyles = {
  "professional-blue": {
    name: "专业蓝白",
    prompt:
      "Use a professional blue-white commercial poster style. deep navy blue #0B1F3A and clean insurance blue #1F6FFF. cool white #F7FAFF and pale blue gray #EAF1FA. bold modern Chinese title, readable body text, translucent panels, fine divider lines, calm corporate finish.",
  },
  "medical-fresh": {
    name: "清透冷感",
    prompt:
      "Use a clean translucent cool-tone poster style. mint cyan #DDF7F2, clear water blue #DCEEFF, clinical white #FFFFFF. frosted blocks, bright diffused cool lighting, crisp readable finish.",
  },
  "premium-business": {
    name: "深蓝商务",
    prompt:
      "Use a deep blue executive business poster style. navy black #071426, deep business blue #0E2A4F, champagne gold #D6B56D. structured grid alignment, restrained luxury-business finish.",
  },
  "minimal-white": {
    name: "极简留白",
    prompt:
      "Use a minimal white editorial poster style. pure white #FFFFFF, warm white #FAFAF7, light gray #EEF1F4, charcoal black #1F1F1F. large negative space, ultra-thin lines, quiet premium finish.",
  },
  "data-explainer": {
    name: "数据科技",
    prompt:
      "Use a data-tech explainer poster style. deep navy #061222, technology cyan #21D4FD, cool white #F2F6FA. translucent interface layers, thin glowing lines, modular information rhythm, no invented numbers.",
  },
  "light-luxury": {
    name: "轻奢金色",
    prompt:
      "Use a light luxury gold poster style. ivory #FFF8E9, deep blue gray #273240, champagne beige #F0DEC1, champagne gold #D6B56D. fine gold borders, silk-like gradients, quiet luxury finish.",
  },
  "handdrawn-care": {
    name: "手绘纸感",
    prompt:
      "Use a refined hand-drawn paper poster style. warm paper beige #F3E7D0, pencil gray #4A4A4A, muted olive #7A8F5A, warm orange #F28C28. hand-drawn strokes, pencil grain, organized notebook-like finish.",
  },
  "flat-illustration": {
    name: "扁平几何",
    prompt:
      "Use a minimal flat geometric poster style. clean white #FFFFFF, low-saturation blue #DCEBFF, light gray #EEF1F4, bright blue #2F80FF. flat vector shapes, crisp edges, clean diagram finish.",
  },
  "storybook-kids": {
    name: "柔彩绘本",
    prompt:
      "Use a soft colorful storybook poster style. sky blue #BFE3FF, cream yellow #FFF0A8, soft green #C9E8B8, warm white #FFFDF8. soft-edge illustration, crayon-like fine grain, friendly layered rhythm.",
  },
  "glassmorphism": {
    name: "玻璃拟态",
    prompt:
      "Use a glassmorphism poster style. ice blue #DCEEFF, cool white #F8FBFF, pale violet #E9E2FF, translucent gray #E8EEF6. frosted glass layers, edge highlights, airy gradients, cool backlight.",
  },
};

function extractInsuranceStyles() {
  const source = readFileSync(styleSourcePath, "utf8");
  const marker = "const insuranceStyleOptions";
  const start = source.indexOf(marker);
  if (start < 0) return fallbackInsuranceStyles;
  const arrayStart = source.indexOf("[", start);
  const arrayEnd = source.indexOf("\n];", arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) return fallbackInsuranceStyles;
  const literal = source.slice(arrayStart, arrayEnd + 2);
  const styles = Function(`"use strict"; return (${literal});`)();
  return Object.fromEntries(styles.map((style) => [style.id, style]));
}

const insuranceStyles = extractInsuranceStyles();

function buildPromptWithInsuranceStyle(template) {
  const styleKey = template.styleId || Object.entries(styleByImageSrc).find(([needle]) => template.imageSrc.includes(needle))?.[1];
  const style = styleKey ? insuranceStyles[styleKey] : null;
  if (!style) return buildInsurancePosterPrompt(template, template.primaryCategory);
  return buildInsurancePosterPrompt(template, template.primaryCategory, {
    ...createInsuranceTemplateFormState(template),
    styleName: style.name,
    stylePrompt: style.prompt,
  });
}

async function loadTemplates() {
  const modulePath = resolveTemplateModulePath(templateModuleArg);
  const module = await import(path.toNamespacedPath(modulePath));
  const templates = module[templateExportArg];
  if (!Array.isArray(templates)) {
    throw new Error(`Template export "${templateExportArg}" was not found or is not an array.`);
  }
  return templates;
}

function resolveManifestPath(templates) {
  if (manifestArg) {
    const manifestName = path.basename(manifestArg);
    if (!/^[a-z0-9-]+-generation-manifest\.json$/i.test(manifestName)) {
      throw new Error(`Unsupported manifest file name: ${manifestArg}`);
    }
    return path.join(outputDir, manifestName);
  }
  const firstImageSrc = templates.find((template) => typeof template.imageSrc === "string")?.imageSrc || "";
  const firstFile = path.basename(firstImageSrc, path.extname(firstImageSrc));
  const prefix = firstFile.replace(/-\d+$/, "") || "insurance";
  return path.join(outputDir, `${prefix}-generation-manifest.json`);
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
  if (!imageUrl) throw new Error("Image provider response did not include an image URL.");
  return { imageUrl };
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url, { headers: { Accept: "image/*" } });
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
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

async function normalizePosterImage(outputPath, aspectRatio) {
  const target = outputSizeByRatio[aspectRatio];
  if (!target) throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
  const source = readFileSync(outputPath);
  const background = await sharp(source)
    .resize(target.width, target.height, { fit: "cover", position: "centre" })
    .blur(20)
    .modulate({ brightness: 1.04, saturation: 0.82 })
    .png()
    .toBuffer();
  const foreground = await sharp(source)
    .resize(target.width, target.height, {
      fit: "contain",
      background: { r: 248, g: 250, b: 252, alpha: 0 },
    })
    .png()
    .toBuffer();
  const normalized = await sharp(background)
    .composite([{ input: foreground, left: 0, top: 0 }])
    .png()
    .toBuffer();
  writeFileSync(outputPath, normalized);
  const metadata = await sharp(normalized).metadata();
  return { width: metadata.width, height: metadata.height, bytes: normalized.byteLength };
}

async function main() {
  const templates = await loadTemplates();
  const manifestPath = resolveManifestPath(templates);
  const selectedTemplates = templates.filter(
    (template) =>
      !onlyImageSrcs.length || onlyImageSrcs.some((imageSrc) => template.imageSrc.includes(imageSrc)),
  );
  mkdirSync(outputDir, { recursive: true });
  if (!selectedTemplates.length) {
    writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), results: [], failures: [] }, null, 2));
    process.stdout.write(`[manifest] ${path.relative(projectRoot, manifestPath)}\n`);
    return;
  }

  const env = readEnv();
  const endpoint = resolveGenerationsEndpoint(
    env.IMAGE2_TUZI_PROVIDER_ENDPOINT || env.IMAGE2_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/generations",
  );
  const apiKey =
    env.IMAGE2_TUZI_PROVIDER_API_KEY ||
    env.IMAGE2_PROVIDER_API_KEY ||
    env.PAID_IMAGE_API_KEY ||
    env.PAID_LLM_API_KEY ||
    "";
  const model = env.IMAGE2_TUZI_PROVIDER_MODEL || env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";
  if (!apiKey) throw new Error("Missing IMAGE2 provider API key in process environment.");

  const results = [];
  const failures = [];
  for (const template of selectedTemplates) {
    const outputPath = path.join(projectRoot, "public", template.imageSrc.replace(/^\//, ""));
    const aspectRatio = template.aspectRatio || "9:16";
    const size = sizeByRatio[aspectRatio];
    if (!size) throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
    if (!forceRegenerate && existsSync(outputPath)) {
      const normalized = normalizeExisting ? await normalizePosterImage(outputPath, aspectRatio) : null;
      const bytes = readFileSync(outputPath).byteLength;
      results.push({
        title: template.title,
        imageSrc: template.imageSrc,
        aspectRatio,
        size,
        bytes,
        width: normalized?.width,
        height: normalized?.height,
        skipped: true,
        normalized: Boolean(normalized),
      });
      process.stdout.write(`[skip] ${template.imageSrc} exists bytes=${bytes}${normalized ? ` normalized=${normalized.width}x${normalized.height}` : ""}\n`);
      continue;
    }
    try {
      process.stdout.write(`[generate] ${template.imageSrc} ${aspectRatio} ${size}\n`);
      const generated = await generateImage({
        endpoint,
        apiKey,
        model,
        prompt: buildPromptWithInsuranceStyle(template),
        size,
      });
      const saved = await downloadImage(generated.imageUrl, outputPath);
      const normalized = await normalizePosterImage(outputPath, aspectRatio);
      results.push({
        title: template.title,
        imageSrc: template.imageSrc,
        aspectRatio,
        size,
        bytes: normalized.bytes,
        width: normalized.width,
        height: normalized.height,
        contentType: saved.contentType,
        generatedAt: new Date().toISOString(),
        normalized: true,
      });
      process.stdout.write(`[saved] ${template.imageSrc} bytes=${normalized.bytes} normalized=${normalized.width}x${normalized.height}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ title: template.title, imageSrc: template.imageSrc, aspectRatio, size, message });
      process.stdout.write(`[failed] ${template.imageSrc} ${message}\n`);
    }
  }
  writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), results, failures }, null, 2));
  process.stdout.write(`[manifest] ${path.relative(projectRoot, manifestPath)}\n`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
