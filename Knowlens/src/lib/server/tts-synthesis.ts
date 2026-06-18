const DEFAULT_TTS_VOICE_ID = "basic_narrator_female";

type TtsProvider = "openai";

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

export type FreeTtsFallbackProvider = "gpt_tts";

export type FreeTtsFallbackAudioResult = TtsAudioResult & {
  fallbackProvider: FreeTtsFallbackProvider;
};

const TTS_VOICES: Record<string, TtsVoiceConfig> = {
  basic_narrator_male: {
    provider: "openai",
    voiceName: "echo",
    languageCode: "en-US",
    gender: "male",
    styleInstructions:
      "Speak with a clear, friendly narrator voice for a short educational video. Use natural pacing, crisp articulation, and gentle emphasis on key ideas. Keep the tone polished, reliable, and easy to understand on mobile speakers.",
  },
  basic_narrator_female: {
    provider: "openai",
    voiceName: "nova",
    languageCode: "en-US",
    gender: "female",
    styleInstructions:
      "Speak with a clear, warm narrator voice for a short educational video. Use natural pacing, crisp articulation, and gentle emphasis on key ideas. Keep the tone polished, reliable, and easy to understand on mobile speakers.",
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

export function isBasicWorkspaceTtsVoice(voiceId?: string) {
  const resolvedVoiceId = TTS_VOICES[voiceId || ""] ? voiceId : DEFAULT_TTS_VOICE_ID;
  return resolvedVoiceId === "basic_narrator_male" || resolvedVoiceId === "basic_narrator_female";
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
    throw new Error("Missing GPT TTS API key");
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
    (isBasicWorkspaceTtsVoiceByConfig(voice)
      ? process.env.GPTSAPI_BASIC_TTS_MODEL?.trim() ||
        process.env.OPENAI_BASIC_TTS_MODEL?.trim()
      : undefined) ||
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

function isBasicWorkspaceTtsVoiceByConfig(voice: TtsVoiceConfig) {
  return voice === TTS_VOICES.basic_narrator_male || voice === TTS_VOICES.basic_narrator_female;
}

export async function synthesizeWorkspaceTtsAudio(input: {
  text: string;
  voice?: string;
  allowLocalFallback?: boolean;
}): Promise<TtsAudioResult> {
  const text = input.text.trim();
  const voice = resolveTtsVoice(input.voice);
  void input.allowLocalFallback;
  return synthesizeWithOpenAi(text, voice);
}

export async function synthesizeFreeBasicTtsFallbackAudio(input: {
  text: string;
  voice?: string;
  allowSilentFallback?: boolean;
}): Promise<FreeTtsFallbackAudioResult> {
  const text = input.text.trim();
  const voice = resolveTtsVoice(input.voice || DEFAULT_TTS_VOICE_ID);
  void input.allowSilentFallback;
  const audio = await synthesizeWithOpenAi(text, voice);
  return {
    ...audio,
    fallbackProvider: "gpt_tts",
  };
}
