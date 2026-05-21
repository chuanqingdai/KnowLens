"use client";

import { useMemo, useState } from "react";
import { FolderKanban, Search, Users, X, Zap } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminProjects, getAdminUsers } from "@/lib/admin";
import { getFeedbackRecords } from "@/lib/feedback";
import { getCreditRecords } from "@/lib/billing";

export default function AdminDashboardPage() {
  const [users] = useState(() => getAdminUsers());
  const [projects] = useState(() => getAdminProjects());
  const [feedbacks] = useState(() => getFeedbackRecords());
  const [creditRecords] = useState(() => getCreditRecords());
  const [emailQuery, setEmailQuery] = useState("");

  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "进行中").length;
    const totalCreditsUsed = creditRecords
      .filter((record) => record.delta < 0)
      .reduce((sum, record) => sum + Math.abs(record.delta), 0);
    return {
      users: users.length,
      projects: projects.length,
      activeProjects,
      feedbacks: feedbacks.length,
      totalCreditsUsed,
    };
  }, [users, projects, feedbacks, creditRecords]);

  const usersById = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  const normalizedEmailQuery = emailQuery.trim().toLowerCase();

  const matchedUsers = useMemo(() => {
    if (!normalizedEmailQuery) {
      return [];
    }
    return users.filter((user) => user.email.toLowerCase().includes(normalizedEmailQuery));
  }, [normalizedEmailQuery, users]);

  const sortedProjects = useMemo(() => {
    const parseTime = (value: string) => {
      const normalized = value.replace(" ", "T");
      const time = new Date(normalized).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    return [...projects].sort((a, b) => parseTime(b.updatedAt) - parseTime(a.updatedAt));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!normalizedEmailQuery) {
      return sortedProjects;
    }
    return sortedProjects.filter((project) => {
      const owner = usersById.get(project.userId);
      if (!owner) {
        return false;
      }
      return owner.email.toLowerCase().includes(normalizedEmailQuery);
    });
  }, [normalizedEmailQuery, sortedProjects, usersById]);

  return (
    <AdminShell
      title="Dashboard"
      description="总览用户、项目、反馈和积分消耗情况。"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700">
            <Users size={14} />
            用户总数
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.users}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700">
            <FolderKanban size={14} />
            项目总数
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.projects}</p>
          <p className="mt-1 text-xs text-zinc-500">进行中 {stats.activeProjects} 个</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-700">反馈工单</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.feedbacks}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700">
            <Zap size={14} />
            累计消耗积分
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.totalCreditsUsed}</p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-900">项目检索</h2>
              <p className="mt-1 text-xs text-zinc-500">
                输入用户邮箱，查看某位用户的全部项目；留空则显示所有项目。
              </p>
            </div>
            <div className="relative w-full sm:max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                value={emailQuery}
                onChange={(event) => setEmailQuery(event.target.value)}
                placeholder="输入邮箱，例如 lin@example.com"
                className="h-10 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-10 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              {emailQuery ? (
                <button
                  type="button"
                  onClick={() => setEmailQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 transition hover:bg-zinc-100"
                  aria-label="清空邮箱筛选"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>

          {normalizedEmailQuery ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              匹配用户：
              {matchedUsers.length > 0
                ? matchedUsers.map((user) => user.email).join("，")
                : "未找到对应邮箱用户"}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-900">所有项目（按更新时间）</h2>
            <p className="text-xs text-zinc-500">
              共 {filteredProjects.length} 个项目
              {normalizedEmailQuery ? "（已按邮箱筛选）" : ""}
            </p>
          </div>

          {!filteredProjects.length ? (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              当前筛选下暂无项目
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="rounded-l-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                      更新时间
                    </th>
                    <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                      项目名称
                    </th>
                    <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                      状态
                    </th>
                    <th className="rounded-r-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                      用户邮箱
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const owner = usersById.get(project.userId);
                    return (
                      <tr key={project.id} className="text-zinc-700">
                        <td className="border-b border-zinc-100 px-3 py-2.5 text-xs text-zinc-500">
                          {project.updatedAt}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2.5 text-zinc-900">
                          {project.title}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              project.status === "进行中"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-200 text-zinc-700"
                            }`}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2.5 text-xs text-zinc-600">
                          {owner?.email ?? "未知用户"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-900">最近反馈</h2>
          {!feedbacks.length ? (
            <p className="mt-2 text-sm text-zinc-500">暂无反馈记录</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {feedbacks.slice(0, 5).map((feedback) => (
                <li key={feedback.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-900">{feedback.type}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{feedback.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-900">最近项目更新</h2>
          <ul className="mt-2 space-y-2">
            {sortedProjects.slice(0, 6).map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <span className="text-sm text-zinc-700">{project.title}</span>
                <span className="text-xs text-zinc-500">{project.updatedAt}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
