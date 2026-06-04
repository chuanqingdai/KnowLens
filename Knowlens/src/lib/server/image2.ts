export type Image2FallbackProviderConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  resolution: "1K" | "2K" | "4K";
};

export type Image2AsyncProviderConfig = {
  endpoint: string;
  pollEndpoint?: string;
  apiKey: string;
  model: string;
};

export type Image2ProviderConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  duomiProvider?: Image2AsyncProviderConfig;
  fallbackProvider?: Image2FallbackProviderConfig;
};

export type Image2ProviderChoice = "auto" | "tuzi" | "duomi" | "gptsapi";

export type Image2ProviderSuccess = {
  ok: true;
  imageUrl: string;
  rawText: string;
};

export type Image2ProviderFailure = {
  ok: false;
  errorCode: string;
  errorMessage: string;
  detail?: string;
  status?: number;
  rawText?: string;
};

export type Image2ProviderResult = Image2ProviderSuccess | Image2ProviderFailure;

type Image2AllowedAspectRatio = "auto" | "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

const IMAGE2_ASPECT_RATIOS: ReadonlyArray<Image2AllowedAspectRatio> = [
  "auto",
  "1:1",
  "9:16",
  "16:9",
  "4:3",
  "3:4",
];

const PRIMARY_FAILURE_THRESHOLD = Number.parseInt(
  process.env.IMAGE2_PRIMARY_FAILURE_THRESHOLD || "3",
  10,
);
const FALLBACK_MODE_DURATION_MS = Number.parseInt(
  process.env.IMAGE2_FALLBACK_MODE_DURATION_MS || `${8 * 60 * 1000}`,
  10,
);
const PRIMARY_PROBE_INTERVAL_MS = Number.parseInt(
  process.env.IMAGE2_PRIMARY_PROBE_INTERVAL_MS || `${60 * 1000}`,
  10,
);
const FALLBACK_POLL_INTERVAL_MS = Number.parseInt(
  process.env.IMAGE2_FALLBACK_POLL_INTERVAL_MS || "1200",
  10,
);
const FALLBACK_POLL_MAX_ATTEMPTS = Number.parseInt(
  process.env.IMAGE2_FALLBACK_POLL_MAX_ATTEMPTS || "120",
  10,
);
const FALLBACK_CREATE_TIMEOUT_MS = Number.parseInt(
  process.env.IMAGE2_FALLBACK_CREATE_TIMEOUT_MS || "90000",
  10,
);
const FALLBACK_POLL_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.IMAGE2_FALLBACK_POLL_REQUEST_TIMEOUT_MS || "20000",
  10,
);
const FALLBACK_POLL_TOTAL_TIMEOUT_MS = Number.parseInt(
  process.env.IMAGE2_FALLBACK_POLL_TOTAL_TIMEOUT_MS || "360000",
  10,
);
const PROVIDER_FETCH_TIMEOUT_MS = Number.parseInt(
  process.env.IMAGE2_PROVIDER_FETCH_TIMEOUT_MS || "360000",
  10,
);

const image2CircuitState = {
  consecutivePrimaryFailures: 0,
  fallbackModeUntil: 0,
  lastPrimaryProbeAt: 0,
};

export const IMAGE2_SUPPORTED_SIZES = {
  square: "1024x1024",
  portrait916: "1024x1792",
  portraitLong: "864x2016",
  portrait23: "1152x1728",
  portrait45: "1152x1440",
  portrait34: "1152x1536",
  portraitA4: "1240x1754",
  landscape169: "1792x1024",
  landscape43: "1536x1152",
} as const;

function shouldAttachSeedImage(endpoint: string) {
  return /\/images\/edits(?:$|\?)/i.test(endpoint);
}

function isDuomiGenerationsEndpoint(endpoint: string) {
  return /duomiapi\.com\/v1\/images\/generations(?:$|\?)/i.test(endpoint.trim());
}

function resolveGenerationsEndpoint(endpoint: string) {
  if (/\/images\/edits(?:$|\?)/i.test(endpoint)) {
    return endpoint.replace(/\/images\/edits(?=$|\?)/i, "/images/generations");
  }
  return endpoint;
}

function pickFirstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function normalizeAspectRatioToken(value?: string): Image2AllowedAspectRatio {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) {
    return "auto";
  }
  if (raw.includes("1:1")) return "1:1";
  if (raw.includes("9:16")) return "9:16";
  if (raw.includes("16:9")) return "16:9";
  if (raw.includes("4:3")) return "4:3";
  if (raw.includes("3:4")) return "3:4";
  return "auto";
}

function resolveAspectRatioFromSize(size?: string): Image2AllowedAspectRatio {
  const normalized = (size || "").trim();
  if (normalized === IMAGE2_SUPPORTED_SIZES.square) return "1:1";
  if (normalized === IMAGE2_SUPPORTED_SIZES.portrait916) return "9:16";
  if (normalized === IMAGE2_SUPPORTED_SIZES.landscape169) return "16:9";
  if (normalized === IMAGE2_SUPPORTED_SIZES.landscape43) return "4:3";
  if (normalized === IMAGE2_SUPPORTED_SIZES.portrait34) return "3:4";
  return "auto";
}

function resolveFallbackAspectRatio(input: { aspectRatio?: string; size?: string }) {
  const fromAspectRatio = normalizeAspectRatioToken(input.aspectRatio);
  if (fromAspectRatio !== "auto") {
    return fromAspectRatio;
  }
  return resolveAspectRatioFromSize(input.size);
}

function isFallbackModeActive(now: number) {
  return image2CircuitState.fallbackModeUntil > now;
}

function shouldProbePrimaryDuringFallback(now: number) {
  return now - image2CircuitState.lastPrimaryProbeAt >= PRIMARY_PROBE_INTERVAL_MS;
}

function markPrimarySuccess() {
  image2CircuitState.consecutivePrimaryFailures = 0;
  image2CircuitState.fallbackModeUntil = 0;
}

