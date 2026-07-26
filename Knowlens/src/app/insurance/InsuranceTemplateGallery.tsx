"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AlertCircle, ArrowRight, Check, ChevronDown, Download, LoaderCircle, RefreshCw, X } from "lucide-react";
import { INSURANCE_CUSTOM_POSTER_EVENT } from "@/app/insurance/InsuranceCustomPosterButton";
import {
  InsuranceMembershipDialog,
  openInsuranceCreditTopupCheckout,
} from "@/components/billing/InsuranceMembershipDialog";
import {
  buildInsurancePosterPrompt,
  createInsuranceTemplateFormState,
} from "@/lib/insurance-poster-prompt";
import { appendCreditRecordOnServer } from "@/lib/billing";
import { STANDARD_OUTPUT_PROMO_CREDITS } from "@/lib/credit-pricing";
import { trackInsuranceEvent } from "@/lib/insurance-analytics";

export type InsuranceTemplateCard = {
  title: string;
  category: string;
  primaryCategory: string;
  secondaryCategory: string;
  description: string;
  prompt: string;
  format: string;
  audience: string;
  fields: string[];
  accent: string;
  rows: string[];
  auxiliaryInfo: string;
  illustration: string;
  imageSrc?: string;
  thumbnailSrc?: string;
  aspectRatio?: "9:16" | "3:4" | "4:5" | "16:11" | "1:1" | "16:9" | "4:3";
  styleId?: string;
  isFree?: boolean;
  isCustom?: boolean;
};

type InsuranceTemplateGalleryProps = {
  templates: InsuranceTemplateCard[];
  categories: string[];
  initialCategory?: string;
  mode?: "showcase" | "mine";
  hasDeferredTemplates?: boolean | ((activeCategory: string) => boolean);
  isDeferredTemplateLoading?: boolean;
  onLoadDeferredTemplates?: (activeCategory: string) => Promise<number> | number | void;
};

type SupportedTemplateAspectRatio = "1:1" | "9:16" | "16:9" | "3:4";
type InsuranceStyleOption = {
  id: string;
  name: string;
  prompt: string;
};
type GenerationStatus = "ready" | "generating" | "failed";
type GeneratedPosterHistoryItem = {
  id: string;
  imageSrc: string;
  createdAt: number;
  aspectRatio?: SupportedTemplateAspectRatio;
  posterTitle?: string;
  posterDescription?: string;
};
type TemplateFormState = {
  title: string;
  description: string;
  rows: string[];
  auxiliaryInfo: string;
  organizationName: string;
  illustration: string;
  aspectRatio: SupportedTemplateAspectRatio;
  styleId: string;
};
type ProductSelectOption<T extends string> = {
  value: T;
  label: string;
};
type GeneratedPosterState = {
  status: GenerationStatus;
  imageSrc: string;
  aspectRatio?: SupportedTemplateAspectRatio;
  history: GeneratedPosterHistoryItem[];
  currentCreatedAt?: number;
  posterTitle?: string;
  posterDescription?: string;
  errorMessage?: string;
  errorCode?: string;
};
type MyPosterRecord = GeneratedPosterHistoryItem & {
  templateKey: string;
  template: InsuranceTemplateCard;
  isCurrent: boolean;
};
type MembershipGateAction = "generate" | "download";
type BillingCreditsPayload = {
  ok?: boolean;
  email?: string;
  balance?: number;
  subscription?: {
    status?: string;
  } | null;
};

const SHOWCASE_CATEGORY_ORDER = [
  "科普",
  "产品",
  "养老",
  "理财",
  "理赔",
  "喜报",
  "重疾",
  "健康",
  "车险",
  "保险",
  "品宣",
  "日签",
  "生日",
  "活动",
  "节日",
  "节气",
];
const SHOWCASE_CATEGORY_ROUND_ORDER = [
  "科普",
  "产品",
  "养老",
  "理财",
  "理赔",
  "喜报",
  "重疾",
  "健康",
  "车险",
  "保险",
  "科普",
  "产品",
  "养老",
  "理财",
  "理赔",
  "喜报",
  "品宣",
  "日签",
  "生日",
  "活动",
  "节日",
  "节气",
  "科普",
  "产品",
  "养老",
  "理财",
  "重疾",
  "健康",
  "车险",
  "保险",
  "品宣",
  "生日",
  "活动",
  "日签",
];

type InsuranceWorkspaceImageTask = {
  taskId?: string;
  index?: number;
  status?: string;
  imageUrl?: string;
  renderUrl?: string;
  rawImageUrl?: string;
  image_url?: string;
  render_url?: string;
  raw_image_url?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
};
type InsuranceWorkspaceImageJobPayload = {
  ok?: boolean;
  error?: string;
  code?: string;
  job?: {
    id?: string;
    runId?: string;
    status?: string;
  };
  tasks?: InsuranceWorkspaceImageTask[];
};

const INSURANCE_POSTER_GENERATION_CREDITS = STANDARD_OUTPUT_PROMO_CREDITS;
const CUSTOM_INSURANCE_TEMPLATE_TITLE = "自定义海报";
const INSURANCE_POSTER_STATE_STORAGE_KEY = "knowlens:insurance:poster-state:v1";
const TEMPLATE_INITIAL_LOAD_COUNT = 8;
const TEMPLATE_LOAD_BATCH_SIZE = 8;
const TEMPLATE_CATEGORY_INITIAL_ROW_COUNT = 4;
const INSURANCE_WORKSPACE_IMAGE_POLL_INTERVAL_MS = 2500;
const INSURANCE_WORKSPACE_IMAGE_POLL_TIMEOUT_MS = 660000;
const INSURANCE_WORKSPACE_IMAGE_PROVIDER_POLICY = "duomi,gptsapi";
const aspectRatioOptions: SupportedTemplateAspectRatio[] = ["1:1", "9:16", "16:9", "3:4"];

const insuranceStyleOptions: InsuranceStyleOption[] = [
  {
    id: "professional-blue",
    name: "专业蓝白",
    prompt:
      "Use a professional blue-white commercial poster style. deep navy blue #0B1F3A and clean insurance blue #1F6FFF. cool white #F7FAFF and pale blue gray #EAF1FA. dark navy #102033. bright blue #2F80FF, used sparingly under 10% of the image. extra-bold modern Chinese sans-serif title at large poster scale, medium-weight subtitle, highly readable body text with generous line height, small footer text with restrained weight. translucent panels, fine divider lines, subtle grid texture, soft cool gradients, low-noise background, light shadow separation, precise alignment, calm corporate finish.",
  },
  {
    id: "warm-family",
    name: "暖调柔光",
    prompt:
      "Use a warm soft-light editorial poster style. warm ivory #FFF4E3 and cream yellow #FFE6A7. soft apricot #F7D7B8 and warm white #FFF9F0. warm charcoal #2F2A24. muted orange #F2994A. rounded bold Chinese sans-serif title at large scale, friendly medium subtitle, readable body text with wider line spacing, small calm footer text. soft mist gradients, warm translucent layers, delicate paper texture, low-contrast shadows, feathered edges, relaxed spacing, gentle visual rhythm, approachable premium finish.",
  },
  {
    id: "medical-fresh",
    name: "清透冷感",
    prompt:
      "Use a clean translucent cool-tone poster style. mint cyan #DDF7F2 and clear water blue #DCEEFF. clinical white #FFFFFF and pale gray #F2F6F8. cool gray #3F4A56. fresh cyan green #35B7A4. clean modern Chinese sans-serif title at medium-large scale, balanced subtitle, high-legibility body text, compact small labels. airy gradients, thin borders, lightly frosted blocks, bright diffused cool lighting, minimal shadow, balanced spacing, clean modular hierarchy, crisp readable finish.",
  },
  {
    id: "premium-business",
    name: "深蓝商务",
    prompt:
      "Use a deep blue executive business poster style. navy black #071426 and deep business blue #0E2A4F. slate gray #283445 and mist gray #E8EDF3. cool white #F4F8FF. champagne gold #D6B56D. heavy modern Chinese sans-serif title with strong contrast, medium subtitle, concise body text, small premium labels. matte gradients, subtle metallic highlights, thin separators, structured grid alignment, controlled negative space, directional soft light, restrained luxury-business finish.",
  },
  {
    id: "minimal-white",
    name: "极简留白",
    prompt:
      "Use a minimal white editorial poster style. pure white #FFFFFF and warm white #FAFAF7. light gray #EEF1F4. charcoal black #1F1F1F. muted blue #4F6F8F or muted gold #B89A5E, only one accent color. bold minimal Chinese sans-serif title at large scale, light subtitle, simple body text, tiny footer text with clean spacing. large negative space, ultra-thin lines, very soft shadows, low-opacity geometric texture, nearly invisible lighting, text-first composition, quiet premium finish.",
  },
  {
    id: "festival-chinese",
    name: "国潮彩墨",
    prompt:
      "Use a contemporary Chinese ink-color poster style. cinnabar red #C83A2A, porcelain blue #1E4E8C, jade green #2F8A66, and rice paper beige #F6EAD2. warm paper #F7E8C8. ink black #171717. warm gold #D9A441. bold Chinese serif-sans mixed title at large scale, modern sans-serif body text, compact refined small labels. rice-paper grain, ink-wash texture, layered color blocks, crisp decorative linework, flat soft lighting, strong title rhythm, controlled ornament density, modern national-style finish.",
  },
  {
    id: "light-luxury",
    name: "轻奢金色",
    prompt:
      "Use a light luxury gold poster style. ivory #FFF8E9 and deep blue gray #273240. champagne beige #F0DEC1. refined dark gray #2A2A2A. champagne gold #D6B56D. refined modern Chinese sans-serif title at large but not bulky scale, elegant medium subtitle, crisp body text, small understated footer. fine gold borders, silk-like gradients, subtle embossing, premium card-stock texture, narrow highlights, low-opacity shadows, balanced margins, quiet luxury finish.",
  },
  {
    id: "data-explainer",
    name: "数据科技",
    prompt:
      "Use a data-tech explainer poster style. deep navy #061222 and technology cyan #21D4FD. dark slate #151C28 and translucent blue gray #263648. cool white #F2F6FA. electric cyan #39D5FF. bold geometric Chinese sans-serif title, compact UI sans-serif body text, tabular numeric font only when user-provided numbers exist, small technical labels. abstract grid texture, thin glowing lines, translucent interface layers, soft edge glow, no invented numbers, precise modular rhythm, polished data-interface finish.",
  },
  {
    id: "soft-3d",
    name: "质感3D",
    prompt:
      "Use a premium soft 3D poster style. ice blue #DCEEFF, milk white #FFFDF8, and pale violet #E9E2FF. warm white #FFFDF8 and soft gray #EEF1F4. soft graphite #4B5563. saturated brand blue #2F80FF. rounded geometric Chinese sans-serif title at large scale, clean rounded body text, simple rounded label typography. polished 3D forms, translucent acrylic, soft plastic, clay-like smooth materials, rounded highlights, ambient lighting, gentle shadows, clear depth layering, modern friendly 3D finish.",
  },
  {
    id: "brand-tech",
    name: "品牌科技",
    prompt:
      "Use a premium brand-tech poster style. brand black #050607, cool white #F5F7FA, technology blue #2F80FF, and blue-violet gradient #6D5DF6. graphite #1A1D21. soft white #F5F7FA. electric blue #39D5FF. sharp geometric Chinese sans-serif title at very large scale, clean product UI body text, compact technical labels. futuristic interface texture, transparent panels, streamlined glow, low-noise dark surfaces, cool rim light, strong central focus, high-recognition digital brand finish.",
  },
  {
    id: "handdrawn-care",
    name: "手绘纸感",
    prompt:
      "Use a refined hand-drawn paper poster style. warm paper beige #F3E7D0. light kraft paper #E6D1B3. pencil gray #4A4A4A. muted olive #7A8F5A and warm orange #F28C28. neat hand-lettered Chinese title at large scale, tidy readable Chinese body text, small annotation-style labels. delicate paper texture, hand-drawn strokes, pencil grain, slight uneven coloring, underlines, emphasis marks, flat soft lighting, organized notebook-like visual finish.",
  },
  {
    id: "watercolor-story",
    name: "水彩柔雾",
    prompt:
      "Use a watercolor mist poster style. watercolor blue #A9D8F2, pale green #CDE8D3, warm yellow #F7DA8A, and paper white #FFFDF8. translucent warm white #FFF8EF. soft ink gray #3F3F3F. muted coral #E99A7A. clear modern Chinese sans-serif title with a gentle hand-crafted feeling, stable readable body text, small calm labels. wet watercolor edges, soft diffusion, absorbent paper grain, low-saturation layering, gentle ambient light, wide spacing, airy narrative finish.",
  },
  {
    id: "flat-illustration",
    name: "扁平几何",
    prompt:
      "Use a minimal flat geometric poster style. clean white #FFFFFF and low-saturation blue #DCEBFF. light gray #EEF1F4 and muted color blocks. neutral gray #4B5563. bright blue #2F80FF with optional muted orange #F2994A. bold rounded Chinese sans-serif title, simple readable body text, large clear label typography. flat vector shapes, simple geometry, crisp edges, low visual noise, consistent rounded modules, very light shadows, mobile-first scanning rhythm, clean diagram finish.",
  },
  {
    id: "storybook-kids",
    name: "柔彩绘本",
    prompt:
      "Use a soft colorful storybook poster style. sky blue #BFE3FF, cream yellow #FFF0A8, soft green #C9E8B8, and warm white #FFFDF8. pale cream #FFF7DA. gentle navy #2F3A4A. soft coral #F4A185. rounded Chinese sans-serif title at large friendly scale, clean body text, simple rounded small labels. soft-edge illustration finish, crayon-like fine grain, low-saturation gradients, rounded corners, warm paper texture, flat gentle light, friendly layered rhythm.",
  },
  {
    id: "paper-cut",
    name: "纸雕层次",
    prompt:
      "Use a layered paper-cut poster style. warm white #FFF7EA, pale blue #D9ECFF, pale green #DCEEDB, and soft orange #F4C28C. stacked paper white #FFFDF8. dark slate #2A3442. muted blue #5A8FD8. heavy clear Chinese sans-serif title, stable readable body text, small neat labels. cut-paper edges, stacked cardstock layers, fiber texture, handmade dimensional shadows, warm top-left lighting, clear foreground-midground-background depth, refined tactile finish.",
  },
  {
    id: "collage-mag",
    name: "杂志拼贴",
    prompt:
      "Use an editorial collage poster style. off-white #F7F3EA and black #111111. warm gray #E8E1D6 and muted color cutouts. charcoal #1F1F1F. brand blue #2F80FF and warm orange #F28C28. bold magazine-style Chinese sans-serif title at large scale, clean sans-serif body text, small refined labels. torn paper edges, halftone dots, sticker-like blocks, subtle print misregistration, shallow drop shadows, layered editorial composition, social-cover visual rhythm.",
  },
  {
    id: "black-gold",
    name: "黑金高端",
    prompt:
      "Use a black-and-gold premium poster style. matte black #070707 and ink navy #081522. dark graphite #202020. warm white #F4EFE3. champagne gold #D6B56D. high-contrast luxury Chinese serif-sans title at large scale, refined modern body text, elegant small labels. metallic gold highlights, glossy black surfaces, fine gold lines, subtle particles, premium paper grain, cinematic spot lighting, deep ambient shadows, precise luxury finish.",
  },
  {
    id: "comic-panels",
    name: "漫画线稿",
    prompt:
      "Use a comic line-art poster style. clean white #FFFFFF. light gray #E8E8E8. black #111111. bright blue #2F80FF, energetic yellow #F6C744, and small red #EF4444. bold Chinese marker-style title at large scale, clean readable body text, compact label typography. strong outlines, halftone shading, panel borders, motion-line accents, print grain, high-contrast flat shadows, clear section transitions, no extra speech text, structured comic finish.",
  },
  {
    id: "glassmorphism",
    name: "玻璃拟态",
    prompt:
      "Use a glassmorphism poster style. ice blue #DCEEFF, cool white #F8FBFF, pale violet #E9E2FF, and translucent gray #E8EEF6. frosted glass white rgba-like light panels. deep slate #263241. micro-glow cyan #39D5FF. geometric Chinese sans-serif title with spacious scale, readable body text, clean small labels. translucent glass layers, frosted blur, edge highlights, soft refraction, airy gradients, cool backlight, subtle reflections, high-readability panel placement.",
  },
  {
    id: "retro-ticket",
    name: "复古纸张",
    prompt:
      "Use a refined retro paper poster style. aged paper beige #EAD7B7 and deep ink blue #1F3556. light kraft paper #E6D1B3. dark ink #252525. muted red #A44A3F and desaturated green #7A8F5A. clear Chinese serif-sans mixed title with vintage print feeling, modern readable body text, small stamp-like labels. old paper texture, slight fading, print dots, dashed borders, subtle registration offset, fine grain, warm flat lighting, stable framed layout, no invented numbers.",
  },
];

