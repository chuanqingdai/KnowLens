import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VOICE_WHITELIST = new Set(["Ting-Ting", "Samantha", "Daniel"]);
const DEFAULT_TTS_VOICE_ID = "basic_narrator_female";

type TtsProvider = "edge" | "openai";

type TtsVoiceConfig = {
  provider: TtsProvider;
  voiceName: string;
  languageCode?: string;
  gender: "male" | "female" | "neutral";
  model?: string;
  styleInstructions?: string;
};

export type TtsAudioResult = {
  data: Uint8Array;
  contentType: string;
};

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
    voiceName: "onyx",
    gender: "male",
    styleInstructions:
      "Speak like a calm documentary narrator for a science explainer. Use a grounded, credible tone, measured pacing, subtle emphasis on discoveries, and short pauses before important cause-and-effect ideas. Keep it authoritative but not dramatic.",
  },
  pro_documentary_female: {
    provider: "openai",
    voiceName: "nova",
    gender: "female",
    styleInstructions:
      "Speak like a polished educational presenter. Use warm clarity, graceful intonation, confident pacing, and gentle emphasis on key facts. Make the narration feel premium, composed, and easy to follow.",
  },
  pro_deep_science: {
    provider: "openai",
    voiceName: "onyx",
    gender: "male",
    styleInstructions:
      "Speak with a deep, serious science-documentary tone. Use slower pacing, thoughtful pauses, and restrained emphasis for complex terms. Sound precise, mature, and analytical without becoming monotonous.",
  },
  pro_bright_explainer: {
    provider: "openai",
    voiceName: "nova",
    gender: "female",
    styleInstructions:
      "Speak like an energetic short-form science explainer. Use bright intonation, lively emphasis, and a clear sense of momentum. Keep the delivery upbeat and engaging while preserving accuracy.",
  },
  pro_neutral_tech: {
    provider: "openai",
    voiceName: "echo",
    gender: "neutral",
    styleInstructions:
      "Speak like a clean technology analyst. Use crisp articulation, steady pacing, precise emphasis on mechanisms and numbers, and a modern professional tone. Avoid hype and keep it easy to scan by ear.",
  },
  pro_warm_host: {
    provider: "openai",
    voiceName: "shimmer",
    gender: "female",
    styleInstructions:
      "Speak like a friendly educational host. Use warm curiosity, conversational rhythm, and inviting emphasis on surprising facts. Sound approachable and expressive without sounding theatrical.",
  },
  pro_calm_teacher: {
    provider: "openai",
    voiceName: "alloy",
    gender: "neutral",
    styleInstructions:
      "Speak like a patient teacher explaining a concept step by step. Use calm pacing, clear pauses after each idea, and reassuring emphasis on definitions and transitions. Make it feel organized and understandable.",
  },
  pro_classic_storyteller: {
    provider: "openai",
    voiceName: "fable",
    gender: "neutral",
    styleInstructions:
      "Speak like a thoughtful educational storyteller. Use narrative cadence, gentle suspense, and expressive pauses that make facts feel connected. Keep it informative, not overly dramatic.",
  },
  pro_soft_presenter: {
    provider: "openai",
    voiceName: "shimmer",
    gender: "female",
    styleInstructions:
      "Speak with a soft, reassuring presenter tone. Use smooth phrasing, gentle rises and falls, and relaxed pacing. Make the narration feel calm, premium, and comfortable for learning.",
  },
  pro_balanced_narrator: {
    provider: "openai",
    voiceName: "alloy",
    gender: "neutral",
    styleInstructions:
      "Speak like a balanced professional narrator for visual explainers. Use natural intonation, steady pacing, and clear emphasis on conclusions, contrasts, and key terms. Keep the tone versatile and polished.",
  },
};

function resolveTtsVoice(voiceId?: string) {
  return TTS_VOICES[voiceId || ""] ?? TTS_VOICES[DEFAULT_TTS_VOICE_ID];
}

export function getWorkspaceTtsVoiceProvider(voiceId?: string) {
  return resolveTtsVoice(voiceId).provider;
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

function buildTtsStyleInstructions(text: string, voice: TtsVoiceConfig) {
  const base = voice.styleInstructions?.trim();
  if (!base) {
    return "";
  }

  const normalized = text.toLowerCase();
  const additions: string[] = [
    "Do not read as a flat transcript. Shape the delivery for a short visual video, with natural stress and clean pauses.",
  ];
  if (/[?？]/.test(text)) {
    additions.push("When a question appears, lift the tone slightly and leave a brief reflective pause after it.");
  }
  if (/\b(first|second|third|next|then|finally|step|process|cause|result|therefore)\b|首先|然后|接着|最后|步骤|流程|原因|结果/.test(normalized)) {
    additions.push("Make sequence words easy to hear, as if guiding the viewer through visible steps.");
  }
  if (/\b(vs|versus|compare|comparison|but|however|whereas|while)\b|对比|相比|但是|然而|优点|缺点/.test(normalized)) {
    additions.push("Add a small pause before contrast words and emphasize the difference without exaggeration.");
  }

  return [base, ...additions].join(" ").slice(0, 1200);
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

  const instructions = buildTtsStyleInstructions(text, voice);
  const basePayload = {
    model,
    input: text,
    voice: voice.voiceName,
    response_format: "mp3",
  };
  const speechUrl = `${baseUrl}/audio/speech`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const postSpeech = (payload: typeof basePayload & { instructions?: string }) =>
    fetch(speechUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

  let response = await postSpeech(
    instructions
      ? {
          ...basePayload,
          instructions,
        }
      : basePayload,
  );

  if (!response.ok && instructions && (response.status === 400 || response.status === 422)) {
    response = await postSpeech(basePayload);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim().slice(0, 240);
    throw new Error(
      detail
        ? `Premium TTS failed: ${response.status} ${detail}`
        : `Premium TTS failed: ${response.status}`,
    );
  }

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}

export async function synthesizeWorkspaceTtsAudio(input: {
  text: string;
  voice?: string;
  allowLocalFallback?: boolean;
}): Promise<TtsAudioResult> {
  const text = input.text.trim();
  const voice = resolveTtsVoice(input.voice);
  try {
    return voice.provider === "edge"
      ? await synthesizeWithEdge(text, voice)
      : await synthesizeWithOpenAi(text, voice);
  } catch (providerError) {
    const allowLocalFallback =
      input.allowLocalFallback ??
      (process.env.TTS_ALLOW_LOCAL_FALLBACK === "true" ||
        (process.env.NODE_ENV !== "production" && process.platform === "darwin"));
    if (!allowLocalFallback) {
      throw providerError;
    }
    return synthesizeWithLocalSay(text, voice);
  }
}