function markPrimaryFailure() {
  image2CircuitState.consecutivePrimaryFailures += 1;
  if (image2CircuitState.consecutivePrimaryFailures >= Math.max(1, PRIMARY_FAILURE_THRESHOLD)) {
    image2CircuitState.fallbackModeUntil = Date.now() + Math.max(60_000, FALLBACK_MODE_DURATION_MS);
  }
}

function normalizeProviderFetchTimeoutMs() {
  if (!Number.isFinite(PROVIDER_FETCH_TIMEOUT_MS)) {
    return 360_000;
  }
  return Math.max(60_000, Math.min(360_000, PROVIDER_FETCH_TIMEOUT_MS));
}

export function resolveImage2Size(aspectRatio?: string) {
  const raw = (aspectRatio || "").trim().toLowerCase();
  if (!raw) {
    return IMAGE2_SUPPORTED_SIZES.square;
  }

  if (raw === "1:1" || raw === "poster-1-1") {
    return IMAGE2_SUPPORTED_SIZES.square;
  }
  if (raw === "4:3" || raw === "poster-4-3") {
    return IMAGE2_SUPPORTED_SIZES.landscape43;
  }
  if (raw === "9:21" || raw === "poster-9-21") {
    return IMAGE2_SUPPORTED_SIZES.portraitLong;
  }
  if (raw === "9:16" || raw === "poster-9-16") {
    return IMAGE2_SUPPORTED_SIZES.portrait916;
  }
  if (raw === "2:3" || raw === "poster-2-3") {
    return IMAGE2_SUPPORTED_SIZES.portrait23;
  }
  if (raw === "4:5" || raw === "poster-4-5") {
    return IMAGE2_SUPPORTED_SIZES.portrait45;
  }
  if (raw === "3:4" || raw === "poster-3-4") {
    return IMAGE2_SUPPORTED_SIZES.portrait34;
  }
  if (raw === "poster-a4") {
    return IMAGE2_SUPPORTED_SIZES.portraitA4;
  }
  if (raw === "16:9" || raw === "poster-16-9") {
    return IMAGE2_SUPPORTED_SIZES.landscape169;
  }

  const parsed = raw.match(/^(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)$/);
  if (parsed) {
    const left = Number(parsed[1]);
    const right = Number(parsed[2]);
    if (Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0) {
      const ratio = left / right;
      if (Math.abs(ratio - 1) <= 0.08) {
        return IMAGE2_SUPPORTED_SIZES.square;
      }
      if (Math.abs(ratio - 16 / 9) <= 0.08) {
        return IMAGE2_SUPPORTED_SIZES.landscape169;
      }
      if (Math.abs(ratio - 4 / 3) <= 0.08) {
        return IMAGE2_SUPPORTED_SIZES.landscape43;
      }
      if (Math.abs(ratio - 9 / 21) <= 0.05) {
        return IMAGE2_SUPPORTED_SIZES.portraitLong;
      }
      if (Math.abs(ratio - 9 / 16) <= 0.07) {
        return IMAGE2_SUPPORTED_SIZES.portrait916;
      }
      if (Math.abs(ratio - 2 / 3) <= 0.06) {
        return IMAGE2_SUPPORTED_SIZES.portrait23;
      }
      if (Math.abs(ratio - 4 / 5) <= 0.06) {
        return IMAGE2_SUPPORTED_SIZES.portrait45;
      }
      if (Math.abs(ratio - 3 / 4) <= 0.06) {
        return IMAGE2_SUPPORTED_SIZES.portrait34;
      }
      if (Math.abs(ratio - 1 / 1.4142) <= 0.05) {
        return IMAGE2_SUPPORTED_SIZES.portraitA4;
      }
      return IMAGE2_SUPPORTED_SIZES.square;
    }
  }

  return IMAGE2_SUPPORTED_SIZES.square;
}

export function extractImage2Url(data: unknown) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const obj = data as Record<string, unknown>;

  const extractFromOutputLike = (value: unknown): string => {
    if (!value) {
      return "";
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      return "";
    }
    if (typeof value !== "object") {
      return "";
    }
    const entry = value as Record<string, unknown>;
    const direct =
      (typeof entry.url === "string" && entry.url.trim()) ||
      (typeof entry.image_url === "string" && entry.image_url.trim()) ||
      (typeof entry.imageUrl === "string" && entry.imageUrl.trim()) ||
      (typeof entry.output_url === "string" && entry.output_url.trim()) ||
      "";
    if (direct) {
      return direct;
    }
    const nestedImage = entry.image;
    if (typeof nestedImage === "string" && nestedImage.trim()) {
      return nestedImage.trim();
    }
    return "";
  };

  const output = Array.isArray(obj.output) ? obj.output : [];
  for (const out of output) {
    const direct = extractFromOutputLike(out);
    if (direct) {
      return direct;
    }
    if (!out || typeof out !== "object") {
      continue;
    }
    const content = Array.isArray((out as Record<string, unknown>).content)
      ? ((out as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    for (const item of content) {
      const url = extractFromOutputLike(item);
      if (url) {
        return url;
      }
    }
  }

  const dataList = Array.isArray(obj.data) ? obj.data : [];
  for (const item of dataList) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const url = typeof (item as Record<string, unknown>).url === "string"
      ? ((item as Record<string, unknown>).url as string).trim()
      : "";
    if (url) {
      return url;
    }
  }

  const nestedData = obj.data;
  if (nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)) {
    const dataObj = nestedData as Record<string, unknown>;
    const outputs = Array.isArray(dataObj.outputs) ? dataObj.outputs : [];
    for (const outputItem of outputs) {
      const url = extractFromOutputLike(outputItem);
      if (url) {
        return url;
      }
    }
    const nestedOutput = Array.isArray(dataObj.output) ? dataObj.output : [];
    for (const outputItem of nestedOutput) {
      const url = extractFromOutputLike(outputItem);
      if (url) {
        return url;
      }
    }
  }

  const imageField = obj.image;
  if (typeof imageField === "string" && imageField.trim()) {
    return imageField.trim();
  }
  if (Array.isArray(imageField)) {
    const first = imageField.find((entry) => typeof entry === "string" && entry.trim());
    if (typeof first === "string") {
      return first.trim();
    }
  }

  const dataField = obj.data;
  if (dataField && typeof dataField === "object" && !Array.isArray(dataField)) {
    const dataObj = dataField as Record<string, unknown>;
    const nestedImage = dataObj.image;
    if (typeof nestedImage === "string" && nestedImage.trim()) {
      return nestedImage.trim();
    }
    if (Array.isArray(nestedImage)) {
      const first = nestedImage.find((entry) => typeof entry === "string" && entry.trim());
      if (typeof first === "string") {
        return first.trim();
      }
    }
    const direct = pickFirstString(
      dataObj.url,
      dataObj.image_url,
      dataObj.imageUrl,
      dataObj.output_url,
      dataObj.outputUrl,
      dataObj.result_url,
      dataObj.resultUrl,
    );
    if (direct) {
      return direct;
    }
  }

  const direct = pickFirstString(
    obj.url,
    obj.image_url,
    obj.imageUrl,
    obj.output_url,
    obj.outputUrl,
    obj.result_url,
    obj.resultUrl,
  );
  if (direct) {
    return direct;
  }

  const choices = Array.isArray(obj.choices) ? obj.choices : [];
  const choiceContent = choices[0] && typeof choices[0] === "object"
    ? (choices[0] as Record<string, unknown>).message
    : null;
  if (choiceContent && typeof choiceContent === "object") {
    const text = typeof (choiceContent as Record<string, unknown>).content === "string"
      ? ((choiceContent as Record<string, unknown>).content as string).trim()
      : "";
    if (text.startsWith("http://") || text.startsWith("https://")) {
      return text;
    }
  }

  return "";
}

