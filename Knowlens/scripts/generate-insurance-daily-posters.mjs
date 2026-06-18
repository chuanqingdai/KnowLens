import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInsurancePosterPrompt, createInsuranceTemplateFormState } from "../src/lib/insurance-poster-prompt.js";
import { dailyQuoteTemplates } from "../src/lib/insurance-daily-templates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "insurance", "posters");
const manifestPath = path.join(outputDir, "riqian-generation-manifest.json");
const providerTimeoutMs = Number.parseInt(process.env.INSURANCE_DAILY_IMAGE_TIMEOUT_MS || "360000", 10);
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

const insuranceStyleOptions = {
  "professional-blue": {
    name: "专业蓝白",
    prompt:
      "Use a professional blue-white commercial poster style. deep navy blue #0B1F3A and clean insurance blue #1F6FFF. cool white #F7FAFF and pale blue gray #EAF1FA. dark navy #102033. bright blue #2F80FF, used sparingly under 10% of the image. extra-bold modern Chinese sans-serif title at large poster scale, medium-weight subtitle, highly readable body text with generous line height, small footer text with restrained weight. translucent panels, fine divider lines, subtle grid texture, soft cool gradients, low-noise background, light shadow separation, precise alignment, calm corporate finish.",
  },
  "warm-family": {
    name: "暖调柔光",
    prompt:
      "Use a warm soft-light editorial poster style. warm ivory #FFF4E3 and cream yellow #FFE6A7. soft apricot #F7D7B8 and warm white #FFF9F0. warm charcoal #2F2A24. muted orange #F2994A. rounded bold Chinese sans-serif title at large scale, friendly medium subtitle, readable body text with wider line spacing, small calm footer text. soft mist gradients, warm translucent layers, delicate paper texture, low-contrast shadows, feathered edges, relaxed spacing, gentle visual rhythm, approachable premium finish.",
  },
  "medical-fresh": {
    name: "清透冷感",
    prompt:
      "Use a clean translucent cool-tone poster style. mint cyan #DDF7F2 and clear water blue #DCEEFF. clinical white #FFFFFF and pale gray #F2F6F8. cool gray #3F4A56. fresh cyan green #35B7A4. clean modern Chinese sans-serif title at medium-large scale, balanced subtitle, high-legibility body text, compact small labels. airy gradients, thin borders, lightly frosted blocks, bright diffused cool lighting, minimal shadow, balanced spacing, clean modular hierarchy, crisp readable finish.",
  },
  "premium-business": {
    name: "深蓝商务",
    prompt:
      "Use a deep blue executive business poster style. navy black #071426 and deep business blue #0E2A4F. slate gray #283445 and mist gray #E8EDF3. cool white #F4F8FF. champagne gold #D6B56D. heavy modern Chinese sans-serif title with strong contrast, medium subtitle, concise body text, small premium labels. matte gradients, subtle metallic highlights, thin separators, structured grid alignment, controlled negative space, directional soft light, restrained luxury-business finish.",
  },
  "light-luxury": {
    name: "轻奢金色",
    prompt:
      "Use a light luxury gold poster style. ivory #FFF8E9 and deep blue gray #273240. champagne beige #F0DEC1. refined dark gray #2A2A2A. champagne gold #D6B56D. refined modern Chinese sans-serif title at large but not bulky scale, elegant medium subtitle, crisp body text, small understated footer. fine gold borders, silk-like gradients, subtle embossing, premium card-stock texture, narrow highlights, low-opacity shadows, balanced margins, quiet luxury finish.",
  },
  "flat-illustration": {
    name: "扁平几何",
    prompt:
      "Use a minimal flat geometric poster style. clean white #FFFFFF and low-saturation blue #DCEBFF. light gray #EEF1F4 and muted color blocks. neutral gray #4B5563. bright blue #2F80FF with optional muted orange #F2994A. bold rounded Chinese sans-serif title, simple readable body text, large clear label typography. flat vector shapes, simple geometry, crisp edges, low visual noise, consistent rounded modules, very light shadows, mobile-first scanning rhythm, clean diagram finish.",
  },
  "storybook-kids": {
    name: "柔彩绘本",
    prompt:
      "Use a soft colorful storybook poster style. sky blue #BFE3FF, cream yellow #FFF0A8, soft green #C9E8B8, and warm white #FFFDF8. pale cream #FFF7DA. gentle navy #2F3A4A. soft coral #F4A185. rounded Chinese sans-serif title at large friendly scale, clean body text, simple rounded small labels. soft-edge illustration finish, crayon-like fine grain, low-saturation gradients, rounded corners, warm paper texture, flat gentle light, friendly layered rhythm.",
  },
  "watercolor-story": {
    name: "水彩柔雾",
    prompt:
      "Use a watercolor mist poster style. watercolor blue #A9D8F2, pale green #CDE8D3, warm yellow #F7DA8A, and paper white #FFFDF8. translucent warm white #FFF8EF. soft ink gray #3F3F3F. muted coral #E99A7A. clear modern Chinese sans-serif title with a gentle hand-crafted feeling, stable readable body text, small calm labels. wet watercolor edges, soft diffusion, absorbent paper grain, low-saturation layering, gentle ambient light, wide spacing, airy narrative finish.",
  },
};

const dailyStyleByImageSrc = {
  "riqian-01": "warm-family",
  "riqian-02": "warm-family",
  "riqian-03": "medical-fresh",
  "riqian-04": "professional-blue",
  "riqian-05": "warm-family",
  "riqian-06": "storybook-kids",
  "riqian-07": "flat-illustration",
  "riqian-08": "light-luxury",
  "riqian-09": "premium-business",
  "riqian-10": "watercolor-story",
};

function buildPromptWithInsuranceStyle(template) {
  const styleKey = Object.entries(dailyStyleByImageSrc).find(([needle]) => template.imageSrc.includes(needle))?.[1];
  const style = styleKey ? insuranceStyleOptions[styleKey] : null;
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
  return { imageUrl, rawText };
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
  for (const template of dailyQuoteTemplates) {
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
