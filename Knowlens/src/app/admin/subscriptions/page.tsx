"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  subscriptionStatus: string;
  creditBalance: number;
  projectCount: number;
};

type AdminSubscriptionRow = {
  id: string;
  userId: string;
  plan: string;
  status: string;
  renewAt: string;
};

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [keyword, setKeyword] = useState("");
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
          data?: { users?: AdminUserRow[]; subscriptions?: AdminSubscriptionRow[] };
        };
        if (!response.ok || !payload.ok) {
          throw new Error("Admin subscriptions request failed");
        }
        if (!cancelled) {
          setUsers(payload.data?.users || []);
          setSubscriptions(payload.data?.subscriptions || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setSubscriptions([]);
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

  const filteredUsers = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return users;
    }
    return users.filter((user) => `${user.name} ${user.email} ${user.subscriptionStatus}`.toLowerCase().includes(key));
  }, [keyword, users]);

  const subscriptionByUserId = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.userId, subscription])),
    [subscriptions],
  );

  return (
    <AdminShell title="订阅列表" description="查询真实用户订阅状态和积分余额。">
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

        {loading ? (
          <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            正在加载真实订阅数据...
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">用户</th>
                <th className="px-3 py-2 font-medium">邮箱</th>
                <th className="px-3 py-2 font-medium">当前订阅</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">积分</th>
                <th className="px-3 py-2 font-medium">项目数</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const subscription = subscriptionByUserId.get(user.id);
                return (
                  <tr key={user.id} className="border-t border-zinc-200">
                    <td className="px-3 py-2 text-zinc-800">{user.name}</td>
                    <td className="px-3 py-2 text-zinc-600">{user.email}</td>
                    <td className="px-3 py-2 text-zinc-700">{subscription?.plan || "Free"}</td>
                    <td className="px-3 py-2 uppercase text-zinc-700">{subscription?.status || user.subscriptionStatus}</td>
                    <td className="px-3 py-2 text-zinc-700">{user.creditBalance}</td>
                    <td className="px-3 py-2 text-zinc-700">{user.projectCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
