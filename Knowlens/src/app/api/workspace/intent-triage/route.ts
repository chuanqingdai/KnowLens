import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TriageDirection = "poster" | "ppt" | "video" | "unknown";
type TriageClassification =
  | "invalid"
  | "pure_text_complete"
  | "pure_text_incomplete"
  | "source_plus_request"
  | "copied_text_plus_extra_request"
  | "multilingual"
  | "explicit_direction_intent";

type TriageResponse = {
  classification: TriageClassification;
  direction: TriageDirection;
  confidence: number;
  topic: string;
  reason: string;
  suggestions: string[];
};

type RequestBody = {
  input?: string;
  outputLanguage?: string;
  sources?: Array<{
    kind?: "file" | "web" | "youtube" | "podcast";
    name?: string;
    origin?: string;
    excerpt?: string;
  }>;
};

const DEFAULT_MODEL = process.env.GPTSAPI_INTENT_TRIAGE_MODEL || "gemini-2.5-flash";
const DEFAULT_ENDPOINT = process.env.GPTSAPI_INTENT_TRIAGE_ENDPOINT || "https://api.gptsapi.net/v1beta/models";
const DEFAULT_KEY =
  process.env.GPTSAPI_GEMINI_API_KEY ||
  process.env.GPTSAPI_FREE_API_KEY ||
  process.env.GPTSAPI_API_KEY ||
  "";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  return candidate.slice(firstBrace, lastBrace + 1);
}

function pickDirection(input: string): TriageDirection {
  const text = normalizeText(input);
  if (/(视频|分镜|口播|video|storyboard|voiceover)/i.test(text)) {
    return "video";
  }
  if (/(ppt|slide|slides|课件|幻灯)/i.test(text)) {
    return "ppt";
  }
  if (/(海报|长图|poster|infographic|封面)/i.test(text)) {
    return "poster";
  }
  return "unknown";
}

function cleanTopicText(value: string) {
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  const withoutGreeting = raw
    .replace(/^(hello|hi|hey|test|你好|在吗|测试|请问|麻烦|help)\b[:：]?\s*/i, "")
    .replace(/^(please|pls|can you|could you|i want to|need to|help me)\b[:：]?\s*/i, "")
    .trim();
  const withoutFiller = withoutGreeting
    .replace(/[\u3000\s]+/g, " ")
    .replace(/^(关于|帮我|请帮我|我想要|我想|需要|请生成|请制作)\s*/i, "")
    .replace(/^(a|an|the|one|some)\s+/i, "")
    .trim();
  return withoutFiller || raw;
}

function buildTopic(input: string) {
  const cleaned = cleanTopicText(
    input
    .replace(/^(please|help me|can you|i want to|need to|请|帮我|麻烦|我想|需要)?\s*(generate|create|make|build|生成|制作|做|创建)?/i, "")
    .replace(/(的)?(ppt|slides?|video|poster|infographic|长图|视频|海报).*/i, "")
    .replace(/[，。；,.]/g, " ")
    .trim(),
  );
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 32);
  }
  return cleanTopicText(input).slice(0, 32);
}

function buildTopicRelatedSuggestions(topic: string) {
  const seed = cleanTopicText(topic) || "this topic";
  return [
    `What is the core concept of ${seed}?`,
    `What are the key stages or steps of ${seed}?`,
    `How is ${seed} used in real life?`,
    `Explain ${seed} with one real-world case.`,
  ];
}

