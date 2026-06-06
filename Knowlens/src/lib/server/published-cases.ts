import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import { getDb } from "@/lib/server/db";
import { readImageAsset } from "@/lib/server/image-generation-jobs";
import { hasManagedDatabase, pgAll, pgGet, pgRun } from "@/lib/server/postgres";
import {
  findWorkspaceProjectOwner,
  listWorkspaceProjectPages,
  type WorkspaceProjectPageOutputType,
  type WorkspaceProjectPageRow,
} from "@/lib/server/workspace-project-pages";

export type PublishedCaseOutputType = "poster" | "ppt" | "video";

export type PublishedCaseAssetRow = {
  id: string;
  caseId: string;
  slug: string;
  assetType: string;
  title: string;
  description: string;
  pageIndex: number;
  fileUrl: string;
  viewerUrl: string;
  thumbnailUrl: string;
  downloadUrl: string;
  storageKey: string | null;
  mimeType: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PublishedCaseRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  outputType: PublishedCaseOutputType;
  authorLabel: string;
  sourceProjectId: string | null;
  sourceUserEmail: string | null;
  coverAssetId: string | null;
  coverUrl: string;
  status: string;
  featured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assets?: PublishedCaseAssetRow[];
};

type PublishProjectInput = {
  projectId: string;
  userEmail: string;
  outputType?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  authorLabel?: string | null;
  slug?: string | null;
  featured?: boolean;
  sortOrder?: number;
  origin?: string | null;
};

type CopiedAsset = {
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

const PUBLIC_ASSET_PREFIX = "published-cases/";

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined, max = 1000) {
  return (value || "").trim().slice(0, max);
}

function normalizeOutputType(value: string | null | undefined): PublishedCaseOutputType {
  const normalized = normalizeText(value, 40).toLowerCase();
  if (normalized === "ppt" || normalized === "video" || normalized === "poster") {
    return normalized;
  }
  return "poster";
}

function parseBooleanEnv(name: string, fallback = false) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function shouldUsePublicBlobStore() {
  return (
    parseBooleanEnv("PUBLISHED_CASES_USE_BLOB", process.env.NODE_ENV === "production") &&
    Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
  );
}

function getLocalPublicAssetDir() {
  return path.join(process.cwd(), "runtime-logs", "public-case-assets");
}

function isAbsoluteLocalPath(input: string) {
  return input.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(input);
}

function stableHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  if (normalized === "video/mp4") return ".mp4";
  if (normalized.includes("presentation")) return ".pptx";
  return ".png";
}

