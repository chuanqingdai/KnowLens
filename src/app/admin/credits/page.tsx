"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

type AdminCreditRecord = {
  id: string;
  createdAt: string;
  type: "topup" | "consume" | "refund" | "adjustment";
  delta: number;
  balanceAfter: number;
  reason: string;
  userId?: string;
  projectId?: string;
};

function formatDate(input: string) {
  return new Date(input).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCreditsPage() {
  const [keyword, setKeyword] = useState("");
  const [records, setRecords] = useState<AdminCreditRecord[]>([]);
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
          data?: { creditRecords?: AdminCreditRecord[] };
        };
        if (!response.ok || !payload.ok) {
          throw new Error("Admin credits request failed");
        }
        if (!cancelled) {
          setRecords(payload.data?.creditRecords || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecords([]);
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

  const summary = useMemo(() => {
    const income = records.filter((record) => record.delta > 0).reduce((sum, item) => sum + item.delta, 0);
    const cost = records.filter((record) => record.delta < 0).reduce((sum, item) => sum + Math.abs(item.delta), 0);
    return {
      income,
      cost,
      balance: records[0]?.balanceAfter ?? 0,
    };
  }, [records]);

  const filtered = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return records;
    }
    return records.filter((record) =>
      `${record.reason} ${record.userId || ""} ${record.projectId || ""}`.toLowerCase().includes(key),
    );
  }, [keyword, records]);

  return (
    <AdminShell title="积分流水" description="查看积分变化明细，支持运营审计。">
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">{loading ? "加载中" : "当前余额"}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.balance}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">累计充值</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">+{summary.income}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">累计消耗</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{summary.cost}</p>
        </article>
      </div>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3">
          <Search size={15} className="text-zinc-500" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索流水描述"
            className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">类型</th>
                <th className="px-3 py-2 font-medium">描述</th>
                <th className="px-3 py-2 font-medium">变化</th>
                <th className="px-3 py-2 font-medium">余额</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2 text-zinc-600">{formatDate(record.createdAt)}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {record.type === "topup" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Plus size={12} />
                        充值
                      </span>
                    ) : record.type === "refund" ? (
                      <span className="inline-flex items-center gap-1 text-sky-700">
                        <RotateCcw size={12} />
                        返还
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <Minus size={12} />
                        消耗
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{record.reason}</td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      record.delta > 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {record.delta > 0 ? `+${record.delta}` : record.delta}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{record.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
