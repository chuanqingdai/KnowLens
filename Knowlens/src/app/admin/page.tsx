"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FolderKanban, Search, Users, X, Zap } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  getAdminProjects,
  getAdminUsers,
  getFeaturedCaseConfigs,
  removeFeaturedCaseConfig,
  upsertFeaturedCaseConfig,
} from "@/lib/admin";
import { getFeedbackRecords } from "@/lib/feedback";
import { getCreditRecords } from "@/lib/billing";

type DashboardTab = "overview" | "projectOps" | "featured";

type CheckoutStatRow = {
  day: string;
  source: string;
  attempts: number;
  successes: number;
  successRate: number;
};

type OpsErrorRow = {
  id: string;
  category: string;
  action: string;
  source: string;
  code: string | null;
  message: string;
  userEmail: string | null;
  projectId: string | null;
  detailsJson: string | null;
  createdAt: string;
};

type OpsSummaryResponse = {
  projects: {
    total: number;
    active: number;
  };
  errors: {
    total: number;
    byCategory: Array<{ category: string; count: number }>;
    recent: OpsErrorRow[];
  };
  checkout: CheckoutStatRow[];
};

type UsageLogRow = {
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
  stage?: string | null;
};

type UserQueryIdentity = {
  userId: string | null;
  email: string | null;
};

