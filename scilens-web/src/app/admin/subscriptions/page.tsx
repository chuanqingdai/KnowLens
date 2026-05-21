"use client";

import { useMemo, useState } from "react";
import { Search, Zap } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminUsers, grantMembership, type AdminUser } from "@/lib/admin";
import { getSubscription } from "@/lib/billing";

const planOptions: AdminUser["plan"][] = ["starter", "pro", "studio"];

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState(() => getAdminUsers());
  const [keyword, setKeyword] = useState("");
  const [planByUserId, setPlanByUserId] = useState<Record<string, AdminUser["plan"]>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [subscription] = useState(() => getSubscription());

  const filteredUsers = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return users;
    }
    return users.filter((user) => `${user.name} ${user.email} ${user.plan}`.toLowerCase().includes(key));
  }, [keyword, users]);

  function handleGrant(userId: string) {
    const plan = planByUserId[userId] ?? "pro";
    const creditMap: Record<AdminUser["plan"], number> = {
      free: 0,
      starter: 800,
      pro: 2400,
      studio: 6500,
    };
    const next = grantMembership(userId, plan, creditMap[plan]);
    setUsers(next);
    setToast(`已为该用户开通 ${plan.toUpperCase()} 套餐`);
    window.setTimeout(() => setToast(null), 2200);
  }

  return (
    <AdminShell title="订阅列表" description="查询用户订阅状态并执行开通/升级操作。">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3">
          <Search size={15} className="text-zinc-500" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索用户名 / 邮箱 / 套餐"
            className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
          />
        </div>

        {subscription ? (
          <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            当前登录用户订阅：{subscription.planName} ·
            {subscription.cycle === "yearly" ? "包年" : "包月"} ·
            {subscription.status}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">用户</th>
                <th className="px-3 py-2 font-medium">邮箱</th>
                <th className="px-3 py-2 font-medium">当前会员</th>
                <th className="px-3 py-2 font-medium">积分</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2 text-zinc-800">{user.name}</td>
                  <td className="px-3 py-2 text-zinc-600">{user.email}</td>
                  <td className="px-3 py-2 uppercase text-zinc-700">{user.plan}</td>
                  <td className="px-3 py-2 text-zinc-700">{user.credits}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={planByUserId[user.id] ?? "pro"}
                        onChange={(event) =>
                          setPlanByUserId((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AdminUser["plan"],
                          }))
                        }
                        className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                      >
                        {planOptions.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleGrant(user.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700"
                      >
                        <Zap size={12} />
                        开通会员
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </AdminShell>
  );
}