function safeTextFromBody(body: unknown) {
  if (!body) {
    return "";
  }
  if (typeof body === "string") {
    return body.trim();
  }
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

function parseJsonBody(rawText: string) {
  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return null;
  }
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function normalizeResponseError(status: number, rawText: string, body: unknown): Image2ProviderFailure {
  const errorObject = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;
  const nestedError = errorObject && typeof errorObject === "object" ? (errorObject as Record<string, unknown>) : null;
  const detail =
    (nestedError?.message as string | undefined) ||
    (nestedError?.detail as string | undefined) ||
    rawText.slice(0, 360);
  const code =
    (nestedError?.code as string | undefined) ||
    `IMAGE2_HTTP_${status}`;
  return {
    ok: false,
    errorCode: code,
    errorMessage: (nestedError?.message as string | undefined) || "Image provider request failed.",
    detail,
    status,
    rawText,
  };
}

async function callImage2Endpoint(input: {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  signal: AbortSignal;
}) {
  return fetch(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      ...(shouldAttachSeedImage(input.endpoint)
        ? {
            messages: [
              {
                role: "user",
                content: input.prompt,
              },
            ],
          }
        : {
            prompt: input.prompt,
          }),
      size: input.size,
      quality: "standard",
      n: 1,
      response_format: "url",
    }),
    signal: input.signal,
  });
}

async function callGenerationsFallback(input: {
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  signal: AbortSignal;
}): Promise<Image2ProviderResult> {
  const fallbackResponse = await callImage2Endpoint({
    endpoint: resolveGenerationsEndpoint(input.endpoint),
    apiKey: input.apiKey,
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    signal: input.signal,
  });
  const fallbackText = await fallbackResponse.text();
  const fallbackBody = parseJsonBody(fallbackText);
  if (!fallbackResponse.ok) {
    return normalizeResponseError(fallbackResponse.status, fallbackText, fallbackBody);
  }
  const fallbackImageUrl = extractImage2Url(fallbackBody);
  if (!fallbackImageUrl) {
    return {
      ok: false,
      errorCode: "IMAGE2_NO_URL",
      errorMessage: "Provider returned success but no image URL was found.",
      detail: fallbackText.slice(0, 360),
      status: fallbackResponse.status,
      rawText: fallbackText,
    };
  }
  return {
    ok: true,
    imageUrl: fallbackImageUrl,
    rawText: fallbackText,
  };
}

function isGptsApiDoneStatus(statusValue: unknown) {
  const normalized = String(statusValue || "")
    .trim()
    .toLowerCase();
  return normalized === "completed" || normalized === "succeeded" || normalized === "success" || normalized === "done";
}

function isGptsApiFailedStatus(statusValue: unknown) {
  const normalized = String(statusValue || "")
    .trim()
    .toLowerCase();
  return normalized === "failed" || normalized === "error" || normalized === "cancelled" || normalized === "canceled";
}

function extractGptsApiPollUrl(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }
  const obj = body as Record<string, unknown>;
  const rootUrl = pickFirstString(
    obj.result_url,
    obj.resultUrl,
    obj.poll_url,
    obj.pollUrl,
    obj.url,
    obj.get,
  );
  if (rootUrl) {
    return rootUrl;
  }
  const rootGet =
    obj.urls && typeof obj.urls === "object"
      ? pickFirstString(
          (obj.urls as Record<string, unknown>).get,
          (obj.urls as Record<string, unknown>).result,
          (obj.urls as Record<string, unknown>).poll,
        )
      : null;
  if (rootGet) {
    return rootGet;
  }
  const data = obj.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    const nestedUrl = pickFirstString(
      dataObj.result_url,
      dataObj.resultUrl,
      dataObj.poll_url,
      dataObj.pollUrl,
      dataObj.url,
      dataObj.get,
    );
    if (nestedUrl) {
      return nestedUrl;
    }
    const nestedGet =
      dataObj.urls &&
      typeof dataObj.urls === "object"
        ? pickFirstString(
            (dataObj.urls as Record<string, unknown>).get,
            (dataObj.urls as Record<string, unknown>).result,
            (dataObj.urls as Record<string, unknown>).poll,
          )
        : null;
    if (nestedGet) {
      return nestedGet;
    }
  }
  return "";
}

