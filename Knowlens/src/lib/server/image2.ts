export type Image2ProviderConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

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

const SEED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnM5m8AAAAASUVORK5CYII=";

function shouldAttachSeedImage(endpoint: string) {
  return /\/images\/edits(?:$|\?)/i.test(endpoint);
}

function resolveGenerationsEndpoint(endpoint: string) {
  if (/\/images\/edits(?:$|\?)/i.test(endpoint)) {
    return endpoint.replace(/\/images\/edits(?=$|\?)/i, "/images/generations");
  }
  return endpoint;
}

export function resolveImage2Size(aspectRatio?: string) {
  const raw = (aspectRatio || "").trim().toLowerCase();
  if (!raw) {
    return IMAGE2_SUPPORTED_SIZES.square;
  }

  if (raw === "1:1" || raw === "poster-1-1") {
    return IMAGE2_SUPPORTED_SIZES.square;
  }
  if (raw === "4:3") {
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

  const output = Array.isArray(obj.output) ? obj.output : [];
  for (const out of output) {
    if (!out || typeof out !== "object") {
      continue;
    }
    const content = Array.isArray((out as Record<string, unknown>).content)
      ? ((out as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    for (const item of content) {
      const url = typeof item.url === "string" ? item.url.trim() : "";
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
  if (shouldAttachSeedImage(input.endpoint)) {
    const formData = new FormData();
    formData.append("model", input.model);
    const seedPng = Buffer.from(SEED_PNG_BASE64, "base64");
    formData.append(
      "image",
      new File([seedPng], "seed.png", {
        type: "image/png",
      }),
    );
    formData.append(
      "messages",
      JSON.stringify([
        {
          role: "user",
          content: input.prompt,
        },
      ]),
    );
    formData.append("size", input.size);
    formData.append("quality", "standard");
    formData.append("n", "1");
    formData.append("response_format", "url");
    return fetch(input.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: formData,
      signal: input.signal,
    });
  }

  return fetch(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
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

export async function requestImage2Generation(
  config: Image2ProviderConfig,
  input: {
    prompt: string;
    size?: string;
  },
): Promise<Image2ProviderResult> {
  const retryDelaysMs = [500, 1200];
  const maxAttempts = retryDelaysMs.length + 1;
  let lastFailure: Image2ProviderFailure | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
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
        const shouldFallbackToGenerations =
          shouldAttachSeedImage(config.endpoint) &&
          resolveGenerationsEndpoint(config.endpoint) !== config.endpoint &&
          (response.status >= 500 ||
            failure.errorCode === "json_marshal_failed" ||
            /image is required/i.test(failure.detail || ""));
        if (shouldFallbackToGenerations) {
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
      const shouldFallbackToGenerations =
        shouldAttachSeedImage(config.endpoint) &&
        resolveGenerationsEndpoint(config.endpoint) !== config.endpoint;
      if (shouldFallbackToGenerations) {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 120000);
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

export function buildImage2ProviderConfig(): Image2ProviderConfig | null {
  const endpoint = process.env.IMAGE2_PROVIDER_ENDPOINT || "https://api.tu-zi.com/v1/images/generations";
  const apiKey =
    process.env.IMAGE2_PROVIDER_API_KEY ||
    process.env.PAID_IMAGE_API_KEY ||
    process.env.PAID_LLM_API_KEY ||
    "";
  const model = process.env.IMAGE2_PROVIDER_MODEL || "gpt-image-2";

  if (!apiKey) {
    return null;
  }

  return {
    endpoint,
    apiKey,
    model,
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
