import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  getBiologyInfographicTemplates,
  type BiologyInfographicTemplate,
} from "@/lib/biology-infographic-templates";
import {
  buildImage2ProviderConfig,
  requestImage2Generation,
  resolveImage2Size,
} from "@/lib/server/image2";

export const runtime = "nodejs";
export const maxDuration = 300;

const batchId = "biology-infographic-tuzi-100";
const batchTopic = "Biology Infographic";
const publicDir = path.join(process.cwd(), "public/images/infographic/biology");
const manifestPath = path.join(process.cwd(), "src/lib/biology-infographic-generated-images.json");

type ManifestRecord = Record<string, unknown> & {
  slug: string;
  generationStatus: "success" | "failed" | "skipped";
};

type Manifest = {
  id: string;
  batchId: string;
  batchTopic: string;
  generationProvider: string;
  updatedAt: string;
  templates: Record<string, ManifestRecord>;
  errors: Array<{ slug: string; title: string; reason: string; updatedAt: string }>;
};

function isLocalOnly(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const host = req.headers.get("host") || "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

async function readManifest(): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
    return {
      id: parsed.id || batchId,
      batchId: parsed.batchId || batchId,
      batchTopic: parsed.batchTopic || batchTopic,
      generationProvider: parsed.generationProvider || "tuzi",
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      templates: parsed.templates || {},
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    };
  } catch {
    return {
      id: batchId,
      batchId,
      batchTopic,
      generationProvider: "tuzi",
      updatedAt: new Date().toISOString(),
      templates: {},
      errors: [],
    };
  }
}

