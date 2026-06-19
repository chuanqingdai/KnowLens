"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AlertCircle, ArrowRight, Crown, Download, LoaderCircle, RefreshCw, X } from "lucide-react";
import { INSURANCE_CUSTOM_POSTER_EVENT } from "@/app/insurance/InsuranceCustomPosterButton";
import {
  InsuranceMembershipDialog,
  openInsuranceMembershipCheckout,
} from "@/components/billing/InsuranceMembershipDialog";
import {
  buildInsurancePosterPrompt,
  createInsuranceTemplateFormState,
} from "@/lib/insurance-poster-prompt";
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
  aspectRatio?: "9:16" | "3:4" | "4:5" | "16:11" | "1:1" | "16:9" | "4:3";
  styleId?: string;
  isFree?: boolean;
  isCustom?: boolean;
};

type InsuranceTemplateGalleryProps = {
  templates: InsuranceTemplateCard[];
  categories: string[];
  initialCategory?: string;
};

type SupportedTemplateAspectRatio = "1:1" | "9:16" | "16:9" | "3:4";
type InsuranceStyleOption = {
  id: string;
  name: string;
  prompt: string;
};
type GenerationStatus = "ready" | "generating" | "failed";
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
type GeneratedPosterState = {
  status: GenerationStatus;
  imageSrc: string;
  aspectRatio?: SupportedTemplateAspectRatio;
  history: Array<{ id: string; imageSrc: string; createdAt: number; aspectRatio?: SupportedTemplateAspectRatio }>;
  errorMessage?: string;
  errorCode?: string;
};
type MembershipGateAction = "generate" | "download";
type BillingCreditsPayload = {
  balance?: number;
  subscription?: {
    status?: string;
  } | null;
};

const INSURANCE_POSTER_GENERATION_CREDITS = STANDARD_OUTPUT_PROMO_CREDITS;
const CUSTOM_INSURANCE_TEMPLATE_TITLE = "自定义海报";
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

