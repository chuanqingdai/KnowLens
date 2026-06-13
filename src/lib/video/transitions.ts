export type SceneTransitionType =
  | "fade"
  | "cross_dissolve"
  | "wipe"
  | "slide"
  | "dip_to_color"
  | "light_sweep";

export type SceneTransitionDirection = "left" | "right" | "up" | "down";
export type SceneTransitionIntensity = "subtle" | "normal" | "strong";

export type SceneTransition = {
  fromSceneId: string;
  toSceneId: string;
  type: SceneTransitionType;
  durationSeconds: number;
  durationFrames: number;
  direction?: SceneTransitionDirection;
  color?: string;
  intensity?: SceneTransitionIntensity;
};

export type TransitionPresetId = "simple_safe" | "clean_knowledge" | "business_editorial" | "tech_premium";

export type TransitionScene = {
  id: string;
  title?: string | null;
  voiceover?: string | null;
  chapterTitle?: string | null;
};

export type BuildSceneTransitionsOptions = {
  fps?: number;
  preset?: TransitionPresetId;
  color?: string;
};

export type TransitionPreset = {
  id: TransitionPresetId;
  label: string;
  weights: Partial<Record<SceneTransitionType, number>>;
};

export const DEFAULT_TRANSITION_FPS = 30;
export const DEFAULT_TRANSITION_PRESET: TransitionPresetId = "clean_knowledge";
export const DEFAULT_TRANSITION_COLOR = "#0B0B0F";

export const TRANSITION_PRESETS: TransitionPreset[] = [
  {
    id: "simple_safe",
    label: "Simple Safe",
    weights: { fade: 70, wipe: 30 },
  },
  {
    id: "clean_knowledge",
    label: "Clean Knowledge",
    weights: { fade: 50, wipe: 40, slide: 10 },
  },
  {
    id: "business_editorial",
    label: "Business Editorial",
    weights: { fade: 40, wipe: 30, slide: 20, light_sweep: 10 },
  },
  {
    id: "tech_premium",
    label: "Tech Premium",
    weights: { wipe: 35, fade: 30, light_sweep: 25, dip_to_color: 10 },
  },
];

const PROGRESSION_PATTERN = /步骤|流程|原因|结果|首先|其次|然后|接着|最后|第一|第二|第三|下一步|first|second|third|next|then|finally|therefore|because|result|cause|step|process|sequence/i;
const COMPARISON_PATTERN = /vs\.?|versus|compare|comparison|优点|缺点|对比|比较|差异|相反|whereas|while|tradeoff|pros?|cons?/i;

function clampDurationSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0.45;
  return Math.max(0.2, Math.min(1.4, value));
}

function frames(durationSeconds: number, fps: number) {
  return Math.max(1, Math.round(clampDurationSeconds(durationSeconds) * fps));
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function weightedPresetType(preset: TransitionPreset, seed: string): SceneTransitionType {
  const entries = Object.entries(preset.weights).filter(([, weight]) => Number(weight) > 0) as Array<[
    SceneTransitionType,
    number,
  ]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!entries.length || total <= 0) return "fade";
  let cursor = hashText(seed) % total;
  for (const [type, weight] of entries) {
    if (cursor < weight) return type;
    cursor -= weight;
  }
  return entries[0][0];
}

function defaultDurationForType(type: SceneTransitionType, chapterChanged: boolean) {
  if (chapterChanged) return 0.75;
  if (type === "light_sweep") return 0.6;
  if (type === "cross_dissolve") return 0.55;
  if (type === "dip_to_color") return 0.5;
  return 0.45;
}

function defaultDirectionForText(text: string): SceneTransitionDirection {
  if (/上|up|rise|increase|growth|提升/i.test(text)) return "up";
  if (/下|down|drop|decrease|decline|下降/i.test(text)) return "down";
  if (/back|previous|return|回到|返回/i.test(text)) return "left";
  return "right";
}

