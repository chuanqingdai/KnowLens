"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Minus, Plus, RotateCcw, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getCreditRecords, type CreditRecord } from "@/lib/billing";

function formatDate(input: string) {
  return new Date(input).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseModelCreditSummary(description: string) {
  const en = description.match(
    /Language model\s*(\d+)\s*credits?\s*\+\s*Image model\s*(\d+)\s*credits?/i,
  );
  if (en) {
    return { lm: Number(en[1]), image: Number(en[2]) };
  }

  const zh = description.match(/语言模型\s*(\d+)\s*积分\s*\+\s*图像模型\s*(\d+)\s*积分/i);
  if (zh) {
    return { lm: Number(zh[1]), image: Number(zh[2]) };
  }

  return null;
}

function simplifyRecordDescription(record: CreditRecord) {
  const raw = record.description.trim();
  if (!raw) {
    return "-";
  }

  if (record.type !== "consume") {
    if (/subscription|充值|top[- ]?up/i.test(raw)) {
      return "Membership top-up";
    }
    return raw.length > 48 ? `${raw.slice(0, 48)}...` : raw;
  }

  const isPoster = /poster generation|海报生成/i.test(raw);
  const isStoryboard = /storyboard generation|分镜生成/i.test(raw);
  const creditSummary = parseModelCreditSummary(raw);

  const action = isPoster
    ? "Poster generation"
    : isStoryboard
      ? "Storyboard generation"
      : "Generation";

  if (!creditSummary) {
    return action;
  }

  return `${action} (LM ${creditSummary.lm} + IMG ${creditSummary.image})`;
}

export default function CreditRecordsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentEmail = (session?.user?.email ?? "").trim().toLowerCase();
  const records = useMemo<CreditRecord[]>(() => getCreditRecords(currentEmail), [currentEmail]);

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
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
                return;
              }
              router.push("/app");
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-900">Credit Activity</p>
            <p className="text-xs text-zinc-500">View credit changes and transaction details</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/membership/credits")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Zap size={14} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">{summary.balance}</span>
            <span className="text-zinc-500">|</span>
            <span>Credits</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-12 pt-20 sm:px-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Credit Activity</h1>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Current Balance</p>
              <p className="text-lg font-semibold text-zinc-900">{summary.balance}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Total Top-ups</p>
              <p className="text-lg font-semibold text-emerald-700">+{summary.income}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Total Spent</p>
              <p className="text-lg font-semibold text-red-700">{summary.cost}</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="w-28 px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="w-20 px-3 py-2 font-medium">Change</th>
                  <th className="w-20 px-3 py-2 font-medium">Balance</th>
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
                          Top-up
                        </span>
                      ) : record.type === "refund" ? (
                        <span className="inline-flex items-center gap-1 text-sky-700">
                          <RotateCcw size={12} />
                          Refund
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <Minus size={12} />
                          Spent
                        </span>
                      )}
                    </td>
                    <td
                      className="truncate px-3 py-2 text-zinc-700"
                      title={record.description}
                    >
                      {simplifyRecordDescription(record)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        record.delta > 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {record.delta > 0 ? `+${record.delta}` : record.delta}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-700">{record.balance}</td>
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
