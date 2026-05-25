import { createUploadJob, updateUploadJob } from "./store";

export const MAX_UPLOAD_SIZE_BYTES = 80 * 1024 * 1024;
export const MAX_TEXT_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_CONCURRENCY = 3;
export const MAX_UPLOAD_RETRIES = 3;

export type UploadSourceKind = "file" | "web" | "youtube" | "podcast";

export type EnqueuedUpload = {
  jobId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceKind: UploadSourceKind;
};

const allowedMimePrefixes = [
  "text/",
  "image/",
  "audio/",
  "video/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export function validateUploadFile(file: { name: string; type: string; size: number }) {
  if (!file.name.trim()) {
    return { ok: false, reason: "文件名不能为空" };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "文件内容为空" };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, reason: "文件过大，请压缩后再试" };
  }
  if (!allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    return { ok: false, reason: "暂不支持当前文件类型" };
  }
  return { ok: true as const };
}

export function enqueueUpload(input: {
  userScope: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sourceKind: UploadSourceKind;
}) {
  const jobId = createUploadJob(input);
  return {
    jobId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    sourceKind: input.sourceKind,
  } satisfies EnqueuedUpload;
}

export async function runUploadJob(jobId: string, worker: () => Promise<{ storageKey?: string; publicUrl?: string }>) {
  updateUploadJob(jobId, { status: "processing", progress: 10, attempts: 1 });
  try {
    const result = await worker();
    updateUploadJob(jobId, {
      status: "done",
      progress: 100,
      storageKey: result.storageKey ?? null,
      publicUrl: result.publicUrl ?? null,
    });
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    updateUploadJob(jobId, {
      status: "failed",
      progress: 100,
      errorMessage: message,
    });
    return { ok: false as const, error: message };
  }
}

