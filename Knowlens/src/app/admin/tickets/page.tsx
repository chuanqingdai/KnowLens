"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

type TicketStatus = "新建" | "处理中" | "已修复";

type TicketItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  userId?: string;
  projectId?: string;
  createdAt: string;
  uiStatus: TicketStatus;
};

function toUiStatus(status: string): TicketStatus {
  if (status === "resolved" || status === "closed") {
    return "已修复";
  }
  if (status === "in_progress") {
    return "处理中";
  }
  return "新建";
}

export default function AdminTicketsPage() {
  const [keyword, setKeyword] = useState("");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/console-data", {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { tickets?: Array<Omit<TicketItem, "uiStatus">> };
        };
        if (!response.ok || !payload.ok) {
          throw new Error("Admin tickets request failed");
        }
        if (!cancelled) {
          setTickets(
            (payload.data?.tickets || []).map((item) => ({
              ...item,
              uiStatus: toUiStatus(item.status),
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTickets([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTickets = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return tickets;
    }
    return tickets.filter((ticket) =>
      `${ticket.type} ${ticket.title} ${ticket.content} ${ticket.userId || ""} ${ticket.projectId || ""}`.toLowerCase().includes(key),
    );
  }, [keyword, tickets]);

  return (
    <AdminShell title="反馈工单" description="处理用户反馈并跟踪修复状态。">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3">
          <Search size={15} className="text-zinc-500" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索工单类型、内容或联系方式"
            className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
          />
        </div>

        <div className="space-y-2">
          {filteredTickets.length ? (
            filteredTickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-zinc-900 px-2 py-0.5 text-xs text-white">
                    {ticket.type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      ticket.uiStatus === "新建"
                        ? "text-amber-700"
                        : ticket.uiStatus === "处理中"
                          ? "text-sky-700"
                          : "text-emerald-700"
                    }`}
                  >
                    {ticket.uiStatus === "已修复" ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <Clock3 size={12} />
                    )}
                    {ticket.uiStatus}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{ticket.content}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {ticket.projectId ? `项目：${ticket.projectId}` : `创建时间：${new Date(ticket.createdAt).toLocaleString("zh-CN")}`}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-zinc-500">{loading ? "正在加载工单..." : "没有匹配的工单"}</p>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