export function slugifyPublishedCase(value: string) {
  const fallback = `case-${Date.now()}`;
  const normalized = normalizeText(value, 160)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

function toPublicAssetUrl(assetId: string) {
  return `/api/public/case-assets/${encodeURIComponent(assetId)}`;
}

function toCaseViewerUrl(caseSlug: string, assetSlug: string) {
  return `/cases/${encodeURIComponent(caseSlug)}?asset=${encodeURIComponent(assetSlug)}`;
}

function mapCaseRow(row: Record<string, unknown>): PublishedCaseRow {
  return {
    id: String(row.id || ""),
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    description: String(row.description || ""),
    category: String(row.category || "All"),
    outputType: normalizeOutputType(String(row.output_type || "")),
    authorLabel: String(row.author_label || "KnowLens"),
    sourceProjectId: typeof row.source_project_id === "string" ? row.source_project_id : null,
    sourceUserEmail: typeof row.source_user_email === "string" ? row.source_user_email : null,
    coverAssetId: typeof row.cover_asset_id === "string" ? row.cover_asset_id : null,
    coverUrl: String(row.cover_url || ""),
    status: String(row.status || "draft"),
    featured: Number(row.featured || 0) === 1,
    sortOrder: Number(row.sort_order || 0),
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapAssetRow(row: Record<string, unknown>): PublishedCaseAssetRow {
  return {
    id: String(row.id || ""),
    caseId: String(row.case_id || ""),
    slug: String(row.slug || ""),
    assetType: String(row.asset_type || "poster_image"),
    title: String(row.title || ""),
    description: String(row.description || ""),
    pageIndex: Number(row.page_index || 1),
    fileUrl: String(row.file_url || ""),
    viewerUrl: String(row.viewer_url || ""),
    thumbnailUrl: String(row.thumbnail_url || ""),
    downloadUrl: String(row.download_url || row.file_url || ""),
    storageKey: typeof row.storage_key === "string" ? row.storage_key : null,
    mimeType: String(row.mime_type || "image/png"),
    fileSize: row.file_size == null ? null : Number(row.file_size || 0),
    width: row.width == null ? null : Number(row.width || 0),
    height: row.height == null ? null : Number(row.height || 0),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds || 0),
    isPrimary: Number(row.is_primary || 0) === 1,
    sortOrder: Number(row.sort_order || 0),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function buildAssetSlug(page: WorkspaceProjectPageRow, fallbackIndex: number) {
  const role = normalizeText(page.pageRole || "", 40);
  const title = normalizeText(page.title || "", 80);
  const base = role === "cover" ? "cover" : title || `page-${page.pageIndex || fallbackIndex}`;
  return `${slugifyPublishedCase(base)}-${page.pageIndex || fallbackIndex}`.slice(0, 140);
}

async function readWorkspacePageImageBytes(page: WorkspaceProjectPageRow, origin?: string | null) {
  if (page.imageTaskId) {
    const asset = await readImageAsset(page.imageTaskId);
    if (asset?.bytes) {
      return {
        bytes: asset.bytes,
        mimeType: asset.mimeType || "image/png",
      };
    }
    if (asset?.redirectUrl) {
      return fetchImageBytes(asset.redirectUrl);
    }
  }

  const sourceUrl = normalizeText(page.imageUrl || page.rawImageUrl || "", 2000);
  if (!sourceUrl) {
    return null;
  }
  if (sourceUrl.startsWith("/") && origin) {
    return fetchImageBytes(new URL(sourceUrl, origin).toString());
  }
  if (/^https?:\/\//i.test(sourceUrl)) {
    return fetchImageBytes(sourceUrl);
  }
  return null;
}

async function fetchImageBytes(sourceUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/*,video/*,*/*;q=0.8" },
    });
    if (!response.ok) {
      throw new Error(`PUBLIC_CASE_ASSET_FETCH_FAILED_${response.status}`);
    }
    const mimeType = normalizeText(response.headers.get("content-type") || "image/png", 120).split(";")[0] || "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) {
      throw new Error("PUBLIC_CASE_ASSET_EMPTY");
    }
    return { bytes, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

async function copyPublicCaseAsset(input: {
  caseSlug: string;
  assetSlug: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<CopiedAsset> {
  const extension = extensionFromMimeType(input.mimeType);
  const safeCaseSlug = slugifyPublishedCase(input.caseSlug);
  const safeAssetSlug = slugifyPublishedCase(input.assetSlug);
  const storageKey = `${PUBLIC_ASSET_PREFIX}${safeCaseSlug}/${safeAssetSlug}${extension}`;
  if (shouldUsePublicBlobStore()) {
    const result = await putBlob(storageKey, input.bytes, {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: input.mimeType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return {
      storageKey: result.pathname,
      mimeType: input.mimeType,
      fileSize: input.bytes.length,
    };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PUBLISHED_CASE_STORAGE_NOT_CONFIGURED");
  }
  const absolutePath = path.join(getLocalPublicAssetDir(), storageKey);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes);
  return {
    storageKey: absolutePath,
    mimeType: input.mimeType,
    fileSize: input.bytes.length,
  };
}

async function getUniqueCaseSlug(baseSlug: string, existingCaseId?: string) {
  if (hasManagedDatabase()) {
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const row = (await pgGet("SELECT id FROM published_cases WHERE slug = ? LIMIT 1", slug)) as
        | { id?: string }
        | undefined;
      if (!row?.id || row.id === existingCaseId) {
        return slug;
      }
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }
  const { db } = getDb();
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const row = db
      .prepare("SELECT id FROM published_cases WHERE slug = ? LIMIT 1")
      .get(slug) as { id?: string } | undefined;
    if (!row?.id || row.id === existingCaseId) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function listPublishedCases(input?: { includeDrafts?: boolean; includeAssets?: boolean; limit?: number }) {
  const includeAssets = input?.includeAssets !== false;
  if (hasManagedDatabase()) {
    const includeDrafts = Boolean(input?.includeDrafts);
    const limit = Math.max(1, Math.min(200, Math.round(Number(input?.limit || 80))));
    const rows = (includeDrafts
      ? await pgAll(
          `SELECT * FROM published_cases
           ORDER BY featured DESC, sort_order ASC, COALESCE(published_at, updated_at) DESC
           LIMIT ?`,
          limit,
        )
      : await pgAll(
          `SELECT * FROM published_cases
           WHERE status = 'published'
           ORDER BY featured DESC, sort_order ASC, COALESCE(published_at, updated_at) DESC
           LIMIT ?`,
          limit,
        )) as Array<Record<string, unknown>>;
    const items = rows.map(mapCaseRow);
    if (includeAssets) {
      for (const item of items) {
        item.assets = await listPublishedCaseAssets(item.id);
      }
    }
    return items;
  }
  const { db } = getDb();
  const includeDrafts = Boolean(input?.includeDrafts);
  const limit = Math.max(1, Math.min(200, Math.round(Number(input?.limit || 80))));
  const rows = (includeDrafts
    ? db
        .prepare(
          `SELECT * FROM published_cases
           ORDER BY featured DESC, sort_order ASC, COALESCE(published_at, updated_at) DESC
           LIMIT ?`,
        )
        .all(limit)
    : db
        .prepare(
          `SELECT * FROM published_cases
           WHERE status = 'published'
           ORDER BY featured DESC, sort_order ASC, COALESCE(published_at, updated_at) DESC
           LIMIT ?`,
        )
        .all(limit)) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const item = mapCaseRow(row);
    if (includeAssets) {
      item.assets = listPublishedCaseAssetsSync(item.id);
    }
    return item;
  });
}

export async function getPublishedCaseBySlug(slug: string, includeDrafts = false) {
  const normalizedSlug = normalizeText(decodeURIComponent(slug), 180);
  if (!normalizedSlug) {
    return null;
  }
  if (hasManagedDatabase()) {
    const row = (includeDrafts
      ? await pgGet("SELECT * FROM published_cases WHERE slug = ? LIMIT 1", normalizedSlug)
      : await pgGet("SELECT * FROM published_cases WHERE slug = ? AND status = 'published' LIMIT 1", normalizedSlug)) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return null;
    }
    const item = mapCaseRow(row);
    item.assets = await listPublishedCaseAssets(item.id);
    return item;
  }
  const { db } = getDb();
  const row = (includeDrafts
    ? db.prepare("SELECT * FROM published_cases WHERE slug = ? LIMIT 1").get(normalizedSlug)
    : db.prepare("SELECT * FROM published_cases WHERE slug = ? AND status = 'published' LIMIT 1").get(normalizedSlug)) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return null;
  }
  const item = mapCaseRow(row);
  item.assets = listPublishedCaseAssetsSync(item.id);
  return item;
}

export async function getPublishedCaseAssetById(assetId: string) {
  const id = normalizeText(assetId, 160);
  if (!id) {
    return null;
  }
  if (hasManagedDatabase()) {
    const row = (await pgGet(
      `SELECT a.*
       FROM published_case_assets a
       JOIN published_cases c ON c.id = a.case_id
       WHERE a.id = ? AND c.status = 'published'
       LIMIT 1`,
      id,
    )) as Record<string, unknown> | undefined;
    return row ? mapAssetRow(row) : null;
  }
  const { db } = getDb();
  const row = db
    .prepare(
      `SELECT a.*
       FROM published_case_assets a
       JOIN published_cases c ON c.id = a.case_id
       WHERE a.id = ? AND c.status = 'published'
       LIMIT 1`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapAssetRow(row) : null;
}

function listPublishedCaseAssetsSync(caseId: string) {
  const { db } = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM published_case_assets
       WHERE case_id = ?
       ORDER BY sort_order ASC, page_index ASC`,
    )
    .all(caseId) as Array<Record<string, unknown>>;
  return rows.map(mapAssetRow);
}

export async function listPublishedCaseAssets(caseId: string) {
  if (hasManagedDatabase()) {
    const rows = (await pgAll(
      `SELECT * FROM published_case_assets
       WHERE case_id = ?
       ORDER BY sort_order ASC, page_index ASC`,
      caseId,
    )) as Array<Record<string, unknown>>;
    return rows.map(mapAssetRow);
  }
  return listPublishedCaseAssetsSync(caseId);
}

export async function readPublishedCaseAsset(assetId: string) {
  const asset = await getPublishedCaseAssetById(assetId);
  if (!asset?.storageKey) {
    return null;
  }
  if (asset.storageKey.startsWith(PUBLIC_ASSET_PREFIX) && !isAbsoluteLocalPath(asset.storageKey)) {
    const blob = await getBlob(asset.storageKey, { access: "public" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return null;
    }
    return {
      asset,
      bytes: Buffer.from(await new Response(blob.stream).arrayBuffer()),
      mimeType: asset.mimeType || blob.blob.contentType || "application/octet-stream",
    };
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return {
    asset,
    bytes: await readFile(asset.storageKey),
    mimeType: asset.mimeType || "application/octet-stream",
  };
}

export async function publishProjectAsCase(input: PublishProjectInput) {
  const outputType = normalizeOutputType(input.outputType);
  const projectId = normalizeText(input.projectId, 140);
  let userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  if (!projectId) {
    throw new Error("Project ID is required.");
  }
  if (!userEmail) {
    userEmail = await findWorkspaceProjectOwner({
      projectId,
      outputType: outputType as WorkspaceProjectPageOutputType,
    });
  }
  if (!userEmail) {
    throw new Error("Project owner email was not found. Search by email first, then select a project.");
  }

  const pages = (await listWorkspaceProjectPages({
    projectId,
    userEmail,
    outputType: outputType as WorkspaceProjectPageOutputType,
  })).filter((page) => page.imageUrl || page.rawImageUrl || page.imageTaskId);

  if (!pages.length) {
    throw new Error("No generated project images are available to publish.");
  }

  const primaryPage = pages.find((page) => page.pageRole === "cover") ?? pages[0];
  const title = normalizeText(input.title, 220) || primaryPage.title || `Published ${outputType.toUpperCase()} case`;
  const description =
    normalizeText(input.description, 1200) ||
    primaryPage.subtitle ||
    primaryPage.body.split("\n").find((line) => line.trim()) ||
    "";
  const baseSlug = slugifyPublishedCase(input.slug || title);
  const now = nowIso();
  const caseId = `pc-${randomUUID()}`;
  const slug = await getUniqueCaseSlug(baseSlug);

  if (hasManagedDatabase()) {
    await pgRun(
      `INSERT INTO published_cases (
        id, slug, title, description, category, output_type, author_label, source_project_id,
        source_user_email, status, featured, sort_order, published_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
      caseId,
      slug,
      title,
      description,
      normalizeText(input.category, 80) || "All",
      outputType,
      normalizeText(input.authorLabel, 120) || "KnowLens",
      projectId,
      userEmail,
      input.featured === false ? 0 : 1,
      Math.round(Number(input.sortOrder || 0)),
      now,
      now,
      now,
    );
  } else {
    const { db } = getDb();

    db.prepare(
      `INSERT INTO published_cases (
        id, slug, title, description, category, output_type, author_label, source_project_id,
        source_user_email, status, featured, sort_order, published_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
    ).run(
      caseId,
      slug,
      title,
      description,
      normalizeText(input.category, 80) || "All",
      outputType,
      normalizeText(input.authorLabel, 120) || "KnowLens",
      projectId,
      userEmail,
      input.featured === false ? 0 : 1,
      Math.round(Number(input.sortOrder || 0)),
      now,
      now,
      now,
    );
  }

  const copiedAssets: PublishedCaseAssetRow[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const bytes = await readWorkspacePageImageBytes(page, input.origin);
    if (!bytes) {
      continue;
    }
    const assetId = `pca-${randomUUID()}`;
    const assetSlug = buildAssetSlug(page, index + 1);
    const copied = await copyPublicCaseAsset({
      caseSlug: slug,
      assetSlug: `${assetSlug}-${stableHash(assetId).slice(0, 8)}`,
      bytes: bytes.bytes,
      mimeType: bytes.mimeType,
    });
    const fileUrl = toPublicAssetUrl(assetId);
    const viewerUrl = toCaseViewerUrl(slug, assetSlug);
    const assetValues = [
      assetId,
      caseId,
      assetSlug,
      outputType === "ppt" ? "ppt_slide_image" : outputType === "video" ? "video_frame_image" : "poster_image",
      page.title || title,
      page.body || page.subtitle || "",
      page.pageIndex || index + 1,
      fileUrl,
      viewerUrl,
      fileUrl,
      fileUrl,
      copied.storageKey,
      copied.mimeType,
      copied.fileSize,
      null,
      null,
      null,
      index === 0 ? 1 : 0,
      index,
      now,
      now,
    ];
    const insertAssetSql = `INSERT INTO published_case_assets (
      id, case_id, slug, asset_type, title, description, page_index, file_url, viewer_url,
      thumbnail_url, download_url, storage_key, mime_type, file_size, width, height,
      duration_seconds, is_primary, sort_order, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    if (hasManagedDatabase()) {
      await pgRun(insertAssetSql, assetValues);
    } else {
      const { db } = getDb();
      db.prepare(insertAssetSql).run(...assetValues);
    }
    const [asset] = (await listPublishedCaseAssets(caseId)).filter((item) => item.id === assetId);
    if (asset) {
      copiedAssets.push(asset);
    }
  }

  if (!copiedAssets.length) {
    if (hasManagedDatabase()) {
      await pgRun("DELETE FROM published_cases WHERE id = ?", caseId);
    } else {
      const { db } = getDb();
      db.prepare("DELETE FROM published_cases WHERE id = ?").run(caseId);
    }
    throw new Error("No publishable asset could be copied.");
  }

  const coverAsset = copiedAssets.find((item) => item.isPrimary) ?? copiedAssets[0];
  if (hasManagedDatabase()) {
    await pgRun(
      `UPDATE published_cases
       SET cover_asset_id = ?, cover_url = ?, updated_at = ?
       WHERE id = ?`,
      coverAsset.id,
      coverAsset.fileUrl,
      nowIso(),
      caseId,
    );
  } else {
    const { db } = getDb();
    db.prepare(
      `UPDATE published_cases
       SET cover_asset_id = ?, cover_url = ?, updated_at = ?
       WHERE id = ?`,
    ).run(coverAsset.id, coverAsset.fileUrl, nowIso(), caseId);
  }

  const item = await getPublishedCaseBySlug(slug, true);
  if (!item) {
    throw new Error("Published case was created but could not be read.");
  }
  return item;
}

export async function updatePublishedCaseStatus(input: {
  id: string;
  status?: string;
  featured?: boolean;
  sortOrder?: number;
}) {
  const id = normalizeText(input.id, 160);
  if (!id) {
    throw new Error("Case id is required.");
  }
  const row = (hasManagedDatabase()
    ? await pgGet("SELECT * FROM published_cases WHERE id = ? LIMIT 1", id)
    : getDb().db.prepare("SELECT * FROM published_cases WHERE id = ? LIMIT 1").get(id)) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Published case not found.");
  }
  const current = mapCaseRow(row);
  const status = normalizeText(input.status, 40) || current.status;
  const updateValues = [
    status,
    typeof input.featured === "boolean" ? (input.featured ? 1 : 0) : current.featured ? 1 : 0,
    typeof input.sortOrder === "number" ? Math.round(input.sortOrder) : current.sortOrder,
    nowIso(),
    id,
  ];
  const updateSql = `UPDATE published_cases
     SET status = ?, featured = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`;
  if (hasManagedDatabase()) {
    await pgRun(updateSql, updateValues);
  } else {
    const { db } = getDb();
    db.prepare(updateSql).run(...updateValues);
  }
  return getPublishedCaseBySlug(current.slug, true);
}