async function writeManifest(manifest: Manifest) {
  manifest.updatedAt = new Date().toISOString();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const imageQualityPrompt = "Create a professional knowledge infographic with clear information hierarchy, minimal and accurate English text, scientifically correct visual elements, precise diagram structures, no spelling mistakes, no distorted or misleading illustrations, and a clean editorial infographic layout that makes the key concepts easy to understand at a glance.";

function cleanImagePromptText(value: string) {
  return value
    .replace(/\bclearly labeled\b/gi, "clearly identified")
    .replace(/\blabeled\b/gi, "named")
    .replace(/\bnumbered labels?\b/gi, "numbered stage names")
    .replace(/\bcallout labels?\b/gi, "callout terms")
    .replace(/\blabels?\b/gi, "biology terms")
    .replace(/\bLabel\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toVisibleTerm(point: string) {
  return point
    .replace(/\s+(controls|supports|stores|helps?|are|is|can|carry|carries|convert|converts|allow|allows|enter|enters|leave|leaves|move|moves|produce|produces|protect|protects|work|works|begin|begins|contain|contains|include|includes|provide|provides|detect|detects|send|sends|return|returns|reduce|reduced|form|forms|use|uses|show|shows|explain|explains)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 42) || point.slice(0, 42);
}

function buildProviderPrompt(template: BiologyInfographicTemplate) {
  const visibleTerms = template.knowledgePoints.slice(0, 4).map(toVisibleTerm);
  const cleanVisualPrompt = cleanImagePromptText(template.visualPrompt);
  return [
    `Clean educational biology infographic about ${template.primaryKeyword}.`,
    "",
    "Style:",
    template.stylePrompt,
    "",
    "Image prompt:",
    cleanVisualPrompt,
    imageQualityPrompt,
    "",
    `Aspect ratio: ${template.aspectRatio}.`,
    "",
    "Biology facts to represent visually, not as paragraphs:",
    ...template.knowledgePoints.map((point) => `- ${point}`),
    "",
    "Visible words allowed:",
    `- ${template.topicName}`,
    ...visibleTerms.map((term) => `- ${term}`),
    "",
    "Use only the title and the allowed biology terms as visible text. Explain details through icons, arrows, color, and simple callout lines instead of paragraphs.",
    "Do not add generic placeholder headings, numbered callout headings, UI text, watermarks, logos, random numbers, fake data, lorem ipsum, extra captions, tiny text, or unrelated objects.",
  ].join("\n");
}

async function downloadImageBytes(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!response.ok) {
      throw new Error(`download failed ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) {
      throw new Error("download returned empty bytes");
    }
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRecord(template: BiologyInfographicTemplate, image: {
  imageFilename: string;
  previewImagePath: string;
  previewImageUrl: string;
  storageKey: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes: number;
  updatedAt: string;
}): ManifestRecord {
  return {
    ...template,
    batchId,
    batchTopic,
    generationProvider: "tuzi",
    generationStatus: "success",
    previewImagePath: image.previewImagePath,
    previewImageUrl: image.previewImageUrl,
    storageKey: image.storageKey,
    imageFilename: image.imageFilename,
    imageFormat: "webp",
    imageMimeType: "image/webp",
    imageWidth: image.imageWidth,
    imageHeight: image.imageHeight,
    imageSizeBytes: image.imageSizeBytes,
    updatedAt: image.updatedAt,
    allowPublicDownload: false,
  };
}

export async function GET(req: NextRequest) {
  if (!isLocalOnly(req)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const manifest = await readManifest();
  const templates = getBiologyInfographicTemplates();
  return NextResponse.json({
    ok: true,
    batchId,
    total: templates.length,
    generated: Object.values(manifest.templates).filter((item) => item.generationStatus === "success").length,
    failed: manifest.errors.length,
    missing: templates.filter((item) => manifest.templates[item.slug]?.generationStatus !== "success").length,
  });
}

export async function POST(req: NextRequest) {
  if (!isLocalOnly(req)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { offset?: number; limit?: number; force?: boolean };
  const offset = Math.max(0, Math.round(Number(body.offset || 0)));
  const limit = Math.max(1, Math.min(5, Math.round(Number(body.limit || 5))));
  const force = Boolean(body.force);
  const config = buildImage2ProviderConfig("tuzi");
  if (!config) {
    return NextResponse.json({
      ok: false,
      error: "Missing tuzi image provider config in the running Next server environment.",
    }, { status: 500 });
  }

  await mkdir(publicDir, { recursive: true });
  const manifest = await readManifest();
  const templates = getBiologyInfographicTemplates().slice(offset, offset + limit);
  const updatedRecords: ManifestRecord[] = [];
  const errors: Array<{ slug: string; title: string; reason: string }> = [];

  for (const template of templates) {
    if (!force && manifest.templates[template.slug]?.generationStatus === "success") {
      updatedRecords.push(manifest.templates[template.slug]);
      continue;
    }
    try {
      const result = await requestImage2Generation(config, {
        prompt: buildProviderPrompt(template),
        aspectRatio: template.aspectRatio,
        size: resolveImage2Size(template.aspectRatio),
      });
      if (!result.ok) {
        throw new Error(`${result.errorCode}: ${result.errorMessage}${result.detail ? ` (${result.detail})` : ""}`);
      }
      const sourceBytes = await downloadImageBytes(result.imageUrl);
      const converted = await sharp(sourceBytes).rotate().webp({ quality: 92 }).toBuffer();
      const metadata = await sharp(converted).metadata();
      const imageFilename = `biology-${template.slug}.webp`;
      const storageKey = `infographic/biology/${imageFilename}`;
      const publicPath = path.join(publicDir, imageFilename);
      await writeFile(publicPath, converted);
      const updatedAt = new Date().toISOString();
      const record = buildRecord(template, {
        imageFilename,
        previewImageUrl: `https://knowlens.ai/images/infographic/biology/${imageFilename}`,
        previewImagePath: `/images/infographic/biology/${imageFilename}`,
        storageKey,
        imageWidth: metadata.width || template.imageWidth,
        imageHeight: metadata.height || template.imageHeight,
        imageSizeBytes: converted.length,
        updatedAt,
      });
      manifest.templates[template.slug] = record;
      updatedRecords.push(record);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push({ slug: template.slug, title: template.title, reason });
      manifest.errors.push({ slug: template.slug, title: template.title, reason, updatedAt: new Date().toISOString() });
    }
    await writeManifest(manifest);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    batchId,
    offset,
    limit,
    updatedRecords,
    errors,
    generated: Object.values(manifest.templates).filter((item) => item.generationStatus === "success").length,
    total: getBiologyInfographicTemplates().length,
  }, { status: errors.length ? 207 : 200 });
}
