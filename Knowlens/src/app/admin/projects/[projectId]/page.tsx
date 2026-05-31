"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createAdminConsoleMockData } from "@/lib/admin/adminConsoleMock";

function formatDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || "";
  const [data] = useState(() => createAdminConsoleMockData());
  const [toast, setToast] = useState("");

  const project = data.projects.find((item) => item.id === projectId) || null;
  const owner = project ? data.users.find((item) => item.id === project.userId) : null;
  const logs = useMemo(() => data.logs.filter((item) => item.projectId === projectId), [data.logs, projectId]);
  const credits = useMemo(() => data.creditRecords.filter((item) => item.projectId === projectId), [data.creditRecords, projectId]);

  function copyText(value: string, label: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => setToast(`已复制 ${label}`))
      .catch(() => setToast(`复制 ${label} 失败`));
    window.setTimeout(() => setToast(""), 2200);
  }

  if (!project) {
    return (
      <AdminShell title="项目详情" description="未找到对应项目。">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-600">项目不存在或已被删除。</p>
          <Link href="/admin?tab=projects" className="mt-3 inline-flex text-sm text-zinc-900 underline underline-offset-2">
            返回项目管理
          </Link>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`项目详情 · ${project.id}`} description="长期对象详情页：输入、配置、生成内容、执行日志和积分记录。">
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{project.topic}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {project.id} · {project.type} · {project.status} · {project.stage}
              </p>
              <p className="mt-1 text-xs text-zinc-500">requestId: {project.requestId}</p>
              <p className="mt-1 text-xs text-zinc-500">创建时间: {formatDateTime(project.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copyText(project.id, "projectId")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs hover:bg-zinc-100">
                <Copy size={12} />
                复制 projectId
              </button>
              <button type="button" onClick={() => setToast("已提交重试任务（mock）")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs hover:bg-zinc-100">
                <RefreshCw size={12} />
                重试
              </button>
              <button type="button" onClick={() => setToast("已创建退积分任务（mock）")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs hover:bg-zinc-100">
                退积分
              </button>
            </div>
          </div>
          {toast ? <p className="mt-2 text-xs text-zinc-600">{toast}</p> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">项目概览</p>
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">用户：{owner ? owner.email : project.userId}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">文本模型：{project.textModel}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">图片模型：{project.imageModel}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">消耗积分：{project.consumedCredits}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">更新时间：{formatDateTime(project.updatedAt)}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">原始输入 / 生成配置（mock）</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify({
              input: `请生成 ${project.type} 内容：${project.topic}`,
              normalizedConfig: {
                normalizedDirection: project.type,
                normalizedCount: project.type === "poster" ? 1 : project.type === "ppt" ? 8 : 10,
                normalizedRatio: project.type === "video" ? "16:9" : "9:16",
              },
              modelConfig: { textModel: project.textModel, imageModel: project.imageModel },
            }, null, 2)}</pre>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">生成内容（mock）</p>
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">Outline: 10 个关键点，每页一个重点。</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">Generation Layer: visibleText / visualDesign / factualRules / negativeRules。</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">composedPrompt 每页单独编译，避免上下文污染。</p>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">生成结果（mock）</p>
            <div className="mt-3 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
              这里展示最终 N 张图片 / PPT 页 / 视频分镜缩略图。当前为 mock 占位，后续可接真实生成资产。
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">执行日志</p>
              <Link href={`/admin?tab=logs&l_project=${project.id}`} className="inline-flex items-center gap-1 text-xs text-zinc-700 underline underline-offset-2">
                去日志筛选
                <ExternalLink size={12} />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {logs.length ? (
                logs.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    <p>
                      {formatDateTime(item.createdAt)} · {item.type}/{item.action}
                    </p>
                    <p className="mt-1">status: {item.status}</p>
                    <p className="mt-1">requestId: {item.requestId}</p>
                    {item.errorId ? (
                      <Link href={`/admin?tab=logs&l_error=${item.errorId}`} className="mt-1 inline-flex underline underline-offset-2 text-red-700">
                        errorId: {item.errorId}
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无日志</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">积分记录</p>
              {owner ? (
                <Link href={`/admin/users/${owner.id}`} className="inline-flex items-center gap-1 text-xs text-zinc-700 underline underline-offset-2">
                  查看用户详情
                  <ExternalLink size={12} />
                </Link>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {credits.length ? (
                credits.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    <p>{formatDateTime(item.createdAt)}</p>
                    <p className="mt-1">
                      {item.type} · {item.delta > 0 ? `+${item.delta}` : item.delta} · balance {item.balanceAfter}
                    </p>
                    <p className="mt-1">reason: {item.reason}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无积分记录</p>
              )}
            </div>
          </article>
        </section>
      </div>
    </AdminShell>
  );
}

