export type OutputLanguage = "en" | "zh" | "es" | "fr" | "de" | "ja" | "ko" | "pt";

type ResolveOutputLanguageInput = {
  userPrompt?: string;
  sourceText?: string;
  fallback?: OutputLanguage;
};

const EXPLICIT_LANGUAGE_PATTERNS: Array<{ language: OutputLanguage; patterns: RegExp[] }> = [
  {
    language: "zh",
    patterns: [
      /\b(in|output|respond|write)\s+(in\s+)?(chinese|mandarin|zh)\b/i,
      /\buse\s+(chinese|mandarin)\b/i,
      /用中文/,
      /中文输出/,
      /简体中文|繁體中文|繁体中文|汉语|漢語/,
    ],
  },
  {
    language: "en",
    patterns: [
      /\b(in|output|respond|write)\s+(in\s+)?(english|en)\b/i,
      /\buse\s+english\b/i,
      /用英文/,
      /英文输出/,
      /英语|英語/,
    ],
  },
  {
    language: "es",
    patterns: [/\b(in|output|respond|write)\s+(in\s+)?(spanish|espanol|español|es)\b/i, /西班牙语|西班牙語/],
  },
  {
    language: "fr",
    patterns: [/\b(in|output|respond|write)\s+(in\s+)?(french|francais|français|fr)\b/i, /法语|法語/],
  },
  {
    language: "de",
    patterns: [/\b(in|output|respond|write)\s+(in\s+)?(german|deutsch|de)\b/i, /德语|德語/],
  },
  {
    language: "ja",
    patterns: [/\b(in|output|respond|write)\s+(in\s+)?(japanese|ja)\b/i, /日语|日語|日本語/],
  },
  {
    language: "ko",
    patterns: [/\b(in|output|respond|write)\s+(in\s+)?(korean|ko)\b/i, /韩语|韓語|한국어/],
  },
  {
    language: "pt",
    patterns: [/\b(in|output|respond|write)\s+(in\s+)?(portuguese|portugues|português|pt)\b/i, /葡萄牙语|葡萄牙語/],
  },
];

function normalize(text: string) {
  return text.trim();
}

export function isChineseLanguage(language: OutputLanguage) {
  return language === "zh";
}

export function getLanguageTag(language: OutputLanguage) {
  switch (language) {
    case "zh":
      return "zh-CN";
    case "es":
      return "es-ES";
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "ja":
      return "ja-JP";
    case "ko":
      return "ko-KR";
    case "pt":
      return "pt-PT";
    case "en":
    default:
      return "en-US";
  }
}

export function extractExplicitOutputLanguage(text: string): OutputLanguage | null {
  const input = normalize(text);
  if (!input) {
    return null;
  }
  for (const item of EXPLICIT_LANGUAGE_PATTERNS) {
    if (item.patterns.some((pattern) => pattern.test(input))) {
      return item.language;
    }
  }
  return null;
}

export function detectInputLanguage(text: string): OutputLanguage {
  const input = normalize(text);
  if (!input) {
    return "en";
  }
  const han = (input.match(/[\u3400-\u9fff]/g) || []).length;
  const hiraganaKatakana = (input.match(/[\u3040-\u30ff]/g) || []).length;
  const hangul = (input.match(/[\uac00-\ud7af]/g) || []).length;
  const latin = (input.match(/[A-Za-z]/g) || []).length;

  if (han >= 2 && han >= latin * 0.3) {
    return "zh";
  }
  if (hiraganaKatakana >= 2) {
    return "ja";
  }
  if (hangul >= 2) {
    return "ko";
  }

  // Lightweight Latin-language hints
  if (/\b(el|la|los|las|para|con|que|de)\b/i.test(input) && /[áéíóúñ]/i.test(input)) {
    return "es";
  }
  if (/\b(le|la|les|des|pour|avec|que|de)\b/i.test(input) && /[àâçéèêëîïôûùüÿ]/i.test(input)) {
    return "fr";
  }
  if (/\b(der|die|das|und|mit|für|ist)\b/i.test(input)) {
    return "de";
  }
  if (/\b(o|a|os|as|para|com|que|de)\b/i.test(input) && /[ãõáàâêôç]/i.test(input)) {
    return "pt";
  }

  return "en";
}

export function resolveOutputLanguage(input: ResolveOutputLanguageInput): OutputLanguage {
  const fallback = input.fallback ?? "en";
  const userPrompt = normalize(input.userPrompt ?? "");
  const sourceText = normalize(input.sourceText ?? "");
  const explicit = extractExplicitOutputLanguage(userPrompt);
  if (explicit) {
    return explicit;
  }

  // Language should follow explicit user typing first.
  // This prevents uploaded source language from unexpectedly overriding
  // the user's requested/default output language.
  if (userPrompt) {
    return detectInputLanguage(userPrompt);
  }

  if (sourceText) {
    return detectInputLanguage(sourceText);
  }

  return fallback;
}
