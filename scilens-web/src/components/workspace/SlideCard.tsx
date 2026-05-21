import type { SlideDraft } from "./mockData";

type SlideCardProps = {
  slide: SlideDraft;
};

const actions = ["重写", "缩短", "更生动", "改成图解化"];

export function SlideCard({ slide }: SlideCardProps) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
          第{slide.page}页
        </span>
        <span className="text-xs text-zinc-500">页面文案</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-zinc-900">{slide.title}</h4>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{slide.body}</p>
      <p className="mt-2 text-xs text-zinc-500">视觉建议：{slide.visual}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}