function formatDate(input: string) {
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

function parseDetailsJson(raw: string | null) {
  if (!raw) {
    return null as Record<string, unknown> | null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveFailureStage(item: UsageLogRow) {
  const details = parseDetailsJson(item.detailsJson);
  const explicitStage = typeof details?.stage === "string" ? details.stage.trim() : "";
  if (explicitStage) {
    return explicitStage;
  }
  const code = (item.code || "").toUpperCase();
  if (code.startsWith("DRAFT_INVALID_JSON")) return "draft_response_parsing";
  if (code.startsWith("FREE_MODEL_REQUEST_FAILED")) return "draft_model_request_free";
  if (code.startsWith("PAID_MODEL_REQUEST_FAILED")) return "draft_model_request_paid";
  if (code.startsWith("DUOMI_")) return "image_fallback_duomi";
  if (code.startsWith("GPTSAPI_")) return "image_fallback_gptsapi";
  if (code.startsWith("IMAGE2_")) return "image_primary_tuzi";
  if (item.category === "image") return "image_pipeline";
  if (item.category === "llm") return "draft_pipeline";
  return "-";
}

function toPrettyJson(raw: string | null) {
  if (!raw) {
    return "-";
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function buildMarkdownTimeline(rows: UsageLogRow[]) {
  if (!rows.length) {
    return "# User Timeline Logs\n\n_No logs found for current filters._\n";
  }
  const lines: string[] = [];
  lines.push("# User Timeline Logs");
  lines.push("");
  rows.forEach((item, idx) => {
    const title = `${idx + 1}. ${item.createdAt} | ${item.category}/${item.action} | ${item.status}`;
    lines.push(`## ${title}`);
    lines.push(`- userEmail: ${item.userEmail ?? "-"}`);
    lines.push(`- projectId: ${item.projectId ?? "-"}`);
    lines.push(`- source: ${item.source ?? "-"}`);
    lines.push(`- code: ${item.code ?? "-"}`);
    lines.push(`- stage: ${item.stage ?? resolveFailureStage(item)}`);
    lines.push(`- message: ${item.message ?? "-"}`);
    lines.push("- details:");
    lines.push("```json");
    lines.push(toPrettyJson(item.detailsJson));
    lines.push("```");
    lines.push("");
  });
  return lines.join("\n");
}

function parseUserIdentityInput(raw: string): UserQueryIdentity {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { userId: null, email: null };
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.includes("@")) {
    return { userId: null, email: lowered };
  }
  if (/^u-[a-z0-9_-]+$/i.test(trimmed)) {
    return { userId: trimmed, email: null };
  }
  return { userId: null, email: lowered };
}

export default function AdminDashboardPage() {
  const [users] = useState(() => getAdminUsers());
  const [projects] = useState(() => getAdminProjects());
  const [feedbacks] = useState(() => getFeedbackRecords());
  const [creditRecords] = useState(() => getCreditRecords());
  const [featuredConfigs, setFeaturedConfigs] = useState(() => getFeaturedCaseConfigs());
  const [emailQuery, setEmailQuery] = useState("");
  const [featuredProjectId, setFeaturedProjectId] = useState("");
  const [featuredCategory, setFeaturedCategory] = useState("综合");
  const [featuredOrder, setFeaturedOrder] = useState("100");
  const [featuredError, setFeaturedError] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [opsSummary, setOpsSummary] = useState<OpsSummaryResponse | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState("");
  const [opsLastRefresh, setOpsLastRefresh] = useState("");
  const [opsReloadVersion, setOpsReloadVersion] = useState(0);
  const [usageLogs, setUsageLogs] = useState<UsageLogRow[]>([]);
  const [usageLogsLoading, setUsageLogsLoading] = useState(false);
  const [usageLogsError, setUsageLogsError] = useState("");
  const [usageLogsLastRefresh, setUsageLogsLastRefresh] = useState("");
  const [projectLogQuery, setProjectLogQuery] = useState("");
  const [projectLogs, setProjectLogs] = useState<UsageLogRow[]>([]);
  const [projectLogsLoading, setProjectLogsLoading] = useState(false);
  const [projectLogsError, setProjectLogsError] = useState("");
  const [projectLogsLastRefresh, setProjectLogsLastRefresh] = useState("");
  const [usageStatusFilter, setUsageStatusFilter] = useState<"all" | "ok" | "error" | "info">("all");
  const [usageCategoryFilter, setUsageCategoryFilter] = useState("");
  const [usageActionFilter, setUsageActionFilter] = useState("");
  const [expandedUsageLogIds, setExpandedUsageLogIds] = useState<Record<string, boolean>>({});
  const [adminActionHint, setAdminActionHint] = useState("");
  const [showUsageMarkdownTimeline, setShowUsageMarkdownTimeline] = useState(true);

  useEffect(() => {
    if (activeTab !== "overview") {
      return;
    }
    let cancelled = false;
    async function loadOpsSummary() {
      setOpsLoading(true);
      setOpsError("");
      try {
        const response = await fetch("/api/admin/ops-summary?checkoutDays=14&errorLimit=80", {
          method: "GET",
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          summary?: OpsSummaryResponse;
          generatedAt?: string;
          error?: string;
        };
        if (!response.ok || !data.ok || !data.summary) {
          throw new Error(data.error || "Unable to load ops summary.");
        }
        if (cancelled) {
          return;
        }
        setOpsSummary(data.summary);
        setOpsLastRefresh(data.generatedAt || new Date().toISOString());
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unable to load ops summary.";
        setOpsError(message);
      } finally {
        if (!cancelled) {
          setOpsLoading(false);
        }
      }
    }
    void loadOpsSummary();
    return () => {
      cancelled = true;
    };
  }, [activeTab, opsReloadVersion]);

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
  const queryIdentity = useMemo(() => parseUserIdentityInput(emailQuery), [emailQuery]);
  const normalizedUserIdQuery = queryIdentity.userId?.trim() || "";
  const normalizedUserEmailQuery = queryIdentity.email?.trim().toLowerCase() || "";
  const normalizedProjectLogQuery = projectLogQuery.trim().toLowerCase();

  function resetUsageLogsState() {
    setUsageLogs([]);
    setUsageLogsError("");
    setUsageLogsLastRefresh("");
  }

  function resetProjectLogsState() {
    setProjectLogs([]);
    setProjectLogsError("");
    setProjectLogsLastRefresh("");
    setProjectLogsLoading(false);
  }

  function handleEmailQueryChange(value: string) {
    setEmailQuery(value);
    if (!value.trim()) {
      resetUsageLogsState();
    }
  }

  function handleProjectLogQueryChange(value: string) {
    setProjectLogQuery(value);
    if (!value.trim()) {
      resetProjectLogsState();
    }
  }

  useEffect(() => {
    const fallbackEmail = normalizedUserIdQuery
      ? users.find((user) => user.id === normalizedUserIdQuery)?.email.trim().toLowerCase() || ""
      : "";
    const emailToLoad = normalizedUserEmailQuery || fallbackEmail;
    if (!emailToLoad) {
      return;
    }
    let cancelled = false;
    async function loadUsageLogs() {
      setUsageLogsLoading(true);
      setUsageLogsError("");
      try {
        const response = await fetch(`/api/admin/logs?userEmail=${encodeURIComponent(emailToLoad)}&limit=120`);
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          logs?: UsageLogRow[];
          error?: string;
          generatedAt?: string;
        };
        if (!response.ok || !data.ok || !Array.isArray(data.logs)) {
          throw new Error(data.error || "Unable to load usage logs.");
        }
        if (cancelled) {
          return;
        }
        setUsageLogs(data.logs);
        setUsageLogsLastRefresh(data.generatedAt || new Date().toISOString());
      } catch (error) {
        if (cancelled) {
          return;
        }
        setUsageLogs([]);
        setUsageLogsError(error instanceof Error ? error.message : "Unable to load usage logs.");
      } finally {
        if (!cancelled) {
          setUsageLogsLoading(false);
        }
      }
    }
    void loadUsageLogs();
    return () => {
      cancelled = true;
    };
  }, [normalizedUserEmailQuery, normalizedUserIdQuery, opsReloadVersion, users]);

  useEffect(() => {
    if (!normalizedProjectLogQuery) {
      return;
    }
    let cancelled = false;
    async function loadProjectLogs() {
      setProjectLogsLoading(true);
      setProjectLogsError("");
      try {
        const response = await fetch(
          `/api/admin/logs?projectId=${encodeURIComponent(normalizedProjectLogQuery)}&limit=120`,
        );
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          logs?: UsageLogRow[];
          error?: string;
          generatedAt?: string;
        };
        if (!response.ok || !data.ok || !Array.isArray(data.logs)) {
          throw new Error(data.error || "Unable to load project logs.");
        }
        if (cancelled) {
          return;
        }
        setProjectLogs(data.logs);
        setProjectLogsLastRefresh(data.generatedAt || new Date().toISOString());
      } catch (error) {
        if (cancelled) {
          return;
        }
        setProjectLogs([]);
        setProjectLogsError(error instanceof Error ? error.message : "Unable to load project logs.");
      } finally {
        if (!cancelled) {
          setProjectLogsLoading(false);
        }
      }
    }
    void loadProjectLogs();
    return () => {
      cancelled = true;
    };
  }, [normalizedProjectLogQuery, opsReloadVersion]);

  const matchedUsers = useMemo(() => {
    if (!normalizedEmailQuery) {
      return [];
    }
    if (normalizedUserIdQuery) {
      return users.filter((user) => user.id.toLowerCase() === normalizedUserIdQuery.toLowerCase());
    }
    return users.filter((user) => user.email.toLowerCase().includes(normalizedUserEmailQuery));
  }, [normalizedEmailQuery, normalizedUserEmailQuery, normalizedUserIdQuery, users]);

  const usageCategories = useMemo(() => {
    return Array.from(new Set(usageLogs.map((item) => item.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [usageLogs]);

  const usageActions = useMemo(() => {
    return Array.from(new Set(usageLogs.map((item) => item.action).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [usageLogs]);

  const filteredUsageLogs = useMemo(() => {
    return usageLogs.filter((item) => {
      if (usageStatusFilter !== "all" && item.status !== usageStatusFilter) {
        return false;
      }
      if (usageCategoryFilter && item.category !== usageCategoryFilter) {
        return false;
      }
      if (usageActionFilter && item.action !== usageActionFilter) {
        return false;
      }
      return true;
    });
  }, [usageActionFilter, usageCategoryFilter, usageLogs, usageStatusFilter]);

  const usageTimelineMarkdown = useMemo(() => {
    return buildMarkdownTimeline(filteredUsageLogs);
  }, [filteredUsageLogs]);

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
    if (normalizedUserIdQuery) {
      return sortedProjects.filter((project) => project.userId === normalizedUserIdQuery);
    }
    return sortedProjects.filter((project) => {
      const owner = usersById.get(project.userId);
      if (!owner) {
        return false;
      }
      return owner.email.toLowerCase().includes(normalizedUserEmailQuery);
    });
  }, [normalizedEmailQuery, normalizedUserEmailQuery, normalizedUserIdQuery, sortedProjects, usersById]);

  const selectedUserForLedger = useMemo(() => {
    if (!normalizedEmailQuery) {
      return null;
    }
    if (normalizedUserIdQuery) {
      const byId = users.find((user) => user.id === normalizedUserIdQuery);
      if (byId) {
        return byId;
      }
    }
    const exact = users.find(
      (user) => user.email.trim().toLowerCase() === normalizedUserEmailQuery,
    );
    if (exact) {
      return exact;
    }
    if (matchedUsers.length === 1) {
      return matchedUsers[0];
    }
    if (normalizedUserEmailQuery.includes("@")) {
      return {
        id: `synthetic-${normalizedUserEmailQuery}`,
        name: normalizedUserEmailQuery.split("@")[0] || normalizedUserEmailQuery,
        email: normalizedUserEmailQuery,
        role: "user" as const,
        plan: "free" as const,
        credits: getCreditRecords(normalizedUserEmailQuery)[0]?.balance ?? 0,
      };
    }
    return null;
  }, [matchedUsers, normalizedEmailQuery, normalizedUserEmailQuery, normalizedUserIdQuery, users]);

  const selectedUserSummary = useMemo(() => {
    if (!selectedUserForLedger) {
      return null;
    }
    const targetEmail = selectedUserForLedger.email.trim().toLowerCase();
    const userProjects = projects.filter((project) => {
      const owner = usersById.get(project.userId);
      return owner?.email.trim().toLowerCase() === targetEmail;
    });
    const latestProjectAt = userProjects
      .map((item) => item.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
    const userLogs = usageLogs.filter(
      (item) => item.userEmail?.trim().toLowerCase() === targetEmail,
    );
    const errorCount = userLogs.filter((item) => item.status === "error").length;
    const latestLogAt = userLogs.map((item) => item.createdAt).sort((a, b) => b.localeCompare(a))[0];
    const currentBalance = getCreditRecords(targetEmail)[0]?.balance ?? selectedUserForLedger.credits;
    return {
      plan: selectedUserForLedger.plan,
      role: selectedUserForLedger.role,
      projectCount: userProjects.length,
      currentBalance,
      latestProjectAt: latestProjectAt ?? null,
      errorCount,
      latestLogAt: latestLogAt ?? null,
    };
  }, [projects, selectedUserForLedger, usageLogs, usersById]);

  const selectedUserLedger = useMemo(() => {
    if (!selectedUserForLedger) {
      return [] as typeof creditRecords;
    }
    const targetEmail = selectedUserForLedger.email.trim().toLowerCase();
    return creditRecords.filter((record) => {
      if (record.userId && record.userId === selectedUserForLedger.id) {
        return true;
      }
      if (record.userEmail && record.userEmail.trim().toLowerCase() === targetEmail) {
        return true;
      }
      return false;
    });
  }, [creditRecords, selectedUserForLedger]);

  const selectedUserTopups = useMemo(() => {
    return selectedUserLedger.filter((record) => record.type === "topup" || record.delta > 0);
  }, [selectedUserLedger]);

  const selectedUserProjectConsumes = useMemo(() => {
    return selectedUserLedger.filter(
      (record) =>
        record.delta < 0 &&
        record.type === "consume" &&
        Boolean(record.projectId || record.projectTitle),
    );
  }, [selectedUserLedger]);

  const selectedUserConsumeByProject = useMemo(() => {
    const grouped = new Map<
      string,
      { projectTitle: string; total: number; count: number; latestAt: string }
    >();
    selectedUserProjectConsumes.forEach((record) => {
      const key = record.projectId || record.projectTitle || "unknown-project";
      const prev = grouped.get(key);
      const amount = Math.abs(record.delta);
      if (!prev) {
        grouped.set(key, {
          projectTitle: record.projectTitle || key,
          total: amount,
          count: 1,
          latestAt: record.createdAt,
        });
        return;
      }
      grouped.set(key, {
        projectTitle: prev.projectTitle,
        total: prev.total + amount,
        count: prev.count + 1,
        latestAt: prev.latestAt > record.createdAt ? prev.latestAt : record.createdAt,
      });
    });
    return Array.from(grouped.entries())
      .map(([projectId, value]) => ({ projectId, ...value }))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [selectedUserProjectConsumes]);

  const categories = useMemo(() => {
    const presets = ["综合", "天文", "经济", "历史", "生物", "地理", "物理", "医学"];
    const dynamic = featuredConfigs.map((item) => item.category);
    return Array.from(new Set([...presets, ...dynamic]));
  }, [featuredConfigs]);

  const projectsById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]));
  }, [projects]);

  const recentCreditRecords = useMemo(() => {
    return [...creditRecords].slice(0, 8);
  }, [creditRecords]);

  const tabs: { id: DashboardTab; label: string; desc: string }[] = [
    { id: "overview", label: "总览", desc: "查看核心运营指标与最近动态" },
    { id: "projectOps", label: "项目与积分", desc: "检索用户项目并查看充值/消耗明细" },
    { id: "featured", label: "优秀案例配置", desc: "配置首页优秀案例的分类与排序" },
  ];

  function clearLogFilters() {
    setUsageStatusFilter("all");
    setUsageCategoryFilter("");
    setUsageActionFilter("");
  }

  function handleToggleUsageDetails(logId: string) {
    setExpandedUsageLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  }

  async function handleCopyText(value: string, hint: string) {
    if (!value.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setAdminActionHint(hint);
    } catch {
      setAdminActionHint("复制失败，请检查浏览器剪贴板权限");
    }
  }

  function handleExportUsageLogs() {
    const payload = filteredUsageLogs.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      userEmail: item.userEmail,
      projectId: item.projectId,
      category: item.category,
      action: item.action,
      status: item.status,
      source: item.source,
      code: item.code,
      message: item.message,
      detailsJson: item.detailsJson,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const emailSegment = normalizedEmailQuery ? normalizedEmailQuery.replace(/[^a-z0-9._-]+/gi, "_") : "all-users";
    link.href = url;
    link.download = `knowlens-usage-logs-${emailSegment}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setAdminActionHint("日志导出完成");
  }

  async function handleDownloadServerLogsByEmail() {
    const resolvedEmail = normalizedUserEmailQuery || selectedUserForLedger?.email.trim().toLowerCase() || "";
    if (!resolvedEmail) {
      setAdminActionHint("请先输入邮箱后再下载服务端日志（用户 ID 暂不支持直接下载）");
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/logs/download?userEmail=${encodeURIComponent(resolvedEmail)}&format=jsonl&limit=2000`,
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "服务端日志下载失败");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `knowlens-server-logs-${resolvedEmail.replace(/[^a-z0-9._-]+/gi, "_")}.jsonl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setAdminActionHint("服务端日志下载完成");
    } catch (error) {
      setAdminActionHint(error instanceof Error ? error.message : "服务端日志下载失败");
    }
  }

  function handleAddFeaturedCase() {
    const projectId = featuredProjectId.trim();
    if (!projectId) {
      setFeaturedError("请输入项目 ID");
      return;
    }
    if (!projectsById.has(projectId)) {
      setFeaturedError("项目 ID 不存在，请先确认项目列表中的 ID");
      return;
    }
    const orderValue = Number(featuredOrder);
    if (!Number.isFinite(orderValue)) {
      setFeaturedError("排序必须是数字");
      return;
    }
    const next = upsertFeaturedCaseConfig({
      projectId,
      category: featuredCategory,
      order: orderValue,
    });
    setFeaturedConfigs(next);
    setFeaturedProjectId("");
    setFeaturedOrder(String(orderValue + 10));
    setFeaturedError("");
  }

  function handleRemoveFeaturedCase(id: string) {
    const next = removeFeaturedCaseConfig(id);
    setFeaturedConfigs(next);
  }

  return (
    <AdminShell
      title="Dashboard"
      description="总览用户、项目、反馈和积分消耗情况。"
    >
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">页面视图</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {tabs.find((tab) => tab.id === activeTab)?.desc}
            </p>
          </div>
        </div>
        <div className="mt-3 inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm transition ${
                activeTab === tab.id
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-transparent bg-transparent text-zinc-700 hover:border-zinc-300 hover:bg-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <div className="mt-4 space-y-4">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">用户查询入口</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  支持输入用户邮箱或用户 ID（如 u-xxx），统一查看日志、项目与积分信息。
                </p>
              </div>
              <div className="relative w-full sm:max-w-md">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={emailQuery}
                  onChange={(event) => handleEmailQueryChange(event.target.value)}
                  placeholder="输入邮箱或用户 ID，例如 pixfun.ai@gmail.com / u-admin"
                  className="h-10 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-10 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
                {emailQuery ? (
                  <button
                    type="button"
                    onClick={() => handleEmailQueryChange("")}
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
                  ? matchedUsers.map((user) => `${user.email} (${user.id})`).join("，")
                  : "未找到用户（仍可继续查询服务端日志）"}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">请输入邮箱或用户 ID 开始查询</p>
            )}

            {selectedUserForLedger && selectedUserSummary ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">用户</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{selectedUserForLedger.email}</p>
                  <p className="mt-1 text-xs text-zinc-500">{selectedUserForLedger.name}</p>
                </article>
                <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">角色 / 计划</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {selectedUserSummary.role} / {selectedUserSummary.plan}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">当前积分 {selectedUserSummary.currentBalance}</p>
                </article>
                <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">项目总数</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">{selectedUserSummary.projectCount}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    最近项目更新：{selectedUserSummary.latestProjectAt ?? "-"}
                  </p>
                </article>
                <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs text-zinc-500">日志报错数量</p>
                  <p className="mt-1 text-xl font-semibold text-rose-600">{selectedUserSummary.errorCount}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    最近活跃：{selectedUserSummary.latestLogAt ? formatDate(selectedUserSummary.latestLogAt) : "-"}
                  </p>
                </article>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">用户使用日志</h2>
                <p className="mt-1 text-xs text-zinc-500">按邮箱查看日志，并可按状态/分类/动作筛选。</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearLogFilters}
                  className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
                >
                  清空筛选
                </button>
                <button
                  type="button"
                  disabled={!filteredUsageLogs.length}
                  onClick={handleExportUsageLogs}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download size={12} />
                  导出 JSON
                </button>
                <button
                  type="button"
                  disabled={!filteredUsageLogs.length}
                  onClick={() => {
                    void handleCopyText(usageTimelineMarkdown, "用户时间轴日志（Markdown）已复制");
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Copy size={12} />
                  复制时间轴
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsageStatusFilter("error");
                    setUsageCategoryFilter("llm");
                    setUsageActionFilter("draft_generation_failed");
                  }}
                  className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
                >
                  LLM 失败
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsageStatusFilter("error");
                    setUsageCategoryFilter("image");
                    setUsageActionFilter("image_generation_failed");
                  }}
                  className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
                >
                  Image2 失败
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDownloadServerLogsByEmail();
                  }}
                  disabled={!normalizedUserEmailQuery}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download size={12} />
                  下载服务端日志
                </button>
                <button
                  type="button"
                  onClick={() => setShowUsageMarkdownTimeline((prev) => !prev)}
                  className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
                >
                  {showUsageMarkdownTimeline ? "切换表格" : "切换 Markdown"}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <select
                value={usageStatusFilter}
                onChange={(event) => setUsageStatusFilter(event.target.value as "all" | "ok" | "error" | "info")}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="all">状态：全部</option>
                <option value="ok">状态：ok</option>
                <option value="error">状态：error</option>
                <option value="info">状态：info</option>
              </select>
              <select
                value={usageCategoryFilter}
                onChange={(event) => setUsageCategoryFilter(event.target.value)}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">分类：全部</option>
                {usageCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={usageActionFilter}
                onChange={(event) => setUsageActionFilter(event.target.value)}
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">动作：全部</option>
                {usageActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            {adminActionHint ? (
              <p className="mt-2 text-xs text-zinc-500">{adminActionHint}</p>
            ) : null}
            {usageLogsLastRefresh ? (
              <p className="mt-2 text-xs text-zinc-500">最后刷新：{formatDate(usageLogsLastRefresh)}</p>
            ) : null}
            {usageLogsLoading ? (
              <p className="mt-3 text-sm text-zinc-500">加载中...</p>
            ) : usageLogsError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {usageLogsError}
              </p>
            ) : !normalizedEmailQuery ? (
              <p className="mt-3 text-sm text-zinc-500">请输入邮箱或用户 ID 后查看日志</p>
            ) : !filteredUsageLogs.length ? (
              <p className="mt-3 text-sm text-zinc-500">当前筛选条件下暂无日志（可先清空筛选或下载服务端原始日志确认）</p>
            ) : (
              showUsageMarkdownTimeline ? (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 text-xs text-zinc-500">
                    Markdown 时间轴（完整可复制）：按时间倒序，包含分类、动作、阶段、message、details。
                  </p>
                  <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-[12px] leading-5 text-zinc-700">
                    {usageTimelineMarkdown}
                  </pre>
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">时间</th>
                        <th className="px-2 py-1.5 font-medium">分类</th>
                        <th className="px-2 py-1.5 font-medium">动作</th>
                        <th className="px-2 py-1.5 font-medium">失败环节</th>
                        <th className="px-2 py-1.5 font-medium">状态</th>
                        <th className="px-2 py-1.5 font-medium">来源</th>
                        <th className="px-2 py-1.5 font-medium">错误码</th>
                        <th className="px-2 py-1.5 font-medium">消息</th>
                        <th className="px-2 py-1.5 font-medium">项目</th>
                        <th className="px-2 py-1.5 font-medium">详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsageLogs.map((item) => {
                        const expanded = Boolean(expandedUsageLogIds[item.id]);
                        return (
                          <tr key={item.id} className="border-t border-zinc-100 align-top">
                            <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-500">{formatDate(item.createdAt)}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{item.category}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{item.action}</td>
                            <td className="px-2 py-1.5 text-xs text-zinc-500">{item.stage ?? resolveFailureStage(item)}</td>
                            <td className={`px-2 py-1.5 text-xs font-medium ${
                              item.status === "error" ? "text-rose-600" : item.status === "ok" ? "text-emerald-600" : "text-zinc-500"
                            }`}>{item.status}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{item.source ?? "-"}</td>
                            <td className="px-2 py-1.5 text-xs text-zinc-500">{item.code ?? "-"}</td>
                            <td className="max-w-[360px] px-2 py-1.5 text-zinc-700">{item.message ?? "-"}</td>
                            <td className="px-2 py-1.5 text-xs text-zinc-500">{item.projectId ?? "-"}</td>
                            <td className="px-2 py-1.5 text-xs text-zinc-500">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleUsageDetails(item.id)}
                                  className="inline-flex rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-600 transition hover:bg-zinc-100"
                                >
                                  {expanded ? "收起" : "展开"}
                                </button>
                                <button
                                  type="button"
                                  disabled={!item.detailsJson}
                                  onClick={() => {
                                    void handleCopyText(item.detailsJson ?? "", "日志详情已复制");
                                  }}
                                  className="inline-flex rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  <Copy size={10} />
                                </button>
                              </div>
                              {expanded ? (
                                <pre className="mt-1 max-w-[320px] whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-[11px] leading-4 text-zinc-600">
                                  {item.detailsJson ?? "-"}
                                </pre>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">项目日志直查</h2>
                <p className="mt-1 text-xs text-zinc-500">作为第二入口，按 projectId 定位单个项目链路。</p>
              </div>
              <div className="relative w-full sm:max-w-md">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={projectLogQuery}
                  onChange={(event) => handleProjectLogQueryChange(event.target.value)}
                  placeholder="输入 projectId，例如 p-admin-001"
                  className="h-10 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-10 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
                {projectLogQuery ? (
                  <button
                    type="button"
                    onClick={() => handleProjectLogQueryChange("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 transition hover:bg-zinc-100"
                    aria-label="清空项目筛选"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
            {projectLogsLastRefresh ? (
              <p className="mt-2 text-xs text-zinc-500">最后刷新：{formatDate(projectLogsLastRefresh)}</p>
            ) : null}
            {projectLogsLoading ? (
              <p className="mt-3 text-sm text-zinc-500">加载中...</p>
            ) : projectLogsError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {projectLogsError}
              </p>
            ) : !normalizedProjectLogQuery ? (
              <p className="mt-3 text-sm text-zinc-500">请输入项目 ID 后查看日志</p>
            ) : !projectLogs.length ? (
              <p className="mt-3 text-sm text-zinc-500">暂无项目日志</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">时间</th>
                      <th className="px-2 py-1.5 font-medium">分类</th>
                      <th className="px-2 py-1.5 font-medium">动作</th>
                      <th className="px-2 py-1.5 font-medium">状态</th>
                      <th className="px-2 py-1.5 font-medium">来源</th>
                      <th className="px-2 py-1.5 font-medium">错误码</th>
                      <th className="px-2 py-1.5 font-medium">消息</th>
                      <th className="px-2 py-1.5 font-medium">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectLogs.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-100 align-top">
                        <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-500">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-2 py-1.5 text-zinc-700">{item.category}</td>
                        <td className="px-2 py-1.5 text-zinc-700">{item.action}</td>
                        <td
                          className={`px-2 py-1.5 text-xs font-medium ${
                            item.status === "error"
                              ? "text-rose-600"
                              : item.status === "ok"
                                ? "text-emerald-600"
                                : "text-zinc-500"
                          }`}
                        >
                          {item.status}
                        </td>
                        <td className="px-2 py-1.5 text-zinc-700">{item.source ?? "-"}</td>
                        <td className="px-2 py-1.5 text-xs text-zinc-500">{item.code ?? "-"}</td>
                        <td className="max-w-[360px] px-2 py-1.5 text-zinc-700">{item.message ?? "-"}</td>
                        <td className="max-w-[320px] whitespace-pre-wrap px-2 py-1.5 text-xs text-zinc-500">
                          {item.detailsJson ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
              <p className="mt-2 text-3xl font-semibold text-zinc-900">
                {stats.totalCreditsUsed}
              </p>
            </article>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">线上运行统计（服务端）</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  项目规模、支付来源转化率、关键报错日志（登录 / LLM / Image / 下载）
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpsReloadVersion((prev) => prev + 1)}
                className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
              >
                刷新
              </button>
            </div>

            {opsLoading ? (
              <p className="mt-3 text-sm text-zinc-500">加载中...</p>
            ) : opsError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {opsError}
              </p>
            ) : !opsSummary ? (
              <p className="mt-3 text-sm text-zinc-500">暂无服务端统计数据</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">历史项目总数</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900">{opsSummary.projects.total}</p>
                  </article>
                  <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">当前项目数量</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900">{opsSummary.projects.active}</p>
                  </article>
                  <article className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">当前报错总数</p>
                    <p className="mt-1 text-xl font-semibold text-rose-600">{opsSummary.errors.total}</p>
                  </article>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <article className="rounded-xl border border-zinc-200 bg-white p-3">
                    <h3 className="text-sm font-medium text-zinc-900">支付来源转化（日）</h3>
                    {!opsSummary.checkout.length ? (
                      <p className="mt-2 text-sm text-zinc-500">暂无支付埋点数据</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs text-zinc-500">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">日期</th>
                              <th className="px-2 py-1.5 font-medium">来源</th>
                              <th className="px-2 py-1.5 font-medium">出单次数</th>
                              <th className="px-2 py-1.5 font-medium">成功数</th>
                              <th className="px-2 py-1.5 font-medium">成功率</th>
                            </tr>
                          </thead>
                          <tbody>
                            {opsSummary.checkout.map((row) => (
                              <tr key={`${row.day}-${row.source}`} className="border-t border-zinc-100">
                                <td className="px-2 py-1.5 text-xs text-zinc-500">{row.day}</td>
                                <td className="px-2 py-1.5 text-zinc-700">{row.source}</td>
                                <td className="px-2 py-1.5 text-zinc-700">{row.attempts}</td>
                                <td className="px-2 py-1.5 text-zinc-700">{row.successes}</td>
                                <td className="px-2 py-1.5 font-medium text-zinc-900">{row.successRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>

                  <article className="rounded-xl border border-zinc-200 bg-white p-3">
                    <h3 className="text-sm font-medium text-zinc-900">报错类型分布</h3>
                    {!opsSummary.errors.byCategory.length ? (
                      <p className="mt-2 text-sm text-zinc-500">暂无报错</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {opsSummary.errors.byCategory.map((item) => (
                          <li
                            key={item.category}
                            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm"
                          >
                            <span className="text-zinc-700">{item.category}</span>
                            <span className="font-medium text-zinc-900">{item.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </div>

                <article className="rounded-xl border border-zinc-200 bg-white p-3">
                  <h3 className="text-sm font-medium text-zinc-900">最近关键报错日志</h3>
                  {!opsSummary.errors.recent.length ? (
                    <p className="mt-2 text-sm text-zinc-500">暂无关键报错日志</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs text-zinc-500">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">时间</th>
                            <th className="px-2 py-1.5 font-medium">分类</th>
                            <th className="px-2 py-1.5 font-medium">动作</th>
                            <th className="px-2 py-1.5 font-medium">来源</th>
                            <th className="px-2 py-1.5 font-medium">错误码</th>
                            <th className="px-2 py-1.5 font-medium">错误描述</th>
                            <th className="px-2 py-1.5 font-medium">用户</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opsSummary.errors.recent.slice(0, 25).map((item) => (
                            <tr key={item.id} className="border-t border-zinc-100 align-top">
                              <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-500">
                                {formatDate(item.createdAt)}
                              </td>
                              <td className="px-2 py-1.5 text-zinc-700">{item.category}</td>
                              <td className="px-2 py-1.5 text-zinc-700">{item.action}</td>
                              <td className="px-2 py-1.5 text-zinc-700">{item.source}</td>
                              <td className="px-2 py-1.5 text-xs text-zinc-500">{item.code ?? "-"}</td>
                              <td className="max-w-[420px] px-2 py-1.5 text-zinc-700">{item.message}</td>
                              <td className="px-2 py-1.5 text-xs text-zinc-500">{item.userEmail ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {opsLastRefresh ? (
                    <p className="mt-2 text-xs text-zinc-500">最后刷新：{formatDate(opsLastRefresh)}</p>
                  ) : null}
                </article>
              </div>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-zinc-900">最近反馈</h2>
              {!feedbacks.length ? (
                <p className="mt-2 text-sm text-zinc-500">暂无反馈记录</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {feedbacks.slice(0, 6).map((feedback) => (
                    <li
                      key={feedback.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-zinc-900">{feedback.type}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{feedback.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-zinc-900">优秀案例预览（Top 6）</h2>
              <ul className="mt-2 space-y-2">
                {featuredConfigs.slice(0, 6).map((config) => {
                  const project = projectsById.get(config.projectId);
                  return (
                    <li
                      key={config.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <span className="truncate text-sm text-zinc-700">
                        [{config.category}] {project?.title ?? config.projectId}
                      </span>
                      <span className="text-xs text-zinc-500">#{config.order}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">最近积分流水</h2>
            {!recentCreditRecords.length ? (
              <p className="mt-2 text-sm text-zinc-500">暂无积分记录</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="rounded-l-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        时间
                      </th>
                      <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        描述
                      </th>
                      <th className="rounded-r-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        变动
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCreditRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="border-b border-zinc-100 px-3 py-2.5 text-xs text-zinc-500">
                          {record.createdAt}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2.5 text-zinc-700">
                          {record.description}
                        </td>
                        <td
                          className={`border-b border-zinc-100 px-3 py-2.5 text-sm font-medium ${
                            record.delta > 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {record.delta > 0 ? `+${record.delta}` : record.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "projectOps" ? (
        <div className="mt-4 space-y-4">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">项目检索</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  继承总览页的邮箱查询条件，查看某位用户的全部项目；留空则显示所有项目。
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                当前查询邮箱：{normalizedEmailQuery || "未设置（显示全部用户项目）"}
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

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">项目日志直查</h2>
                <p className="mt-1 text-xs text-zinc-500">输入 project ID，可以直接筛出该项目的前后端日志。</p>
              </div>
              <div className="relative w-full sm:max-w-md">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={projectLogQuery}
                  onChange={(event) => setProjectLogQuery(event.target.value)}
                  placeholder="输入 projectId，例如 p-admin-001"
                  className="h-10 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-10 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
                {projectLogQuery ? (
                  <button
                    type="button"
                    onClick={() => setProjectLogQuery("")}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 transition hover:bg-zinc-100"
                    aria-label="清空项目筛选"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
              使用日志入口已迁移至「总览」首屏，便于管理员先按邮箱定位用户，再继续看项目与积分。
            </div>
            {projectLogsLastRefresh || projectLogsLoading || projectLogsError || normalizedProjectLogQuery ? (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">项目直查结果</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {normalizedProjectLogQuery ? `projectId = ${projectLogQuery}` : "请输入 project ID"}
                    </p>
                  </div>
                  {projectLogsLastRefresh ? (
                    <p className="text-xs text-zinc-500">最后刷新：{formatDate(projectLogsLastRefresh)}</p>
                  ) : null}
                </div>
                {projectLogsLoading ? (
                  <p className="mt-3 text-sm text-zinc-500">加载中...</p>
                ) : projectLogsError ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {projectLogsError}
                  </p>
                ) : !normalizedProjectLogQuery ? (
                  <p className="mt-3 text-sm text-zinc-500">请输入项目 ID 后查看日志</p>
                ) : !projectLogs.length ? (
                  <p className="mt-3 text-sm text-zinc-500">暂无项目日志</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs text-zinc-500">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">时间</th>
                          <th className="px-2 py-1.5 font-medium">分类</th>
                          <th className="px-2 py-1.5 font-medium">动作</th>
                          <th className="px-2 py-1.5 font-medium">状态</th>
                          <th className="px-2 py-1.5 font-medium">来源</th>
                          <th className="px-2 py-1.5 font-medium">错误码</th>
                          <th className="px-2 py-1.5 font-medium">消息</th>
                          <th className="px-2 py-1.5 font-medium">详情</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectLogs.map((item) => (
                          <tr key={item.id} className="border-t border-zinc-100 align-top">
                            <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-500">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-700">{item.category}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{item.action}</td>
                            <td
                              className={`px-2 py-1.5 text-xs font-medium ${
                                item.status === "error"
                                  ? "text-rose-600"
                                  : item.status === "ok"
                                    ? "text-emerald-600"
                                    : "text-zinc-500"
                              }`}
                            >
                              {item.status}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-700">{item.source ?? "-"}</td>
                            <td className="px-2 py-1.5 text-xs text-zinc-500">{item.code ?? "-"}</td>
                            <td className="max-w-[360px] px-2 py-1.5 text-zinc-700">{item.message ?? "-"}</td>
                            <td className="max-w-[320px] whitespace-pre-wrap px-2 py-1.5 text-xs text-zinc-500">
                              {item.detailsJson ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-900">用户充值与项目积分消耗</h2>
              <p className="text-xs text-zinc-500">
                输入完整邮箱可查看该用户充值记录和项目级消耗明细
              </p>
            </div>

            {!normalizedEmailQuery ? (
              <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                先在上方输入用户邮箱，再查看积分明细
              </p>
            ) : matchedUsers.length > 1 && !selectedUserForLedger ? (
              <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                匹配到多个用户，请输入更完整的邮箱：{matchedUsers
                  .map((user) => user.email)
                  .join("，")}
              </p>
            ) : !selectedUserForLedger ? (
              <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                未找到该用户
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  当前用户：{selectedUserForLedger.email}（{selectedUserForLedger.name}）
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <article className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                    <p className="text-xs text-zinc-500">累计充值</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-600">
                      +
                      {selectedUserTopups.reduce(
                        (sum, record) => sum + Math.abs(record.delta),
                        0,
                      )}
                    </p>
                  </article>
                  <article className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                    <p className="text-xs text-zinc-500">累计项目消耗</p>
                    <p className="mt-1 text-lg font-semibold text-rose-600">
                      -
                      {selectedUserProjectConsumes.reduce(
                        (sum, record) => sum + Math.abs(record.delta),
                        0,
                      )}
                    </p>
                  </article>
                  <article className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                    <p className="text-xs text-zinc-500">涉及项目数</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-900">
                      {selectedUserConsumeByProject.length}
                    </p>
                  </article>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <article className="rounded-xl border border-zinc-200 bg-white p-3">
                    <h3 className="text-sm font-medium text-zinc-900">充值记录</h3>
                    {!selectedUserTopups.length ? (
                      <p className="mt-2 text-sm text-zinc-500">暂无充值记录</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs text-zinc-500">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">时间</th>
                              <th className="px-2 py-1.5 font-medium">描述</th>
                              <th className="px-2 py-1.5 font-medium">积分</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedUserTopups.map((record) => (
                              <tr key={record.id} className="border-t border-zinc-100">
                                <td className="px-2 py-1.5 text-xs text-zinc-500">
                                  {formatDate(record.createdAt)}
                                </td>
                                <td className="px-2 py-1.5 text-zinc-700">
                                  {record.description}
                                </td>
                                <td className="px-2 py-1.5 font-medium text-emerald-600">
                                  +{Math.abs(record.delta)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>

                  <article className="rounded-xl border border-zinc-200 bg-white p-3">
                    <h3 className="text-sm font-medium text-zinc-900">项目积分消耗汇总</h3>
                    {!selectedUserConsumeByProject.length ? (
                      <p className="mt-2 text-sm text-zinc-500">暂无项目消耗记录</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs text-zinc-500">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">项目</th>
                              <th className="px-2 py-1.5 font-medium">累计消耗</th>
                              <th className="px-2 py-1.5 font-medium">次数</th>
                              <th className="px-2 py-1.5 font-medium">最近时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedUserConsumeByProject.map((item) => (
                              <tr key={item.projectId} className="border-t border-zinc-100">
                                <td className="px-2 py-1.5 text-zinc-700">{item.projectTitle}</td>
                                <td className="px-2 py-1.5 font-medium text-rose-600">
                                  -{item.total}
                                </td>
                                <td className="px-2 py-1.5 text-zinc-600">{item.count}</td>
                                <td className="px-2 py-1.5 text-xs text-zinc-500">
                                  {formatDate(item.latestAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
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
        </div>
      ) : null}

      {activeTab === "featured" ? (
        <div className="mt-4 space-y-4">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-900">首页优秀案例配置</h2>
              <p className="text-xs text-zinc-500">
                支持手动录入项目 ID，配置分类和排序（数字越小越靠前）
              </p>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_0.9fr_0.6fr_auto]">
              <input
                value={featuredProjectId}
                onChange={(event) => {
                  setFeaturedProjectId(event.target.value);
                  if (featuredError) {
                    setFeaturedError("");
                  }
                }}
                placeholder="项目 ID，例如 p-admin-001"
                className="h-10 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              <select
                value={featuredCategory}
                onChange={(event) => setFeaturedCategory(event.target.value)}
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                value={featuredOrder}
                onChange={(event) => {
                  setFeaturedOrder(event.target.value);
                  if (featuredError) {
                    setFeaturedError("");
                  }
                }}
                placeholder="排序"
                className="h-10 rounded-xl border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              <button
                type="button"
                onClick={handleAddFeaturedCase}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                添加/更新
              </button>
            </div>
            {featuredError ? (
              <p className="mt-2 text-xs text-red-600">{featuredError}</p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                提示：重复添加同一个项目 ID 会更新分类与排序，不会新增重复项。
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            {!featuredConfigs.length ? (
              <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                暂无优秀案例配置
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="rounded-l-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        排序
                      </th>
                      <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        分类
                      </th>
                      <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        项目 ID
                      </th>
                      <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        项目名称
                      </th>
                      <th className="border-y border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        用户
                      </th>
                      <th className="rounded-r-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {featuredConfigs.map((config) => {
                      const project = projectsById.get(config.projectId);
                      const owner = project ? usersById.get(project.userId) : null;
                      return (
                        <tr key={config.id} className="text-zinc-700">
                          <td className="border-b border-zinc-100 px-3 py-2.5 text-xs text-zinc-500">
                            {config.order}
                          </td>
                          <td className="border-b border-zinc-100 px-3 py-2.5">
                            <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                              {config.category}
                            </span>
                          </td>
                          <td className="border-b border-zinc-100 px-3 py-2.5 font-mono text-xs text-zinc-600">
                            {config.projectId}
                          </td>
                          <td className="border-b border-zinc-100 px-3 py-2.5 text-zinc-900">
                            {project?.title ?? "项目不存在"}
                          </td>
                          <td className="border-b border-zinc-100 px-3 py-2.5 text-xs text-zinc-600">
                            {owner?.email ?? "未知用户"}
                          </td>
                          <td className="border-b border-zinc-100 px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => handleRemoveFeaturedCase(config.id)}
                              className="inline-flex rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