function extractGptsApiTaskId(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }
  const obj = body as Record<string, unknown>;
  const rootId = pickFirstString(obj.id, obj.task_id, obj.taskId, obj.prediction_id, obj.predictionId);
  if (rootId) {
    return rootId;
  }
  const data = obj.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    const nestedId = pickFirstString(
      dataObj.id,
      dataObj.task_id,
      dataObj.taskId,
      dataObj.prediction_id,
      dataObj.predictionId,
    );
    if (nestedId) {
      return nestedId;
    }
  }
  return "";
}

function buildGptsApiPollCandidates(basePollUrl: string, taskId: string, createEndpoint?: string) {
  const candidates = new Set<string>();
  const trimmed = basePollUrl.trim();
  if (trimmed) {
    candidates.add(trimmed);
    candidates.add(appendQueryParam(trimmed, "no_cache", `${Date.now()}`));
  }
  if (taskId) {
    const cleanCreateEndpoint = (createEndpoint || "").trim().split("?")[0];
    if (cleanCreateEndpoint) {
      candidates.add(`${cleanCreateEndpoint}/${encodeURIComponent(taskId)}`);
      candidates.add(`${cleanCreateEndpoint}/${encodeURIComponent(taskId)}/result`);
      candidates.add(appendQueryParam(cleanCreateEndpoint, "id", taskId));
      candidates.add(appendQueryParam(cleanCreateEndpoint, "task_id", taskId));
    }
    candidates.add(`https://api.gptsapi.net/api/v3/predictions/${encodeURIComponent(taskId)}/result`);
    candidates.add(`https://api.gptsapi.net/api/v3/predictions/${encodeURIComponent(taskId)}`);
  }
  return Array.from(candidates).filter(Boolean);
}

function extractDuomiTaskId(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }
  const obj = body as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    const idValue = dataObj.id;
    if (typeof idValue === "string" && idValue.trim()) {
      return idValue.trim();
    }
  }
  const rootId = obj.id;
  if (typeof rootId === "string" && rootId.trim()) {
    return rootId.trim();
  }
  return "";
}

function isDuomiDoneStatus(statusValue: unknown) {
  const normalized = String(statusValue || "")
    .trim()
    .toLowerCase();
  return normalized === "completed" || normalized === "succeeded" || normalized === "success" || normalized === "done";
}

function isDuomiFailedStatus(statusValue: unknown) {
  const normalized = String(statusValue || "")
    .trim()
    .toLowerCase();
  return normalized === "failed" || normalized === "error" || normalized === "cancelled" || normalized === "canceled";
}

