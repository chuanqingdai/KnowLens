import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "public", "en-picture");
const targetDir = path.join(rootDir, "public", "landing-optimized", "en-picture");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function optimizeImage(inputPath, outputPath) {
  const image = sharp(inputPath, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const isTall = height > width * 1.1;

  await ensureDir(outputPath);

  const pipeline = image
    .resize({
      width: isTall ? 1080 : 1440,
      withoutEnlargement: true,
      fit: "inside",
    })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath);

  await pipeline;
}

async function main() {
  const files = await walk(sourceDir);

  for (const file of files) {
    const relative = path.relative(sourceDir, file);
    const target = path.join(targetDir, relative);
    await optimizeImage(file, target);
    process.stdout.write(`optimized ${relative}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
