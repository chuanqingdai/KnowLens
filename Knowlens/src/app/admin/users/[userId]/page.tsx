"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Loader2, X } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

type UserDetailResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
    createdAt: string;
    updatedAt: string;
    recentActiveAt: string;
  };
  subscription: {
    id: string;
    planId: string | null;
    planName: string | null;
    cycle: string | null;
    status: string | null;
    renewAt: string | null;
    startedAt: string | null;
    updatedAt: string | null;
  } | null;
  payments: Array<{
    sessionId: string;
    planId: string | null;
    cycle: string | null;
    checkoutSource: string | null;
    checkoutStatus: string | null;
    createdAt: string;
  }>;
  credits: {
    currentBalance: number;
    records: Array<{
      id: string;
      type: string;
      description: string;
      delta: number;
      balance: number;
      projectId: string | null;
      projectTitle: string | null;
      createdAt: string;
    }>;
  };
  projects: Array<{
    id: string;
    title: string;
    status: string | null;
    format: string | null;
    duration: string | null;
    updatedAt: string;
  }>;
  tickets: Array<{
    id: string;
    type: string;
    detail: string;
    status: string | null;
    createdAt: string;
  }>;
  logSummary: {
    totalCount: number;
    errorCount: number;
    latestAt: string | null;
  };
};

type UserLogResponse = UserDetailResponse & {
  logs: Array<{
    id: string;
    category: string;
    action: string;
    status: "ok" | "error" | "info";
    source: string | null;
    code: string | null;
    message: string | null;
    userEmail: string | null;
    projectId: string | null;
    detailsJson: string | null;
    createdAt: string;
    runId: string | null;
    jobId: string | null;
    taskId: string | null;
    durationMs: number | null;
  }>;
  logText: string;
};