function isStrongTransition(type: SceneTransitionType) {
  return type === "slide" || type === "dip_to_color" || type === "light_sweep";
}

function normalizeChapter(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function chooseTransitionType(input: {
  current: TransitionScene;
  next: TransitionScene;
  preset: TransitionPreset;
  index: number;
  lightOrDipCount: number;
  lightOrDipLimit: number;
  slideCount: number;
  slideLimit: number;
  previousTypes: SceneTransitionType[];
}): SceneTransitionType {
  const text = [input.current.title, input.current.voiceover, input.next.title, input.next.voiceover]
    .filter(Boolean)
    .join(" ");
  const chapterChanged =
    normalizeChapter(input.current.chapterTitle) &&
    normalizeChapter(input.next.chapterTitle) &&
    normalizeChapter(input.current.chapterTitle) !== normalizeChapter(input.next.chapterTitle);

  let type: SceneTransitionType;
  if (chapterChanged) {
    type = input.preset.id === "tech_premium" || input.preset.id === "business_editorial" ? "light_sweep" : "dip_to_color";
  } else if (COMPARISON_PATTERN.test(text)) {
    type = "slide";
  } else if (PROGRESSION_PATTERN.test(text)) {
    type = "wipe";
  } else {
    type = weightedPresetType(input.preset, `${input.current.id}:${input.next.id}:${input.index}`);
  }

  if ((type === "light_sweep" || type === "dip_to_color") && input.lightOrDipCount >= input.lightOrDipLimit) {
    type = "fade";
  }
  if (type === "slide" && input.slideCount >= input.slideLimit) {
    type = PROGRESSION_PATTERN.test(text) ? "wipe" : "fade";
  }

  const lastTwo = input.previousTypes.slice(-2);
  if (isStrongTransition(type) && lastTwo.length === 2 && lastTwo.every((item) => item === type)) {
    type = "fade";
  }

  return type;
}

export function buildSceneTransitions(
  scenes: TransitionScene[],
  options: BuildSceneTransitionsOptions = {},
): SceneTransition[] {
  const fps = Math.max(1, Math.round(options.fps || DEFAULT_TRANSITION_FPS));
  const preset = TRANSITION_PRESETS.find((item) => item.id === options.preset) ?? TRANSITION_PRESETS[1];
  const pairs = Math.max(0, scenes.length - 1);
  if (pairs === 0) return [];

  const lightOrDipLimit = Math.max(1, Math.floor(pairs * 0.1));
  const slideLimit = Math.max(1, Math.floor(pairs * 0.2));
  const result: SceneTransition[] = [];
  let lightOrDipCount = 0;
  let slideCount = 0;

  for (let index = 0; index < pairs; index += 1) {
    const current = scenes[index];
    const next = scenes[index + 1];
    const previousTypes = result.map((item) => item.type);
    const type = chooseTransitionType({
      current,
      next,
      preset,
      index,
      lightOrDipCount,
      lightOrDipLimit,
      slideCount,
      slideLimit,
      previousTypes,
    });
    if (type === "light_sweep" || type === "dip_to_color") lightOrDipCount += 1;
    if (type === "slide") slideCount += 1;

    const text = [current.title, current.voiceover, next.title, next.voiceover].filter(Boolean).join(" ");
    const chapterChanged =
      normalizeChapter(current.chapterTitle) &&
      normalizeChapter(next.chapterTitle) &&
      normalizeChapter(current.chapterTitle) !== normalizeChapter(next.chapterTitle);
    const durationSeconds = defaultDurationForType(type, Boolean(chapterChanged));

    result.push({
      fromSceneId: current.id,
      toSceneId: next.id,
      type,
      durationSeconds,
      durationFrames: frames(durationSeconds, fps),
      direction: type === "wipe" || type === "slide" ? defaultDirectionForText(text) : undefined,
      color: type === "dip_to_color" ? options.color || DEFAULT_TRANSITION_COLOR : undefined,
      intensity: type === "light_sweep" ? "normal" : undefined,
    });
  }

  return result;
}
