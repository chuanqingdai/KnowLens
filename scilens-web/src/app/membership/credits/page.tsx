"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, RotateCcw, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getCreditRecords, type CreditRecord } from "@/lib/billing";

function formatDate(input: string) {
  return new Date(input).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CreditRecordsPage() {
  const router = useRouter();
  const [records] = useState<CreditRecord[]>(() => getCreditRecords());

  const summary = useMemo(() => {
    const income = records.filter((r) => r.delta > 0).reduce((sum, r) => sum + r.delta, 0);
    const cost = records.filter((r) => r.delta < 0).reduce((sum, r) => sum + r.delta, 0);
    const balance = records[0]?.balance ?? 0;
    return { income, cost, balance };
  }, [records]);

  return (
    <main className="min-h-screen bg-[#f7f7f8]">
      <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <ArrowLeft size={14} />
            返回
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-900">积分消耗记录</p>
            <p className="text-xs text-zinc-500">查看积分变化与明细</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/membership/credits")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Zap size={14} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">{summary.balance}</span>
            <span className="text-zinc-500">|</span>
            <span>积分</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-12 pt-20 sm:px-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">积分消耗记录</h1>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">当前积分</p>
              <p className="text-lg font-semibold text-zinc-900">{summary.balance}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">累计充值</p>
              <p className="text-lg font-semibold text-emerald-700">+{summary.income}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">累计消耗</p>
              <p className="text-lg font-semibold text-red-700">{summary.cost}</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
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
                {records.map((record) => (
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
                    <td className="px-3 py-2 text-zinc-700">{record.description}</td>
                    <td
                      className={`px-3 py-2 font-medium ${
                        record.delta > 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {record.delta > 0 ? `+${record.delta}` : record.delta}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{record.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
