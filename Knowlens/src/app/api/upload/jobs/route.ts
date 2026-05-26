import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { listUploadJobs, normalizeScope, updateUploadJob } from "../../../../lib/server/store";
import {
  buildUploadWorkerResult,
  enqueueUpload,
  runUploadJob,
  validateUploadFile,
} from "../../../../lib/server/upload";
import { rateLimitOrThrow } from "../../../../lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "../../../../lib/server/rate-limit-config";

export const runtime = "nodejs";

type UploadJobRequest = {
  userEmail?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  sourceKind?: "file" | "web" | "youtube" | "podcast";
  sourceUrl?: string;
  sourceText?: string;
  inputPath?: string;
};

function getScopeFromRequest(req: NextRequest, bodyUserEmail?: string) {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  const userScope = normalizeScope(bodyUserEmail);
  return userScope === "guest" ? `ip:${ip}` : `user:${userScope}`;
}

export async function GET(request: NextRequest) {
  const userEmail = request.nextUrl.searchParams.get("userEmail");
  const scope = normalizeScope(userEmail);
  const jobs = listUploadJobs(scope === "guest" ? undefined : scope);
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: UploadJobRequest;
    let uploadFile: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {
        userEmail: String(formData.get("userEmail") ?? ""),
        fileName: String(formData.get("fileName") ?? ""),
        mimeType: String(formData.get("mimeType") ?? ""),
        fileSize: Number(formData.get("fileSize") ?? 0),
        sourceKind: (String(formData.get("sourceKind") ?? "file") as UploadJobRequest["sourceKind"]) ?? "file",
        sourceUrl: String(formData.get("sourceUrl") ?? ""),
        sourceText: String(formData.get("sourceText") ?? ""),
        inputPath: String(formData.get("inputPath") ?? ""),
      };
      const file = formData.get("file");
      uploadFile = file instanceof File ? file : null;
    } else {
      body = (await request.json()) as UploadJobRequest;
    }
    const userEmail = (body.userEmail ?? "").trim().toLowerCase();
    const fileName = (body.fileName ?? "").trim();
    const mimeType = (body.mimeType ?? "").trim();
    const fileSize = Number(body.fileSize ?? 0);
    const sourceKind = body.sourceKind ?? "file";
    const sourceUrl = (body.sourceUrl ?? "").trim();
    const sourceText = (body.sourceText ?? "").trim();

    const scopeKey = getScopeFromRequest(request, userEmail);
    rateLimitOrThrow({
      scopeKey,
      endpoint: "upload-job-create",
      limit: RATE_LIMIT_CONFIG.uploadJobCreate.limit,
      windowMs: RATE_LIMIT_CONFIG.uploadJobCreate.windowMs,
    });

    const valid = validateUploadFile({
      name: fileName,
      type: mimeType,
      size: fileSize,
    });
    if (!valid.ok) {
      return NextResponse.json(
        {
          error: valid.reason,
        },
        { status: 400 },
      );
    }

    const tempInputPath =
      uploadFile && sourceKind === "file"
        ? path.join(
            "/tmp",
            `knowlens-upload-${Date.now()}-${fileName.replace(/[^a-z0-9.-]+/gi, "_").slice(0, 80) || "file"}`,
          )
        : body.inputPath?.trim() || undefined;
    if (uploadFile && tempInputPath) {
      await writeFile(tempInputPath, Buffer.from(await uploadFile.arrayBuffer()));
    }

    const job = enqueueUpload({
      userScope: normalizeScope(userEmail),
      fileName,
      mimeType,
      fileSize,
      sourceKind,
      sourceUrl: sourceUrl || undefined,
      inputPath: tempInputPath,
      sourceText: sourceText || undefined,
    });

    void runUploadJob(job.jobId, async () => {
      try {
        return await buildUploadWorkerResult({
          jobId: job.jobId,
          fileName,
          mimeType,
          fileSize,
          sourceKind,
          sourceUrl: sourceUrl || undefined,
          inputPath: tempInputPath,
          sourceText: sourceText || undefined,
        });
      } finally {
        if (tempInputPath) {
          await unlink(tempInputPath).catch(() => undefined);
        }
      }
    });

    return NextResponse.json({
      job,
      message: "Upload job queued",
    });
  } catch (error) {
    const retryAfter = (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds;
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many upload requests. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
    const message = error instanceof Error ? error.message : "Upload queue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      jobId?: string;
      status?: string;
      progress?: number;
      attempts?: number;
      errorMessage?: string | null;
      errorCode?: string | null;
      resultExcerpt?: string | null;
      resultText?: string | null;
      resultKind?: string | null;
      sourceUrl?: string | null;
    };
    const jobId = (body.jobId ?? "").trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    const next = updateUploadJob(jobId, {
      status: body.status,
      progress: body.progress,
      attempts: body.attempts,
      errorMessage: body.errorMessage,
      errorCode: body.errorCode,
      resultExcerpt: body.resultExcerpt,
      resultText: body.resultText,
      resultKind: body.resultKind,
      sourceUrl: body.sourceUrl,
    });
    if (!next) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
