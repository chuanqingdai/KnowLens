import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const optimizedRoot = path.join(publicDir, "landing-optimized");

const mapping = {
  "/picture/hero picture.png": "/picture/ai-infographic-generator-learning-hero.jpg",
  "/en-picture/c2b3c799-28c9-4267-a18e-fe3145449df7.png": "/en-picture/featured-visual-case-01.jpg",
  "/en-picture/ce307920-892e-46eb-a193-fe228d4b9c31.png": "/en-picture/featured-visual-case-02.jpg",
  "/en-picture/17e1c7f5-b04e-4e54-88af-787c79d1e8e3.png": "/en-picture/featured-visual-case-03.jpg",
  "/en-picture/645ecabf-1b29-4d05-a377-1c886b5a2ae8.png": "/en-picture/photosynthesis-infographic-case.jpg",
  "/en-picture/a4e1d8cf-9ce8-4301-8eaf-c2a0981ef380.png": "/en-picture/inflation-daily-life-infographic-case.jpg",
  "/en-picture/a93133f7-46f9-4da1-a488-375e9f909169.png": "/en-picture/plate-tectonics-earthquake-infographic-case.jpg",
  "/en-picture/d561aaef-2126-479e-bef3-5726b925f88e.png": "/en-picture/printing-press-history-infographic-case.jpg",
  "/en-picture/astronomy/f811316c-2452-4a84-8785-c6de347998d4.png": "/en-picture/astronomy/astronomy-infographic-card.jpg",
  "/en-picture/biology/74380d3a-9a1b-44a2-998a-7c3482175ff4.png": "/en-picture/biology/biology-infographic-card.jpg",
  "/en-picture/economics/3e26f31b-fb9c-4855-8a32-d14e060ea98c.png": "/en-picture/economics/economics-infographic-card.jpg",
  "/en-picture/geography/8f861cf8-f326-4dcd-9c54-e1673f2caf13.png": "/en-picture/geography/geography-infographic-card.jpg",
  "/en-picture/history/88e45522-e408-429c-b670-92c62faa47d9.png": "/en-picture/history/history-infographic-card.jpg",
  "/en-picture/mdeicine/15454ff0-b0e6-46b9-bc2a-787cb8ff2080.png": "/en-picture/mdeicine/medical-infographic-card.jpg",
  "/en-picture/astronomy/63f2d8b5-da95-4f3c-9e02-46a61519071d.png": "/en-picture/astronomy/astronomy-long-infographic.jpg",
  "/en-picture/biology/c03468d1-6e9d-4808-9a69-2a3852412d0b.png": "/en-picture/biology/biology-long-infographic.jpg",
  "/en-picture/geography/94a41a11-5983-4b03-924c-e1e47aa8d945.png": "/en-picture/geography/geography-long-infographic.jpg",
  "/picture/text-to-poster.png": "/picture/text-to-poster-workflow.jpg",
  "/picture/text-to-ppt.png": "/picture/text-to-ppt-workflow.jpg",
  "/picture/web-to-poster.png": "/picture/webpage-to-poster-workflow.jpg",
  "/picture/doc-to-ppt.png": "/picture/document-to-ppt-workflow.jpg",
  "/picture/video-to-video.png": "/picture/video-to-video-workflow.jpg",
  "/picture/podcast-to-video.png": "/picture/podcast-to-video-workflow.jpg",
  "/picture/video-to-poster.png": "/picture/video-to-poster-workflow.jpg",
  "/picture/989f14bd-ff95-4298-a091-57a54ac5332f.png": "/picture/inflation-daily-life-poster-case.jpg",
  "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png": "/picture/immune-mechanism-infographic-case.jpg",
  "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png": "/picture/volcano-eruption-ppt-case.jpg",
  "/picture/fb1ec712-8275-4b22-989b-756e17684fbe.png": "/picture/electrolysis-classroom-ppt-case.jpg",
  "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png": "/picture/ocean-circulation-infographic-case.jpg",
  "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png": "/picture/black-hole-video-visual-case.jpg",
  "/picture/c24ee34d-8ee2-498a-b95d-c17d30640f2a.png": "/picture/dna-video-script-case.jpg",
  "/picture/feb2b176-157f-44f9-ac52-5a271e25ed6e.png": "/picture/deep-sea-podcast-visual-case.jpg",
  "/picture/9cfe9227-c75b-40d0-a459-8d85064a1e55.png": "/picture/blue-light-health-poster-case.jpg",
};

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function toFsPath(publicPath) {
  return path.join(publicDir, publicPath.replace(/^\//, ""));
}

function toOptimizedFsPath(publicPath) {
  return path.join(optimizedRoot, publicPath.replace(/^\//, ""));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildPair(sourcePublicPath, targetPublicPath) {
  const source = toFsPath(sourcePublicPath);
  const sourceOptimized = toOptimizedFsPath(sourcePublicPath);
  const target = toFsPath(targetPublicPath);
  const targetOptimized = toOptimizedFsPath(targetPublicPath);

  const sourceOk = await exists(source);
  if (!sourceOk) {
    throw new Error(`Missing source file: ${sourcePublicPath}`);
  }

  await ensureDir(target);
  await sharp(source, { failOn: "none" })
    .rotate()
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toFile(target);

  const optimizedInput = (await exists(sourceOptimized)) ? sourceOptimized : source;
  const optimizedMeta = await sharp(optimizedInput, { failOn: "none" }).metadata();
  const width = optimizedMeta.width ?? 0;
  const height = optimizedMeta.height ?? 0;
  const isTall = height > width * 1.1;
  await ensureDir(targetOptimized);
  await sharp(optimizedInput, { failOn: "none" })
    .rotate()
    .resize({
      width: isTall ? 1080 : 1440,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 74, mozjpeg: true, progressive: true })
    .toFile(targetOptimized);
}

async function main() {
  const entries = Object.entries(mapping);
  for (const [fromPath, toPath] of entries) {
    await buildPair(fromPath, toPath);
    process.stdout.write(`generated ${toPath}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