function heuristicFallback(input: string, sourcesCount: number): TriageResponse {
  const text = input.trim();
  const normalized = normalizeText(text);
  const direction = pickDirection(text);
  const topic = buildTopic(text);
  if (!text || /^(hello|hi|hey|test|你好|在吗|测试)$/i.test(text)) {
    return {
      classification: "invalid",
      direction: "unknown",
      confidence: 0.88,
      topic,
      reason: "Input is too short or missing a knowledge-task signal.",
      suggestions: buildTopicRelatedSuggestions(topic),
    };
  }
  if (sourcesCount > 0) {
    return {
      classification: "source_plus_request",
      direction,
      confidence: 0.82,
      topic,
      reason: "Source inputs are provided with user request.",
      suggestions: buildTopicRelatedSuggestions(topic),
    };
  }
  if (direction !== "unknown") {
    return {
      classification: "explicit_direction_intent",
      direction,
      confidence: 0.9,
      topic,
      reason: "Direction keywords are explicit.",
      suggestions: buildTopicRelatedSuggestions(topic),
    };
  }
  if (normalized.length < 8) {
    return {
      classification: "pure_text_incomplete",
      direction: "unknown",
      confidence: 0.76,
      topic,
      reason: "Topic exists but request is incomplete.",
      suggestions: buildTopicRelatedSuggestions(topic),
    };
  }
  return {
    classification: "pure_text_complete",
    direction: "unknown",
    confidence: 0.7,
    topic,
    reason: "Text request is coherent but no explicit output direction detected.",
    suggestions: buildTopicRelatedSuggestions(topic),
  };
}

function normalizeTriageResult(raw: Partial<TriageResponse>, input: string, sourcesCount: number): TriageResponse {
  const fallback = heuristicFallback(input, sourcesCount);
  const direction =
    raw.direction === "poster" || raw.direction === "ppt" || raw.direction === "video" || raw.direction === "unknown"
      ? raw.direction
      : fallback.direction;
  const classification: TriageClassification =
    raw.classification &&
    [
      "invalid",
      "pure_text_complete",
      "pure_text_incomplete",
      "source_plus_request",
      "copied_text_plus_extra_request",
      "multilingual",
      "explicit_direction_intent",
    ].includes(raw.classification)
      ? (raw.classification as TriageClassification)
      : fallback.classification;
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0.1, Math.min(0.99, raw.confidence))
      : fallback.confidence;
  const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim().slice(0, 60) : fallback.topic;
  const reason = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 300) : fallback.reason;
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  return {
    classification,
    direction,
    confidence,
    topic,
    reason,
    suggestions: suggestions.length ? suggestions : buildTopicRelatedSuggestions(topic),
  };
}

async function requestTriageFromModel(input: string, sourcesSummary: string, outputLanguage?: string) {
  if (!DEFAULT_KEY) {
    return null;
  }
  const systemPrompt = [
    "You are an intent triage model for a knowledge-to-visual generation product.",
    "Return JSON only. No markdown.",
    "Classify one user request into exactly one class:",
    "invalid, pure_text_complete, pure_text_incomplete, source_plus_request, copied_text_plus_extra_request, multilingual, explicit_direction_intent.",
    "Detect direction: poster | ppt | video | unknown.",
    "If user already mentions direction like video/ppt/poster, set classification=explicit_direction_intent.",
    "If topic is present but request incomplete, set pure_text_incomplete and provide 4 topic-related suggestions.",
    "If greeting or non-task text, set invalid.",
    "Output JSON keys exactly: classification, direction, confidence, topic, reason, suggestions.",
    "suggestions must be concise English strings and related to user topic.",
  ].join("\n");
  const userPrompt = [
    `Input language hint: ${outputLanguage || "auto"}`,
    `User input: ${input}`,
    `Sources summary: ${sourcesSummary || "none"}`,
  ].join("\n");

  const response = await fetch(`${DEFAULT_ENDPOINT}/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": DEFAULT_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
    }),
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    return null;
  }
  try {
    return JSON.parse(jsonText) as Partial<TriageResponse>;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const input = (body.input || "").trim().slice(0, 8000);
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const sourcesSummary = sources
      .slice(0, 6)
      .map((item, index) => {
        const kind = item.kind || "file";
        const name = (item.name || "").slice(0, 120);
        const origin = (item.origin || "").slice(0, 220);
        const excerpt = (item.excerpt || "").slice(0, 220);
        return `${index + 1}. [${kind}] ${name} ${origin} ${excerpt}`.trim();
      })
      .join("\n");

    if (!input) {
      return NextResponse.json({
        ok: true,
        triage: heuristicFallback("", sources.length),
      });
    }

    const modelResult = await requestTriageFromModel(input, sourcesSummary, body.outputLanguage);
    const triage = normalizeTriageResult(modelResult || {}, input, sources.length);
    return NextResponse.json({
      ok: true,
      triage,
    });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        triage: heuristicFallback("", 0),
      },
      { status: 200 },
    );
  }
}
