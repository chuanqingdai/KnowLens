"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
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

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId || "";
  const [data] = useState(() => createAdminConsoleMockData());
  const [hint, setHint] = useState("");
  const user = data.users.find((item) => item.id === userId) || null;

  const userProjects = useMemo(() => data.projects.filter((item) => item.userId === userId), [data.projects, userId]);
  const userLogs = useMemo(() => data.logs.filter((item) => item.userId === userId), [data.logs, userId]);
  const userCredits = useMemo(() => data.creditRecords.filter((item) => item.userId === userId), [data.creditRecords, userId]);
  const userOrders = useMemo(() => data.orders.filter((item) => item.userId === userId), [data.orders, userId]);
  const userTickets = useMemo(() => data.tickets.filter((item) => item.userId === userId), [data.tickets, userId]);
  const userSubscriptions = useMemo(() => data.subscriptions.filter((item) => item.userId === userId), [data.subscriptions, userId]);

  function copyText(value: string, label: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => setHint(`已复制 ${label}`))
      .catch(() => setHint(`复制 ${label} 失败`));
    window.setTimeout(() => setHint(""), 2200);
  }

  if (!user) {
    return (
      <AdminShell title="用户详情" description="未找到对应用户。">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-600">用户不存在或已被删除。</p>
          <Link href="/admin?tab=users" className="mt-3 inline-flex text-sm text-zinc-900 underline underline-offset-2">
            返回用户管理
          </Link>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`用户详情 · ${user.email}`} description="长期对象详情页：基础信息、订阅支付、积分、项目历史、日志和工单。">
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{user.email}</p>
              <p className="mt-1 text-xs text-zinc-500">userId: {user.id}</p>
              <p className="mt-1 text-xs text-zinc-500">注册时间: {formatDateTime(user.registeredAt)}</p>
              <p className="mt-1 text-xs text-zinc-500">最近活跃: {formatDateTime(user.recentActiveAt)}</p>
            </div>
            <button type="button" onClick={() => copyText(user.id, "userId")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-xs hover:bg-zinc-100">
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
              {userSubscriptions.length ? (
                userSubscriptions.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p>{item.plan}</p>
                    <p className="mt-1 text-xs">状态: {item.status}</p>
                    <p className="mt-1 text-xs">续费: {formatDateTime(item.renewAt)}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">无订阅记录</p>
              )}
              {userOrders.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs">
                  <p>
                    订单:
                    <span className="ml-1 font-medium">{item.id}</span>
                  </p>
                  <p className="mt-1">
                    {item.amount} {item.currency} · {item.status}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">积分余额与流水</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{user.creditBalance}</p>
            <div className="mt-3 space-y-2">
              {userCredits.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
                  <p>{formatDateTime(item.createdAt)}</p>
                  <p className="mt-1">
                    {item.type} · {item.delta > 0 ? `+${item.delta}` : item.delta} · balance {item.balanceAfter}
                  </p>
                  {item.projectId ? (
                    <Link href={`/admin/projects/${item.projectId}`} className="mt-1 inline-flex underline underline-offset-2">
                      关联项目 {item.projectId}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">项目历史</p>
            <div className="mt-3 space-y-2">
              {userProjects.length ? (
                userProjects.map((item) => (
                  <Link key={item.id} href={`/admin/projects/${item.id}`} className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 hover:bg-white">
                    <p className="text-sm font-medium text-zinc-900">{item.topic}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.id} · {item.type} · {item.status} · {item.stage}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无项目记录</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">使用日志</p>
            <div className="mt-3 space-y-2">
              {userLogs.length ? (
                userLogs.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                    <p>
                      {formatDateTime(item.createdAt)} · {item.type}/{item.action}
                    </p>
                    <p className="mt-1">requestId: {item.requestId}</p>
                    {item.projectId ? (
                      <Link href={`/admin/projects/${item.projectId}`} className="mt-1 inline-flex underline underline-offset-2">
                        查看项目 {item.projectId}
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无日志记录</p>
              )}
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
            {userTickets.length ? (
              userTickets.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                  <p className="font-medium text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {item.id} · {item.status} · {item.priority}
                  </p>
                  {item.projectId ? (
                    <Link href={`/admin/projects/${item.projectId}`} className="mt-1 inline-flex text-xs underline underline-offset-2">
                      查看关联项目 {item.projectId}
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500">暂无工单记录</p>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

