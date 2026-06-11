export type ImageBatchTaskResultLike = {
  taskId?: string;
  index?: number;
  status?: string;
  ok?: boolean;
  imageUrl?: string;
  renderUrl?: string;
  rawImageUrl?: string;
  image_url?: string;
  render_url?: string;
  raw_image_url?: string;
  error?: string | null;
  errorCode?: string | null;
};

export type NormalizedImageTaskResult = {
  task: ImageBatchTaskResultLike;
  resultPosition: number;
  backendTaskIndex: number | null;
  mappedStateIndex: number | null;
  normalizedStatus: string;
  finalImageUrl: string;
  shouldMarkSuccess: boolean;
};

const SUCCESS_STATUS_SET = new Set(["asset_ready", "completed", "success", "succeeded"]);
const ACTIVE_STATUS_SET = new Set(["queued", "running", "generating", "asset_downloading", "retrying", "processing"]);
const INDEX_OFFSET_CANDIDATES = [0, -1, 1] as const;

function toRoundedFiniteNumber(value: unknown) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    return null;
  }
  return Math.round(raw);
}

export function normalizeImageTaskStatus(status: unknown) {
  if (typeof status !== "string") {
    return "";
  }
  return status.trim().toLowerCase();
}

export function resolveFinalImageUrlFromTask(task: ImageBatchTaskResultLike | null | undefined) {
  if (!task || typeof task !== "object") {
    return "";
  }
  const candidates = [
    task.renderUrl,
    task.imageUrl,
    task.image_url,
    task.render_url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export function isImageTaskActiveStatus(status: unknown) {
  return ACTIVE_STATUS_SET.has(normalizeImageTaskStatus(status));
}

function resolveBestIndexOffset(requestedTaskIndexes: number[], taskResults: ImageBatchTaskResultLike[]) {
  const requestedSet = new Set(requestedTaskIndexes);
  let bestOffset = 0;
  let bestScore = -1;
  for (const offset of INDEX_OFFSET_CANDIDATES) {
    let score = 0;
    for (const task of taskResults) {
      const rounded = toRoundedFiniteNumber(task.index);
      if (rounded == null) {
        continue;
      }
      if (requestedSet.has(rounded + offset)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

export function normalizeImageBatchTaskResults(input: {
  taskResults: ImageBatchTaskResultLike[];
  requestedTaskIndexes: number[];
}) {
  const { taskResults, requestedTaskIndexes } = input;
  const requestedSet = new Set(requestedTaskIndexes);
  const usedMappedIndexes = new Set<number>();
  const bestOffset = resolveBestIndexOffset(requestedTaskIndexes, taskResults);

  return taskResults.map((task, resultPosition) => {
    const backendTaskIndex = toRoundedFiniteNumber(task.index);
    const normalizedStatus = normalizeImageTaskStatus(task.status);
    const finalImageUrl = resolveFinalImageUrlFromTask(task);
    const shouldMarkSuccess =
      Boolean(finalImageUrl) && (task.ok === true || SUCCESS_STATUS_SET.has(normalizedStatus));

    let mappedStateIndex: number | null = null;
    if (backendTaskIndex != null) {
      const candidate = backendTaskIndex + bestOffset;
      if (requestedSet.has(candidate) && !usedMappedIndexes.has(candidate)) {
        mappedStateIndex = candidate;
      }
    }
    if (mappedStateIndex == null) {
      const fallback = requestedTaskIndexes[resultPosition];
      if (Number.isFinite(fallback) && !usedMappedIndexes.has(fallback)) {
        mappedStateIndex = fallback;
      }
    }
    if (mappedStateIndex != null) {
      usedMappedIndexes.add(mappedStateIndex);
    }

    const normalized: NormalizedImageTaskResult = {
      task,
      resultPosition,
      backendTaskIndex,
      mappedStateIndex,
      normalizedStatus,
      finalImageUrl,
      shouldMarkSuccess,
    };
    return normalized;
  });
}

export function buildGenerationTaskStateByIndexFromNormalized(input: {
  normalizedResults: NormalizedImageTaskResult[];
  maxAttempts?: number;
  now?: number;
}) {
  const maxAttempts = Number.isFinite(input.maxAttempts) ? Number(input.maxAttempts) : 1;
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const nextStateByIndex: Record<
    number,
    {
      index: number;
      status: "success" | "failed";
      attempts: number;
      maxAttempts: number;
      imageUrl?: string;
      error?: string;
      startedAt: number;
      lastUpdatedAt: number;
    }
  > = {};

  input.normalizedResults.forEach((item) => {
    if (item.mappedStateIndex == null) {
      return;
    }
    if (item.shouldMarkSuccess) {
      nextStateByIndex[item.mappedStateIndex] = {
        index: item.mappedStateIndex,
        status: "success",
        attempts: 1,
        maxAttempts,
        imageUrl: item.finalImageUrl,
        startedAt: now,
        lastUpdatedAt: now,
      };
      return;
    }
    nextStateByIndex[item.mappedStateIndex] = {
      index: item.mappedStateIndex,
      status: "failed",
      attempts: 1,
      maxAttempts,
      error: item.task.error || "Generation failed.",
      startedAt: now,
      lastUpdatedAt: now,
    };
  });

  return nextStateByIndex;
}
