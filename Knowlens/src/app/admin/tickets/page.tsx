"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getFeedbackRecords, type FeedbackRecord } from "@/lib/feedback";

type TicketStatus = "新建" | "处理中" | "已修复";

type TicketItem = FeedbackRecord & {
  uiStatus: TicketStatus;
};

function ticketStatusByIndex(index: number): TicketStatus {
  if (index % 3 === 0) {
    return "新建";
  }
  if (index % 3 === 1) {
    return "处理中";
  }
  return "已修复";
}

export default function AdminTicketsPage() {
  const [keyword, setKeyword] = useState("");
  const [tickets] = useState<TicketItem[]>(() =>
    getFeedbackRecords().map((item, idx) => ({
      ...item,
      uiStatus: ticketStatusByIndex(idx),
    })),
  );

  const filteredTickets = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return tickets;
    }
    return tickets.filter((ticket) =>
      `${ticket.type} ${ticket.detail} ${ticket.contact}`.toLowerCase().includes(key),
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
                <p className="mt-2 text-sm leading-6 text-zinc-700">{ticket.detail}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  联系方式：{ticket.contact || "未填写"}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-zinc-500">没有匹配的工单</p>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
