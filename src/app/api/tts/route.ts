import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { isFreeUserBySubscriptionSafe } from "@/lib/server/store";
import {
  getWorkspaceTtsVoiceProvider,
  synthesizeWorkspaceTtsAudio,
} from "@/lib/server/tts-synthesis";

const MAX_TEXT_LEN = 600;

export const runtime = "nodejs";

type TtsPayload = {
  text?: string;
  voice?: string;
  sample?: boolean;
};

function toResponseBody(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function isTransientVoiceProviderError(message: string) {
  return /^Edge TTS (connection failed|timed out|returned no audio)$/.test(message) ||
    message === "WebSocket is not available for Edge TTS";
}

function toPublicTtsError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown tts error";
  if (isTransientVoiceProviderError(message)) {
    return {
      message: "Voice generation is temporarily unavailable. Please retry or choose another voice.",
      status: 503,
    };
  }
  return { message, status: 500 };
}

async function synthesizeTtsResponse(payload: TtsPayload) {
  try {
    const text = (payload.text ?? "").trim();
    const voiceProvider = getWorkspaceTtsVoiceProvider(payload.voice);
    const isSamplePreview = payload.sample === true;

    if (!text) {
      return new Response("text is required", { status: 400 });
    }

    if (text.length > MAX_TEXT_LEN) {
      return new Response("text is too long", { status: 400 });
    }

    if (voiceProvider === "openai" && isSamplePreview && text.length > 180) {
      return new Response("sample text is too long", { status: 400 });
    }

    if (voiceProvider === "openai" && !isSamplePreview) {
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

    const audio = await synthesizeWorkspaceTtsAudio({
      text,
      voice: payload.voice,
    });

    return new Response(toResponseBody(audio.data), {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const publicError = toPublicTtsError(error);
    return new Response(publicError.message, { status: publicError.status });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return synthesizeTtsResponse({
    text: url.searchParams.get("text") ?? "",
    voice: url.searchParams.get("voice") ?? "",
    sample: url.searchParams.get("sample") === "1" || url.searchParams.get("sample") === "true",
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as TtsPayload;
  return synthesizeTtsResponse(payload);
}