const kepuStyleOptions: InsuranceStyleOption[] = [
  {
    id: "kepu-handdrawn-paper",
    name: "科普手绘",
    prompt:
      "Use a warm hand-drawn educational poster style. warm paper beige #F3E7D0, ink black #1F1A16, muted brown #9A5B2E, olive green #7A8F5A, and soft rust #B85A32. Chinese brush-style title, tidy handwritten annotation typography, readable Chinese body text. pencil grain, watercolor wash, light paper fibers, gentle ink bleed, handmade icons, calm warm lighting, friendly knowledge-sharing mood.",
  },
  {
    id: "kepu-ink-notes",
    name: "科普墨迹",
    prompt:
      "Use an elegant ink-note educational poster style. rice paper white #F8EEDB, ink black #171717, tea brown #8A5A32, muted cinnabar #B6462A, and pale leaf green #9BAF78. expressive Chinese calligraphy title, clean serif-sans body typography, delicate handwritten emphasis marks. dry-brush texture, faint ink wash, paper speckles, scholarly calm atmosphere, soft natural light.",
  },
  {
    id: "kepu-soft-watercolor",
    name: "科普水彩",
    prompt:
      "Use a soft watercolor educational poster style. cream paper #FFF4E2, mist blue #BFDDF2, sage green #BFD3B1, warm apricot #F2C49B, and charcoal #2F2A24. gentle brush-style Chinese title, clear rounded body typography, small neat annotation text. translucent watercolor edges, light pigment blooms, soft diffusion, airy texture, approachable family advisory mood.",
  },
  {
    id: "kepu-vintage-manual",
    name: "科普手册",
    prompt:
      "Use a vintage knowledge-manual poster style. aged paper #EAD7B7, deep ink brown #2B2118, muted red #A44A3F, faded olive #7D8A5D, and warm cream #FFF4DF. bold Chinese serif title, legible printed body text, small stamp-like annotation typography. old book paper grain, subtle print dots, lightly faded ink, antique stationery details, trustworthy reference-book mood.",
  },
  {
    id: "kepu-clean-doodle",
    name: "科普涂鸦",
    prompt:
      "Use a clean doodle educational poster style. warm white #FFF9EF, graphite #333333, soft blue #8DBCE8, muted yellow #F4D77A, and gentle coral #E79A80. friendly handwritten Chinese title, crisp readable body text, simple marker-style emphasis. neat doodle icons, thin sketch lines, soft highlighter strokes, light paper texture, relaxed but professional explainer mood.",
  },
];

const allInsuranceStyleOptions = [...insuranceStyleOptions, ...kepuStyleOptions];

const emptyCategoryDescriptions: Record<string, string> = {
  日签: "适合代理人每日早安问候、客户轻触达和朋友圈日常经营。",
  生日: "适合客户生日祝福、续联问候和专属顾问关系维护。",
  节日: "适合节假日祝福、节点营销和客户关怀内容转发。",
  节气: "适合二十四节气问候、健康提醒和轻量品牌露出。",
  活动: "适合沙龙邀约、直播预告、客户答疑会和报名转化。",
  产品: "适合保险产品亮点说明、配置建议和方案介绍。",
  科普: "适合保险知识、家庭传承、保单规则和客户教育长图。",
  喜报: "适合保险团队业绩战报、签单捷报、荣誉榜单和增员表彰。",
  理赔: "适合理赔流程、报案方式、材料清单和理赔案例说明。",
  车险: "适合车险产品对比、续保提醒、车主服务和用车风险教育。",
  养老: "适合养老金规划、年金险说明、养老现金流和退休安排。",
  理财: "适合存款保险、年金分红、寿险投资价值和财富规划科普。",
  健康: "适合健康科普、疾病预防、体检提醒和客户教育。",
  保险: "适合保险知识科普、投保提醒、理赔服务和合规提示。",
  重疾: "适合重疾知识拆解、配置提醒和重疾险客户教育。",
};

function buildEmptyCategoryCards(category: string) {
  const description = emptyCategoryDescriptions[category] || "适合该保险场景的模板内容，后续将逐步补充。";
  return Array.from({ length: 6 }, (_, index) => ({
    id: `${category}-${index + 1}`,
    title: `${category}模板示例`,
    description,
  }));
}

function getAspectClass(template: InsuranceTemplateCard) {
  if (template.aspectRatio === "9:16") return "aspect-[9/16]";
  if (template.aspectRatio === "3:4") return "aspect-[3/4]";
  if (template.aspectRatio === "1:1") return "aspect-square";
  if (template.aspectRatio === "16:9") return "aspect-video";
  if (template.aspectRatio === "4:3") return "aspect-[4/3]";
  if (template.aspectRatio === "4:5") return "aspect-[4/5]";
  if (template.aspectRatio === "16:11") return "aspect-[16/11]";
  return template.rows.length >= 5 ? "aspect-[4/5]" : template.rows.length >= 4 ? "aspect-[3/4]" : "aspect-[16/11]";
}

function getAspectHeightScore(aspectRatio?: string) {
  if (aspectRatio === "9:16") return 16 / 9;
  if (aspectRatio === "3:4") return 4 / 3;
  if (aspectRatio === "1:1") return 1;
  if (aspectRatio === "16:9") return 9 / 16;
  if (aspectRatio === "4:3") return 3 / 4;
  if (aspectRatio === "4:5") return 5 / 4;
  if (aspectRatio === "16:11") return 11 / 16;
  return 1.25;
}

function getTemplateMasonryHeightScore(template: InsuranceTemplateCard) {
  const inferredAspectRatio =
    template.aspectRatio || (template.rows.length >= 5 ? "4:5" : template.rows.length >= 4 ? "3:4" : "16:11");
  return getAspectHeightScore(inferredAspectRatio) + 0.34;
}

function getGeneratedPosterMasonryHeightScore(record: MyPosterRecord) {
  return getAspectHeightScore(record.aspectRatio || "9:16") + 0.32;
}

function getResponsiveMasonryColumnCount() {
  if (typeof window === "undefined") return 2;
  if (window.matchMedia("(min-width: 1280px)").matches) return 4;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  return 2;
}

function splitStableMasonryColumns<T>(
  items: T[],
  columnCount: number,
  getHeightScore: (item: T) => number,
) {
  const safeColumnCount = Math.max(1, Math.min(4, Math.round(columnCount)));
  const columns = Array.from({ length: safeColumnCount }, () => ({
    height: 0,
    items: [] as T[],
  }));

  for (const item of items) {
    let targetColumnIndex = 0;
    for (let index = 1; index < columns.length; index += 1) {
      if (columns[index].height < columns[targetColumnIndex].height) {
        targetColumnIndex = index;
      }
    }
    columns[targetColumnIndex].items.push(item);
    columns[targetColumnIndex].height += getHeightScore(item);
  }

  return columns.map((column) => column.items);
}

function getAspectClassFromRatio(aspectRatio?: SupportedTemplateAspectRatio) {
  if (aspectRatio === "1:1") return "aspect-square";
  if (aspectRatio === "16:9") return "aspect-video";
  if (aspectRatio === "3:4") return "aspect-[3/4]";
  return "aspect-[9/16]";
}

function canUseNextImageForInsuranceSrc(imageSrc: string) {
  return imageSrc.startsWith("/") && !imageSrc.startsWith("/api/");
}

