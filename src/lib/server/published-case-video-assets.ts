import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { hasManagedDatabase, pgAll, pgRun } from "@/lib/server/postgres";

type LinkVideoExportInput = {
  projectId?: string | null;
  userEmail?: string | null;
  resultUrl?: string | null;
  downloadUrl?: string | null;
  jobId: string;
  title?: string | null;
  contentType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined, max = 1000) {
  return (value || "").trim().slice(0, max);
}

function slugify(value: string) {
  return (
    normalizeText(value, 160)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "video"
  );
}

function toCaseViewerUrl(caseSlug: string, assetSlug: string) {
  return `/cases/${encodeURIComponent(caseSlug)}?asset=${encodeURIComponent(assetSlug)}`;
}

function findPublishedVideoCasesSql(hasUserEmail: boolean) {
  return hasUserEmail
    ? `SELECT *
       FROM published_cases
       WHERE status = 'published'
         AND output_type = 'video'
         AND source_project_id = ?
         AND (LOWER(source_user_email) = ? OR source_user_email IS NULL OR source_user_email = '')
       ORDER BY featured DESC, sort_order ASC, COALESCE(published_at, updated_at) DESC`
    : `SELECT *
       FROM published_cases
       WHERE status = 'published'
         AND output_type = 'video'
         AND source_project_id = ?
       ORDER BY featured DESC, sort_order ASC, COALESCE(published_at, updated_at) DESC`;
}

async function listPublishedVideoCases(projectId: string, userEmail: string) {
  const sql = findPublishedVideoCasesSql(Boolean(userEmail));
  const params = userEmail ? [projectId, userEmail] : [projectId];
  if (hasManagedDatabase()) {
    return pgAll(sql, params);
  }
  const { db } = getDb();
  return db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
}

async function getPrimaryThumbnail(caseId: string) {
  const sql = `SELECT file_url, thumbnail_url
    FROM published_case_assets
    WHERE case_id = ? AND asset_type <> 'video_file'
    ORDER BY is_primary DESC, sort_order ASC, page_index ASC
    LIMIT 1`;
  if (hasManagedDatabase()) {
    const rows = await pgAll(sql, caseId);
    return rows[0] as Record<string, unknown> | undefined;
  }
  const { db } = getDb();
  return db.prepare(sql).get(caseId) as Record<string, unknown> | undefined;
}

async function getExistingVideoAsset(caseId: string) {
  const sql = `SELECT id, slug
    FROM published_case_assets
    WHERE case_id = ? AND asset_type = 'video_file'
    ORDER BY updated_at DESC
    LIMIT 1`;
  if (hasManagedDatabase()) {
    const rows = await pgAll(sql, caseId);
    return rows[0] as Record<string, unknown> | undefined;
  }
  const { db } = getDb();
  return db.prepare(sql).get(caseId) as Record<string, unknown> | undefined;
}

async function runSql(sql: string, values: unknown[]) {
  if (hasManagedDatabase()) {
    await pgRun(sql, values);
    return;
  }
  const { db } = getDb();
  db.prepare(sql).run(...values);
}

export async function linkVideoExportToPublishedCases(input: LinkVideoExportInput) {
  const projectId = normalizeText(input.projectId, 140);
  const userEmail = normalizeText(input.userEmail, 240).toLowerCase();
  const fileUrl = normalizeText(input.resultUrl || input.downloadUrl, 4000);
  if (!projectId || !fileUrl) {
    return { linked: 0 };
  }

  const cases = await listPublishedVideoCases(projectId, userEmail);
  if (!cases.length) {
    return { linked: 0 };
  }

  const now = nowIso();
  let linked = 0;
  for (const item of cases) {
    const caseId = String(item.id || "");
    const caseSlug = String(item.slug || "");
    if (!caseId || !caseSlug) {
      continue;
    }

    const title = normalizeText(input.title, 220) || String(item.title || "KnowLens Video");
    const description = String(item.description || "");
    const assetSlug = `${slugify(title)}-video`;
    const thumbnail = await getPrimaryThumbnail(caseId);
    const thumbnailUrl =
      String(thumbnail?.thumbnail_url || thumbnail?.file_url || item.cover_url || "") || "";
    const downloadUrl = normalizeText(input.downloadUrl || input.resultUrl, 4000);
    const storageKey = `video-exports/output/${input.jobId}.mp4`;
    const mimeType = normalizeText(input.contentType, 120) || "video/mp4";
    const existing = await getExistingVideoAsset(caseId);

    if (existing?.id) {
      await runSql(
        `UPDATE published_case_assets
         SET slug = ?, title = ?, description = ?, page_index = 0, file_url = ?, viewer_url = ?,
             thumbnail_url = ?, download_url = ?, storage_key = ?, mime_type = ?, file_size = ?,
             width = ?, height = ?, duration_seconds = NULL, is_primary = 0, sort_order = -1,
             updated_at = ?
         WHERE id = ?`,
        [
          assetSlug,
          `${title} Video`,
          description,
          fileUrl,
          toCaseViewerUrl(caseSlug, assetSlug),
          thumbnailUrl,
          downloadUrl,
          storageKey,
          mimeType,
          input.size ?? null,
          input.width ?? null,
          input.height ?? null,
          now,
          String(existing.id),
        ],
      );
    } else {
      await runSql(
        `INSERT INTO published_case_assets (
          id, case_id, slug, asset_type, title, description, page_index, file_url, viewer_url,
          thumbnail_url, download_url, storage_key, mime_type, file_size, width, height,
          duration_seconds, is_primary, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, 'video_file', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, -1, ?, ?)`,
        [
          `pca-${randomUUID()}`,
          caseId,
          assetSlug,
          `${title} Video`,
          description,
          fileUrl,
          toCaseViewerUrl(caseSlug, assetSlug),
          thumbnailUrl,
          downloadUrl,
          storageKey,
          mimeType,
          input.size ?? null,
          input.width ?? null,
          input.height ?? null,
          now,
          now,
        ],
      );
    }

    await runSql(
      `UPDATE published_cases
       SET updated_at = ?
       WHERE id = ?`,
      [now, caseId],
    );
    linked += 1;
  }

  return { linked };
}