const emptyCategoryDescriptions: Record<string, string> = {
  日签: "适合代理人每日早安问候、客户轻触达和朋友圈日常经营。",
  生日: "适合客户生日祝福、续联问候和专属顾问关系维护。",
  节日: "适合节假日祝福、节点营销和客户关怀内容转发。",
  节气: "适合二十四节气问候、健康提醒和轻量品牌露出。",
  活动: "适合沙龙邀约、直播预告、客户答疑会和报名转化。",
  产品: "适合保险产品亮点说明、配置建议和方案介绍。",
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

function getAspectClassFromRatio(aspectRatio?: SupportedTemplateAspectRatio) {
  if (aspectRatio === "1:1") return "aspect-square";
  if (aspectRatio === "16:9") return "aspect-video";
  if (aspectRatio === "3:4") return "aspect-[3/4]";
  return "aspect-[9/16]";
}

function normalizeAspectRatioChoice(aspectRatio?: string): SupportedTemplateAspectRatio {
  return aspectRatioOptions.includes(aspectRatio as SupportedTemplateAspectRatio)
    ? (aspectRatio as SupportedTemplateAspectRatio)
    : "9:16";
}

function getStyleOption(styleId?: string) {
  return insuranceStyleOptions.find((style) => style.id === styleId) || insuranceStyleOptions[0];
}

function hasActiveMembership(subscription?: BillingCreditsPayload["subscription"]) {
  return subscription?.status === "active" || subscription?.status === "canceling";
}

function parseCoreRows(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
  return [template.primaryCategory, template.category, template.secondaryCategory].some((value) =>
    value ? value.includes(activeCategory) || activeCategory.includes(value) : false,
  );
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

function CasePreview({ template, eager = false }: { template: InsuranceTemplateCard; eager?: boolean }) {
  const aspectClass = getAspectClass(template);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (template.imageSrc) {
    return (
      <div className={`relative w-full overflow-hidden bg-zinc-100 ${aspectClass}`}>
        {!loaded ? <div className="skeleton-shimmer pointer-events-none absolute inset-0 z-10" /> : null}
        {failed ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-100 px-4 text-center">
            <div>
              <p className="text-xs font-medium text-zinc-500">海报暂未加载</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-400">{template.title}</p>
            </div>
          </div>
        ) : (
          // Native image loading is more reliable inside CSS multi-column masonry on mobile Safari.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.imageSrc}
            alt={`${template.title}海报`}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    );
  }

  return <div aria-hidden="true" className={`w-full bg-zinc-100 ${aspectClass}`} />;
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
  const imageSrc = posterState?.imageSrc || template.imageSrc;
  const isGenerating = posterState?.status === "generating";
  const isFailed = posterState?.status === "failed";

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-zinc-100">
      {imageSrc ? (
        <div className={`relative overflow-hidden bg-zinc-100 ${aspectClass} ${fitClass}`}>
          {imageSrc.startsWith("/") ? (
            <Image
              src={imageSrc}
              alt={`${template.title}海报`}
              fill
              sizes="500px"
              className="object-contain"
              priority
            />
          ) : (
            // image2 returns signed external image URLs that are not part of Next image remote config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={`${template.title}海报`}
              className="absolute inset-0 h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          {isGenerating ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/62 backdrop-blur-[2px]">
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
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 px-4 backdrop-blur-[1px]">
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

export function InsuranceTemplateGallery({ templates, categories, initialCategory = "全部" }: InsuranceTemplateGalleryProps) {
  const safeInitialCategory = categories.includes(initialCategory) ? initialCategory : "全部";
  const [activeCategory, setActiveCategory] = useState(safeInitialCategory);
  const [activeTemplate, setActiveTemplate] = useState<InsuranceTemplateCard | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState | null>(null);
  const [posterStateByTitle, setPosterStateByTitle] = useState<Record<string, GeneratedPosterState>>({});
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const downloadToastTimerRef = useRef<number | null>(null);
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);
  const [creditsPaywallOpen, setCreditsPaywallOpen] = useState(false);
  const [creditsPaywallBalance, setCreditsPaywallBalance] = useState<number | null>(null);
  const [membershipPaywallOpen, setMembershipPaywallOpen] = useState(false);
  const [membershipPaywallAction, setMembershipPaywallAction] = useState<MembershipGateAction>("generate");
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => templateMatchesCategory(template, activeCategory));
  }, [activeCategory, templates]);
  const emptyCategoryCards = useMemo(() => {
    if (activeCategory === "全部" || filteredTemplates.length > 0) {
      return [];
    }
    return buildEmptyCategoryCards(activeCategory);
  }, [activeCategory, filteredTemplates.length]);

  const activePosterState = activeTemplate ? posterStateByTitle[activeTemplate.title] : undefined;
  const isGeneratingPoster = activePosterState?.status === "generating";
  const isGenerateActionBusy = isGeneratingPoster || isCheckingCredits;
  const selectedStyle = getStyleOption(templateForm?.styleId);
  const activePosterImageSrc = activePosterState?.imageSrc || activeTemplate?.imageSrc || "";
  const isTemplatePremium = (template: InsuranceTemplateCard) => {
    if (template.isCustom || template.isFree === true) {
      return false;
    }
    return true;
  };
  const activeTemplatePremium = activeTemplate ? isTemplatePremium(activeTemplate) : false;
  const activeTemplateIsCustom = Boolean(activeTemplate?.isCustom);

  useEffect(() => {
    return () => {
      if (downloadToastTimerRef.current) {
        window.clearTimeout(downloadToastTimerRef.current);
      }
    };
  }, []);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTemplate(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeTemplate]);

  const openTemplate = (template: InsuranceTemplateCard) => {
    trackInsuranceEvent({
      action: "template_modal_open",
      message: "Insurance template modal opened.",
      details: getTemplateAnalyticsDetails(template, isTemplatePremium(template)),
    });
    setActiveTemplate(template);
    setTemplateForm({
      ...createInsuranceTemplateFormState(template),
      aspectRatio: normalizeAspectRatioChoice(template.aspectRatio),
      styleId: template.styleId || insuranceStyleOptions[0].id,
    });
  };

  const openCustomTemplate = () => {
    const customTemplate = createCustomInsuranceTemplate();
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
        status: "ready",
        imageSrc: "",
        aspectRatio: "9:16",
        history: [],
      },
    }));
  };

  useEffect(() => {
    const onCustomPoster = () => openCustomTemplate();
    window.addEventListener(INSURANCE_CUSTOM_POSTER_EVENT, onCustomPoster);
    return () => window.removeEventListener(INSURANCE_CUSTOM_POSTER_EVENT, onCustomPoster);
  }, []);

  const openMembershipPaywall = (action: MembershipGateAction) => {
    trackInsuranceEvent({
      action: "membership_paywall_shown",
      message: "Insurance membership paywall shown.",
      details: {
        gateAction: action,
        activeTemplateTitle: activeTemplate?.isCustom ? CUSTOM_INSURANCE_TEMPLATE_TITLE : activeTemplate?.title,
        activeTemplateCategory: activeTemplate?.primaryCategory,
        activeTemplateSecondaryCategory: activeTemplate?.secondaryCategory,
      },
    });
    setMembershipPaywallAction(action);
    setActiveTemplate(null);
    setTemplateForm(null);
    setMembershipPaywallOpen(true);
  };

  const openCreditsPaywall = (balance: number | null) => {
    trackInsuranceEvent({
      action: "credits_paywall_shown",
      message: "Insurance credits paywall shown.",
      details: {
        balance,
        requiredCredits: INSURANCE_POSTER_GENERATION_CREDITS,
        activeTemplateTitle: activeTemplate?.isCustom ? CUSTOM_INSURANCE_TEMPLATE_TITLE : activeTemplate?.title,
        activeTemplateCategory: activeTemplate?.primaryCategory,
        activeTemplateSecondaryCategory: activeTemplate?.secondaryCategory,
      },
    });
    setCreditsPaywallBalance(Number.isFinite(balance) ? balance : null);
    setActiveTemplate(null);
    setTemplateForm(null);
    setCreditsPaywallOpen(true);
  };

  const openMembership = () => {
    trackInsuranceEvent({
      action: "membership_checkout_click",
      message: "Insurance membership checkout clicked.",
      details: {
        source: "insurance_template_membership",
      },
    });
    openInsuranceMembershipCheckout("insurance_template_membership");
  };

  const verifyMembershipAccess = async (action: MembershipGateAction) => {
    try {
      const response = await fetch("/api/billing/credits", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as BillingCreditsPayload | null;
      if (response.ok && hasActiveMembership(payload?.subscription)) {
        return true;
      }
      openMembershipPaywall(action);
      return false;
    } catch {
      openMembershipPaywall(action);
      return false;
    }
  };

  const verifyCreditsBeforeGeneration = async () => {
    try {
      const response = await fetch("/api/billing/credits", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as BillingCreditsPayload | null;
      const balance = Number(payload?.balance ?? 0);
      if (!response.ok || !Number.isFinite(balance) || balance < INSURANCE_POSTER_GENERATION_CREDITS) {
        openCreditsPaywall(Number.isFinite(balance) ? balance : null);
        return false;
      }
      return true;
    } catch {
      openCreditsPaywall(null);
      return false;
    }
  };

  const requestOpenTemplate = (template: InsuranceTemplateCard, placement: "card" | "hover_button" = "card") => {
    const premium = isTemplatePremium(template);
    trackInsuranceEvent({
      action: "template_open_click",
      message: "Insurance template open clicked.",
      details: {
        ...getTemplateAnalyticsDetails(template, premium),
        placement,
        activeCategory,
      },
    });
    void (async () => {
      if (premium && !(await verifyMembershipAccess("generate"))) {
        return;
      }
      openTemplate(template);
    })();
  };

  const requestDownloadTemplate = (template: InsuranceTemplateCard) => {
    const premium = isTemplatePremium(template);
    void (async () => {
      const imageSrc = posterStateByTitle[template.title]?.imageSrc || template.imageSrc || "";
      trackInsuranceEvent({
        action: "template_download_click",
        message: "Insurance template download clicked.",
        details: {
          ...getTemplateAnalyticsDetails(template, premium),
          activeCategory,
          hasImage: Boolean(imageSrc),
        },
      });
      if (!imageSrc) {
        return;
      }
      if (premium && !(await verifyMembershipAccess("download"))) {
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
      } catch {
        showDownloadToast("下载未完成，请稍后重试或打开图片长按保存", 3600);
        return;
      }
      trackInsuranceEvent({
        action: "template_download_started",
        message: "Insurance template download started.",
        details: {
          ...getTemplateAnalyticsDetails(template, premium),
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
          ...getTemplateAnalyticsDetails(activeTemplate, activeTemplatePremium),
          selectedAspectRatio: templateForm?.aspectRatio,
        },
      });
      if (activeTemplatePremium && !(await verifyMembershipAccess("download"))) {
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
      } catch {
        showDownloadToast("下载未完成，请稍后重试或打开图片长按保存", 3600);
        return;
      }
      trackInsuranceEvent({
        action: "modal_download_started",
        message: "Insurance modal download started.",
        details: {
          ...getTemplateAnalyticsDetails(activeTemplate, activeTemplatePremium),
          selectedAspectRatio: templateForm?.aspectRatio,
        },
      });
    })();
  };

  const generateTemplate = () => {
    if (!activeTemplate || !templateForm || isGenerateActionBusy) {
      return;
    }
    const templateKey = activeTemplate.title;
    const selectedAspectRatio = templateForm.aspectRatio;
    const currentStyle = getStyleOption(templateForm.styleId);
    const prompt = buildInsurancePosterPrompt(activeTemplate, activeTemplate.primaryCategory, {
      ...templateForm,
      styleName: currentStyle.name,
      stylePrompt: currentStyle.prompt,
    });
    const generateDetails = {
      ...getTemplateAnalyticsDetails(activeTemplate, activeTemplatePremium),
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

    void (activeTemplatePremium ? verifyMembershipAccess("generate") : Promise.resolve(true))
      .then((hasMembershipAccess) => {
        if (!hasMembershipAccess) {
          setIsCheckingCredits(false);
          return false;
        }
        return verifyCreditsBeforeGeneration();
      })
      .then((hasEnoughCredits) => {
        setIsCheckingCredits(false);
        if (!hasEnoughCredits) {
          return;
        }
        setPosterStateByTitle((prev) => {
          const current = prev[templateKey] || {
            status: "ready",
            imageSrc: activeTemplate.imageSrc || "",
            aspectRatio: normalizeAspectRatioChoice(activeTemplate.aspectRatio),
            history: [],
          };
          const archived =
            current.imageSrc && current.status !== "generating"
              ? {
                  id: `${templateKey}-${Date.now()}`,
                  imageSrc: current.imageSrc,
                  createdAt: Date.now(),
                  aspectRatio: current.aspectRatio || normalizeAspectRatioChoice(activeTemplate.aspectRatio),
                }
              : null;
          return {
            ...prev,
            [templateKey]: {
              status: "generating",
              imageSrc: current.imageSrc || activeTemplate.imageSrc || "",
              aspectRatio: selectedAspectRatio,
              history: archived ? [archived, ...current.history].slice(0, 8) : current.history,
              errorMessage: undefined,
              errorCode: undefined,
            },
          };
        });

        void fetch("/api/insurance/poster-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            aspectRatio: selectedAspectRatio,
          }),
        })
          .then((response) => {
            trackInsuranceEvent({
              action: "generate_request_sent",
              message: "Insurance poster generation request sent.",
              details: generateDetails,
            });
            return response;
          })
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as
              | {
                  ok?: boolean;
                  imageUrl?: string;
                  error?: { code?: string; message?: string; detail?: string };
                }
              | null;
            if (!response.ok || !payload?.ok || !payload.imageUrl) {
              const message = payload?.error?.message || `generation failed (${response.status})`;
              const error = new Error(message) as Error & { code?: string };
              error.code = payload?.error?.code;
              throw error;
            }
            setPosterStateByTitle((prev) => {
              const current = prev[templateKey];
              return {
                ...prev,
                [templateKey]: {
                  status: "ready",
                  imageSrc: payload.imageUrl || "",
                  aspectRatio: selectedAspectRatio,
                  history: current?.history || [],
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
                hasImageUrl: Boolean(payload.imageUrl),
              },
            });
          })
          .catch((error: Error & { code?: string }) => {
            setPosterStateByTitle((prev) => {
              const current = prev[templateKey];
              return {
                ...prev,
                [templateKey]: {
                  status: "failed",
                  imageSrc: current?.imageSrc || activeTemplate.imageSrc || "",
                  aspectRatio: selectedAspectRatio,
                  history: current?.history || [],
                  errorMessage: error.message || "Generation failed. Please retry this card.",
                  errorCode: error.code,
                },
              };
            });
            trackInsuranceEvent({
              action: "generate_failed",
              message: "Insurance poster generation failed.",
              details: {
                ...generateDetails,
                errorCode: error.code,
                errorMessage: error.message,
              },
            });
          });
      })
      .catch(() => {
        setIsCheckingCredits(false);
        openCreditsPaywall(null);
      });
  };

  const getCardLabels = (template: InsuranceTemplateCard) => {
    if (activeCategory === "全部") {
      return [template.primaryCategory, template.secondaryCategory].filter(
        (label, index, labels) => label && labels.indexOf(label) === index,
      );
    }
    return [template.secondaryCategory || template.primaryCategory];
  };

  const closeActiveTemplate = (reason: "backdrop" | "close_button") => {
    if (activeTemplate) {
      trackInsuranceEvent({
        action: "template_modal_close",
        message: "Insurance template modal closed.",
        details: {
          ...getTemplateAnalyticsDetails(activeTemplate, activeTemplatePremium),
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

      <div className="mb-6 flex flex-wrap gap-2 sm:mb-8 sm:gap-3">
        {categories.map((category) => {
          const active = category === activeCategory;

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
                    templateCount: templates.filter((template) => templateMatchesCategory(template, category)).length,
                  },
                });
                setActiveCategory(category);
              }}
              className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition sm:h-12 sm:px-6 sm:text-base ${
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

      <div className="columns-2 [column-gap:0.75rem] sm:[column-gap:1rem] lg:columns-3 xl:columns-4">
        {filteredTemplates.map((template, index) => {
          const likes = [8, 5, 13, 7, 11, 4, 10, 6, 3, 9, 2, 12][index % 12];
          const views = [68, 34, 96, 52, 81, 29, 73, 41, 24, 59, 18, 88][index % 12];
          const labels = getCardLabels(template);
          const premium = isTemplatePremium(template);
          const canDownload = Boolean(posterStateByTitle[template.title]?.imageSrc || template.imageSrc);

          return (
            <article
              key={template.title}
              onClick={() => requestOpenTemplate(template, "card")}
              className="group relative mb-3 block w-full cursor-pointer break-inside-avoid-column overflow-hidden border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] sm:mb-4"
            >
              <div className="relative w-full overflow-hidden bg-zinc-100">
                <CasePreview template={template} eager={index < 24} />
                {premium ? (
                  <div className="absolute right-2.5 top-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-[0_8px_18px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.58)]">
                    <Crown size={14} fill="currentColor" />
                  </div>
                ) : null}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950/42 via-zinc-950/18 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-3 flex justify-center px-3 opacity-0 transition group-hover:opacity-100">
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
        {emptyCategoryCards.map((card) => (
          <article
            key={card.id}
            className="mb-3 block w-full break-inside-avoid-column overflow-hidden rounded-xl border border-dashed border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)] sm:mb-4"
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

      <div className="pt-8 pb-12 text-center text-sm text-zinc-400">已经到底部了</div>

      {activeTemplate && templateForm && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-stretch justify-stretch p-0 sm:items-center sm:justify-center sm:p-5">
          <button
            type="button"
            aria-label="关闭浮层"
            className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[2px]"
            onClick={() => closeActiveTemplate("backdrop")}
          />
          <div className="relative grid h-dvh max-h-dvh w-full max-w-5xl grid-rows-[minmax(0,42dvh)_minmax(0,1fr)] overflow-hidden border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:h-[92dvh] sm:max-h-[92dvh] sm:rounded-2xl lg:grid-cols-[minmax(420px,1fr)_500px] lg:grid-rows-none">
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <button
                type="button"
                aria-label="关闭"
                onClick={() => closeActiveTemplate("close_button")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-100 hover:text-zinc-900"
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
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <FieldBlock label="尺寸">
                    <select
                      aria-label="尺寸"
                      value={templateForm.aspectRatio}
                      disabled={isGenerateActionBusy}
                      onChange={(event) =>
                        setTemplateForm((prev) =>
                          prev ? { ...prev, aspectRatio: event.target.value as SupportedTemplateAspectRatio } : prev,
                        )
                      }
                      className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {aspectRatioOptions.map((ratio) => (
                        <option key={ratio} value={ratio}>
                          {ratio}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>

                  <FieldBlock label="风格">
                    <select
                      aria-label="风格"
                      value={selectedStyle.id}
                      disabled={isGenerateActionBusy}
                      onChange={(event) =>
                        setTemplateForm((prev) => (prev ? { ...prev, styleId: event.target.value } : prev))
                      }
                      className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {insuranceStyleOptions.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.name}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                  </div>

                  <FieldBlock label="标题（必填）">
                    <EditableBox
                      value={templateForm.title}
                      placeholder="输入海报主标题"
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, title: value } : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="副标题（选填）">
                    <EditableBox
                      value={templateForm.description}
                      placeholder="输入一句副标题"
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, description: value } : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="核心要点（选填）">
                    <EditableBox
                      value={templateForm.rows.join("\n")}
                      minHeight="min-h-24"
                      multiline
                      rows={4}
                      placeholder={"每行一个核心卖点"}
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, rows: parseCoreRows(value) } : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="辅助信息（选填）">
                    <EditableBox
                      value={templateForm.auxiliaryInfo}
                      placeholder="输入风险提示或备注"
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, auxiliaryInfo: value } : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="机构名称（选填）">
                    <EditableBox
                      value={templateForm.organizationName}
                      placeholder="输入机构名称"
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, organizationName: value } : prev))}
                    />
                  </FieldBlock>

                  <FieldBlock label="插图元素（选填）">
                    <EditableBox
                      value={templateForm.illustration}
                      minHeight="min-h-20"
                      multiline
                      placeholder="描述海报画面元素"
                      disabled={isGenerateActionBusy}
                      onChange={(value) => setTemplateForm((prev) => (prev ? { ...prev, illustration: value } : prev))}
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
                        {item.imageSrc.startsWith("/") ? (
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
      {membershipPaywallOpen && typeof document !== "undefined"
        ? createPortal(
            <InsuranceMembershipDialog
              open={membershipPaywallOpen}
              source={`insurance_template_membership_${membershipPaywallAction}`}
              contextLabel={membershipPaywallAction === "download" ? "下载高级海报" : "生成高级同款"}
              onClose={() => setMembershipPaywallOpen(false)}
              onUpgrade={() => {
                setMembershipPaywallOpen(false);
                openMembership();
              }}
            />,
            document.body,
          )
        : null}
      {creditsPaywallOpen && typeof document !== "undefined"
        ? createPortal(
            <InsuranceMembershipDialog
              open={creditsPaywallOpen}
              source="insurance_template_credits_paywall"
              contextLabel={`积分不足：生成需要 ${INSURANCE_POSTER_GENERATION_CREDITS} 积分${
                creditsPaywallBalance === null ? "" : `，当前余额 ${creditsPaywallBalance} 积分`
              }`}
              onClose={() => setCreditsPaywallOpen(false)}
              onUpgrade={() => {
                setCreditsPaywallOpen(false);
                openMembership();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
