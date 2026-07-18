"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  InsuranceTemplateGallery,
  type InsuranceTemplateCard,
} from "@/app/insurance/InsuranceTemplateGallery";
import { InsuranceScrollLink } from "@/app/insurance/InsuranceScrollLink";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { trackInsuranceEvent } from "@/lib/insurance-analytics";

type InsurancePageClientProps = {
  templates: InsuranceTemplateCard[];
  categories: string[];
  initialCategory: string;
  totalTemplateCount: number;
};

const HERO_SLIDES = [
  {
    src: "/insurance/hero-insurance-poster-wide.webp",
    alt: "保险文案生成海报示例",
  },
  {
    src: "/insurance/hero-brand-aesthetics.jpg",
    alt: "KnowLens 与保险品牌视觉海报展示",
  },
] as const;

const TEMPLATE_BATCH_SIZE = 8;

function getTemplateIdentity(template: InsuranceTemplateCard) {
  return template.imageSrc || `${template.primaryCategory}:${template.secondaryCategory}:${template.title}`;
}

function templateMatchesCategory(template: InsuranceTemplateCard, activeCategory: string) {
  if (activeCategory === "全部") {
    return true;
  }
  return (template.primaryCategory || template.category) === activeCategory;
}

export function InsurancePageClient({ templates, categories, initialCategory, totalTemplateCount }: InsurancePageClientProps) {
  const [showcaseTemplates, setShowcaseTemplates] = useState(templates);
  const [isTemplateCatalogLoading, setIsTemplateCatalogLoading] = useState(false);
  const [templateTotalByCategory, setTemplateTotalByCategory] = useState<Record<string, number>>({
    全部: totalTemplateCount,
  });
  const [templateOffsetByCategory, setTemplateOffsetByCategory] = useState<Record<string, number>>({
    全部: templates.length,
  });
  const [activeSection, setActiveSection] = useState<"showcase" | "mine">("showcase");
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const templateBatchRequestRef = useRef(false);

  useEffect(() => {
    setShowcaseTemplates(templates);
    setTemplateTotalByCategory({ 全部: totalTemplateCount });
    setTemplateOffsetByCategory({ 全部: templates.length });
  }, [templates, totalTemplateCount]);

  const getLoadedTemplateCountForCategory = useCallback(
    (category: string) =>
      showcaseTemplates.filter((template) => templateMatchesCategory(template, category || "全部")).length,
    [showcaseTemplates],
  );

  const hasMoreTemplateBatch = useCallback(
    (category: string) => {
      const normalizedCategory = category || "全部";
      const knownTotal = templateTotalByCategory[normalizedCategory];
      if (typeof knownTotal === "number") {
        return getLoadedTemplateCountForCategory(normalizedCategory) < knownTotal;
      }
      return getLoadedTemplateCountForCategory(normalizedCategory) < totalTemplateCount;
    },
    [getLoadedTemplateCountForCategory, templateTotalByCategory, totalTemplateCount],
  );

  const loadTemplateBatch = useCallback((category = "全部") => {
    const normalizedCategory = category || "全部";
    if (templateBatchRequestRef.current || !hasMoreTemplateBatch(normalizedCategory)) {
      return;
    }
    templateBatchRequestRef.current = true;
    setIsTemplateCatalogLoading(true);
    const offset =
      templateOffsetByCategory[normalizedCategory] ??
      getLoadedTemplateCountForCategory(normalizedCategory);
    const query = new URLSearchParams({
      offset: String(offset),
      limit: String(TEMPLATE_BATCH_SIZE),
    });
    if (normalizedCategory !== "全部") {
      query.set("category", normalizedCategory);
    }
    fetch(`/api/insurance/templates?${query.toString()}`, { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load templates."))))
      .then((payload: { templates?: InsuranceTemplateCard[]; total?: number }) => {
        const nextTemplates = Array.isArray(payload.templates) ? payload.templates : [];
        setTemplateTotalByCategory((current) => ({
          ...current,
          [normalizedCategory]: typeof payload.total === "number" ? payload.total : current[normalizedCategory] ?? 0,
        }));
        setTemplateOffsetByCategory((current) => ({
          ...current,
          [normalizedCategory]: offset + nextTemplates.length,
        }));
        if (nextTemplates.length === 0) {
          return;
        }
        setShowcaseTemplates((current) => {
          const existingIds = new Set(current.map(getTemplateIdentity));
          const appendedTemplates = nextTemplates.filter((template) => !existingIds.has(getTemplateIdentity(template)));
          return appendedTemplates.length > 0 ? [...current, ...appendedTemplates] : current;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        templateBatchRequestRef.current = false;
        setIsTemplateCatalogLoading(false);
      });
  }, [getLoadedTemplateCountForCategory, hasMoreTemplateBatch, templateOffsetByCategory]);

  useEffect(() => {
    trackInsuranceEvent({
      action: "page_view",
      message: "Insurance landing page viewed.",
      details: {
        initialCategory,
        templateCount: showcaseTemplates.length,
        categoryCount: categories.length,
      },
    });
  }, [categories.length, initialCategory, showcaseTemplates.length]);

  const selectSection = useCallback(
    (nextSection: "showcase" | "mine") => {
      if (activeSection === nextSection) {
        return;
      }
      trackInsuranceEvent({
        action: "section_tab_click",
        message: "Insurance section tab clicked.",
        details: {
          previousSection: activeSection,
          nextSection,
          initialCategory,
        },
      });
      setActiveSection(nextSection);
    },
    [activeSection, initialCategory],
  );

  const selectHeroSlide = useCallback(
    (nextSlide: number, source: "auto" | "arrow" | "dot") => {
      const normalizedSlide = (nextSlide + HERO_SLIDES.length) % HERO_SLIDES.length;
      setActiveHeroSlide(normalizedSlide);
      if (source !== "auto") {
        trackInsuranceEvent({
          action: "hero_slide_change",
          message: "Insurance hero slide changed.",
          details: {
            source,
            slideIndex: normalizedSlide,
          },
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (isHeroPaused || HERO_SLIDES.length < 2) {
      return;
    }
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      selectHeroSlide(activeHeroSlide + 1, "auto");
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeHeroSlide, isHeroPaused, selectHeroSlide]);

  return (
    <MarketingChrome
      showLocaleSwitch={false}
      showExamplesLink={false}
      showToolsMenu={false}
      forceLocale="zh"
      membershipVariant="insurance"
      showPrimaryCta={false}
      showFooter={false}
    >
      <div className="insurance-page-shell mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:gap-12 sm:px-6 sm:py-10 lg:gap-12 lg:py-10">
        <section className="grid justify-items-center gap-8 py-8 text-center sm:py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:justify-items-stretch lg:py-12 lg:text-left">
          <div className="flex max-w-3xl flex-col items-center lg:items-start">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-700 shadow-sm sm:mb-5 sm:px-4 sm:py-2 sm:text-xs">
              <Sparkles size={14} />
              保罗万相联合出品
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight">
              <span className="block">「展页」保险海报</span>
              <span className="block">一键制作同款</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-600 sm:mt-5 sm:text-base sm:leading-7">
              覆盖宣传、产品、教育、续保和理赔服务，一键套用保险海报模板。标题、卖点和风险提示都能精准修改。
            </p>
            <div className="mt-5 flex flex-row flex-wrap justify-center gap-3 sm:mt-6 lg:justify-start">
              <InsuranceScrollLink
                className="inline-flex h-12 min-w-36 items-center justify-center rounded-full bg-zinc-950 px-7 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 sm:min-w-40"
                onClick={() =>
                  trackInsuranceEvent({
                    action: "select_template_click",
                    message: "Insurance hero select template CTA clicked.",
                    details: {
                      placement: "hero",
                      initialCategory,
                    },
                  })
                }
              >
                选择模板
                <ArrowRight size={16} className="ml-2" />
              </InsuranceScrollLink>
            </div>
          </div>

          <div
            className="group relative aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm sm:rounded-2xl lg:max-w-none"
            onMouseEnter={() => setIsHeroPaused(true)}
            onMouseLeave={() => setIsHeroPaused(false)}
            onFocusCapture={() => setIsHeroPaused(true)}
            onBlurCapture={() => setIsHeroPaused(false)}
          >
            {HERO_SLIDES.map((slide, index) => (
              <Image
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                sizes="(min-width: 1024px) 610px, 100vw"
                className={`object-cover transition duration-700 ease-out ${
                  activeHeroSlide === index ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
                }`}
              />
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950/45 to-transparent" />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  key={`${slide.src}-indicator`}
                  type="button"
                  aria-label={`切换到第 ${index + 1} 张`}
                  aria-current={activeHeroSlide === index}
                  onClick={() => selectHeroSlide(index, "dot")}
                  className={`rounded-full transition ${
                    activeHeroSlide === index ? "h-1.5 w-4 bg-white/80" : "h-1.5 w-1.5 bg-white/35 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="templates" className="scroll-mt-20">
          <div className="mb-5 border-b border-zinc-200 sm:mb-7">
            <button
              type="button"
              onClick={() => selectSection("showcase")}
              className={`inline-flex h-11 items-center border-b-2 px-1 text-sm font-medium transition sm:h-12 sm:px-1 sm:text-base ${
                activeSection === "showcase"
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:text-zinc-950"
              }`}
            >
              精选海报
            </button>
            <button
              type="button"
              onClick={() => selectSection("mine")}
              className={`ml-6 inline-flex h-11 items-center border-b-2 px-1 text-sm font-medium transition sm:ml-8 sm:h-12 sm:px-1 sm:text-base ${
                activeSection === "mine"
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:text-zinc-950"
              }`}
            >
              我的海报
            </button>
          </div>
          <InsuranceTemplateGallery
            key={activeSection}
            templates={showcaseTemplates}
            categories={categories}
            initialCategory={initialCategory}
            mode={activeSection}
            hasDeferredTemplates={(category) => activeSection === "showcase" && hasMoreTemplateBatch(category)}
            isDeferredTemplateLoading={isTemplateCatalogLoading}
            onLoadDeferredTemplates={loadTemplateBatch}
          />
        </section>
      </div>
    </MarketingChrome>
  );
}