function formatDateTime(input?: string | null) {
  if (!input) {
    return "-";
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDialogTimestamp(input?: string | null) {
  if (!input) {
    return "-";
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function readJsonOrThrow(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId || "";
  const [hint, setHint] = useState("");
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logDialogLoading, setLogDialogLoading] = useState(false);
  const [logDialogError, setLogDialogError] = useState("");
  const [logDialogText, setLogDialogText] = useState("");
  const [logDialogMeta, setLogDialogMeta] = useState<{
    totalCount: number;
    errorCount: number;
    latestAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("缺少 userId。");
      setData(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setLogDialogOpen(false);
    setLogDialogText("");
    setLogDialogMeta(null);
    setLogDialogError("");

    void fetch(`/api/admin/users/${encodeURIComponent(userId)}?ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readJsonOrThrow)
      .then((payload) => setData(payload as UserDetailResponse))
      .catch((fetchError) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "加载用户详情失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [userId]);

  const userLogSummaryText = useMemo(() => {
    if (!data) {
      return {
        totalCount: 0,
        errorCount: 0,
        latestAt: "-",
      };
    }
    return {
      totalCount: data.logSummary.totalCount,
      errorCount: data.logSummary.errorCount,
      latestAt: data.logSummary.latestAt ? formatDialogTimestamp(data.logSummary.latestAt) : "-",
    };
  }, [data]);

  function copyText(value: string, label: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => setHint(`已复制 ${label}`))
      .catch(() => setHint(`复制 ${label} 失败`));
    window.setTimeout(() => setHint(""), 2200);
  }

  async function openLogDialog() {
    if (!data?.user?.id) {
      return;
    }
    setLogDialogOpen(true);
    setLogDialogLoading(true);
    setLogDialogError("");
    setLogDialogText("");
    try {
      const payload = (await fetch(
        `/api/admin/users/${encodeURIComponent(data.user.id)}?view=logs&logLimit=5000&ts=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      ).then(readJsonOrThrow)) as UserLogResponse;
      setLogDialogText(payload.logText || "暂无日志记录。");
      setLogDialogMeta(payload.logSummary);
    } catch (fetchError) {
      setLogDialogError(fetchError instanceof Error ? fetchError.message : "加载日志失败。");
    } finally {
      setLogDialogLoading(false);
    }
  }

  function closeLogDialog() {
    setLogDialogOpen(false);
    setLogDialogError("");
    setLogDialogLoading(false);
    setLogDialogText("");
    setLogDialogMeta(null);
  }

  if (loading) {
    return (
      <AdminShell title="用户详情" description="正在加载真实用户数据。">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取真实用户详情...
          </div>
        </section>
      </AdminShell>
    );
  }

  if (error || !data) {
    return (
      <AdminShell title="用户详情" description="未找到对应用户。">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-600">{error || "用户不存在或已被删除。"}</p>
          <Link href="/admin?tab=users" className="mt-3 inline-flex text-sm text-zinc-900 underline underline-offset-2">
            返回用户管理
          </Link>
        </section>
      </AdminShell>
    );
  }

  const { user, subscription, payments, credits, projects, tickets } = data;

  return (
    <AdminShell title={`用户详情 · ${user.email}`} description="真实用户详情页：基础信息、订阅支付、积分、项目历史、使用日志和工单。">
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{user.email}</p>
              <p className="mt-1 text-xs text-zinc-500">userId: {user.id}</p>
              <p className="mt-1 text-xs text-zinc-500">注册时间: {formatDateTime(user.createdAt)}</p>
              <p className="mt-1 text-xs text-zinc-500">最近活跃: {formatDateTime(user.recentActiveAt)}</p>
            </div>
            <button
              type="button"
              onClick={() => copyText(user.id, "userId")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs hover:bg-zinc-100"
            >
              <Copy size={12} />
              复制 userId
            </button>
          </div>
          {hint ? <p className="mt-2 text-xs text-zinc-600">{hint}</p> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">订阅与支付</p>
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              {subscription ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p>{subscription.planName || subscription.planId || "订阅"}</p>
                  <p className="mt-1 text-xs">状态: {subscription.status || "-"}</p>
                  <p className="mt-1 text-xs">周期: {subscription.cycle || "-"}</p>
                  <p className="mt-1 text-xs">续费: {formatDateTime(subscription.renewAt)}</p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">无订阅记录</p>
              )}
              {payments.length ? (
                payments.slice(0, 6).map((item) => (
                  <div key={item.sessionId} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
                    <p className="font-medium text-zinc-900">{item.planId || "payment"}</p>
                    <p className="mt-1">
                      {item.cycle || "-"} · {item.checkoutStatus || "fulfilled"} · {formatDateTime(item.createdAt)}
                    </p>
                    <p className="mt-1 text-zinc-500">source: {item.checkoutSource || "unknown"}</p>
                  </div>
                ))
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">积分余额与流水</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{credits.currentBalance}</p>
            <div className="mt-3 space-y-2">
              {credits.records.length ? (
                credits.records.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
                    <p>{formatDateTime(item.createdAt)}</p>
                    <p className="mt-1">
                      {item.type} · {item.delta > 0 ? `+${item.delta}` : item.delta} · balance {item.balance}
                    </p>
                    <p className="mt-1 text-zinc-500">{item.description}</p>
                    {item.projectId ? (
                      <Link href={`/admin/projects/${item.projectId}`} className="mt-1 inline-flex underline underline-offset-2">
                        关联项目 {item.projectId}
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无积分流水</p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">项目历史</p>
            <div className="mt-3 space-y-2">
              {projects.length ? (
                projects.map((item) => (
                  <Link key={item.id} href={`/admin/projects/${item.id}`} className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 hover:bg-white">
                    <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.id} · {item.format || "-"} · {item.status || "-"} · {formatDateTime(item.updatedAt)}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无项目记录</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">使用日志</p>
                <p className="mt-1 text-xs text-zinc-500">点击查看该用户的真实纯文本日志时间线。每次打开都会重新拉取，不使用 mock 或页面缓存。</p>
              </div>
              <button
                type="button"
                onClick={openLogDialog}
                className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-3 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                查看该用户日志
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              <p>总日志数：{userLogSummaryText.totalCount}</p>
              <p className="mt-1">失败日志：{userLogSummaryText.errorCount}</p>
              <p className="mt-1">最近一条：{userLogSummaryText.latestAt}</p>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">反馈工单</p>
            <Link href={`/admin?tab=tickets&t_user=${user.id}`} className="inline-flex items-center gap-1 text-xs text-zinc-700 underline underline-offset-2">
              去工单列表筛选
              <ExternalLink size={12} />
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {tickets.length ? (
              tickets.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                  <p className="font-medium text-zinc-900">{item.type}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-zinc-600">{item.detail}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.id} · {item.status || "-"} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无工单记录</p>
            )}
          </div>
        </section>
      </div>

      {logDialogOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <p className="text-base font-semibold text-zinc-900">该用户全部使用日志</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {user.email} · 真实数据 · 秒级时间点 · 可直接复制文本
                </p>
                {logDialogMeta ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    总数 {logDialogMeta.totalCount} · 失败 {logDialogMeta.errorCount} · 最近一条 {formatDialogTimestamp(logDialogMeta.latestAt)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openLogDialog}
                  className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-3 text-sm text-zinc-800 hover:bg-zinc-100"
                >
                  刷新
                </button>
                <button
                  type="button"
                  onClick={() => copyText(logDialogText || "暂无日志记录。", "用户全部日志")}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-800 hover:bg-zinc-100"
                >
                  <Copy size={14} />
                  复制文本
                </button>
                <button
                  type="button"
                  onClick={closeLogDialog}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                  aria-label="关闭日志弹窗"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {logDialogLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载该用户的全部真实日志...
                </div>
              ) : logDialogError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">{logDialogError}</div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-4">
                  <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-100">
                    {logDialogText || "暂无日志记录。"}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