function getInsuranceTemplatePreviewSrc(template: InsuranceTemplateCard) {
  if (template.thumbnailSrc) {
    return template.thumbnailSrc;
  }
  const imageSrc = template.imageSrc || "";
  const match = imageSrc.match(/^\/insurance\/posters\/([^/?#]+)\.png$/i);
  return match ? `/insurance/posters/thumbs/${match[1]}.webp` : imageSrc;
}

function normalizeAspectRatioChoice(aspectRatio?: string): SupportedTemplateAspectRatio {
  return aspectRatioOptions.includes(aspectRatio as SupportedTemplateAspectRatio)
    ? (aspectRatio as SupportedTemplateAspectRatio)
    : "9:16";
}

function getStyleOption(styleId?: string) {
  return allInsuranceStyleOptions.find((style) => style.id === styleId) || insuranceStyleOptions[0];
}

function parseCoreRows(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatPosterCopy(form: TemplateFormState) {
  return [
    form.description,
    ...form.rows,
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function applyPosterCopy(form: TemplateFormState, value: string): TemplateFormState {
  const lines = parseCoreRows(value);
  return {
    ...form,
    description: lines[0] || "",
    rows: lines.slice(1),
  };
}

function formatRemarkCopy(form: TemplateFormState) {
  return [
    form.auxiliaryInfo,
    form.organizationName,
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function applyRemarkCopy(form: TemplateFormState, value: string): TemplateFormState {
  const lines = parseCoreRows(value);
  return {
    ...form,
    auxiliaryInfo: lines[0] || "",
    organizationName: lines.slice(1).join("\n"),
  };
}

function createCustomInsuranceTemplate(): InsuranceTemplateCard {
  return {
    title: CUSTOM_INSURANCE_TEMPLATE_TITLE,
    category: "自定义",
    primaryCategory: "自定义",
    secondaryCategory: "海报",
    description: "",
    prompt: "生成一张中文保险营销海报。只显示用户输入的文案，不显示字段名和分类词。",
    format: "9:16 海报",
    audience: "保险客户",
    fields: ["标题", "副标题", "核心要点", "辅助信息", "机构名称"],
    accent: "#f4f4f5",
    rows: [],
    auxiliaryInfo: "",
    illustration: "",
    imageSrc: "",
    aspectRatio: "9:16",
    isCustom: true,
  };
}

function templateMatchesCategory(template: InsuranceTemplateCard, activeCategory: string) {
  if (activeCategory === "全部") {
    return true;
  }
  return getTemplatePrimaryCategory(template) === activeCategory;
}

const EXPIRED_SEASONAL_TEMPLATE_KEYWORDS = ["父亲节", "端午", "夏至", "小暑"];
const EXPIRED_SEASONAL_TEMPLATE_IMAGE_MARKERS = [
  "/father-",
  "/xiazhi-",
  "/duanwu-",
  "/duanwu-free-",
];
const FEATURED_SHOWCASE_TEMPLATE_LIMIT = 12;
const FEATURED_SHOWCASE_TEMPLATE_IMAGE_ORDER = [
  "/insurance/posters/gaoding-285.png",
  "/insurance/posters/gaoding-286.png",
  "/insurance/posters/gaoding-287.png",
  "/insurance/posters/gaoding-288.png",
  "/insurance/posters/gaoding-289.png",
  "/insurance/posters/gaoding-290.png",
  "/insurance/posters/gaoding-291.png",
  "/insurance/posters/gaoding-292.png",
  "/insurance/posters/gaoding-181.png",
  "/insurance/posters/gaoding-182.png",
  "/insurance/posters/gaoding-183.png",
  "/insurance/posters/gaoding-184.png",
  "/insurance/posters/gaoding-185.png",
  "/insurance/posters/gaoding-186.png",
  "/insurance/posters/jieqi-dashu-brush-01.png",
  "/insurance/posters/female-jiankang-03.png",
  "/insurance/posters/festival-qixi-brush-01.png",
  "/insurance/posters/female-kepu-04.png",
  "/insurance/posters/female-lipei-04.png",
  "/insurance/posters/female-chexian-03.png",
  "/insurance/posters/female-baoxian-03.png",
  "/insurance/posters/female-yanglao-05.png",
  "/insurance/posters/jieqi-liqiu-brush-01.png",
  "/insurance/posters/female-jiankang-05.png",
  "/insurance/posters/jieqi-chushu-brush-01.png",
  "/insurance/posters/health-check-notice-01.png",
  "/insurance/posters/jieqi-bailu-brush-01.png",
  "/insurance/posters/jieqi-qiufen-brush-01.png",
];

function isExpiredSeasonalTemplate(template: InsuranceTemplateCard) {
  const imageSrc = template.imageSrc || "";
  const categoryText = [
    template.primaryCategory,
    template.category,
    template.secondaryCategory,
    template.title,
    template.description,
  ]
    .filter(Boolean)
    .join(" ");

  if (EXPIRED_SEASONAL_TEMPLATE_IMAGE_MARKERS.some((marker) => imageSrc.includes(marker))) {
    return true;
  }

  return EXPIRED_SEASONAL_TEMPLATE_KEYWORDS.some((keyword) => categoryText.includes(keyword));
}

function getTemplatePrimaryCategory(template: InsuranceTemplateCard) {
  return template.primaryCategory || template.category;
}

function getTemplateIdentity(template: InsuranceTemplateCard) {
  return template.imageSrc || `${template.primaryCategory}:${template.secondaryCategory}:${template.title}`;
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function hashStringToNumber(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getShowcaseShuffleScore(template: InsuranceTemplateCard, seed: number) {
  return hashStringToNumber(`${seed}:${getTemplateIdentity(template)}`);
}

function getClientSeasonalPriority(template: InsuranceTemplateCard) {
  const imageSrc = template.imageSrc || "";
  const secondaryCategory = template.secondaryCategory || "";
  const title = template.title || "";

  if (imageSrc.includes("/hongkong-")) return -500;
  if (isExpiredSeasonalTemplate(template)) return -900;
  if (secondaryCategory.includes("七夕") || title.includes("七夕")) return 180;
  if (secondaryCategory.includes("中秋") || title.includes("中秋")) return 160;
  if (secondaryCategory.includes("国庆") || title.includes("国庆")) return 140;
  return 0;
}

function getClientTemplateQualityPriority(template: InsuranceTemplateCard) {
  const gaodingMatch = template.imageSrc?.match(/\/insurance\/posters\/gaoding-(\d+)\.png$/);
  const category = template.primaryCategory || template.category;

  if (gaodingMatch) {
    const fileNumber = Number.parseInt(gaodingMatch[1], 10);
    if (fileNumber >= 285 && fileNumber <= 292) return 1_340;
    if (fileNumber >= 249 && fileNumber <= 292) return 1_260;
    if (fileNumber >= 228 && fileNumber <= 248) return 1_250;
    if (fileNumber >= 181 && fileNumber <= 186) return 1_180;
    if (fileNumber >= 151 && fileNumber <= 180) return 1_120;
    if (fileNumber >= 121 && fileNumber <= 150) return 1_100;
    if (fileNumber >= 111 && fileNumber <= 120) return 1_060;
    if (fileNumber >= 1 && fileNumber <= 30) return 980;
    if (fileNumber >= 31 && fileNumber <= 60) return 960;
    if (fileNumber >= 61 && fileNumber <= 90) return 940;
    if (fileNumber >= 91 && fileNumber <= 110) return 880;
    if (fileNumber >= 197 && fileNumber <= 227) return 840;
    if (fileNumber >= 187 && fileNumber <= 196) return 760;
  }

  if (category === "科普") return 900;
  if (category === "产品" || category === "养老" || category === "理财" || category === "理赔") return 860;
  if (category === "喜报" || category === "重疾" || category === "健康" || category === "车险") return 820;
  if (category === "品宣" || category === "日签" || category === "保险") return 760;
  return 700;
}

function getClientTemplateSourceBucket(template: InsuranceTemplateCard) {
  const imageSrc = template.imageSrc || "";
  if (imageSrc.includes("/insurance/posters/gaoding-")) {
    return "gaoding";
  }
  if (imageSrc.includes("/insurance/posters/female-")) {
    return "female";
  }
  return "standard";
}

function getClientQualityTier(template: InsuranceTemplateCard) {
  const priority = getClientTemplateQualityPriority(template);
  if (priority >= 1_000) return "premium";
  if (priority >= 860) return "strong";
  return "standard";
}

function getFeaturedShowcaseTemplateRank(template: InsuranceTemplateCard) {
  const index = FEATURED_SHOWCASE_TEMPLATE_IMAGE_ORDER.indexOf(template.imageSrc || "");
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getFeaturedShowcaseTemplateSortBand(template: InsuranceTemplateCard) {
  const rank = getFeaturedShowcaseTemplateRank(template);
  if (rank === Number.POSITIVE_INFINITY) {
    return rank;
  }
  const category = template.primaryCategory || template.category;
  const imageSrc = template.imageSrc || "";
  const premiumKepuBoost = category === "科普" || imageSrc.includes("/gaoding-28") ? -6 : 0;
  return Math.max(0, Math.floor((rank + premiumKepuBoost) / 4));
}

function pinFeaturedShowcaseTemplates(templates: InsuranceTemplateCard[], seed = 0) {
  const featured = templates
    .filter((template) => getFeaturedShowcaseTemplateRank(template) !== Number.POSITIVE_INFINITY)
    .sort((left, right) => {
      const bandDelta = getFeaturedShowcaseTemplateSortBand(left) - getFeaturedShowcaseTemplateSortBand(right);
      if (bandDelta !== 0) {
        return bandDelta;
      }
      if (seed !== 0) {
        const shuffleDelta = getShowcaseShuffleScore(left, seed + 9_719) - getShowcaseShuffleScore(right, seed + 9_719);
        if (shuffleDelta !== 0) {
          return shuffleDelta;
        }
      }
      return getFeaturedShowcaseTemplateRank(left) - getFeaturedShowcaseTemplateRank(right);
    })
    .slice(0, FEATURED_SHOWCASE_TEMPLATE_LIMIT);
  if (!featured.length) {
    return templates;
  }

  const featuredIds = new Set(featured.map(getTemplateIdentity));
  return [...featured, ...templates.filter((template) => !featuredIds.has(getTemplateIdentity(template)))];
}

function sortShowcaseTemplatesForRefresh(templates: InsuranceTemplateCard[], seed: number) {
  return [...templates].sort((left, right) => {
    const priorityDelta = getClientSeasonalPriority(right) - getClientSeasonalPriority(left);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const qualityDelta = getClientTemplateQualityPriority(right) - getClientTemplateQualityPriority(left);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    const shuffleDelta = getShowcaseShuffleScore(left, seed) - getShowcaseShuffleScore(right, seed);
    if (shuffleDelta !== 0) {
      return shuffleDelta;
    }
    return getTemplateIdentity(left).localeCompare(getTemplateIdentity(right));
  });
}

function scatterShowcaseTemplatesForRefresh(templates: InsuranceTemplateCard[], seed: number) {
  const sourceOrder = ["gaoding", "female", "standard"];
  const grouped = new Map<string, InsuranceTemplateCard[]>();

  for (const template of sortShowcaseTemplatesForRefresh(templates, seed)) {
    const source = getClientTemplateSourceBucket(template);
    const current = grouped.get(source) || [];
    current.push(template);
    grouped.set(source, current);
  }

  const ordered: InsuranceTemplateCard[] = [];
  let hasRemaining = true;
  while (hasRemaining) {
    hasRemaining = false;
    for (const source of sourceOrder) {
      const queue = grouped.get(source);
      if (queue && queue.length > 0) {
        ordered.push(queue.shift() as InsuranceTemplateCard);
        hasRemaining = true;
      }
    }
  }

  return ordered;
}

function orderShowcaseTemplatesForRefresh(
  templates: InsuranceTemplateCard[],
  activeCategory: string,
  seed: number,
) {
  if (seed === 0) {
    return templates;
  }
  if (activeCategory !== "全部") {
    return sortShowcaseTemplatesForRefresh(templates, seed + hashStringToNumber(activeCategory));
  }

  const tierOrder = ["premium", "strong", "standard"] as const;
  const grouped = new Map<string, Map<string, InsuranceTemplateCard[]>>();
  const extras: InsuranceTemplateCard[] = [];
  for (const template of templates) {
    const category = template.primaryCategory || template.category;
    if (!SHOWCASE_CATEGORY_ORDER.includes(category)) {
      extras.push(template);
      continue;
    }
    const tier = getClientQualityTier(template);
    const tierMap = grouped.get(tier) || new Map<string, InsuranceTemplateCard[]>();
    const current = tierMap.get(category) || [];
    current.push(template);
    tierMap.set(category, current);
    grouped.set(tier, tierMap);
  }

  for (const tier of tierOrder) {
    const tierMap = grouped.get(tier);
    if (!tierMap) {
      continue;
    }
    for (const [category, categoryTemplates] of tierMap) {
      tierMap.set(category, scatterShowcaseTemplatesForRefresh(categoryTemplates, seed + hashStringToNumber(`${tier}:${category}`)));
    }
  }

  const ordered: InsuranceTemplateCard[] = [];
  for (const tier of tierOrder) {
    const tierMap = grouped.get(tier);
    if (!tierMap) {
      continue;
    }
    let hasRemaining = true;
    while (hasRemaining) {
      hasRemaining = false;
      for (const category of SHOWCASE_CATEGORY_ROUND_ORDER) {
        const queue = tierMap.get(category);
        if (queue && queue.length > 0) {
          ordered.push(queue.shift() as InsuranceTemplateCard);
          hasRemaining = true;
        }
      }
    }
  }

  return pinFeaturedShowcaseTemplates([...ordered, ...sortShowcaseTemplatesForRefresh(extras, seed)], seed);
}

function createShowcaseRefreshSeed() {
  if (typeof window === "undefined") {
    return 0;
  }
  const buffer = new Uint32Array(1);
  window.crypto?.getRandomValues(buffer);
  if (buffer[0]) {
    return buffer[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

function isSupportedAspectRatio(value: unknown): value is SupportedTemplateAspectRatio {
  return value === "1:1" || value === "9:16" || value === "16:9" || value === "3:4";
}

function sanitizeGeneratedPosterHistoryItem(value: unknown): GeneratedPosterHistoryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const imageSrc = typeof raw.imageSrc === "string" ? raw.imageSrc.trim() : "";
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Number(raw.createdAt);
  if (!imageSrc || !Number.isFinite(createdAt)) {
    return null;
  }
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `${imageSrc}-${createdAt}`,
    imageSrc,
    createdAt,
    aspectRatio: isSupportedAspectRatio(raw.aspectRatio) ? raw.aspectRatio : undefined,
    posterTitle: typeof raw.posterTitle === "string" ? raw.posterTitle : undefined,
    posterDescription: typeof raw.posterDescription === "string" ? raw.posterDescription : undefined,
  };
}

function sanitizeGeneratedPosterState(value: unknown): GeneratedPosterState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const status = raw.status === "ready" || raw.status === "generating" || raw.status === "failed" ? raw.status : "ready";
  const imageSrc = typeof raw.imageSrc === "string" ? raw.imageSrc : "";
  const history = Array.isArray(raw.history)
    ? raw.history.map(sanitizeGeneratedPosterHistoryItem).filter((item): item is GeneratedPosterHistoryItem => Boolean(item))
    : [];
  return {
    status,
    imageSrc,
    aspectRatio: isSupportedAspectRatio(raw.aspectRatio) ? raw.aspectRatio : undefined,
    history,
    currentCreatedAt:
      typeof raw.currentCreatedAt === "number" && Number.isFinite(raw.currentCreatedAt) ? raw.currentCreatedAt : undefined,
    posterTitle: typeof raw.posterTitle === "string" ? raw.posterTitle : undefined,
    posterDescription: typeof raw.posterDescription === "string" ? raw.posterDescription : undefined,
    errorMessage: typeof raw.errorMessage === "string" ? raw.errorMessage : undefined,
    errorCode: typeof raw.errorCode === "string" ? raw.errorCode : undefined,
  };
}

function getTemplateAnalyticsDetails(template: InsuranceTemplateCard, isPremium: boolean) {
  return {
    templateTitle: template.isCustom ? CUSTOM_INSURANCE_TEMPLATE_TITLE : template.title,
    primaryCategory: template.primaryCategory,
    secondaryCategory: template.secondaryCategory,
    category: template.category,
    aspectRatio: normalizeAspectRatioChoice(template.aspectRatio),
    isPremium,
    isCustom: Boolean(template.isCustom),
  };
}

function createBlankInsuranceTemplateForm(): TemplateFormState {
  return {
    title: "",
    description: "",
    rows: [],
    auxiliaryInfo: "",
    organizationName: "",
    illustration: "",
    aspectRatio: "9:16",
    styleId: insuranceStyleOptions[0].id,
  };
}

function toImageErrorDisplayCode(errorCode?: string, message?: string) {
  const bag = `${errorCode || ""} ${message || ""}`.toUpperCase();
  if (/TIMEOUT|TIMED_OUT|BUDGET/.test(bag)) return "IMG-408";
  if (/STORAGE|PERSIST|DOWNLOAD|ASSET/.test(bag)) return "IMG-512";
  if (/FETCH|NETWORK|ABORT|INTERRUPT/.test(bag)) return "IMG-503";
  if (/ALL_FAILED|PROVIDER|TUZI|GPTSAPI|DUOMI|IMAGE2/.test(bag)) return "IMG-502";
  return "IMG-500";
}

function toImageFailureSentence(message?: string, errorCode?: string) {
  const displayCode = toImageErrorDisplayCode(errorCode, message);
  const raw = (message || "").trim();
  if (/timeout|timed out|budget/i.test(raw)) {
    return `生成超时，请手动重试。错误码：${displayCode}。`;
  }
  if (/storage|persist|download|asset/i.test(`${errorCode || ""} ${raw}`)) {
    return `图片保存失败，请手动重试。错误码：${displayCode}。`;
  }
  if (/aborted|network|fetch/i.test(raw)) {
    return `图片请求已中断，请手动重试。错误码：${displayCode}。`;
  }
  return `图片暂时无法生成，请手动重试。错误码：${displayCode}。`;
}

function loadStoredPosterState() {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(INSURANCE_POSTER_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nextState: Record<string, GeneratedPosterState> = {};
    for (const [key, value] of Object.entries(parsed || {})) {
      const sanitized = sanitizeGeneratedPosterState(value);
      if (sanitized) {
        nextState[key] = sanitized;
      }
    }
    return nextState;
  } catch {
    return {};
  }
}

function formatGeneratedPosterTime(createdAt: number) {
  try {
    return new Date(createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function CasePreview({
  template,
  eager = false,
  previewId,
  onPreviewSettled,
}: {
  template: InsuranceTemplateCard;
  eager?: boolean;
  previewId?: string;
  onPreviewSettled?: (previewId: string) => void;
}) {
  const aspectClass = getAspectClass(template);
  const originalImageSrc = template.imageSrc || "";
  const thumbnailImageSrc = getInsuranceTemplatePreviewSrc(template);
  const previewImageSrc = thumbnailImageSrc || originalImageSrc;
  const [activeImageSrc, setActiveImageSrc] = useState(previewImageSrc);
  const [useOriginalFallback, setUseOriginalFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const reportSettled = useCallback(() => {
    if (previewId) {
      onPreviewSettled?.(previewId);
    }
  }, [onPreviewSettled, previewId]);

  useEffect(() => {
    setActiveImageSrc(previewImageSrc);
    setUseOriginalFallback(false);
    setLoaded(false);
    setFailed(false);
  }, [previewImageSrc]);

  useEffect(() => {
    if (!activeImageSrc) {
      reportSettled();
    }
  }, [activeImageSrc, reportSettled]);

  if (activeImageSrc) {
    return (
      <div className={`relative w-full overflow-hidden bg-white ${aspectClass}`}>
        {!loaded ? <div className="skeleton-shimmer pointer-events-none absolute inset-0 z-0" /> : null}
        {failed ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white px-4 text-center">
            <div>
              <p className="text-xs font-medium text-zinc-500">海报暂未加载</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-400">{template.title}</p>
            </div>
          </div>
        ) : (
          <Image
            src={activeImageSrc}
            alt={`${template.title}海报`}
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1280px) 260px, (min-width: 1024px) 28vw, 50vw"
            unoptimized={useOriginalFallback || activeImageSrc !== originalImageSrc}
            decoding="async"
            className="insurance-template-poster-image absolute inset-0 z-10 h-full w-full rounded-none bg-white object-cover [transform:translateZ(0)]"
            onLoad={() => {
              setLoaded(true);
              reportSettled();
            }}
            onError={() => {
              if (activeImageSrc !== originalImageSrc && originalImageSrc) {
                setLoaded(false);
                setActiveImageSrc(originalImageSrc);
                return;
              }
              if (!useOriginalFallback && originalImageSrc.startsWith("/")) {
                setLoaded(false);
                setUseOriginalFallback(true);
                return;
              }
              setFailed(true);
              reportSettled();
              trackInsuranceEvent({
                action: "template_preview_image_failed",
                message: "Insurance template preview image failed to load.",
                status: "error",
                details: {
                  ...getTemplateAnalyticsDetails(template, false),
                  imageSrc: activeImageSrc,
                },
              });
            }}
            referrerPolicy={activeImageSrc.startsWith("/") ? undefined : "no-referrer"}
          />
        )}
      </div>
    );
  }

  return <div aria-hidden="true" className={`w-full bg-white ${aspectClass}`} />;
}

function TemplateCardSkeleton({ index }: { index: number }) {
  const aspectClass = index % 4 === 1 ? "aspect-[3/4]" : "aspect-[9/16]";
  return (
    <article aria-hidden="true" className="w-full overflow-hidden border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
      <div className={`skeleton-shimmer w-full ${aspectClass}`} />
      <div className="p-2.5 sm:p-3">
        <div className="flex gap-1.5">
          <div className="h-5 w-10 rounded-md bg-zinc-100" />
          <div className="h-5 w-14 rounded-md bg-zinc-100" />
        </div>
        <div className="mt-3 h-4 w-4/5 rounded bg-zinc-100" />
        <div className="mt-2 h-3 w-full rounded bg-zinc-100" />
        <div className="mt-1.5 h-3 w-2/3 rounded bg-zinc-100" />
      </div>
    </article>
  );
}

function PosterPreview({
  template,
  posterState,
  aspectRatio,
  onRetry,
}: {
  template: InsuranceTemplateCard;
  posterState?: GeneratedPosterState;
  aspectRatio: SupportedTemplateAspectRatio;
  onRetry: () => void;
}) {
  const previewAspectRatio = posterState?.aspectRatio || aspectRatio || normalizeAspectRatioChoice(template.aspectRatio);
  const aspectClass = getAspectClassFromRatio(previewAspectRatio);
  const fitClass = previewAspectRatio === "9:16" ? "h-full max-w-full" : "w-full max-h-full";
  const generatedImageSrc = posterState?.imageSrc || "";
  const imageSrc = generatedImageSrc || template.imageSrc;
  const [failedImageSrc, setFailedImageSrc] = useState("");
  const [loadedImageSrc, setLoadedImageSrc] = useState("");
  const isGenerating = posterState?.status === "generating";
  const isFailed = posterState?.status === "failed";
  const fallbackImageSrc = template.imageSrc && template.imageSrc !== imageSrc ? template.imageSrc : "";
  const imageFailed = Boolean(imageSrc && failedImageSrc === imageSrc);
  const previewImageSrc = imageFailed && fallbackImageSrc ? fallbackImageSrc : imageSrc;
  const shouldRenderPreviewImage = Boolean(previewImageSrc && !(imageFailed && !fallbackImageSrc));
  const previewImageLoaded = Boolean(previewImageSrc && loadedImageSrc === previewImageSrc);
  const showImageLoadingShimmer = Boolean(shouldRenderPreviewImage && !previewImageLoaded);

  useEffect(() => {
    setFailedImageSrc("");
    setLoadedImageSrc("");
  }, [imageSrc]);

  useEffect(() => {
    if (!generatedImageSrc || isGenerating) {
      return;
    }
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled) {
        setFailedImageSrc((current) => (current === generatedImageSrc ? "" : current));
        setLoadedImageSrc(generatedImageSrc);
      }
    };
    probe.onerror = () => {
      if (!cancelled) {
        setFailedImageSrc(generatedImageSrc);
      }
    };
    probe.referrerPolicy = "no-referrer";
    probe.src = generatedImageSrc;
    return () => {
      cancelled = true;
    };
  }, [generatedImageSrc, isGenerating]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-zinc-100">
      {previewImageSrc ? (
        <div className={`relative overflow-hidden bg-zinc-100 ${aspectClass} ${fitClass}`}>
          {showImageLoadingShimmer ? (
            <div className="skeleton-shimmer pointer-events-none absolute inset-0 z-10 transition-opacity duration-500" />
          ) : null}
          {showImageLoadingShimmer && !isGenerating ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/72 backdrop-blur-[1px]">
              <div className="mx-5 flex max-w-[260px] flex-col items-center rounded-2xl border border-zinc-200 bg-white/95 px-5 py-4 text-center shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <LoaderCircle size={18} className="animate-spin" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-900">海报图片加载中</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">图片加载完成后会自动显示。</p>
              </div>
            </div>
          ) : null}
          {shouldRenderPreviewImage && canUseNextImageForInsuranceSrc(previewImageSrc) ? (
            <Image
              src={previewImageSrc}
              alt={`${template.title}海报`}
              fill
              sizes="500px"
              className={`rounded-none object-contain transition-opacity duration-500 ${
                previewImageLoaded ? "opacity-100" : "opacity-0"
              }`}
              priority
              onLoad={() => setLoadedImageSrc(previewImageSrc)}
              onError={() => setFailedImageSrc(previewImageSrc)}
            />
          ) : shouldRenderPreviewImage ? (
            // image2 returns signed external image URLs that are not part of Next image remote config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImageSrc}
              alt={`${template.title}海报`}
              className={`absolute inset-0 h-full w-full rounded-none object-contain transition-opacity duration-500 ${
                previewImageLoaded ? "opacity-100" : "opacity-0"
              }`}
              referrerPolicy="no-referrer"
              onLoad={() => setLoadedImageSrc(previewImageSrc)}
              onError={() => setFailedImageSrc(previewImageSrc)}
            />
          ) : null}
          {imageFailed && !fallbackImageSrc ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-100 px-5 text-center">
              <div>
                <p className="text-sm font-semibold text-zinc-700">生成图加载失败</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">请点击重新生成，或稍后在“我的海报”中查看。</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex h-8 items-center gap-1 rounded-md bg-zinc-900 px-3 text-xs text-white hover:bg-zinc-700"
                >
                  <RefreshCw size={12} />
                  重新生成
                </button>
              </div>
            </div>
          ) : null}
          {imageFailed && fallbackImageSrc ? (
            <div className="absolute inset-x-3 top-3 z-20 rounded-full bg-white/92 px-3 py-1.5 text-center text-[11px] font-medium text-zinc-600 shadow-sm">
              生成图加载失败，当前显示原模板图，请重试
            </div>
          ) : null}
          {isGenerating ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/62 backdrop-blur-[2px]">
              <div className="mx-5 flex max-w-[320px] flex-col items-center rounded-2xl border border-zinc-200 bg-white/96 px-5 py-4 text-center shadow-[0_16px_34px_rgba(15,23,42,0.14)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <LoaderCircle size={18} className="animate-spin" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-900">正在生成海报</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  海报生成完成后会自动显示在这里。
                </p>
                <p className="mt-2 text-[11px] font-medium text-zinc-500">通常需要 2-3 分钟</p>
              </div>
            </div>
          ) : null}
          {isFailed ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 px-4 backdrop-blur-[1px]">
              <div className="max-w-[250px] rounded-lg border border-red-100 bg-white px-4 py-3 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertCircle size={14} />
                </div>
                <p className="text-xs leading-5 text-zinc-700">
                  {toImageFailureSentence(posterState?.errorMessage, posterState?.errorCode)}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 inline-flex h-8 items-center gap-1 rounded-md bg-zinc-900 px-3 text-xs text-white hover:bg-zinc-700"
                >
                  <RefreshCw size={12} />
                  重新生成
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ProductSelect<T extends string>({
  ariaLabel,
  value,
  options,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: ProductSelectOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePress(event: MouseEvent | TouchEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("touchstart", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePress);
      document.removeEventListener("touchstart", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm shadow-sm outline-none transition ${
          open
            ? "border-zinc-400 bg-white text-zinc-950 ring-4 ring-zinc-950/[0.04]"
            : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
        } disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 disabled:opacity-70`}
      >
        <span className="truncate">{selectedOption?.label || "请选择"}</span>
        <ChevronDown size={16} className={`shrink-0 text-zinc-400 transition ${open ? "rotate-180 text-zinc-700" : ""}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  selected ? "bg-zinc-100 font-medium text-zinc-950" : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selected ? <Check size={14} className="shrink-0 text-zinc-900" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EditableBox({
  value,
  onChange,
  minHeight = "min-h-10",
  multiline = false,
  rows = 2,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const className = `w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm leading-6 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 ${minHeight}`;
  if (multiline) {
    return (
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${className} resize-none`}
      />
    );
  }
  return (
    <input
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}

type PosterDownloadResult = "download-triggered" | "image-opened";

function getSafePosterFilename(title: string) {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "").trim() || "insurance-poster";
  return `${safeTitle}.png`;
}

function isAppleMobileBrowser() {
  const userAgent = window.navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
  const isIPadOSDesktopMode = userAgent.includes("Macintosh") && window.navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOSDesktopMode;
}

function openImageInNewTab(imageSrc: string) {
  const opened = window.open(imageSrc, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.href = imageSrc;
  }
}

async function downloadPosterImage(imageSrc: string, title: string): Promise<PosterDownloadResult> {
  if (!imageSrc) throw new Error("missing image source");
  const filename = getSafePosterFilename(title);

  if (isAppleMobileBrowser()) {
    openImageInNewTab(imageSrc);
    return "image-opened";
  }

  try {
    const response = await fetch(imageSrc);
    if (!response.ok) {
      throw new Error("download failed");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return "download-triggered";
  } catch {
    openImageInNewTab(imageSrc);
    return "image-opened";
  }
}

function resolveInsuranceWorkspaceImageSize(aspectRatio: SupportedTemplateAspectRatio) {
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "16:9") return "1792x1024";
  if (aspectRatio === "3:4") return "1152x1536";
  return "1024x1792";
}

function appendKnowLensRenderAttemptToken(imageUrl: string, token: string) {
  const trimmed = imageUrl.trim();
  if (!trimmed || !token.trim()) {
    return trimmed;
  }
  const isRelativeKnowLensAsset = trimmed.startsWith("/api/workspace/image/assets/");
  const isAbsoluteKnowLensAsset = /^https?:\/\/[^/]+\/api\/workspace\/image\/assets\//i.test(trimmed);
  if (!isRelativeKnowLensAsset && !isAbsoluteKnowLensAsset) {
    return trimmed;
  }
  try {
    const baseOrigin =
      typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost";
    const parsed = new URL(trimmed, baseOrigin);
    parsed.searchParams.set("rk", token.trim());
    if (isRelativeKnowLensAsset) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    const joiner = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${joiner}rk=${encodeURIComponent(token.trim())}`;
  }
}

function getInsuranceWorkspaceReadyImageUrl(payload: InsuranceWorkspaceImageJobPayload | null) {
  const readyStatuses = new Set(["asset_ready", "completed", "success", "succeeded"]);
  const readyTask = payload?.tasks?.find((task) => {
    const status = (task.status || "").trim().toLowerCase();
    const imageUrl =
      task.renderUrl ||
      task.render_url ||
      task.imageUrl ||
      task.image_url ||
      task.rawImageUrl ||
      task.raw_image_url ||
      "";
    return imageUrl && (!status || readyStatuses.has(status));
  });
  const imageUrl =
    readyTask?.renderUrl ||
    readyTask?.render_url ||
    readyTask?.imageUrl ||
    readyTask?.image_url ||
    readyTask?.rawImageUrl ||
    readyTask?.raw_image_url ||
    "";
  return appendKnowLensRenderAttemptToken(
    imageUrl,
    `insurance-${payload?.job?.id || readyTask?.taskId || Date.now()}`,
  );
}

function getInsuranceWorkspaceError(payload: InsuranceWorkspaceImageJobPayload | null) {
  const task = payload?.tasks?.find((item) => item.error || item.errorMessage || item.errorCode);
  return {
    code: payload?.code || task?.errorCode || "IMAGE_GENERATION_FAILED",
    message: payload?.error || task?.error || task?.errorMessage || "图片生成失败，请稍后重试。",
  };
}

async function readInsuranceWorkspaceJson(response: Response) {
  return (await response.json().catch(() => null)) as InsuranceWorkspaceImageJobPayload | null;
}

async function pollInsuranceWorkspaceImageJob(jobId: string, initialPayload: InsuranceWorkspaceImageJobPayload | null) {
  const activeTaskStatuses = new Set(["queued", "generating", "asset_downloading"]);
  const terminalTaskStatuses = new Set([
    "asset_ready",
    "completed",
    "success",
    "succeeded",
    "billing_failed",
    "failed",
    "timed_out",
    "timeout",
    "error",
    "cancelled",
    "canceled",
  ]);
  const terminalJobStatuses = new Set(["completed", "completed_with_errors", "billing_failed", "failed", "timed_out"]);
  const startedAt = Date.now();
  let latestPayload = initialPayload;

  while (Date.now() - startedAt < INSURANCE_WORKSPACE_IMAGE_POLL_TIMEOUT_MS) {
    const readyImageUrl = getInsuranceWorkspaceReadyImageUrl(latestPayload);
    if (readyImageUrl) {
      return {
        imageUrl: readyImageUrl,
        payload: latestPayload,
      };
    }

    const jobStatus = (latestPayload?.job?.status || "").trim().toLowerCase();
    const tasks = latestPayload?.tasks || [];
    const activeTasks = tasks.filter((task) => activeTaskStatuses.has((task.status || "").trim().toLowerCase()));
    const taskStatuses = tasks.map((task) => (task.status || "").trim().toLowerCase()).filter(Boolean);
    const allTasksTerminal = taskStatuses.length > 0 && taskStatuses.every((status) => terminalTaskStatuses.has(status));
    if (terminalJobStatuses.has(jobStatus) || allTasksTerminal) {
      const error = getInsuranceWorkspaceError(latestPayload);
      throw new Error(`${error.code}: ${error.message}`);
    }

    if (activeTasks.length) {
      const runTask = activeTasks[0];
      const runResponse = await fetch("/api/workspace/image/tasks/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          jobId,
          taskId: runTask.taskId,
        }),
      });
      const runPayload = await readInsuranceWorkspaceJson(runResponse);
      if (runPayload?.job?.id || runPayload?.tasks?.length) {
        latestPayload = runPayload;
      }
      if (!runResponse.ok) {
        const error = getInsuranceWorkspaceError(runPayload || latestPayload);
        throw new Error(`${error.code}: ${error.message}`);
      }
    } else {
      const statusResponse = await fetch(`/api/workspace/image/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        credentials: "same-origin",
      });
      const statusPayload = await readInsuranceWorkspaceJson(statusResponse);
      if (statusPayload?.job?.id || statusPayload?.tasks?.length) {
        latestPayload = statusPayload;
      }
      if (!statusResponse.ok) {
        const error = getInsuranceWorkspaceError(statusPayload || latestPayload);
        throw new Error(`${error.code}: ${error.message}`);
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, INSURANCE_WORKSPACE_IMAGE_POLL_INTERVAL_MS));
  }

  const finalStatusResponse = await fetch(`/api/workspace/image/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    credentials: "same-origin",
  }).catch(() => null);
  if (finalStatusResponse?.ok) {
    const finalPayload = await readInsuranceWorkspaceJson(finalStatusResponse);
    const readyImageUrl = getInsuranceWorkspaceReadyImageUrl(finalPayload);
    if (readyImageUrl) {
      return {
        imageUrl: readyImageUrl,
        payload: finalPayload,
      };
    }
  }

  throw new Error("IMAGE_JOB_POLL_TIMEOUT: 图片生成超时，请稍后在“我的海报”中查看或重新生成。");
}

async function generateInsurancePosterViaWorkspaceImageJob({
  prompt,
  aspectRatio,
  title,
}: {
  prompt: string;
  aspectRatio: SupportedTemplateAspectRatio;
  title: string;
}) {
  const runId = `insurance-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  const idempotencyKey = `${runId}-${getSafePosterFilename(title).replace(/\.png$/i, "").slice(0, 48)}`;
  const task = {
    index: 1,
    outputType: "poster",
    aspectRatio,
    size: resolveInsuranceWorkspaceImageSize(aspectRatio),
    prompt,
    model: "gpt-image-2",
    quality: "standard",
    response_format: "url",
  };
  const basePayload = {
    intent: "poster",
    normalizedDirection: "poster",
    ratio: aspectRatio,
    normalizedRatio: aspectRatio,
    imageModel: "gpt-image-2",
    imageModelPolicy: INSURANCE_WORKSPACE_IMAGE_PROVIDER_POLICY,
    runId,
    idempotencyKey,
    tasks: [task],
    clientContext: {
      source: "insurance_template_gallery",
      title,
      providerPolicy: INSURANCE_WORKSPACE_IMAGE_PROVIDER_POLICY,
      generationKind: "regenerate",
    },
  };
  const prepareResponse = await fetch("/api/workspace/image/generate-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      ...basePayload,
      action: "prepare",
    }),
  });
  const preparePayload = await readInsuranceWorkspaceJson(prepareResponse);
  if (!prepareResponse.ok || !preparePayload?.ok) {
    const error = getInsuranceWorkspaceError(preparePayload);
    throw new Error(`${error.code}: ${error.message}`);
  }

  const preparedImageUrl = getInsuranceWorkspaceReadyImageUrl(preparePayload);
  if (preparedImageUrl) {
    return {
      imageUrl: preparedImageUrl,
      payload: preparePayload,
    };
  }

  const jobId = (preparePayload.job?.id || "").trim();
  if (!jobId) {
    throw new Error("IMAGE_JOB_ID_MISSING: 生成任务缺少 jobId，请重试。");
  }

  const activateResponse = await fetch("/api/workspace/image/generate-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      ...basePayload,
      action: "activate",
      jobId,
    }),
  });
  const activatePayload = await readInsuranceWorkspaceJson(activateResponse);
  if (!activateResponse.ok || !activatePayload?.ok) {
    const error = getInsuranceWorkspaceError(activatePayload);
    throw new Error(`${error.code}: ${error.message}`);
  }

  return pollInsuranceWorkspaceImageJob(jobId, activatePayload);
}

export function InsuranceTemplateGallery({
  templates,
  categories,
  initialCategory = "全部",
  mode = "showcase",
  hasDeferredTemplates = false,
  isDeferredTemplateLoading = false,
  onLoadDeferredTemplates,
}: InsuranceTemplateGalleryProps) {
  const safeInitialCategory = categories.includes(initialCategory) ? initialCategory : "全部";
  const [activeCategory, setActiveCategory] = useState(safeInitialCategory);
  const [visibleTemplateCount, setVisibleTemplateCount] = useState(TEMPLATE_INITIAL_LOAD_COUNT);
  const [activeTemplate, setActiveTemplate] = useState<InsuranceTemplateCard | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState | null>(null);
  const [posterStateByTitle, setPosterStateByTitle] = useState<Record<string, GeneratedPosterState>>(loadStoredPosterState);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const downloadToastTimerRef = useRef<number | null>(null);
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);
  const [creditsPaywallOpen, setCreditsPaywallOpen] = useState(false);
  const [creditsPaywallBalance, setCreditsPaywallBalance] = useState<number | null>(null);
  const [creditsPaywallAction, setCreditsPaywallAction] = useState<MembershipGateAction>("generate");
  const [, setSettledPreviewIds] = useState<Set<string>>(() => new Set());
  const [isTemplateBatchLoading, setIsTemplateBatchLoading] = useState(false);
  const [stableShowcaseTemplateIds, setStableShowcaseTemplateIds] = useState<string[]>([]);
  const [showcaseRefreshSeed, setShowcaseRefreshSeed] = useState(0);
  const [masonryColumnCount, setMasonryColumnCount] = useState(2);
  const showcaseOrderResetKeyRef = useRef("");
  const loadMoreInFlightRef = useRef(false);
  const lastLoadMoreCompletedAtRef = useRef(0);
  const customTemplate = useMemo(() => createCustomInsuranceTemplate(), []);
  const isMineMode = mode === "mine";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const syncColumnCount = () => setMasonryColumnCount(getResponsiveMasonryColumnCount());
    syncColumnCount();
    window.addEventListener("resize", syncColumnCount);
    return () => window.removeEventListener("resize", syncColumnCount);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isMineMode) {
      return;
    }
    setShowcaseRefreshSeed(createShowcaseRefreshSeed());
  }, [isMineMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const categoryFromUrl = new URLSearchParams(window.location.search).get("category")?.trim();
    if (categoryFromUrl && categories.includes(categoryFromUrl)) {
      setActiveCategory(categoryFromUrl);
    }
  }, [categories]);

  const templateByTitle = useMemo(() => new Map(templates.map((template) => [template.title, template])), [templates]);
  const matchedTemplates = useMemo(
    () =>
      templates
        .filter((template) => !isExpiredSeasonalTemplate(template))
        .filter((template) => templateMatchesCategory(template, activeCategory)),
    [activeCategory, templates],
  );
  const orderedTemplateCandidates = useMemo(
    () =>
      isMineMode
        ? matchedTemplates
        : orderShowcaseTemplatesForRefresh(matchedTemplates, activeCategory, showcaseRefreshSeed),
    [activeCategory, isMineMode, matchedTemplates, showcaseRefreshSeed],
  );
  const orderedTemplateCandidateIds = useMemo(
    () => orderedTemplateCandidates.map(getTemplateIdentity),
    [orderedTemplateCandidates],
  );
  const orderedTemplateCandidateById = useMemo(
    () => new Map(orderedTemplateCandidates.map((template) => [getTemplateIdentity(template), template])),
    [orderedTemplateCandidates],
  );
  const showcaseOrderResetKey = `${isMineMode ? "mine" : "showcase"}:${activeCategory}:${showcaseRefreshSeed}`;
  useEffect(() => {
    if (isMineMode) {
      return;
    }
    setStableShowcaseTemplateIds((current) => {
      if (showcaseOrderResetKeyRef.current !== showcaseOrderResetKey) {
        showcaseOrderResetKeyRef.current = showcaseOrderResetKey;
        return areStringArraysEqual(current, orderedTemplateCandidateIds) ? current : orderedTemplateCandidateIds;
      }

      const candidateIdSet = new Set(orderedTemplateCandidateIds);
      const keptIds = current.filter((id) => candidateIdSet.has(id));
      const keptIdSet = new Set(keptIds);
      const appendedIds = orderedTemplateCandidateIds.filter((id) => !keptIdSet.has(id));
      const nextIds = [...keptIds, ...appendedIds];
      return areStringArraysEqual(current, nextIds) ? current : nextIds;
    });
  }, [isMineMode, orderedTemplateCandidateIds, showcaseOrderResetKey]);
  const filteredTemplates = useMemo(() => {
    if (isMineMode || stableShowcaseTemplateIds.length === 0) {
      return orderedTemplateCandidates;
    }
    return stableShowcaseTemplateIds
      .map((id) => orderedTemplateCandidateById.get(id))
      .filter((template): template is InsuranceTemplateCard => Boolean(template));
  }, [isMineMode, orderedTemplateCandidateById, orderedTemplateCandidates, stableShowcaseTemplateIds]);
  const myPosterRecords = useMemo(() => {
    const records: MyPosterRecord[] = [];
    for (const [templateKey, state] of Object.entries(posterStateByTitle)) {
      const template = templateByTitle.get(templateKey) || (templateKey === CUSTOM_INSURANCE_TEMPLATE_TITLE ? customTemplate : null);
      if (!template) {
        continue;
      }
      if (state.currentCreatedAt && state.imageSrc) {
        records.push({
          id: `${templateKey}-current-${state.currentCreatedAt}`,
          imageSrc: state.imageSrc,
          createdAt: state.currentCreatedAt,
          aspectRatio: state.aspectRatio,
          posterTitle: state.posterTitle || template.title,
          posterDescription: state.posterDescription || template.description,
          templateKey,
          template,
          isCurrent: true,
        });
      }
      for (const item of state.history) {
        records.push({
          ...item,
          posterTitle: item.posterTitle || template.title,
          posterDescription: item.posterDescription || template.description,
          templateKey,
          template,
          isCurrent: false,
        });
      }
    }
    return records.sort((left, right) => right.createdAt - left.createdAt);
  }, [customTemplate, posterStateByTitle, templateByTitle]);
  const emptyCategoryCards = useMemo(() => {
    if (isMineMode || activeCategory === "全部" || filteredTemplates.length > 0) {
      return [];
    }
    return buildEmptyCategoryCards(activeCategory);
  }, [activeCategory, filteredTemplates.length, isMineMode]);
  const visibleTemplates = useMemo(
    () => filteredTemplates.slice(0, visibleTemplateCount),
    [filteredTemplates, visibleTemplateCount],
  );
  const visibleTemplatePreviewIds = useMemo(
    () => visibleTemplates.map(getTemplateIdentity),
    [visibleTemplates],
  );
  const visibleMyPosterRecords = useMemo(
    () => myPosterRecords.slice(0, visibleTemplateCount),
    [myPosterRecords, visibleTemplateCount],
  );
  const visibleTemplateColumns = useMemo(
    () => splitStableMasonryColumns(visibleTemplates, masonryColumnCount, getTemplateMasonryHeightScore),
    [masonryColumnCount, visibleTemplates],
  );
  const visibleMyPosterColumns = useMemo(
    () => splitStableMasonryColumns(visibleMyPosterRecords, masonryColumnCount, getGeneratedPosterMasonryHeightScore),
    [masonryColumnCount, visibleMyPosterRecords],
  );
  const activeCollectionSize = isMineMode ? myPosterRecords.length : orderedTemplateCandidates.length;
  const hasDeferredTemplatesForActiveCategory =
    typeof hasDeferredTemplates === "function" ? hasDeferredTemplates(activeCategory) : hasDeferredTemplates;
  const hasMoreTemplates = visibleTemplateCount < activeCollectionSize || Boolean(hasDeferredTemplatesForActiveCategory);
  const visibleTemplateRowNeedsBackfill =
    !isMineMode &&
    activeCategory !== "全部" &&
    visibleTemplates.length < TEMPLATE_CATEGORY_INITIAL_ROW_COUNT &&
    Boolean(hasDeferredTemplatesForActiveCategory);
  const showTemplateBatchLoading = !isMineMode && (isTemplateBatchLoading || isDeferredTemplateLoading);
  const handleTemplatePreviewSettled = useCallback((previewId: string) => {
    setSettledPreviewIds((current) => {
      if (current.has(previewId)) {
        return current;
      }
      const next = new Set(current);
      next.add(previewId);
      return next;
    });
  }, []);
  const loadMoreTemplates = useCallback(() => {
    if (loadMoreInFlightRef.current || isTemplateBatchLoading) {
      return;
    }
    loadMoreInFlightRef.current = true;
    if (visibleTemplateCount < activeCollectionSize) {
      setVisibleTemplateCount((current) => Math.min(current + TEMPLATE_LOAD_BATCH_SIZE, activeCollectionSize));
      lastLoadMoreCompletedAtRef.current = Date.now();
      loadMoreInFlightRef.current = false;
      return;
    }
    if (hasDeferredTemplatesForActiveCategory && !isDeferredTemplateLoading) {
      setIsTemplateBatchLoading(true);
      Promise.resolve(onLoadDeferredTemplates?.(activeCategory))
        .then((loadedCount) => {
          const safeLoadedCount =
            typeof loadedCount === "number" && Number.isFinite(loadedCount)
              ? Math.max(0, Math.min(loadedCount, TEMPLATE_LOAD_BATCH_SIZE))
              : 0;
          if (safeLoadedCount > 0) {
            setVisibleTemplateCount((current) => current + safeLoadedCount);
          }
        })
        .finally(() => {
          lastLoadMoreCompletedAtRef.current = Date.now();
          loadMoreInFlightRef.current = false;
          setIsTemplateBatchLoading(false);
        });
      return;
    }
    loadMoreInFlightRef.current = false;
  }, [
    activeCategory,
    activeCollectionSize,
    hasDeferredTemplatesForActiveCategory,
    isDeferredTemplateLoading,
    isTemplateBatchLoading,
    onLoadDeferredTemplates,
    visibleTemplateCount,
  ]);

  const activePosterState = activeTemplate ? posterStateByTitle[activeTemplate.title] : undefined;
  const isGeneratingPoster = activePosterState?.status === "generating";
  const isGenerateActionBusy = isGeneratingPoster || isCheckingCredits;
  const selectedStyle = getStyleOption(templateForm?.styleId);
  const availableStyleOptions = activeTemplate?.primaryCategory === "科普" || activeTemplate?.category === "科普"
    ? [...kepuStyleOptions, ...insuranceStyleOptions]
    : insuranceStyleOptions;
  const activePosterImageSrc = activePosterState?.imageSrc || activeTemplate?.imageSrc || "";
  const activeTemplateIsCustom = Boolean(activeTemplate?.isCustom);

  useEffect(() => {
    try {
      window.localStorage.setItem(INSURANCE_POSTER_STATE_STORAGE_KEY, JSON.stringify(posterStateByTitle));
    } catch {
      // Ignore persistence failures and keep in-memory state usable.
    }
  }, [posterStateByTitle]);

  useEffect(() => {
    return () => {
      if (downloadToastTimerRef.current) {
        window.clearTimeout(downloadToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTemplateBatchLoading && !isDeferredTemplateLoading) {
      loadMoreInFlightRef.current = false;
    }
  }, [activeCategory, isDeferredTemplateLoading, isTemplateBatchLoading, visibleTemplateCount]);

  useEffect(() => {
    if (
      !visibleTemplateRowNeedsBackfill ||
      isTemplateBatchLoading ||
      isDeferredTemplateLoading
    ) {
      return;
    }
    loadMoreTemplates();
  }, [
    isDeferredTemplateLoading,
    isTemplateBatchLoading,
    loadMoreTemplates,
    visibleTemplateRowNeedsBackfill,
  ]);

  useEffect(() => {
    if (
      isMineMode ||
      !hasMoreTemplates ||
      isTemplateBatchLoading ||
      isDeferredTemplateLoading
    ) {
      return;
    }
    const handleLoadMoreIntent = () => {
      if (Date.now() - lastLoadMoreCompletedAtRef.current < 900) {
        return;
      }
      const scrollBottom = window.scrollY + window.innerHeight;
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      if (documentHeight - scrollBottom > 480) {
        return;
      }
      loadMoreTemplates();
    };
    window.requestAnimationFrame(handleLoadMoreIntent);
    window.addEventListener("scroll", handleLoadMoreIntent, { passive: true });
    window.addEventListener("wheel", handleLoadMoreIntent, { passive: true });
    window.addEventListener("touchmove", handleLoadMoreIntent, { passive: true });
    window.addEventListener("resize", handleLoadMoreIntent);
    return () => {
      window.removeEventListener("scroll", handleLoadMoreIntent);
      window.removeEventListener("wheel", handleLoadMoreIntent);
      window.removeEventListener("touchmove", handleLoadMoreIntent);
      window.removeEventListener("resize", handleLoadMoreIntent);
    };
  }, [
    hasMoreTemplates,
    isDeferredTemplateLoading,
    isMineMode,
    isTemplateBatchLoading,
    loadMoreTemplates,
    visibleTemplateCount,
  ]);

  useEffect(() => {
    setSettledPreviewIds((current) => {
      const visibleIdSet = new Set(visibleTemplatePreviewIds);
      let changed = false;
      const next = new Set<string>();
      for (const previewId of current) {
        if (visibleIdSet.has(previewId)) {
          next.add(previewId);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [visibleTemplatePreviewIds]);

  const showDownloadToast = (message = "正在下载海报中...", duration = 2200) => {
    setDownloadToast(message);
    if (downloadToastTimerRef.current) {
      window.clearTimeout(downloadToastTimerRef.current);
    }
    downloadToastTimerRef.current = window.setTimeout(() => {
      setDownloadToast(null);
      downloadToastTimerRef.current = null;
    }, duration);
  };

  useEffect(() => {
    if (!activeTemplate) {
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeTemplate]);

  const openTemplate = (template: InsuranceTemplateCard) => {
    trackInsuranceEvent({
      action: "template_modal_open",
      message: "Insurance template modal opened.",
      details: getTemplateAnalyticsDetails(template, false),
    });
    setActiveTemplate(template);
    const initialForm = createInsuranceTemplateFormState(template);
    setTemplateForm({
      ...initialForm,
      aspectRatio: normalizeAspectRatioChoice(template.aspectRatio),
      styleId: template.styleId || insuranceStyleOptions[0].id,
    });
  };

  const openCustomTemplate = useCallback(() => {
    trackInsuranceEvent({
      action: "custom_template_open",
      message: "Insurance custom poster modal opened.",
      details: getTemplateAnalyticsDetails(customTemplate, false),
    });
    setActiveTemplate(customTemplate);
    setTemplateForm(createBlankInsuranceTemplateForm());
    setPosterStateByTitle((prev) => ({
      ...prev,
      [CUSTOM_INSURANCE_TEMPLATE_TITLE]: {
        status: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.status || "ready",
        imageSrc: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.imageSrc || "",
        aspectRatio: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.aspectRatio || "9:16",
        history: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.history || [],
        currentCreatedAt: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.currentCreatedAt,
        posterTitle: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.posterTitle,
        posterDescription: prev[CUSTOM_INSURANCE_TEMPLATE_TITLE]?.posterDescription,
      },
    }));
  }, [customTemplate]);

  useEffect(() => {
    const onCustomPoster = () => openCustomTemplate();
    window.addEventListener(INSURANCE_CUSTOM_POSTER_EVENT, onCustomPoster);
    return () => window.removeEventListener(INSURANCE_CUSTOM_POSTER_EVENT, onCustomPoster);
  }, [openCustomTemplate]);

  const openCreditsPaywall = (balance: number | null, action: MembershipGateAction) => {
    trackInsuranceEvent({
      action: "credits_paywall_shown",
      message: "Insurance credits paywall shown.",
      details: {
        action,
        balance,
        requiredCredits: INSURANCE_POSTER_GENERATION_CREDITS,
        activeTemplateTitle: activeTemplate?.isCustom ? CUSTOM_INSURANCE_TEMPLATE_TITLE : activeTemplate?.title,
        activeTemplateCategory: activeTemplate?.primaryCategory,
        activeTemplateSecondaryCategory: activeTemplate?.secondaryCategory,
      },
    });
    setCreditsPaywallAction(action);
    setCreditsPaywallBalance(Number.isFinite(balance) ? balance : null);
    setActiveTemplate(null);
    setTemplateForm(null);
    setCreditsPaywallOpen(true);
  };

  const openCreditTopup = () => {
    trackInsuranceEvent({
      action: "credit_topup_checkout_click",
      message: "Insurance credit top-up checkout clicked.",
      details: {
        source: "insurance_template_credit_topup",
      },
    });
    openInsuranceCreditTopupCheckout("insurance_template_credit_topup");
  };

  const fetchBillingCredits = async () => {
    const response = await fetch("/api/billing/credits", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as BillingCreditsPayload | null;
    return {
      ok: response.ok && Boolean(payload?.ok),
      payload,
    };
  };

  const verifyCreditsForAction = async (action: MembershipGateAction) => {
    try {
      const { ok, payload } = await fetchBillingCredits();
      const balance = Number(payload?.balance ?? 0);
      if (!ok || !Number.isFinite(balance) || balance < INSURANCE_POSTER_GENERATION_CREDITS) {
        openCreditsPaywall(Number.isFinite(balance) ? balance : null, action);
        return null;
      }
      return {
        email: payload?.email?.trim() || undefined,
        balance,
      };
    } catch {
      openCreditsPaywall(null, action);
      return null;
    }
  };

  const isInsufficientCreditsError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /INSUFFICIENT|NOT_ENOUGH|BILLING_CREDITS/i.test(message);
  };

  const consumeInsuranceCredits = async ({
    action,
    title,
    balance,
    email,
  }: {
    action: MembershipGateAction;
    title: string;
    balance: number;
    email?: string;
  }) => {
    const actionLabel = action === "download" ? "保险海报下载" : "保险海报生图";
    await appendCreditRecordOnServer(
      {
        type: "consume",
        description: `${title} · ${actionLabel}（${INSURANCE_POSTER_GENERATION_CREDITS} 积分）`,
        delta: -INSURANCE_POSTER_GENERATION_CREDITS,
        projectTitle: title,
        entrySource: "insurance_template_gallery",
        estimatedCreditsCost: INSURANCE_POSTER_GENERATION_CREDITS,
        creditsBefore: balance,
        creditsAfter: Math.max(0, balance - INSURANCE_POSTER_GENERATION_CREDITS),
        creditBalanceSource: "server_synced_balance",
        consumeResult: "success",
      },
      email,
    );
  };

  const refundInsuranceCredits = async ({
    title,
    balance,
    email,
    reason,
  }: {
    title: string;
    balance: number;
    email?: string;
    reason: string;
  }) => {
    const refundLabel = reason.includes("download") ? "下载失败退回积分" : "生图失败退回积分";
    await appendCreditRecordOnServer(
      {
        type: "refund",
        description: `${title} · ${refundLabel}（${INSURANCE_POSTER_GENERATION_CREDITS} 积分）`,
        delta: INSURANCE_POSTER_GENERATION_CREDITS,
        projectTitle: title,
        entrySource: "insurance_template_gallery",
        estimatedCreditsCost: INSURANCE_POSTER_GENERATION_CREDITS,
        creditsBefore: balance,
        creditsAfter: balance + INSURANCE_POSTER_GENERATION_CREDITS,
        creditBalanceSource: "server_synced_balance",
        consumeResult: "success",
        refundReason: reason,
      },
      email,
    );
  };

  const requestOpenTemplate = (template: InsuranceTemplateCard, placement: "card" | "hover_button" = "card") => {
    trackInsuranceEvent({
      action: "template_open_click",
      message: "Insurance template open clicked.",
      details: {
        ...getTemplateAnalyticsDetails(template, false),
        placement,
        activeCategory,
      },
    });
    openTemplate(template);
  };

  const requestDownloadTemplate = (template: InsuranceTemplateCard) => {
    void (async () => {
      const posterState = posterStateByTitle[template.title];
      const imageSrc = posterState?.imageSrc || template.imageSrc || "";
      trackInsuranceEvent({
        action: "template_download_click",
        message: "Insurance template download clicked.",
        details: {
          ...getTemplateAnalyticsDetails(template, false),
          activeCategory,
          hasImage: Boolean(imageSrc),
        },
      });
      if (!imageSrc) {
        return;
      }
      let consumedDownloadCredits = false;
      const billingState = await verifyCreditsForAction("download");
      if (!billingState) {
        return;
      }
      const consumedBalance = billingState.balance;
      const consumedEmail = billingState.email;
      try {
        await consumeInsuranceCredits({
          action: "download",
          title: template.title,
          balance: billingState.balance,
          email: billingState.email,
        });
        consumedDownloadCredits = true;
      } catch (error) {
        if (isInsufficientCreditsError(error)) {
          openCreditsPaywall(billingState.balance, "download");
          return;
        }
        showDownloadToast("积分扣除失败，请稍后重试", 3200);
        return;
      }
      showDownloadToast("正在下载海报中...");
      try {
        const result = await downloadPosterImage(imageSrc, template.title);
        showDownloadToast(
          result === "image-opened"
            ? "已打开海报图片，可长按保存或使用浏览器分享保存"
            : "已触发下载，请查看浏览器下载记录或文件夹",
          result === "image-opened" ? 4200 : 3200,
        );
      } catch (error) {
        if (consumedDownloadCredits) {
          void refundInsuranceCredits({
            title: template.title,
            balance: Math.max(0, consumedBalance - INSURANCE_POSTER_GENERATION_CREDITS),
            email: consumedEmail,
            reason: "insurance_download_failed",
          }).catch(() => undefined);
        }
        trackInsuranceEvent({
          action: "template_download_failed",
          message: "Insurance template download failed.",
          status: "error",
          details: {
            ...getTemplateAnalyticsDetails(template, false),
            activeCategory,
            errorMessage: error instanceof Error ? error.message : "download failed",
          },
        });
        showDownloadToast("下载未完成，请稍后重试或打开图片长按保存", 3600);
        return;
      }
      trackInsuranceEvent({
        action: "template_download_started",
        message: "Insurance template download started.",
        details: {
          ...getTemplateAnalyticsDetails(template, false),
          activeCategory,
        },
      });
    })();
  };

  const requestDownloadActivePoster = () => {
    if (!activeTemplate || !activePosterImageSrc) {
      return;
    }
    void (async () => {
      trackInsuranceEvent({
        action: "modal_download_click",
        message: "Insurance modal download clicked.",
        details: {
          ...getTemplateAnalyticsDetails(activeTemplate, false),
          selectedAspectRatio: templateForm?.aspectRatio,
        },
      });
      let consumedDownloadCredits = false;
      const billingState = await verifyCreditsForAction("download");
      if (!billingState) {
        return;
      }
      const consumedBalance = billingState.balance;
      const consumedEmail = billingState.email;
      try {
        await consumeInsuranceCredits({
          action: "download",
          title: activeTemplate.title,
          balance: billingState.balance,
          email: billingState.email,
        });
        consumedDownloadCredits = true;
      } catch (error) {
        if (isInsufficientCreditsError(error)) {
          openCreditsPaywall(billingState.balance, "download");
          return;
        }
        showDownloadToast("积分扣除失败，请稍后重试", 3200);
        return;
      }
      showDownloadToast("正在下载海报中...");
      try {
        const result = await downloadPosterImage(activePosterImageSrc, activeTemplate.title);
        showDownloadToast(
          result === "image-opened"
            ? "已打开海报图片，可长按保存或使用浏览器分享保存"
            : "已触发下载，请查看浏览器下载记录或文件夹",
          result === "image-opened" ? 4200 : 3200,
        );
      } catch (error) {
        if (consumedDownloadCredits) {
          void refundInsuranceCredits({
            title: activeTemplate.title,
            balance: Math.max(0, consumedBalance - INSURANCE_POSTER_GENERATION_CREDITS),
            email: consumedEmail,
            reason: "insurance_modal_download_failed",
          }).catch(() => undefined);
        }
        trackInsuranceEvent({
          action: "modal_download_failed",
          message: "Insurance modal download failed.",
          status: "error",
          details: {
            ...getTemplateAnalyticsDetails(activeTemplate, false),
            selectedAspectRatio: templateForm?.aspectRatio,
            errorMessage: error instanceof Error ? error.message : "download failed",
          },
        });
        showDownloadToast("下载未完成，请稍后重试或打开图片长按保存", 3600);
        return;
      }
      trackInsuranceEvent({
        action: "modal_download_started",
        message: "Insurance modal download started.",
        details: {
          ...getTemplateAnalyticsDetails(activeTemplate, false),
          selectedAspectRatio: templateForm?.aspectRatio,
        },
      });
    })();
  };

  const requestDownloadMyPosterRecord = (record: MyPosterRecord, placement: "card" | "hover_button" = "hover_button") => {
    void (async () => {
      const title = record.posterTitle || record.template.title;
      trackInsuranceEvent({
        action: "my_poster_download_click",
        message: "My generated insurance poster download clicked.",
        details: {
          templateTitle: record.templateKey,
          placement,
          isCustom: Boolean(record.template.isCustom),
          createdAt: record.createdAt,
        },
      });
      let consumedDownloadCredits = false;
      const billingState = await verifyCreditsForAction("download");
      if (!billingState) {
        return;
      }
      const consumedBalance = billingState.balance;
      const consumedEmail = billingState.email;
      try {
        await consumeInsuranceCredits({
          action: "download",
          title,
          balance: billingState.balance,
          email: billingState.email,
        });
        consumedDownloadCredits = true;
      } catch (error) {
        if (isInsufficientCreditsError(error)) {
          openCreditsPaywall(billingState.balance, "download");
          return;
        }
        showDownloadToast("积分扣除失败，请稍后重试", 3200);
        return;
      }
      showDownloadToast("正在下载海报中...");
      try {
        const result = await downloadPosterImage(record.imageSrc, title);
        showDownloadToast(
          result === "image-opened"
            ? "已打开海报图片，可长按保存或使用浏览器分享保存"
            : "已触发下载，请查看浏览器下载记录或文件夹",
          result === "image-opened" ? 4200 : 3200,
        );
      } catch (error) {
        if (consumedDownloadCredits) {
          void refundInsuranceCredits({
            title,
            balance: Math.max(0, consumedBalance - INSURANCE_POSTER_GENERATION_CREDITS),
            email: consumedEmail,
            reason: "insurance_my_poster_download_failed",
          }).catch(() => undefined);
        }
        trackInsuranceEvent({
          action: "my_poster_download_failed",
          message: "My generated insurance poster download failed.",
          status: "error",
          details: {
            templateTitle: record.templateKey,
            placement,
            isCustom: Boolean(record.template.isCustom),
            createdAt: record.createdAt,
            errorMessage: error instanceof Error ? error.message : "download failed",
          },
        });
        showDownloadToast("下载未完成，请稍后重试或打开图片长按保存", 3600);
        return;
      }
      trackInsuranceEvent({
        action: "my_poster_download_started",
        message: "My generated insurance poster download started.",
        details: {
          templateTitle: record.templateKey,
          placement,
          isCustom: Boolean(record.template.isCustom),
          createdAt: record.createdAt,
        },
      });
    })();
  };

  const openMyPosterRecord = (record: MyPosterRecord, placement: "card" | "hover_button" = "card") => {
    trackInsuranceEvent({
      action: "my_poster_open_click",
      message: "My generated insurance poster opened.",
      details: {
        templateTitle: record.templateKey,
        placement,
        isCustom: Boolean(record.template.isCustom),
        createdAt: record.createdAt,
      },
    });
    setPosterStateByTitle((prev) => {
      const current = prev[record.templateKey];
      return {
        ...prev,
        [record.templateKey]: {
          status: "ready",
          imageSrc: record.imageSrc,
          aspectRatio:
            record.aspectRatio ||
            current?.aspectRatio ||
            normalizeAspectRatioChoice(record.template.aspectRatio),
          history: current?.history || [],
          currentCreatedAt: record.createdAt,
          posterTitle: record.posterTitle || current?.posterTitle || record.template.title,
          posterDescription: record.posterDescription || current?.posterDescription || record.template.description,
          errorCode: undefined,
          errorMessage: undefined,
        },
      };
    });
    if (record.template.isCustom) {
      setActiveTemplate(customTemplate);
      setTemplateForm({
        ...createBlankInsuranceTemplateForm(),
        title: record.posterTitle || "",
        description: record.posterDescription || "",
        aspectRatio: record.aspectRatio || "9:16",
      });
      return;
    }
    setActiveTemplate(record.template);
    const recordForm = createInsuranceTemplateFormState(record.template);
    setTemplateForm({
      ...recordForm,
      title: record.posterTitle || recordForm.title,
      description: record.posterDescription || recordForm.description,
      aspectRatio: record.aspectRatio || normalizeAspectRatioChoice(record.template.aspectRatio),
      styleId: record.template.styleId || insuranceStyleOptions[0].id,
    });
  };

  const generateTemplate = () => {
    if (!activeTemplate || !templateForm || isGenerateActionBusy) {
      return;
    }
    const templateKey = activeTemplate.title;
    const selectedAspectRatio = templateForm.aspectRatio;
    const currentStyle = getStyleOption(templateForm.styleId);
    const posterTitleSnapshot = templateForm.title.trim() || activeTemplate.title;
    const posterDescriptionSnapshot = templateForm.description.trim() || activeTemplate.description || "";
    const prompt = buildInsurancePosterPrompt(activeTemplate, activeTemplate.primaryCategory, {
      ...templateForm,
      styleName: currentStyle.name,
      stylePrompt: currentStyle.prompt,
    });
    const generateDetails = {
      ...getTemplateAnalyticsDetails(activeTemplate, false),
      selectedAspectRatio,
      selectedStyleId: currentStyle.id,
      selectedStyleName: currentStyle.name,
      corePointCount: templateForm.rows.length,
      hasAuxiliaryInfo: Boolean(templateForm.auxiliaryInfo.trim()),
      hasOrganizationName: Boolean(templateForm.organizationName.trim()),
      hasIllustration: Boolean(templateForm.illustration.trim()),
      promptLength: prompt.length,
      requiredCredits: INSURANCE_POSTER_GENERATION_CREDITS,
    };
    trackInsuranceEvent({
      action: "generate_click",
      message: "Insurance poster generate clicked.",
      details: generateDetails,
    });
    setIsCheckingCredits(true);

    void verifyCreditsForAction("generate")
      .then((billingState) => {
        if (!billingState) {
          setIsCheckingCredits(false);
          return;
        }
        return consumeInsuranceCredits({
          action: "generate",
          title: posterTitleSnapshot,
          balance: billingState.balance,
          email: billingState.email,
        }).then(() => billingState);
      })
      .then((billingState) => {
        if (!billingState) {
          return;
        }
        setIsCheckingCredits(false);
        setPosterStateByTitle((prev) => {
          const current = prev[templateKey] || {
            status: "ready",
            imageSrc: activeTemplate.imageSrc || "",
            aspectRatio: normalizeAspectRatioChoice(activeTemplate.aspectRatio),
            history: [],
          };
          const archived =
            current.imageSrc && current.status !== "generating" && current.currentCreatedAt
              ? {
                  id: `${templateKey}-${current.currentCreatedAt}`,
                  imageSrc: current.imageSrc,
                  createdAt: current.currentCreatedAt,
                  aspectRatio: current.aspectRatio || normalizeAspectRatioChoice(activeTemplate.aspectRatio),
                  posterTitle: current.posterTitle || activeTemplate.title,
                  posterDescription: current.posterDescription || activeTemplate.description,
                }
              : null;
          return {
            ...prev,
            [templateKey]: {
              status: "generating",
              imageSrc: current.imageSrc || activeTemplate.imageSrc || "",
              aspectRatio: selectedAspectRatio,
              history: archived ? [archived, ...current.history].slice(0, 8) : current.history,
              currentCreatedAt: current.currentCreatedAt,
              posterTitle: current.posterTitle,
              posterDescription: current.posterDescription,
              errorMessage: undefined,
              errorCode: undefined,
            },
          };
        });

        void generateInsurancePosterViaWorkspaceImageJob({
          prompt,
          aspectRatio: selectedAspectRatio,
          title: posterTitleSnapshot,
        })
          .then((result) => {
            trackInsuranceEvent({
              action: "generate_request_sent",
              message: "Insurance poster generation job started.",
              details: generateDetails,
            });
            setPosterStateByTitle((prev) => {
              const current = prev[templateKey];
              return {
                ...prev,
                [templateKey]: {
                  status: "ready",
                  imageSrc: result.imageUrl || "",
                  aspectRatio: selectedAspectRatio,
                  history: current?.history || [],
                  currentCreatedAt: Date.now(),
                  posterTitle: posterTitleSnapshot,
                  posterDescription: posterDescriptionSnapshot,
                  errorMessage: undefined,
                  errorCode: undefined,
                },
              };
            });
            trackInsuranceEvent({
              action: "generate_success",
              message: "Insurance poster generation succeeded.",
              details: {
                ...generateDetails,
                hasImageUrl: Boolean(result.imageUrl),
                workspaceJobId: result.payload?.job?.id,
              },
            });
          })
          .catch((error: Error & { code?: string }) => {
            void refundInsuranceCredits({
              title: posterTitleSnapshot,
              balance: Math.max(0, billingState.balance - INSURANCE_POSTER_GENERATION_CREDITS),
              email: billingState.email,
              reason: "insurance_generate_failed",
            }).catch(() => undefined);
            setPosterStateByTitle((prev) => {
              const current = prev[templateKey];
              return {
                ...prev,
                [templateKey]: {
                  status: "failed",
                  imageSrc: current?.imageSrc || activeTemplate.imageSrc || "",
                  aspectRatio: selectedAspectRatio,
                  history: current?.history || [],
                  currentCreatedAt: current?.currentCreatedAt,
                  posterTitle: current?.posterTitle,
                  posterDescription: current?.posterDescription,
                  errorMessage: error.message || "Generation failed. Please retry this card.",
                  errorCode: error.code,
                },
              };
            });
            trackInsuranceEvent({
              action: "generate_failed",
              message: "Insurance poster generation failed.",
              status: "error",
              details: {
                ...generateDetails,
                errorCode: error.code,
                errorMessage: error.message,
              },
            });
          });
      })
      .catch((error: unknown) => {
        setIsCheckingCredits(false);
        if (isInsufficientCreditsError(error)) {
          openCreditsPaywall(null, "generate");
          return;
        }
        showDownloadToast("积分扣除失败，请稍后重试", 3200);
      });
  };

  const getCardLabels = (template: InsuranceTemplateCard) => {
    if (activeCategory === "全部") {
      return [getTemplatePrimaryCategory(template), template.secondaryCategory].filter(
        (label, index, labels) => label && labels.indexOf(label) === index,
      );
    }
    return [template.secondaryCategory || getTemplatePrimaryCategory(template)];
  };

  const closeActiveTemplate = (reason: "close_button") => {
    if (activeTemplate) {
      trackInsuranceEvent({
        action: "template_modal_close",
        message: "Insurance template modal closed.",
        details: {
          ...getTemplateAnalyticsDetails(activeTemplate, false),
          reason,
        },
      });
    }
    setActiveTemplate(null);
  };

  return (
    <>
      {downloadToast ? (
        <div className="fixed inset-x-0 bottom-6 z-[10000] flex justify-center px-4 sm:bottom-8">
          <div className="max-w-[min(92vw,420px)] rounded-2xl bg-zinc-950 px-5 py-3 text-center text-sm font-medium leading-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] sm:rounded-full">
            {downloadToast}
          </div>
        </div>
      ) : null}

      {!isMineMode ? (
        <div className="mb-5 grid grid-cols-5 gap-x-1 gap-y-2 sm:mb-7 sm:flex sm:flex-wrap sm:gap-x-2 sm:gap-y-2.5">
          {categories.map((category) => {
            const active = category === activeCategory;
            const categoryRecordCount = templates.filter((template) => templateMatchesCategory(template, category)).length;

            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  trackInsuranceEvent({
                    action: "category_click",
                    message: "Insurance category clicked.",
                    details: {
                      category,
                      previousCategory: activeCategory,
                      templateCount: categoryRecordCount,
                    },
                  });
                  setVisibleTemplateCount(TEMPLATE_INITIAL_LOAD_COUNT);
                  setActiveCategory(category);
                }}
                className={`inline-flex h-9 w-full items-center justify-center rounded-full px-0 text-sm font-medium transition sm:h-10 sm:w-auto sm:shrink-0 sm:px-4 sm:text-sm ${
                  active
                    ? "bg-zinc-950 text-white"
                    : "bg-transparent text-zinc-600 hover:bg-white hover:text-zinc-950"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      ) : null}

      {isMineMode && myPosterRecords.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <div>
            <p className="text-lg font-medium text-zinc-900">没有生成记录</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">生成过的保险海报会按时间顺序显示在这里。</p>
          </div>
        </div>
      ) : (
        <>
          <div
            className="grid gap-3 sm:gap-4"
            style={{ gridTemplateColumns: `repeat(${masonryColumnCount}, minmax(0, 1fr))` }}
          >
            {isMineMode
              ? visibleMyPosterColumns.map((column, columnIndex) => (
                <div key={`my-poster-column-${columnIndex}`} className="flex min-w-0 flex-col gap-3 sm:gap-4">
                  {column.map((record) => {
                    const index = visibleMyPosterRecords.findIndex((item) => item.id === record.id);
                    const aspectClass = getAspectClassFromRatio(record.aspectRatio);
                    const originalImageSrc = record.imageSrc;
                    return (
                      <article
                        key={record.id}
                        onClick={() => openMyPosterRecord(record, "card")}
                        className="group relative w-full cursor-pointer overflow-hidden border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                      >
                        <div className={`relative w-full overflow-hidden bg-white ${aspectClass}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={originalImageSrc}
                            alt={`${record.posterTitle || "我的海报"}海报`}
                            loading={index < TEMPLATE_INITIAL_LOAD_COUNT ? "eager" : "lazy"}
                            decoding="async"
                            className="insurance-template-poster-image absolute inset-0 h-full w-full rounded-none object-contain"
                            referrerPolicy={originalImageSrc.startsWith("/") ? undefined : "no-referrer"}
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-zinc-950/42 via-zinc-950/18 to-transparent opacity-0 transition group-hover:opacity-100" />
                          <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 opacity-0 transition hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100">
                            <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/10 px-1.5 py-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.18)] backdrop-blur-[2px]">
                              <button
                                type="button"
                                aria-label={`重新生成：${record.posterTitle || record.template.title}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openMyPosterRecord(record, "hover_button");
                                }}
                                className="relative z-20 inline-flex h-10 min-w-[116px] items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.34),0_3px_10px_rgba(15,23,42,0.2)] transition hover:bg-zinc-800"
                              >
                                <RefreshCw size={15} className="mr-1.5" />
                                重新生成
                              </button>
                              <button
                                type="button"
                                aria-label={`下载海报：${record.posterTitle || record.template.title}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  requestDownloadMyPosterRecord(record, "hover_button");
                                }}
                                className="relative z-20 inline-flex h-10 min-w-[116px] items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_12px_24px_rgba(15,23,42,0.26),0_2px_8px_rgba(15,23,42,0.12)] ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                              >
                                <Download size={15} className="mr-1.5" />
                                下载海报
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 sm:p-3">
                          <h3 className="text-[13px] font-medium leading-5 text-zinc-900 sm:text-[15px] sm:leading-6">
                            {record.posterTitle || record.template.title}
                          </h3>
                          {record.posterDescription ? (
                            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500 sm:mt-2 sm:text-sm sm:leading-6">
                              {record.posterDescription}
                            </p>
                          ) : null}
                          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-zinc-500 sm:mt-3 sm:text-xs">
                            <span>{record.isCurrent ? "最新生成" : "历史记录"}</span>
                            <span className="shrink-0 whitespace-nowrap tabular-nums">{formatGeneratedPosterTime(record.createdAt)}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))
              : visibleTemplateColumns.map((column, columnIndex) => (
                <div key={`template-column-${columnIndex}`} className="flex min-w-0 flex-col gap-3 sm:gap-4">
                  {column.map((template) => {
                    const index = visibleTemplates.findIndex((item) => getTemplateIdentity(item) === getTemplateIdentity(template));
                    const likes = [8, 5, 13, 7, 11, 4, 10, 6, 3, 9, 2, 12][index % 12];
                    const views = [68, 34, 96, 52, 81, 29, 73, 41, 24, 59, 18, 88][index % 12];
                    const labels = getCardLabels(template);
                    const canDownload = Boolean(posterStateByTitle[template.title]?.imageSrc || template.imageSrc);

                    return (
                      <article
                        key={getTemplateIdentity(template)}
                        onClick={() => requestOpenTemplate(template, "card")}
                        className="group relative w-full cursor-pointer overflow-hidden border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                      >
                    <div className="relative w-full overflow-hidden bg-white">
                      <CasePreview
                        template={template}
                        eager={index < TEMPLATE_INITIAL_LOAD_COUNT}
                        previewId={getTemplateIdentity(template)}
                        onPreviewSettled={handleTemplatePreviewSettled}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-zinc-950/42 via-zinc-950/18 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center px-3 opacity-0 transition hover:opacity-100 focus-within:opacity-100 group-hover:opacity-100">
                        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/10 px-1.5 py-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.18)] backdrop-blur-[2px]">
                          <button
                            type="button"
                            aria-label={`生成同款：${template.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              requestOpenTemplate(template, "hover_button");
                            }}
                            className="relative z-20 inline-flex h-10 min-w-[116px] items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.34),0_3px_10px_rgba(15,23,42,0.2)] transition hover:bg-zinc-800"
                          >
                            生成同款
                            <ArrowRight size={15} className="ml-1.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`下载海报：${template.title}`}
                            disabled={!canDownload}
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDownloadTemplate(template);
                            }}
                            className="relative z-20 inline-flex h-10 min-w-[116px] items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_12px_24px_rgba(15,23,42,0.26),0_2px_8px_rgba(15,23,42,0.12)] ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Download size={15} className="mr-1.5" />
                            下载海报
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 sm:p-3">
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                        {labels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-2.5 text-[13px] font-medium leading-5 text-zinc-900 sm:mt-3 sm:text-[15px] sm:leading-6">
                        {template.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500 sm:mt-2 sm:text-sm sm:leading-6">
                        {template.description}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-zinc-500 sm:mt-3 sm:text-xs">
                        <span>♡ {likes}</span>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">{views} 次浏览</span>
                      </div>
                    </div>
                      </article>
                    );
                  })}
                </div>
              ))}
          </div>
          {emptyCategoryCards.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {emptyCategoryCards.map((card) => (
                <article
                  key={card.id}
                  className="w-full overflow-hidden rounded-xl border border-dashed border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                >
                  <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-200" />
                  <div className="p-3">
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500">
                        {activeCategory}
                      </span>
                      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500">
                        占位图
                      </span>
                    </div>
                    <h3 className="mt-3 text-[15px] font-medium leading-6 text-zinc-900">{card.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{card.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <span>即将上线</span>
                      <span className="shrink-0 whitespace-nowrap">模板占位</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {showTemplateBatchLoading ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: TEMPLATE_LOAD_BATCH_SIZE }).map((_, index) => (
                <div key={`template-loading-${activeCategory}-${index}`} className="w-full">
                  <TemplateCardSkeleton index={index} />
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {!(isMineMode && myPosterRecords.length === 0) ? (
        <div className="flex min-h-20 items-center justify-center pb-10 pt-6 text-center text-sm text-zinc-400">
          {showTemplateBatchLoading ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin text-zinc-500" />
              正在加载 8 张海报...
            </span>
          ) : hasMoreTemplates ? (
            <span>继续下滑加载更多海报</span>
          ) : (
            <span>已经到底部了</span>
          )}
        </div>
      ) : null}

      {activeTemplate && templateForm && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-stretch p-0 sm:items-center sm:justify-center sm:p-5">
          <div aria-hidden="true" className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[2px]" />
          <div className="relative grid h-dvh max-h-dvh w-full max-w-5xl grid-rows-[minmax(0,42dvh)_minmax(0,1fr)] overflow-hidden border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:h-[92dvh] sm:max-h-[92dvh] sm:rounded-2xl lg:grid-cols-[minmax(420px,1fr)_500px] lg:grid-rows-none">
            <div className="absolute right-3 top-3 z-40 flex items-center gap-2">
              <button
                type="button"
                aria-label="关闭"
                onClick={() => closeActiveTemplate("close_button")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-950 bg-zinc-950 text-white shadow-sm transition hover:bg-zinc-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="order-2 flex min-h-0 flex-col lg:order-1">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-4 sm:p-5">
                <h3 className="pr-10 text-xl font-semibold tracking-tight text-zinc-950">
                  {activeTemplateIsCustom ? "自定义海报" : "生成同款"}
                </h3>

                <div className="mt-4 grid gap-3">
                  <FieldBlock label="风格">
                    <ProductSelect
                      ariaLabel="风格"
                      value={selectedStyle.id}
                      disabled={isGenerateActionBusy}
                      options={availableStyleOptions.map((style) => ({
                        value: style.id,
                        label: style.name,
                      }))}
                      onChange={(value) =>
                        setTemplateForm((prev) => (prev ? { ...prev, styleId: value } : prev))
                      }
                    />
                  </FieldBlock>

                  <FieldBlock label="标题">
                    <EditableBox
                      value={templateForm.title}
                      placeholder="输入海报主标题"
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, title: value } : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="海报文案">
                    <EditableBox
                      value={formatPosterCopy(templateForm)}
                      minHeight="min-h-[15rem]"
                      multiline
                      rows={10}
                      placeholder={"副标题和核心要点写在这里，每行一条"}
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? applyPosterCopy(prev, value) : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="备注信息">
                    <EditableBox
                      value={formatRemarkCopy(templateForm)}
                      minHeight="min-h-24"
                      multiline
                      rows={4}
                      placeholder={"风险提示、补充说明、机构名称或署名写在这里，每行一条"}
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? applyRemarkCopy(prev, value) : prev))}
                    />
                  </FieldBlock>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 bg-white p-4 shadow-[0_-10px_24px_rgba(15,23,42,0.06)] sm:p-5">
                <button
                  type="button"
                  onClick={generateTemplate}
                  disabled={isGenerateActionBusy}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCheckingCredits ? (
                    <>
                      <LoaderCircle size={16} className="mr-2 animate-spin" />
                      确认积分
                    </>
                  ) : isGeneratingPoster ? (
                    <>
                      <LoaderCircle size={16} className="mr-2 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      生成海报
                      <ArrowRight size={16} className="ml-2" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={!activePosterImageSrc}
                  onClick={requestDownloadActivePoster}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={16} className="mr-2" />
                  下载海报
                </button>
              </div>
            </div>

            <div className="order-1 flex min-h-0 flex-col overflow-hidden border-b border-zinc-200 bg-zinc-100 lg:order-2 lg:border-b-0 lg:border-l">
              <div className="min-h-0 flex-1">
                <PosterPreview
                  template={activeTemplate}
                  posterState={activePosterState}
                  aspectRatio={templateForm.aspectRatio}
                  onRetry={generateTemplate}
                />
              </div>
              {activePosterState?.history.length ? (
                <div className="w-full border-t border-zinc-200 bg-white/90 px-3 py-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-medium text-zinc-500">历史生成记录</p>
                    <p className="text-[10px] text-zinc-400">{activePosterState.history.length} 张</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {activePosterState.history.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setPosterStateByTitle((prev) => {
                            const current = prev[activeTemplate.title];
                            if (!current || current.status === "generating") {
                              return prev;
                            }
                            return {
                              ...prev,
                              [activeTemplate.title]: {
                                ...current,
                                imageSrc: item.imageSrc,
                                aspectRatio: item.aspectRatio || current.aspectRatio,
                              },
                            };
                          })
                        }
                        className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 transition hover:border-zinc-400"
                        title={new Date(item.createdAt).toLocaleString("zh-CN")}
                      >
                        {canUseNextImageForInsuranceSrc(item.imageSrc) ? (
                          <Image src={item.imageSrc} alt="" fill sizes="44px" className="object-cover" />
                        ) : (
                          // image2 history items can be signed external URLs.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageSrc} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
          document.body,
          )
        : null}
      {creditsPaywallOpen && typeof document !== "undefined"
        ? createPortal(
            <InsuranceMembershipDialog
              open={creditsPaywallOpen}
              source="insurance_template_credits_paywall"
              contextLabel={`积分不足：${creditsPaywallAction === "download" ? "下载需要" : "生成需要"} ${INSURANCE_POSTER_GENERATION_CREDITS} 积分${
                creditsPaywallBalance === null ? "" : `，当前余额 ${creditsPaywallBalance} 积分`
              }`}
              onClose={() => setCreditsPaywallOpen(false)}
              onUpgrade={() => {
                setCreditsPaywallOpen(false);
                openCreditTopup();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
