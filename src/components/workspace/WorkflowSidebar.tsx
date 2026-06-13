import { Check } from "lucide-react";

import type { WorkflowStep } from "./mockData";

type WorkflowSidebarProps = {
  steps: WorkflowStep[];
};

export function WorkflowSidebar({ steps }: WorkflowSidebarProps) {
  return (
    <aside className="h-full rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">项目流程</h2>
      <ol className="mt-4 space-y-2">
        {steps.map((step, idx) => (
          <li key={step.id}>
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                step.status === "current"
                  ? "bg-zinc-900 text-white"
                  : step.status === "done"
                    ? "bg-zinc-100 text-zinc-800"
                    : "text-zinc-400"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                {step.status === "done" ? <Check size={12} /> : idx + 1}
              </span>
              <span>{step.title}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <h3 className="text-xs font-semibold text-zinc-700">输出目标</h3>
        <dl className="mt-2 space-y-1 text-xs text-zinc-600">
          <div className="flex justify-between gap-2">
            <dt>输出形式</dt>
            <dd>PPT</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>页数</dt>
            <dd>10页</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>受众</dt>
            <dd>中学生</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>风格</dt>
            <dd>清晰图解化</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
