import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { isFreeUserBySubscriptionSafe } from "@/lib/server/store";

const execFileAsync = promisify(execFile);

const VOICE_WHITELIST = new Set(["Ting-Ting", "Samantha", "Daniel"]);
const MAX_TEXT_LEN = 600;
const DEFAULT_TTS_VOICE_ID = "basic_narrator_female";

export const runtime = "nodejs";

type TtsPayload = {
  text?: string;
  voice?: string;
  sample?: boolean;
};

type TtsProvider = "edge" | "openai";

type TtsVoiceConfig = {
  provider: TtsProvider;
  voiceName: string;
  languageCode?: string;
  gender: "male" | "female" | "neutral";
  model?: string;
};

type TtsAudioResult = {
  data: Uint8Array;
  contentType: string;
};

function toResponseBody(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

const TTS_VOICES: Record<string, TtsVoiceConfig> = {
  basic_narrator_male: {
    provider: "edge",
    voiceName: "en-US-GuyNeural",
    languageCode: "en-US",
    gender: "male",
  },
  basic_narrator_female: {
    provider: "edge",
    voiceName: "en-US-JennyNeural",
    languageCode: "en-US",
    gender: "female",
  },
  pro_documentary_male: {
    provider: "openai",
    voiceName: "cedar",
    gender: "male",
  },
  pro_documentary_female: {
    provider: "openai",
    voiceName: "marin",
    gender: "female",
  },
  pro_deep_science: {
    provider: "openai",
    voiceName: "onyx",
    gender: "male",
  },
  pro_bright_explainer: {
    provider: "openai",
    voiceName: "nova",
    gender: "female",
  },
  pro_neutral_tech: {
    provider: "openai",
    voiceName: "echo",
    gender: "neutral",
  },
  pro_warm_host: {
    provider: "openai",
    voiceName: "coral",
    gender: "female",
  },
  pro_calm_teacher: {
    provider: "openai",
    voiceName: "sage",
    gender: "neutral",
  },
  pro_classic_storyteller: {
    provider: "openai",
    voiceName: "fable",
    gender: "neutral",
  },
  pro_soft_presenter: {
    provider: "openai",
    voiceName: "shimmer",
    gender: "female",
  },
  pro_balanced_narrator: {
    provider: "openai",
    voiceName: "alloy",
    gender: "neutral",
  },
};

function resolveTtsVoice(voiceId?: string) {
  return TTS_VOICES[voiceId || ""] ?? TTS_VOICES[DEFAULT_TTS_VOICE_ID];
}

function getLocalFallbackVoice(voice: TtsVoiceConfig) {
  if (voice.gender === "male") {
    return "Daniel";
  }
  return "Samantha";
}

async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

async function synthesizeWithLocalSay(
  text: string,
  voice: TtsVoiceConfig,
): Promise<TtsAudioResult> {
  const basename = `knowlens-tts-${randomUUID()}`;
  const aiffPath = path.join(os.tmpdir(), `${basename}.aiff`);
  const wavPath = path.join(os.tmpdir(), `${basename}.wav`);
  try {
    const localVoice = getLocalFallbackVoice(voice);
    const safeVoice = VOICE_WHITELIST.has(localVoice) ? localVoice : "Samantha";
    await execFileAsync("/usr/bin/say", ["-v", safeVoice, "-o", aiffPath, text]);
    await execFileAsync("/usr/bin/afconvert", [
      "-f",
      "WAVE",
      "-d",
      "LEI16@48000",
      aiffPath,
      wavPath,
    ]);
    const data = await fs.readFile(wavPath);
    return {
      data,
      contentType: "audio/wav",
    };
  } finally {
    await safeUnlink(aiffPath);
    await safeUnlink(wavPath);
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeEdgeRequestId() {
  return randomUUID().replace(/-/g, "");
}

function edgeTimestamp() {
  return new Date().toISOString();
}

function edgeMessage(pathName: string, requestId: string, body: string) {
  return [
    `X-RequestId:${requestId}`,
    `X-Timestamp:${edgeTimestamp()}`,
    `Path:${pathName}`,
    "",
    body,
  ].join("\r\n");
}

function edgeBinaryToAudioBuffer(data: ArrayBuffer) {
  const buffer = Buffer.from(data);
  const marker = Buffer.from("Path:audio");
  const markerIndex = buffer.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }
  const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), markerIndex);
  if (headerEnd < 0) {
    return null;
  }
  return buffer.subarray(headerEnd + 4);
}

