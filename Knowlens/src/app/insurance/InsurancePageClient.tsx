"use client";

import { useCallback, useEffect, useState } from "react";
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
};

export function InsurancePageClient({ templates, categories, initialCategory }: InsurancePageClientProps) {
  const [activeSection, setActiveSection] = useState<"showcase" | "mine">("showcase");

  useEffect(() => {
    trackInsuranceEvent({
      action: "page_view",
      message: "Insurance landing page viewed.",
      details: {
        initialCategory,
        templateCount: templates.length,
        categoryCount: categories.length,
      },
    });
  }, [categories.length, initialCategory, templates.length]);

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
              BAOX联合出品
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight">
              <span className="block">保险营销海报</span>
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

          <div className="relative aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:rounded-2xl lg:max-w-none">
            <Image
              src="/insurance/hero-insurance-poster-wide.webp"
              alt="保险文案生成海报示例"
              fill
              priority
              sizes="(min-width: 1024px) 610px, 100vw"
              className="object-contain"
            />
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
            templates={templates}
            categories={categories}
            initialCategory={initialCategory}
            mode={activeSection}
          />
        </section>
      </div>
    </MarketingChrome>
  );
}