function appendQueryParam(url: string, key: string, value: string) {
  if (!url) {
    return url;
  }
  const hasQuery = url.includes("?");
  const hasTrailing = url.endsWith("?") || url.endsWith("&");
  if (hasQuery) {
    if (hasTrailing) {
      return `${url}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
    return `${url}&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
  return `${url}?${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function buildDuomiPollCandidates(createEndpoint: string, taskId: string, pollEndpoint?: string) {
  const trimmed = createEndpoint.trim();
  const withoutQuery = trimmed.split("?")[0];
  const candidates = new Set<string>();
  if (pollEndpoint?.trim()) {
    const cleanPoll = pollEndpoint.trim();
    const withPlaceholder = cleanPoll
      .replaceAll("{task_id}", encodeURIComponent(taskId))
      .replaceAll("{id}", encodeURIComponent(taskId))
      .replaceAll(":task_id", encodeURIComponent(taskId))
      .replaceAll(":id", encodeURIComponent(taskId));
    candidates.add(withPlaceholder);
    candidates.add(appendQueryParam(withPlaceholder, "task_id", taskId));
    candidates.add(appendQueryParam(withPlaceholder, "id", taskId));
  }
  if (trimmed) {
    candidates.add(trimmed);
    candidates.add(appendQueryParam(trimmed, "task_id", taskId));
    candidates.add(appendQueryParam(trimmed, "id", taskId));
  }
  if (withoutQuery) {
    candidates.add(withoutQuery);
    candidates.add(appendQueryParam(withoutQuery, "task_id", taskId));
    candidates.add(appendQueryParam(withoutQuery, "id", taskId));
    candidates.add(`${withoutQuery}/${encodeURIComponent(taskId)}`);
  }
  candidates.add(`https://duomiapi.com/v1/images/generations/${encodeURIComponent(taskId)}`);
  candidates.add(`https://duomiapi.com/v1/images/generations/result/${encodeURIComponent(taskId)}`);
  return Array.from(candidates);
}

async function requestDuomiFallbackGeneration(
  duomi: Image2AsyncProviderConfig,
  input: {
    prompt: string;
    aspectRatio: Image2AllowedAspectRatio;
  },
): Promise<Image2ProviderResult> {
  const createEndpoint = appendQueryParam(duomi.endpoint, "async", "true");
  const createController = new AbortController();
  const createTimeout = setTimeout(() => createController.abort(), Math.max(1000, FALLBACK_CREATE_TIMEOUT_MS));
  let taskId = "";
  let createRaw = "";

  try {
    const createResponse = await fetch(createEndpoint, {
      method: "POST",
      headers: {
        Authorization: duomi.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: duomi.model,
        prompt: input.prompt,
        size: input.aspectRatio === "auto" ? "1:1" : input.aspectRatio,
      }),
      signal: createController.signal,
    });
    createRaw = await createResponse.text();
    const createBody = parseJsonBody(createRaw);
    if (!createResponse.ok) {
      return {
        ok: false,
        errorCode: `DUOMI_HTTP_${createResponse.status}`,
        errorMessage: "Duomi image provider request failed.",
        detail: safeTextFromBody(createBody) || createRaw.slice(0, 360),
        status: createResponse.status,
        rawText: createRaw,
      };
    }

    const immediateUrl = extractImage2Url(createBody);
    if (immediateUrl) {
      return {
        ok: true,
        imageUrl: immediateUrl,
        rawText: createRaw,
      };
    }

    taskId = extractDuomiTaskId(createBody);
    if (!taskId) {
      return {
        ok: false,
        errorCode: "DUOMI_MISSING_TASK_ID",
        errorMessage: "Duomi response has no task id.",
        detail: createRaw.slice(0, 360),
        rawText: createRaw,
      };
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof DOMException && error.name === "AbortError" ? "DUOMI_TIMEOUT" : "DUOMI_FETCH_ERROR",
      errorMessage:
        error instanceof DOMException && error.name === "AbortError"
          ? "Duomi image provider request timed out."
          : "Duomi image provider request failed.",
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(createTimeout);
  }

  const pollCandidates = buildDuomiPollCandidates(duomi.endpoint, taskId, duomi.pollEndpoint);
  const pollStartedAt = Date.now();
  for (let attempt = 1; attempt <= Math.max(3, FALLBACK_POLL_MAX_ATTEMPTS); attempt += 1) {
    if (Date.now() - pollStartedAt >= Math.max(10_000, FALLBACK_POLL_TOTAL_TIMEOUT_MS)) {
      break;
    }
    for (const candidate of pollCandidates) {
      const pollController = new AbortController();
      const pollTimeout = setTimeout(
        () => pollController.abort(),
        Math.max(3000, FALLBACK_POLL_REQUEST_TIMEOUT_MS),
      );
      try {
        const pollResponse = await fetch(candidate, {
          method: "GET",
          headers: {
            Authorization: duomi.apiKey,
          },
          signal: pollController.signal,
        });
        const pollRaw = await pollResponse.text();
        const pollBody = parseJsonBody(pollRaw);
        if (!pollResponse.ok) {
          continue;
        }

        const imageUrl = extractImage2Url(pollBody);
        if (imageUrl) {
          return {
            ok: true,
            imageUrl,
            rawText: pollRaw,
          };
        }

        const rootStatus =
          pollBody && typeof pollBody === "object"
            ? (pollBody as Record<string, unknown>).status
            : null;
        const dataStatus =
          pollBody && typeof pollBody === "object"
            ? (pollBody as Record<string, unknown>).data &&
              typeof (pollBody as Record<string, unknown>).data === "object"
              ? ((pollBody as Record<string, unknown>).data as Record<string, unknown>).status
              : null
            : null;
        const currentStatus = dataStatus ?? rootStatus;
        if (isDuomiFailedStatus(currentStatus)) {
          return {
            ok: false,
            errorCode: "DUOMI_RESULT_FAILED",
            errorMessage: "Duomi provider returned failed status.",
            detail: safeTextFromBody(pollBody) || pollRaw.slice(0, 360),
            rawText: pollRaw,
          };
        }
        if (isDuomiDoneStatus(currentStatus)) {
          return {
            ok: false,
            errorCode: "DUOMI_NO_URL",
            errorMessage: "Duomi provider completed but image URL is empty.",
            detail: safeTextFromBody(pollBody) || pollRaw.slice(0, 360),
            rawText: pollRaw,
          };
        }
      } catch {
        continue;
      } finally {
        clearTimeout(pollTimeout);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, Math.max(600, FALLBACK_POLL_INTERVAL_MS)));
  }

  return {
    ok: false,
    errorCode: "DUOMI_POLL_TIMEOUT",
    errorMessage: "Duomi provider did not return image URL in time.",
    detail: createRaw ? `task_id=${taskId}` : "",
  };
}

async function requestGptsApiFallbackGeneration(
  fallback: Image2FallbackProviderConfig,
  input: {
    prompt: string;
    aspectRatio: Image2AllowedAspectRatio;
  },
): Promise<Image2ProviderResult> {
  const createController = new AbortController();
  const createTimeout = setTimeout(() => createController.abort(), Math.max(1000, FALLBACK_CREATE_TIMEOUT_MS));
  let pollUrl = "";
  let taskId = "";

  try {
    const createResponse = await fetch(fallback.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fallback.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        aspect_ratio: IMAGE2_ASPECT_RATIOS.includes(input.aspectRatio) ? input.aspectRatio : "auto",
        resolution: fallback.resolution,
      }),
      signal: createController.signal,
    });
    const createRaw = await createResponse.text();
    const createBody = parseJsonBody(createRaw);

    if (!createResponse.ok) {
      return {
        ok: false,
        errorCode: `GPTSAPI_HTTP_${createResponse.status}`,
        errorMessage: "Fallback image provider request failed.",
        detail: safeTextFromBody(createBody) || createRaw.slice(0, 360),
        status: createResponse.status,
        rawText: createRaw,
      };
    }

    const immediateUrl = extractImage2Url(createBody);
    if (immediateUrl) {
      return {
        ok: true,
        imageUrl: immediateUrl,
        rawText: createRaw,
      };
    }

    pollUrl = extractGptsApiPollUrl(createBody);
    taskId = extractGptsApiTaskId(createBody);
    if (!pollUrl && !taskId) {
      return {
        ok: false,
        errorCode: "GPTSAPI_MISSING_RESULT_URL",
        errorMessage: "Fallback provider response has no result URL or task id.",
        detail: createRaw.slice(0, 360),
        rawText: createRaw,
      };
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof DOMException && error.name === "AbortError" ? "GPTSAPI_TIMEOUT" : "GPTSAPI_FETCH_ERROR",
      errorMessage:
        error instanceof DOMException && error.name === "AbortError"
          ? "Fallback image provider request timed out."
          : "Fallback image provider request failed.",
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(createTimeout);
  }

  const pollCandidates = buildGptsApiPollCandidates(pollUrl, taskId, fallback.endpoint);
  const pollStartedAt = Date.now();
  let doneWithoutUrlCount = 0;
  let lastPollFailure: Image2ProviderFailure | null = null;
  let allNotFoundRounds = 0;

  for (let attempt = 1; attempt <= Math.max(3, FALLBACK_POLL_MAX_ATTEMPTS); attempt += 1) {
    if (Date.now() - pollStartedAt >= Math.max(10_000, FALLBACK_POLL_TOTAL_TIMEOUT_MS)) {
      break;
    }
    let notFoundCount = 0;
    let checkedCount = 0;
    for (const candidate of pollCandidates) {
      const pollController = new AbortController();
      const pollTimeout = setTimeout(
        () => pollController.abort(),
        Math.max(3000, FALLBACK_POLL_REQUEST_TIMEOUT_MS),
      );
      try {
        const pollResponse = await fetch(candidate, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${fallback.apiKey}`,
          },
          signal: pollController.signal,
        });
        const pollRaw = await pollResponse.text();
        const pollBody = parseJsonBody(pollRaw);
        checkedCount += 1;
        if (!pollResponse.ok) {
          lastPollFailure = {
            ok: false,
            errorCode: `GPTSAPI_POLL_HTTP_${pollResponse.status}`,
            errorMessage: "Fallback provider polling failed.",
            detail: safeTextFromBody(pollBody) || pollRaw.slice(0, 360),
            status: pollResponse.status,
            rawText: pollRaw,
          };
          if (pollResponse.status === 404) {
            notFoundCount += 1;
          }
          if (pollResponse.status === 404 || pollResponse.status >= 500 || pollResponse.status === 429) {
            continue;
          }
          return lastPollFailure;
        }

        const imageUrl = extractImage2Url(pollBody);
        if (imageUrl) {
          return {
            ok: true,
            imageUrl,
            rawText: pollRaw,
          };
        }

        const rootStatus =
          pollBody && typeof pollBody === "object"
            ? (pollBody as Record<string, unknown>).status
            : null;
        const dataStatus =
          pollBody && typeof pollBody === "object"
            ? (pollBody as Record<string, unknown>).data &&
              typeof (pollBody as Record<string, unknown>).data === "object"
              ? ((pollBody as Record<string, unknown>).data as Record<string, unknown>).status
              : null
            : null;
        const currentStatus = dataStatus ?? rootStatus;
        if (isGptsApiFailedStatus(currentStatus)) {
          return {
            ok: false,
            errorCode: "GPTSAPI_RESULT_FAILED",
            errorMessage: "Fallback provider returned failed status.",
            detail: safeTextFromBody(pollBody) || pollRaw.slice(0, 360),
            rawText: pollRaw,
          };
        }
        if (isGptsApiDoneStatus(currentStatus)) {
          doneWithoutUrlCount += 1;
          if (doneWithoutUrlCount >= 4) {
            return {
              ok: false,
              errorCode: "GPTSAPI_NO_URL",
              errorMessage: "Fallback provider completed but image URL is empty.",
              detail: safeTextFromBody(pollBody) || pollRaw.slice(0, 360),
              rawText: pollRaw,
            };
          }
        }
      } catch (error) {
        lastPollFailure = {
          ok: false,
          errorCode:
            error instanceof DOMException && error.name === "AbortError" ? "GPTSAPI_TIMEOUT" : "GPTSAPI_FETCH_ERROR",
          errorMessage:
            error instanceof DOMException && error.name === "AbortError"
              ? "Fallback provider polling timed out."
              : "Fallback provider polling failed.",
          detail: error instanceof Error ? error.message : "Unknown error",
        };
        if (attempt >= Math.max(3, FALLBACK_POLL_MAX_ATTEMPTS)) {
          return lastPollFailure;
        }
      } finally {
        clearTimeout(pollTimeout);
      }
    }
    if (checkedCount > 0 && notFoundCount === checkedCount) {
      allNotFoundRounds += 1;
      if (allNotFoundRounds >= 3 && lastPollFailure) {
        return {
          ...lastPollFailure,
          detail: [lastPollFailure.detail, `task_id=${taskId || "unknown"}`, `poll_candidates=${pollCandidates.length}`, "all_candidates_404=true"]
            .filter(Boolean)
            .join(" | "),
        };
      }
    } else {
      allNotFoundRounds = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, Math.max(600, FALLBACK_POLL_INTERVAL_MS)));
  }

  return lastPollFailure || {
    ok: false,
    errorCode: "GPTSAPI_POLL_TIMEOUT",
    errorMessage: "Fallback provider did not return image URL in time.",
    detail: taskId ? `task_id=${taskId};poll_candidates=${pollCandidates.length}` : `poll_candidates=${pollCandidates.length}`,
  };
}

async function requestPrimaryImage2Generation(
  config: Image2ProviderConfig,
  input: {
    prompt: string;
    size?: string;
  },
): Promise<Image2ProviderResult> {
  const retryDelaysMs = [500, 1200];
  const maxAttempts = retryDelaysMs.length + 1;
  let lastFailure: Image2ProviderFailure | null = null;
  const canTryGenerationsFallback = resolveGenerationsEndpoint(config.endpoint) !== config.endpoint;
  const providerFetchTimeoutMs = normalizeProviderFetchTimeoutMs();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), providerFetchTimeoutMs);
    try {
      const response = await callImage2Endpoint({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        prompt: input.prompt,
        size: input.size || IMAGE2_SUPPORTED_SIZES.square,
        signal: controller.signal,
      });

      const rawText = await response.text();
      const body = parseJsonBody(rawText);

      if (!response.ok) {
        const failure = normalizeResponseError(response.status, rawText, body);
        if (canTryGenerationsFallback) {
          const fallbackResult = await callGenerationsFallback({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            model: config.model,
            prompt: input.prompt,
            size: input.size || IMAGE2_SUPPORTED_SIZES.square,
            signal: controller.signal,
          });
          if (fallbackResult.ok) {
            return fallbackResult;
          }
          if (attempt >= maxAttempts || !isRetryableStatus(fallbackResult.status ?? 0)) {
            return fallbackResult;
          }
          lastFailure = fallbackResult;
          await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1] ?? 1200));
          continue;
        }
        const isRetryable = isRetryableStatus(response.status);
        if (isRetryable && attempt < maxAttempts) {
          lastFailure = failure;
          await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1] ?? 1200));
          continue;
        }
        return failure;
      }

      const imageUrl = extractImage2Url(body);
      if (!imageUrl) {
        if (canTryGenerationsFallback) {
          const fallbackResult = await callGenerationsFallback({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            model: config.model,
            prompt: input.prompt,
            size: input.size || IMAGE2_SUPPORTED_SIZES.square,
            signal: controller.signal,
          });
          if (fallbackResult.ok) {
            return fallbackResult;
          }
          if (attempt >= maxAttempts || !isRetryableStatus(fallbackResult.status ?? 0)) {
            return fallbackResult;
          }
          lastFailure = fallbackResult;
          await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1] ?? 1200));
          continue;
        }
        const errorFromBody =
          body && typeof body === "object"
            ? (body as Record<string, unknown>).error
            : null;
        const nestedError =
          errorFromBody && typeof errorFromBody === "object"
            ? (errorFromBody as Record<string, unknown>)
            : null;
        return {
          ok: false,
          errorCode: (nestedError?.code as string | undefined) || "IMAGE2_NO_URL",
          errorMessage: (nestedError?.message as string | undefined) || "Provider returned success but no image URL was found.",
          detail: rawText.slice(0, 360),
          status: response.status,
          rawText,
        };
      }

      return {
        ok: true,
        imageUrl,
        rawText,
      };
    } catch (error) {
      if (canTryGenerationsFallback) {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), providerFetchTimeoutMs);
        try {
          const fallbackResult = await callGenerationsFallback({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            model: config.model,
            prompt: input.prompt,
            size: input.size || IMAGE2_SUPPORTED_SIZES.square,
            signal: fallbackController.signal,
          });
          if (fallbackResult.ok) {
            return fallbackResult;
          }
          if (attempt < maxAttempts && isRetryableStatus(fallbackResult.status ?? 0)) {
            lastFailure = fallbackResult;
            await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1] ?? 1200));
            continue;
          }
          return fallbackResult;
        } catch (fallbackError) {
          const failure: Image2ProviderFailure = {
            ok: false,
            errorCode:
              fallbackError instanceof DOMException && fallbackError.name === "AbortError"
                ? "IMAGE2_TIMEOUT"
                : "IMAGE2_FETCH_ERROR",
            errorMessage:
              fallbackError instanceof DOMException && fallbackError.name === "AbortError"
                ? "Image provider request timed out."
                : "Image provider request failed.",
            detail: fallbackError instanceof Error ? fallbackError.message : "Unknown error",
          };
          if (attempt < maxAttempts) {
            lastFailure = failure;
            await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1] ?? 1200));
            continue;
          }
          return failure;
        } finally {
          clearTimeout(fallbackTimeout);
        }
      }
      const failure: Image2ProviderFailure = {
        ok: false,
        errorCode: error instanceof DOMException && error.name === "AbortError" ? "IMAGE2_TIMEOUT" : "IMAGE2_FETCH_ERROR",
        errorMessage:
          error instanceof DOMException && error.name === "AbortError"
            ? "Image provider request timed out."
            : "Image provider request failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      };
      if (attempt < maxAttempts) {
        lastFailure = failure;
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 1] ?? 1200));
        continue;
      }
      return failure;
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    lastFailure || {
      ok: false,
      errorCode: "IMAGE2_UNKNOWN",
      errorMessage: "Image provider request failed.",
    }
  );
}

export async function requestImage2Generation(
  config: Image2ProviderConfig,
  input: {
    prompt: string;
    size?: string;
    aspectRatio?: string;
  },
): Promise<Image2ProviderResult> {
  const fallbackAspectRatio = resolveFallbackAspectRatio({
    aspectRatio: input.aspectRatio,
    size: input.size,
  });
  const primaryIsDuomi = isDuomiGenerationsEndpoint(config.endpoint);
  const primaryIsGptsApi = /gptsapi\.net/i.test(config.endpoint);
  const chain: Array<{
    name: "tuzi" | "duomi" | "gptsapi";
    run: () => Promise<Image2ProviderResult>;
  }> = [];

  if (config.endpoint) {
    if (primaryIsDuomi) {
      chain.push({
        name: "duomi",
        run: () =>
          requestDuomiFallbackGeneration(
            {
              endpoint: config.endpoint,
              apiKey: config.apiKey,
              model: config.model,
            },
            {
              prompt: input.prompt,
              aspectRatio: fallbackAspectRatio,
            },
          ),
      });
    } else if (primaryIsGptsApi) {
      chain.push({
        name: "gptsapi",
        run: () =>
          requestGptsApiFallbackGeneration(
            config.fallbackProvider ?? {
              endpoint: config.endpoint,
              apiKey: config.apiKey,
              model: config.model,
              resolution: "1K",
            },
            {
              prompt: input.prompt,
              aspectRatio: fallbackAspectRatio,
            },
          ),
      });
    } else {
      chain.push({
        name: "tuzi",
        run: () => requestPrimaryImage2Generation(config, input),
      });
    }
  }

  if (!primaryIsDuomi && config.duomiProvider) {
    chain.push({
      name: "duomi",
      run: () =>
        requestDuomiFallbackGeneration(config.duomiProvider as Image2AsyncProviderConfig, {
          prompt: input.prompt,
          aspectRatio: fallbackAspectRatio,
        }),
    });
  }

  if (!primaryIsGptsApi && config.fallbackProvider) {
    chain.push({
      name: "gptsapi",
      run: () =>
        requestGptsApiFallbackGeneration(config.fallbackProvider as Image2FallbackProviderConfig, {
          prompt: input.prompt,
          aspectRatio: fallbackAspectRatio,
        }),
    });
  }

  let lastFailure: Image2ProviderFailure | null = null;
  for (const step of chain) {
    const result = await step.run();
    if (result.ok) {
      if (step.name === "tuzi") {
        markPrimarySuccess();
      }
      return result;
    }

    const detailParts = [result.detail, `provider=${step.name}`];
    lastFailure = {
      ...result,
      detail: detailParts.filter(Boolean).join(" | "),
    };

    if (step.name === "tuzi") {
      markPrimaryFailure();
    }
  }

  return lastFailure || {
    ok: false,
    errorCode: "IMAGE2_UNKNOWN",
    errorMessage: "Image provider request failed.",
  };
}

export function buildImage2ProviderConfig(choice: Image2ProviderChoice = "auto"): Image2ProviderConfig | null {
  const duomiEndpoint = process.env.IMAGE2_DUOMI_PROVIDER_ENDPOINT || "https://duomiapi.com/v1/images/generations";
  const duomiPollEndpoint = process.env.IMAGE2_DUOMI_PROVIDER_POLL_ENDPOINT || "";
  const duomiApiKey = process.env.IMAGE2_DUOMI_PROVIDER_API_KEY || "";
  const tuziEndpoint = process.env.IMAGE2_TUZI_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/edits";
  const tuziApiKey =
    process.env.IMAGE2_TUZI_PROVIDER_API_KEY ||
    process.env.IMAGE2_PROVIDER_API_KEY ||
    process.env.PAID_IMAGE_API_KEY ||
    process.env.PAID_LLM_API_KEY ||
    "";
  const tuziModel = process.env.IMAGE2_TUZI_PROVIDER_MODEL || process.env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";
  const duomiModel = process.env.IMAGE2_DUOMI_PROVIDER_MODEL || "gpt-image-2";
  const fallbackEndpoint =
    process.env.IMAGE2_FALLBACK_PROVIDER_ENDPOINT ||
    "https://api.gptsapi.net/api/v3/openai/gpt-image-2/text-to-image";
  const fallbackApiKey = process.env.IMAGE2_FALLBACK_PROVIDER_API_KEY || process.env.IMAGE2_GPTSAPI_PROVIDER_API_KEY || "";
  const fallbackModel = process.env.IMAGE2_FALLBACK_PROVIDER_MODEL || "gpt-image-2";

  if (choice === "tuzi") {
    if (!tuziApiKey) {
      return null;
    }
    return {
      endpoint: tuziEndpoint,
      apiKey: tuziApiKey,
      model: tuziModel,
    };
  }

  if (choice === "duomi") {
    const resolvedDuomiKey = duomiApiKey || process.env.IMAGE2_PROVIDER_API_KEY || "";
    if (!resolvedDuomiKey) {
      return null;
    }
    return {
      endpoint: duomiEndpoint,
      apiKey: resolvedDuomiKey,
      model: duomiModel,
      duomiProvider: {
        endpoint: duomiEndpoint,
        pollEndpoint: duomiPollEndpoint || undefined,
        apiKey: resolvedDuomiKey,
        model: duomiModel,
      },
    };
  }

  if (choice === "gptsapi") {
    if (!fallbackApiKey) {
      return null;
    }
    const fallbackResolutionRaw = (process.env.IMAGE2_FALLBACK_RESOLUTION || "1K").trim().toUpperCase();
    const fallbackResolution: "1K" | "2K" | "4K" =
      fallbackResolutionRaw === "2K" || fallbackResolutionRaw === "4K"
        ? fallbackResolutionRaw
        : "1K";
    return {
      endpoint: fallbackEndpoint,
      apiKey: fallbackApiKey,
      model: fallbackModel,
      fallbackProvider: {
        endpoint: fallbackEndpoint,
        apiKey: fallbackApiKey,
        model: fallbackModel,
        resolution: fallbackResolution,
      },
    };
  }

  const resolvedTuziKey =
    tuziApiKey ||
    process.env.IMAGE2_PROVIDER_API_KEY ||
    process.env.PAID_IMAGE_API_KEY ||
    process.env.PAID_LLM_API_KEY ||
    "";
  const resolvedDuomiKey =
    duomiApiKey ||
    process.env.IMAGE2_PROVIDER_API_KEY ||
    process.env.PAID_IMAGE_API_KEY ||
    process.env.PAID_LLM_API_KEY ||
    "";
  const fallbackResolutionRaw = (process.env.IMAGE2_FALLBACK_RESOLUTION || "1K").trim().toUpperCase();
  const fallbackResolution: "1K" | "2K" | "4K" =
    fallbackResolutionRaw === "2K" || fallbackResolutionRaw === "4K"
      ? fallbackResolutionRaw
      : "1K";

  const primaryProvider =
    resolvedTuziKey
      ? {
          endpoint: tuziEndpoint,
          apiKey: resolvedTuziKey,
          model: tuziModel,
        }
      : resolvedDuomiKey
        ? {
            endpoint: duomiEndpoint,
            apiKey: resolvedDuomiKey,
            model: duomiModel,
        }
        : fallbackApiKey
          ? {
              endpoint: fallbackEndpoint,
              apiKey: fallbackApiKey,
              model: fallbackModel,
            }
          : null;

  if (!primaryProvider) {
    return null;
  }

  const duomiProvider =
    resolvedDuomiKey
      ? {
          endpoint: duomiEndpoint,
          pollEndpoint: duomiPollEndpoint || undefined,
          apiKey: resolvedDuomiKey,
          model: duomiModel,
        }
      : undefined;

  const fallbackProvider =
    fallbackApiKey
      ? {
          endpoint: fallbackEndpoint,
          apiKey: fallbackApiKey,
          model: fallbackModel,
          resolution: fallbackResolution,
      }
      : undefined;

  return {
    endpoint: primaryProvider.endpoint,
    apiKey: primaryProvider.apiKey,
    model: primaryProvider.model,
    duomiProvider,
    fallbackProvider,
  };
}

export function toImage2ErrorPayload(result: Image2ProviderFailure) {
  return {
    code: result.errorCode,
    message: result.errorMessage,
    detail: result.detail,
    status: result.status,
  };
}
