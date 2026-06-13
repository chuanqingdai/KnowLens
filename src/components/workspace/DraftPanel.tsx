import { useMemo } from "react";

import {
  outlineItems,
  slideDrafts,
  taskFields,
  type SlideDraft,
} from "./mockData";
import { SlideCard } from "./SlideCard";

type DraftTab = "需求理解" | "内容大纲" | "页面文案";

type DraftPanelProps = {
  activeTab: DraftTab;
  onTabChange: (tab: DraftTab) => void;
};

function RequirementTab() {
  return (
    <div className="space-y-2">
      {taskFields.map((field) => (
        <div
          key={field.label}
          className="grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm"
        >
          <p className="text-zinc-500">{field.label}</p>
          <p className="text-zinc-800">{field.value}</p>
        </div>
      ))}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        下一步：确认内容后生成 PPT 页面
      </div>
    </div>
  );
}

function OutlineTab() {
  return (
    <ol className="space-y-2">
      {outlineItems.map((item, index) => (
        <li
          key={item}
          className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800"
        >
          {index + 1}. {item}
        </li>
      ))}
    </ol>
  );
}

function SlidesTab({ slides }: { slides: SlideDraft[] }) {
  return (
    <div className="space-y-3">
      {slides.map((slide) => (
        <SlideCard key={slide.page} slide={slide} />
      ))}
    </div>
  );
}

export function DraftPanel({ activeTab, onTabChange }: DraftPanelProps) {
  const tabs = useMemo(() => ["需求理解", "内容大纲", "页面文案"] as const, []);

  return (
    <aside className="h-full rounded-xl bg-white p-2">
      <div className="grid grid-cols-3 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`rounded-lg px-2 py-2 text-xs ${
              activeTab === tab
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-3 h-[calc(100%-58px)] overflow-y-auto pr-1">
        {activeTab === "需求理解" ? <RequirementTab /> : null}
        {activeTab === "内容大纲" ? <OutlineTab /> : null}
        {activeTab === "页面文案" ? <SlidesTab slides={slideDrafts} /> : null}
      </div>
    </aside>
  );
}

export type { DraftTab };
