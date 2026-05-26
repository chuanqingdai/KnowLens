import { NextRequest, NextResponse } from "next/server";
import { listUploadJobs, normalizeScope, updateUploadJob } from "@/lib/server/store";
import { enqueueUpload, runUploadJob, validateUploadFile } from "@/lib/server/upload";
import { rateLimitOrThrow } from "@/lib/server/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/server/rate-limit-config";

export const runtime = "nodejs";

type UploadJobRequest = {
  userEmail?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  sourceKind?: "file" | "web" | "youtube" | "podcast";
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
    const body = (await request.json()) as UploadJobRequest;
    const userEmail = (body.userEmail ?? "").trim().toLowerCase();
    const fileName = (body.fileName ?? "").trim();
    const mimeType = (body.mimeType ?? "").trim();
    const fileSize = Number(body.fileSize ?? 0);
    const sourceKind = body.sourceKind ?? "file";

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

    const job = enqueueUpload({
      userScope: normalizeScope(userEmail),
      fileName,
      mimeType,
      fileSize,
      sourceKind,
    });

    void runUploadJob(job.jobId, async () => {
      // P0: placeholder async worker. Replace with real object storage upload.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const storageKey = `uploads/${job.jobId}/${encodeURIComponent(fileName)}`;
      const publicUrl = process.env.KNOWLENS_CDN_BASE_URL
        ? `${process.env.KNOWLENS_CDN_BASE_URL.replace(/\/$/, "")}/${storageKey}`
        : null;
      return { storageKey, publicUrl: publicUrl ?? undefined };
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