async function synthesizeWithEdge(
  text: string,
  voice: TtsVoiceConfig,
): Promise<TtsAudioResult> {
  if (typeof WebSocket === "undefined") {
    throw new Error("WebSocket is not available for Edge TTS");
  }

  const requestId = makeEdgeRequestId();
  const token =
    process.env.EDGE_TTS_TRUSTED_CLIENT_TOKEN?.trim() ||
    "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const outputFormat =
    process.env.EDGE_TTS_OUTPUT_FORMAT?.trim() ||
    "audio-24khz-48kbitrate-mono-mp3";
  const connectionId = makeEdgeRequestId();
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${encodeURIComponent(
    token,
  )}&ConnectionId=${connectionId}`;

  return await new Promise<TtsAudioResult>((resolve, reject) => {
    const ws = new WebSocket(url);
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Edge TTS timed out"));
    }, 45000);

    const cleanup = () => {
      clearTimeout(timeout);
    };

    ws.onerror = () => {
      cleanup();
      reject(new Error("Edge TTS connection failed"));
    };

    ws.onopen = () => {
      const speechConfig = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "false",
              },
              outputFormat,
            },
          },
        },
      };
      ws.send(edgeMessage("speech.config", requestId, JSON.stringify(speechConfig)));
      const ssml = `<speak version='1.0' xml:lang='${voice.languageCode ?? "en-US"}'><voice name='${voice.voiceName}'>${escapeXml(
        text,
      )}</voice></speak>`;
      ws.send(edgeMessage("ssml", requestId, ssml));
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          cleanup();
          ws.close();
          const data = Buffer.concat(chunks);
          if (!data.length) {
            reject(new Error("Edge TTS returned no audio"));
            return;
          }
          resolve({
            data,
            contentType: "audio/mpeg",
          });
        }
        return;
      }

      const arrayBuffer =
        event.data instanceof ArrayBuffer
          ? event.data
          : event.data instanceof Blob
            ? await event.data.arrayBuffer()
            : null;
      if (!arrayBuffer) {
        return;
      }
      const audioBuffer = edgeBinaryToAudioBuffer(arrayBuffer);
      if (audioBuffer?.length) {
        chunks.push(audioBuffer);
      }
    };
  });
}

async function synthesizeWithOpenAi(
  text: string,
  voice: TtsVoiceConfig,
): Promise<TtsAudioResult> {
  const apiKey =
    process.env.GPTSAPI_TTS_API_KEY?.trim() ||
    process.env.GPTSAPI_API_KEY?.trim() ||
    process.env.GPTSAPI_FREE_API_KEY?.trim() ||
    process.env.GPTSAPI_GEMINI_API_KEY?.trim() ||
    process.env.OPENAI_TTS_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing premium TTS API key");
  }

  const baseUrl = (
    process.env.GPTSAPI_TTS_BASE_URL?.trim() ||
    process.env.GPTSAPI_BASE_URL?.trim() ||
    process.env.OPENAI_TTS_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    voice.model ||
    process.env.GPTSAPI_TTS_MODEL?.trim() ||
    process.env.OPENAI_TTS_MODEL?.trim() ||
    "gpt-4o-mini-tts";
  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      voice: voice.voiceName,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    throw new Error(`Premium TTS failed: ${response.status}`);
  }

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TtsPayload;
    const text = (payload.text ?? "").trim();
    const voice = resolveTtsVoice(payload.voice);
    const isSamplePreview = payload.sample === true;

    if (!text) {
      return new Response("text is required", { status: 400 });
    }

    if (text.length > MAX_TEXT_LEN) {
      return new Response("text is too long", { status: 400 });
    }

    if (voice.provider === "openai" && isSamplePreview && text.length > 180) {
      return new Response("sample text is too long", { status: 400 });
    }

    if (voice.provider === "openai" && !isSamplePreview) {
      const session = await getServerSession(nextAuthOptions);
      const email = session?.user?.email?.trim().toLowerCase();
      if (!email) {
        return new Response("Premium TTS requires sign in", { status: 401 });
      }
      const isFreeUser = await isFreeUserBySubscriptionSafe({
        email,
        source: "tts_api",
      });
      if (isFreeUser) {
        return new Response("Premium TTS requires membership", { status: 403 });
      }
    }

    let audio: TtsAudioResult;
    try {
      audio =
        voice.provider === "edge"
          ? await synthesizeWithEdge(text, voice)
          : await synthesizeWithOpenAi(text, voice);
    } catch (providerError) {
      const allowLocalFallback = process.env.TTS_ALLOW_LOCAL_FALLBACK !== "false";
      if (!allowLocalFallback) {
        throw providerError;
      }
      audio = await synthesizeWithLocalSay(text, voice);
    }

    return new Response(toResponseBody(audio.data), {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tts error";
    return new Response(message, { status: 500 });
  }
}
