import { NextRequest, NextResponse } from "next/server";
import { buildImage2ProviderConfig } from "@/lib/server/image2";

export const runtime = "nodejs";
export const maxDuration = 300;

function isLocalOnly(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return false;
  const host = req.headers.get("host") || "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findUrl(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const directKeys = ["url", "image_url", "imageUrl", "output_url", "outputUrl", "result_url", "resultUrl"];
  for (const key of directKeys) {
    const value = obj[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  for (const key of ["data", "output", "images", "result"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = typeof item === "string" ? item : findUrl(item);
        if (typeof found === "string" && found) return found;
      }
    } else {
      const found = findUrl(value);
      if (found) return found;
    }
  }
  return "";
}

function findTaskId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  for (const key of ["task_id", "taskId", "id", "job_id", "jobId"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const nested = obj.data || obj.result;
  if (nested && nested !== data) return findTaskId(nested);
  return "";
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text, body: parseJson(text) };
  } finally {
    clearTimeout(timeout);
  }
}

async function testTuziJson(referenceUrl: string, prompt: string) {
  const config = buildImage2ProviderConfig("tuzi");
  if (!config) return { ok: false, error: "missing_tuzi_config" };
  const endpoint = config.endpoint.replace(/\/images\/generations(?=$|\?)/i, "/images/edits");
  const { response, text, body } = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      size: "1024x1024",
      n: 1,
      response_format: "url",
      image_url: referenceUrl,
      image: referenceUrl,
      image_urls: [referenceUrl],
      reference_images: [referenceUrl],
    }),
  });
  return {
    ok: response.ok && Boolean(findUrl(body)),
    status: response.status,
    contentType: response.headers.get("content-type"),
    imageUrl: findUrl(body),
    bodyPreview: text.slice(0, 500),
  };
}

async function testTuziMultipart(referenceUrl: string, prompt: string) {
  const config = buildImage2ProviderConfig("tuzi");
  if (!config) return { ok: false, error: "missing_tuzi_config" };
  const imageResponse = await fetch(referenceUrl);
  const imageBlob = await imageResponse.blob();
  const form = new FormData();
  form.append("model", config.model);
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("n", "1");
  form.append("response_format", "url");
  form.append("image", imageBlob, "reference.png");
  const endpoint = config.endpoint.replace(/\/images\/generations(?=$|\?)/i, "/images/edits");
  const { response, text, body } = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  });
  return {
    ok: response.ok && Boolean(findUrl(body)),
    status: response.status,
    contentType: response.headers.get("content-type"),
    imageUrl: findUrl(body),
    bodyPreview: text.slice(0, 500),
  };
}

async function pollDuomi(endpoint: string, apiKey: string, taskId: string) {
  const candidates = [
    `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(taskId)}`,
    `https://duomiapi.com/v1/tasks/${encodeURIComponent(taskId)}`,
    `https://duomiapi.com/v1/images/generations/${encodeURIComponent(taskId)}`,
    `https://duomiapi.com/v1/images/generations/result/${encodeURIComponent(taskId)}`,
  ];
  const attempts: Array<{ status: number; imageUrl: string; bodyPreview: string }> = [];
  for (let round = 0; round < 4; round += 1) {
    for (const url of candidates) {
      try {
        const { response, text, body } = await fetchJson(url, {
          method: "GET",
          headers: { Authorization: apiKey, Accept: "application/json" },
        }, 20_000);
        const imageUrl = findUrl(body);
        attempts.push({ status: response.status, imageUrl, bodyPreview: text.slice(0, 240) });
        if (imageUrl) return { ok: true, imageUrl, attempts: attempts.slice(-4) };
      } catch (error) {
        attempts.push({
          status: 0,
          imageUrl: "",
          bodyPreview: error instanceof Error ? error.message.slice(0, 240) : "poll error",
        });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return { ok: false, imageUrl: "", attempts: attempts.slice(-6) };
}

async function testDuomiJson(referenceUrl: string, prompt: string) {
  try {
    const config = buildImage2ProviderConfig("duomi");
    if (!config) return { ok: false, error: "missing_duomi_config" };
    const endpoint = `${config.endpoint}${config.endpoint.includes("?") ? "&" : "?"}async=true`;
    const { response, text, body } = await fetchJson(endpoint, {
      method: "POST",
      headers: {
        Authorization: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        size: "1:1",
        image_url: referenceUrl,
        image: referenceUrl,
        image_urls: [referenceUrl],
        reference_images: [referenceUrl],
      }),
    }, 60_000);
    const immediateUrl = findUrl(body);
    const taskId = findTaskId(body);
    const polled = immediateUrl || !taskId ? null : await pollDuomi(config.endpoint, config.apiKey, taskId);
    return {
      ok: response.ok && Boolean(immediateUrl || polled?.imageUrl),
      status: response.status,
      contentType: response.headers.get("content-type"),
      taskId,
      imageUrl: immediateUrl || polled?.imageUrl || "",
      createBodyPreview: text.slice(0, 500),
      pollPreview: polled?.attempts,
    };
  } catch (error) {
    return {
      ok: false,
      error: "duomi_reference_test_failed",
      detail: error instanceof Error ? error.message.slice(0, 500) : String(error),
    };
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalOnly(req)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    mode?: string;
    taskId?: string;
    referenceUrl?: string;
    prompt?: string;
  };
  const referenceUrl =
    body.referenceUrl ||
    "https://knowlens.ai/picture/recipe-infographic-maker.jpg";
  const prompt =
    body.prompt ||
    "Use the provided reference image as the visual guide. Create a fresh square image with the same overall infographic-card composition, but change the subject to a simple green apple recipe card. Keep the layout clean and readable.";

  if (body.provider === "tuzi" && body.mode === "multipart") {
    return NextResponse.json(await testTuziMultipart(referenceUrl, prompt));
  }
  if (body.provider === "tuzi") {
    return NextResponse.json(await testTuziJson(referenceUrl, prompt));
  }
  if (body.provider === "duomi") {
    if (body.taskId) {
      const config = buildImage2ProviderConfig("duomi");
      if (!config) return NextResponse.json({ ok: false, error: "missing_duomi_config" });
      return NextResponse.json(await pollDuomi(config.endpoint, config.apiKey, body.taskId));
    }
    return NextResponse.json(await testDuomiJson(referenceUrl, prompt));
  }
  return NextResponse.json({
    tuziJson: await testTuziJson(referenceUrl, prompt),
    tuziMultipart: await testTuziMultipart(referenceUrl, prompt),
    duomiJson: await testDuomiJson(referenceUrl, prompt),
  });
}
