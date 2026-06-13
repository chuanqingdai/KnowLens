"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSearch,
  Filter,
  FolderKanban,
  MessageSquareWarning,
  LoaderCircle,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  createAdminConsoleMockData,
  getLogById,
  getOrderById,
  searchAdminGlobal,
  type AdminConsoleData,
  type AdminMainTab,
  type MockBillingAnomaly,
  type MockCaseConfig,
  type MockCreditRecord,
  type MockLog,
  type MockProject,
  type MockTicket,
  type MockTicketStatus,
  type MockUser,
  type TimeRangeKey,
} from "@/lib/admin/adminConsoleMock";

type SortOrder = "asc" | "desc";

type ToastItem = {
  id: string;
  message: string;
};

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: null | (() => void);
};

type ProjectInputPreviewState = {
  projectId: string;
  title: string;
  input: string;
};

type AdjustCreditState = {
  open: boolean;
  userId: string;
  adjustmentType: "increase" | "decrease";
  amount: string;
  reason: string;
  projectId: string;
  notifyUser: boolean;
};

type PublishedCaseAdminItem = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  outputType: "poster" | "ppt" | "video";
  authorLabel?: string;
  sourceProjectId?: string | null;
  sourceUserEmail?: string | null;
  coverUrl?: string;
  status: string;
  featured: boolean;
  sortOrder: number;
  assets?: Array<{ id: string; fileUrl: string; viewerUrl: string; title?: string }>;
};

type PublishableCaseProjectItem = {
  projectId: string;
  userEmail: string;
  outputType: "poster" | "ppt" | "video";
  title: string;
  pageCount: number;
  generatedAssetCount: number;
  createdAt: string;
  updatedAt: string;
  alreadyPublished: boolean;
  publishedStatus?: string | null;
  publishedSlug?: string | null;
};

type OpsEventAdminLog = {
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
  details?: Record<string, unknown> | null;
  runId?: string | null;
  jobId?: string | null;
  taskId?: string | null;
  durationMs?: number | null;
  taskStatusSummary?: Record<string, number> | null;
};

type OpsEventAdminSummary = {
  email?: string | null;
  userId?: string | null;
  isMember?: boolean;
  planType?: string | null;
  planName?: string | null;
  currentCredits?: number | null;
  generationCount24h?: number;
  failureCount24h?: number;
  refundCount24h?: number;
  latestError?: {
    createdAt?: string;
    action?: string;
    code?: string | null;
    message?: string | null;
  } | null;
};

type OpsTraceSummary = {
  traceId: string;
  createdAt: string;
  lastEventAt: string;
  userEmail: string | null;
  runId: string | null;
  jobId: string | null;
  projectId: string | null;
  entrySource: string | null;
  generationDirection: string | null;
  outputType: string | null;
  styleName: string | null;
  requestedCount: number | null;
  taskCount: number | null;
  finalJobStatus: string | null;
  successCount: number;
  failedCount: number;
  timedOutCount: number;
  creditsConsumed: boolean;
  creditsRefunded: boolean;
  totalDurationMs: number | null;
  failedStep: string | null;
  errorCode: string | null;
};

type OpsLogScopePreset = "critical" | "all" | "summary" | "provider" | "credits" | "refund" | "ui";

const defaultOpsLogFilters = {
  status: "error",
  category: "",
  action: "",
  userEmail: "",
  projectId: "",
  runId: "",
  jobId: "",
  taskId: "",
  code: "",
  from: "",
  to: "",
  onlyErrors: true,
  criticalOnly: true,
  onlySlow: false,
  scope: "critical" as OpsLogScopePreset,
  limit: "120",
  page: 1,
};

type PublishCaseFormState = {
  projectId: string;
  userEmail: string;
  outputType: "poster" | "ppt" | "video";
  title: string;
  category: string;
  authorLabel: string;
  featured: boolean;
};

type PublishCaseProjectSearchState = {
  projectId: string;
  userEmail: string;
};

const MAIN_TABS: Array<{ id: AdminMainTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "overview", label: "运营总览", icon: Sparkles },
  { id: "logs", label: "故障与日志", icon: ShieldAlert },
  { id: "projects", label: "项目管理", icon: FolderKanban },
  { id: "users", label: "用户管理", icon: UserRound },
  { id: "billing", label: "积分与订阅", icon: CreditCard },
  { id: "tickets", label: "反馈工单", icon: MessageSquareWarning },
  { id: "cases", label: "案例配置", icon: FileSearch },
  { id: "settings", label: "系统设置", icon: Settings2 },
];

const PAGE_SIZE = 8;

function formatDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateOnly(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function safeNumber(input: string | null, fallback: number) {
  if (!input) {
    return fallback;
  }
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inTimeRange(input: string, range: TimeRangeKey, customStart?: string | null, customEnd?: string | null) {
  const time = new Date(input).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  const now = Date.now();
  if (range === "today") {
    const date = new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return time >= start && time <= now;
  }
  if (range === "7d") {
    return time >= now - 7 * 24 * 60 * 60 * 1000 && time <= now;
  }
  if (range === "30d") {
    return time >= now - 30 * 24 * 60 * 60 * 1000 && time <= now;
  }
  const startTime = customStart ? new Date(`${customStart}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return time >= startTime && time <= endTime;
}

function getUserEmailLabel(userId: string | undefined | null, usersById: Map<string, MockUser>) {
  if (!userId) {
    return "-";
  }
  return usersById.get(userId)?.email || userId;
}

function matchesUserEmailFilter(userId: string | undefined | null, filter: string, usersById: Map<string, MockUser>) {
  const query = filter.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const normalizedUserId = (userId || "").trim().toLowerCase();
  const email = (userId ? usersById.get(userId)?.email || "" : "").trim().toLowerCase();
  return email.includes(query) || normalizedUserId.includes(query);
}

function clampPage(page: number, total: number) {
  if (total <= 0) {
    return 1;
  }
  return Math.min(Math.max(page, 1), Math.ceil(total / PAGE_SIZE));
}

function paginate<T>(items: T[], page: number) {
  const currentPage = clampPage(page, items.length);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  return {
    pageItems: items.slice(start, end),
    page: currentPage,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / PAGE_SIZE)),
  };
}

function statusBadgeClass(status: string) {
  if (status.includes("fail") || status.includes("failed") || status.includes("frozen") || status.includes("past_due")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (status.includes("process") || status.includes("generating") || status.includes("in_progress") || status.includes("pending")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (status.includes("active") || status.includes("ok") || status.includes("completed") || status.includes("resolved") || status.includes("handled")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function toTicketStatusLabel(status: MockTicketStatus) {
  const map: Record<MockTicketStatus, string> = {
    pending: "待处理",
    in_progress: "处理中",
    resolved: "已解决",
    closed: "已关闭",
    no_action: "无需处理",
  };
  return map[status];
}

function sortBy<T>(items: T[], key: keyof T, order: SortOrder) {
  const next = [...items];
  next.sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const x = left == null ? "" : String(left).toLowerCase();
    const y = right == null ? "" : String(right).toLowerCase();
    if (x === y) {
      return 0;
    }
    if (order === "asc") {
      return x > y ? 1 : -1;
    }
    return x < y ? 1 : -1;
  });
  return next;
}

function getProjectInputText(project: MockProject) {
  return project.originalInput?.trim() || project.topic;
}

function shouldShowProjectInputButton(project: MockProject) {
  const input = getProjectInputText(project);
  return Boolean(project.originalInput?.trim()) && (input.length > 120 || input.includes("\n"));
}

function Drawer(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { open, title, onClose, children } = props;
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button type="button" aria-label="关闭详情" className="h-full w-full cursor-default" onClick={onClose} />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </aside>
    </div>
  );
}

function ConfirmDialog(props: {
  state: ConfirmDialogState;
  onCancel: () => void;
}) {
  const { state, onCancel } = props;
  if (!state.open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-zinc-900">{state.title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{state.description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => state.onConfirm?.()}
            className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pagination(props: {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  total: number;
}) {
  const { page, totalPages, onPageChange, total } = props;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-zinc-600">
      <p>
        共 <span className="font-medium text-zinc-900">{total}</span> 条
      </p>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function AdminDashboardPageContent() {
  const [data, setData] = useState<AdminConsoleData>(() => createAdminConsoleMockData());
  const [selectedLogId, setSelectedLogId] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [selectedOpsEventId, setSelectedOpsEventId] = useState<string>("");
  const [selectedProjectInput, setSelectedProjectInput] = useState<ProjectInputPreviewState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    confirmText: "确认",
    onConfirm: null,
  });
  const [adjustCredit, setAdjustCredit] = useState<AdjustCreditState>({
    open: false,
    userId: "",
    adjustmentType: "increase",
    amount: "",
    reason: "",
    projectId: "",
    notifyUser: true,
  });
  const [publishedCases, setPublishedCases] = useState<PublishedCaseAdminItem[]>([]);
  const [publishedCasesLoading, setPublishedCasesLoading] = useState(false);
  const [publishingCase, setPublishingCase] = useState(false);
  const [caseProjectSearch, setCaseProjectSearch] = useState<PublishCaseProjectSearchState>({
    projectId: "",
    userEmail: "",
  });
  const [caseProjectResults, setCaseProjectResults] = useState<PublishableCaseProjectItem[]>([]);
  const [caseProjectSearchLoading, setCaseProjectSearchLoading] = useState(false);
  const [adminDataLoading, setAdminDataLoading] = useState(true);
  const [opsLogs, setOpsLogs] = useState<OpsEventAdminLog[]>([]);
  const [opsLogSummary, setOpsLogSummary] = useState<OpsEventAdminSummary | null>(null);
  const [opsTraceSummaries, setOpsTraceSummaries] = useState<OpsTraceSummary[]>([]);
  const [opsLogsLoading, setOpsLogsLoading] = useState(false);
  const [opsLogFilters, setOpsLogFilters] = useState(defaultOpsLogFilters);
  const [showAdvancedOpsFilters, setShowAdvancedOpsFilters] = useState(false);
  const [publishCaseForm, setPublishCaseForm] = useState<PublishCaseFormState>({
    projectId: "",
    userEmail: "",
    outputType: "poster",
    title: "",
    category: "All",
    authorLabel: "KnowLens",
    featured: true,
  });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idCounterRef = useRef(1);

  const activeTab = (searchParams.get("tab") as AdminMainTab) || "overview";
  const globalQ = searchParams.get("globalQ") || "";
  const globalResults = useMemo(() => searchAdminGlobal(data, globalQ), [data, globalQ]);
  const userMap = useMemo(() => new Map(data.users.map((item) => [item.id, item])), [data.users]);

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
          data?: AdminConsoleData;
          error?: string;
        };
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Admin data request failed (${response.status})`);
        }
        if (!cancelled) {
          setData(payload.data);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const id = `toast-${idCounterRef.current}`;
        idCounterRef.current += 1;
        const message = error instanceof Error ? error.message : "管理员真实数据加载失败";
        setToasts((prev) => [...prev, { id, message }]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, 3200);
      })
      .finally(() => {
        if (!cancelled) {
          setAdminDataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLog = selectedLogId ? getLogById(data, selectedLogId) : null;
  const selectedOrder = selectedOrderId ? getOrderById(data, selectedOrderId) : null;
  const selectedTicket = selectedTicketId
    ? data.tickets.find((item) => item.id === selectedTicketId) || null
    : null;
  const selectedOpsEvent = useMemo(
    () => opsLogs.find((item) => item.id === selectedOpsEventId) || null,
    [opsLogs, selectedOpsEventId],
  );
  const displayOpsLogs = useMemo(() => {
    const hasDrilldownFilter = Boolean(
      opsLogFilters.action.trim() ||
        opsLogFilters.runId.trim() ||
        opsLogFilters.jobId.trim() ||
        opsLogFilters.taskId.trim(),
    );
    if (hasDrilldownFilter) {
      return [...opsLogs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    if (opsLogFilters.scope === "summary") {
      const summaryLogs = opsLogs.filter((item) => item.action === "generation.trace.summary");
      return summaryLogs.length ? summaryLogs : opsLogs;
    }
    return opsLogs;
  }, [opsLogFilters.action, opsLogFilters.jobId, opsLogFilters.runId, opsLogFilters.scope, opsLogFilters.taskId, opsLogs]);

  function applyOpsLogScope(scope: OpsLogScopePreset) {
    const presets: Record<
      OpsLogScopePreset,
      Pick<typeof opsLogFilters, "status" | "category" | "action" | "scope" | "page" | "criticalOnly" | "onlyErrors">
    > = {
      critical: { status: "error", category: "", action: "", scope: "critical", criticalOnly: true, onlyErrors: true, page: 1 },
      all: { status: "error", category: "", action: "", scope: "all", criticalOnly: false, onlyErrors: true, page: 1 },
      summary: { status: "", category: "", action: "generation.trace.summary", scope: "summary", criticalOnly: false, onlyErrors: false, page: 1 },
      provider: { status: "error", category: "image", action: "generation.provider.", scope: "provider", criticalOnly: false, onlyErrors: true, page: 1 },
      credits: { status: "error", category: "billing", action: "generation.credits.", scope: "credits", criticalOnly: false, onlyErrors: true, page: 1 },
      refund: { status: "error", category: "billing", action: "generation.refund.", scope: "refund", criticalOnly: false, onlyErrors: true, page: 1 },
      ui: { status: "error", category: "ui", action: "ui.", scope: "ui", criticalOnly: false, onlyErrors: true, page: 1 },
    };
    setOpsLogFilters((prev) => ({ ...prev, ...presets[scope] }));
  }

  function resetOpsLogFilters() {
    setOpsLogFilters(defaultOpsLogFilters);
    loadOpsLogs(defaultOpsLogFilters);
  }

  function pushToast(message: string) {
    const id = `toast-${idCounterRef.current}`;
    idCounterRef.current += 1;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2600);
  }

  function loadPublishedCases() {
    setPublishedCasesLoading(true);
    fetch("/api/admin/published-cases", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load cases."))))
      .then((payload: { cases?: PublishedCaseAdminItem[] }) => {
        setPublishedCases(payload.cases || []);
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "公开案例读取失败");
      })
      .finally(() => setPublishedCasesLoading(false));
  }

  function searchPublishableCaseProjects() {
    const projectId = caseProjectSearch.projectId.trim();
    const userEmail = caseProjectSearch.userEmail.trim();
    if (!projectId && !userEmail) {
      pushToast("请输入项目 ID 或邮箱账号");
      return;
    }
    const params = new URLSearchParams();
    if (projectId) {
      params.set("projectId", projectId);
    }
    if (userEmail) {
      params.set("userEmail", userEmail);
    }
    setCaseProjectSearchLoading(true);
    fetch(`/api/admin/published-cases/projects?${params.toString()}`, { cache: "no-store" })
      .then((response) =>
        response.ok
          ? response.json()
          : response.json().then((payload) => Promise.reject(new Error(payload.error || "项目搜索失败"))),
      )
      .then((payload: { projects?: PublishableCaseProjectItem[] }) => {
        setCaseProjectResults(payload.projects || []);
        if (!payload.projects?.length) {
          pushToast("没有找到可发布项目");
        }
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "项目搜索失败");
      })
      .finally(() => setCaseProjectSearchLoading(false));
  }

  function selectPublishableCaseProject(item: PublishableCaseProjectItem) {
    setPublishCaseForm((prev) => ({
      ...prev,
      projectId: item.projectId,
      userEmail: item.userEmail,
      outputType: item.outputType,
      title: prev.title || item.title,
    }));
    pushToast("已填入发布表单");
  }

  useEffect(() => {
    if (activeTab !== "cases") {
      return undefined;
    }
    const timer = window.setTimeout(() => loadPublishedCases(), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab]);

  function loadOpsLogs(overrideFilters?: typeof opsLogFilters) {
    setOpsLogsLoading(true);
    const activeFilters = overrideFilters ?? opsLogFilters;
    const params = new URLSearchParams();
    params.set("limit", activeFilters.limit);
    params.set("page", String(activeFilters.page));
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (key === "scope" || key === "onlyErrors" || key === "onlySlow" || key === "criticalOnly") {
        return;
      }
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    });
    if (activeFilters.onlyErrors) {
      params.set("onlyErrors", "1");
    }
    if (activeFilters.criticalOnly) {
      params.set("criticalOnly", "1");
    }
    if (activeFilters.onlySlow) {
      params.set("onlySlow", "1");
    }
    fetch(`/api/admin/logs?${params.toString()}`, { cache: "no-store" })
      .then((response) =>
        response.ok
          ? response.json()
          : response.json().then((payload) => Promise.reject(new Error(payload.error || "线上日志读取失败"))),
      )
      .then((payload: { logs?: OpsEventAdminLog[]; summary?: OpsEventAdminSummary | null; traces?: OpsTraceSummary[] }) => {
        setOpsLogs(payload.logs || []);
        setOpsLogSummary(payload.summary || null);
        setOpsTraceSummaries(payload.traces || []);
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "线上日志读取失败");
      })
      .finally(() => setOpsLogsLoading(false));
  }

  useEffect(() => {
    if (activeTab === "logs") {
      loadOpsLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "logs") {
      loadOpsLogs();
    }
  }, [activeTab, opsLogFilters.page, opsLogFilters.limit]);

  function publishPublicCaseFromProject() {
    if (!publishCaseForm.projectId.trim()) {
      pushToast("请填写 projectId，或先用邮箱搜索后选择项目");
      return;
    }
    setPublishingCase(true);
    fetch("/api/admin/published-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publishCaseForm),
    })
      .then((response) =>
        response.ok
          ? response.json()
          : response.json().then((payload) => Promise.reject(new Error(payload.error || "发布失败"))),
      )
      .then(() => {
        pushToast("已发布为公开案例");
        setPublishCaseForm((prev) => ({ ...prev, projectId: "", title: "" }));
        loadPublishedCases();
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "发布失败");
      })
      .finally(() => setPublishingCase(false));
  }

  function updatePublishedCase(item: PublishedCaseAdminItem, updates: Partial<Pick<PublishedCaseAdminItem, "status" | "featured" | "sortOrder">>) {
    fetch(`/api/admin/published-cases/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((response) =>
        response.ok
          ? response.json()
          : response.json().then((payload) => Promise.reject(new Error(payload.error || "更新失败"))),
      )
      .then(() => {
        pushToast("公开案例已更新");
        loadPublishedCases();
      })
      .catch((error) => {
        pushToast(error instanceof Error ? error.message : "公开案例更新失败");
      });
  }

  function setQuery(updates: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function askConfirm(title: string, description: string, confirmText: string, onConfirm: () => void) {
    setConfirmDialog({
      open: true,
      title,
      description,
      confirmText,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));
      },
    });
  }

  function setTab(tab: AdminMainTab) {
    setQuery({ tab, page: "1" });
  }

  function openUserDetail(userId: string) {
    const lookupKey = userId.trim();
    const realLookupValue = userMap.get(lookupKey)?.email || lookupKey;
    router.push(`/admin/users/${encodeURIComponent(realLookupValue)}`);
  }

  function openProjectDetail(projectId: string) {
    router.push(`/admin/projects/${projectId}`);
  }

  function jumpToLogsWithError(errorId: string) {
    setQuery({ tab: "logs", l_error: errorId, l_page: "1" });
  }

  function copyText(value: string, label: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => pushToast(`已复制 ${label}`))
      .catch(() => pushToast(`复制 ${label} 失败`));
  }

  function runSort(
    sortKeyName: string,
    orderKeyName: string,
    pageKeyName: string,
    currentSort: string,
    currentOrder: SortOrder,
    nextSort: string,
  ) {
    const nextOrder = currentSort === nextSort && currentOrder === "desc" ? "asc" : "desc";
    setQuery({
      [sortKeyName]: nextSort,
      [orderKeyName]: nextOrder,
      [pageKeyName]: "1",
    });
  }

  function handleGlobalResultClick(item: ReturnType<typeof searchAdminGlobal>[number]) {
    if (item.kind === "user") {
      openUserDetail(item.refId);
      return;
    }
    if (item.kind === "project") {
      openProjectDetail(item.refId);
      return;
    }
    if (item.kind === "order") {
      setSelectedOrderId(item.refId);
      return;
    }
    if (item.kind === "log") {
      setSelectedLogId(item.refId);
      return;
    }
    if (item.kind === "error") {
      jumpToLogsWithError(item.refId);
    }
  }

  const ovRange = (searchParams.get("ov_range") as TimeRangeKey) || "7d";
  const ovStart = searchParams.get("ov_start");
  const ovEnd = searchParams.get("ov_end");
  const overviewLogs = data.logs.filter((item) => inTimeRange(item.createdAt, ovRange, ovStart, ovEnd));
  const todayUserCount = data.users.filter((item) => inTimeRange(item.registeredAt, "today")).length;
  const todayProjectCount = data.projects.filter((item) => inTimeRange(item.createdAt, "today")).length;
  const generatingCount = data.projects.filter((item) => item.status === "generating").length;
  const failedTodayCount = data.projects.filter((item) => item.status === "failed" && inTimeRange(item.updatedAt, "today"))
    .length;
  const llmLogs = overviewLogs.filter((item) => item.type === "LLM");
  const imageLogs = overviewLogs.filter((item) => item.type === "Image");
  const llmSuccess = llmLogs.length
    ? Math.round((llmLogs.filter((item) => item.status === "ok").length / llmLogs.length) * 100)
    : 100;
  const imageSuccess = imageLogs.length
    ? Math.round((imageLogs.filter((item) => item.status === "ok").length / imageLogs.length) * 100)
    : 100;
  const todayCreditsUsed = Math.abs(
    data.creditRecords
      .filter((item) => item.delta < 0 && inTimeRange(item.createdAt, "today"))
      .reduce((sum, item) => sum + item.delta, 0),
  );
  const paidOrders = data.orders.filter((item) => item.status === "paid");
  const paymentSuccessRate = data.orders.length ? Math.round((paidOrders.length / data.orders.length) * 100) : 100;
  const keyErrors = overviewLogs
    .filter((item) => item.status === "failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const funnel = [
    { id: "intent", label: "意图摘要", count: overviewLogs.filter((item) => item.action.includes("intent")).length, jump: { l_action: "intent_summary" } },
    { id: "draft", label: "文稿生成", count: overviewLogs.filter((item) => item.action.includes("draft")).length, jump: { l_type: "LLM" } },
    { id: "compile", label: "任务编译", count: overviewLogs.filter((item) => item.action.includes("compile")).length, jump: { l_action: "compile_tasks" } },
    { id: "image", label: "画面生成", count: overviewLogs.filter((item) => item.type === "Image").length, jump: { l_type: "Image" } },
    { id: "export", label: "导出", count: overviewLogs.filter((item) => item.type === "Export").length, jump: { l_type: "Export" } },
  ];

  const lRange = (searchParams.get("l_range") as TimeRangeKey) || "7d";
  const lStart = searchParams.get("l_start");
  const lEnd = searchParams.get("l_end");
  const lStatus = searchParams.get("l_status") || "";
  const lType = searchParams.get("l_type") || "";
  const lAction = searchParams.get("l_action") || "";
  const lUser = searchParams.get("l_user") || "";
  const lProject = searchParams.get("l_project") || "";
  const lError = searchParams.get("l_error") || "";
  const lSort = searchParams.get("l_sort") || "createdAt";
  const lOrder = (searchParams.get("l_order") as SortOrder) || "desc";
  const lPage = safeNumber(searchParams.get("l_page"), 1);
  const filteredLogs = useMemo(() => {
    const rows = data.logs.filter((item) => {
      if (!inTimeRange(item.createdAt, lRange, lStart, lEnd)) {
        return false;
      }
      if (lStatus && item.status !== lStatus) {
        return false;
      }
      if (lType && item.type !== lType) {
        return false;
      }
      if (lAction && !item.action.includes(lAction)) {
        return false;
      }
      if (!matchesUserEmailFilter(item.userId, lUser, userMap)) {
        return false;
      }
      if (lProject && item.projectId !== lProject) {
        return false;
      }
      if (lError && item.errorId !== lError) {
        return false;
      }
      return true;
    });
    return sortBy(rows, lSort as keyof MockLog, lOrder);
  }, [data.logs, lAction, lEnd, lError, lOrder, lProject, lRange, lSort, lStart, lStatus, lType, lUser, userMap]);
  const pagedLogs = paginate(filteredLogs, lPage);

  const pRange = (searchParams.get("p_range") as TimeRangeKey) || "30d";
  const pStart = searchParams.get("p_start");
  const pEnd = searchParams.get("p_end");
  const pType = searchParams.get("p_type") || "";
  const pStatus = searchParams.get("p_status") || "";
  const pStage = searchParams.get("p_stage") || "";
  const pText = searchParams.get("p_text") || "";
  const pImage = searchParams.get("p_image") || "";
  const pUser = searchParams.get("p_user") || "";
  const pSort = searchParams.get("p_sort") || "createdAt";
  const pOrder = (searchParams.get("p_order") as SortOrder) || "desc";
  const pPage = safeNumber(searchParams.get("p_page"), 1);
  const filteredProjects = useMemo(() => {
    const rows = data.projects.filter((item) => {
      if (!inTimeRange(item.createdAt, pRange, pStart, pEnd)) {
        return false;
      }
      if (pType && item.type !== pType) {
        return false;
      }
      if (pStatus && item.status !== pStatus) {
        return false;
      }
      if (pStage && item.stage !== pStage) {
        return false;
      }
      if (pText && item.textModel !== pText) {
        return false;
      }
      if (pImage && item.imageModel !== pImage) {
        return false;
      }
      if (!matchesUserEmailFilter(item.userId, pUser, userMap)) {
        return false;
      }
      return true;
    });
    return sortBy(rows, pSort as keyof MockProject, pOrder);
  }, [data.projects, pEnd, pImage, pOrder, pRange, pSort, pStage, pStart, pStatus, pText, pType, pUser, userMap]);
  const pagedProjects = paginate(filteredProjects, pPage);

  const uRange = (searchParams.get("u_range") as TimeRangeKey) || "30d";
  const uStart = searchParams.get("u_start");
  const uEnd = searchParams.get("u_end");
  const uSub = searchParams.get("u_sub") || "";
  const uStatus = searchParams.get("u_status") || "";
  const uCreditMin = safeNumber(searchParams.get("u_creditMin"), Number.NEGATIVE_INFINITY);
  const uCreditMax = safeNumber(searchParams.get("u_creditMax"), Number.POSITIVE_INFINITY);
  const uProjectsMin = safeNumber(searchParams.get("u_projects"), Number.NEGATIVE_INFINITY);
  const uActive = searchParams.get("u_active") || "";
  const uFailed = searchParams.get("u_failed") || "";
  const uSort = searchParams.get("u_sort") || "registeredAt";
  const uOrder = (searchParams.get("u_order") as SortOrder) || "desc";
  const uPage = safeNumber(searchParams.get("u_page"), 1);
  const filteredUsers = useMemo(() => {
    const nowTs = new Date().getTime();
    const rows = data.users.filter((item) => {
      if (!inTimeRange(item.registeredAt, uRange, uStart, uEnd)) {
        return false;
      }
      if (uSub && item.subscriptionStatus !== uSub) {
        return false;
      }
      if (uStatus && item.status !== uStatus) {
        return false;
      }
      if (!(item.creditBalance >= uCreditMin && item.creditBalance <= uCreditMax)) {
        return false;
      }
      if (item.projectCount < uProjectsMin) {
        return false;
      }
      if (uActive) {
        const activeDays = safeNumber(uActive, 9999);
        const recentMs = new Date(item.recentActiveAt).getTime();
        if (nowTs - recentMs > activeDays * 24 * 60 * 60 * 1000) {
          return false;
        }
      }
      if (uFailed === "yes" && item.failedProjectCount <= 0) {
        return false;
      }
      return true;
    });
    return sortBy(rows, uSort as keyof MockUser, uOrder);
  }, [data.users, uActive, uCreditMax, uCreditMin, uEnd, uFailed, uOrder, uProjectsMin, uRange, uSort, uStart, uStatus, uSub]);
  const pagedUsers = paginate(filteredUsers, uPage);

  const bUser = searchParams.get("b_user") || "";
  const bStatus = searchParams.get("b_status") || "";
  const bPage = safeNumber(searchParams.get("b_page"), 1);
  const billingView = searchParams.get("b_view") || "credits";
  const filteredCredits = data.creditRecords.filter((item) => matchesUserEmailFilter(item.userId, bUser, userMap));
  const filteredOrders = data.orders.filter((item) => matchesUserEmailFilter(item.userId, bUser, userMap) && (!bStatus || item.status === bStatus));
  const filteredSubscriptions = data.subscriptions.filter((item) => matchesUserEmailFilter(item.userId, bUser, userMap));
  const filteredWebhooks = data.webhookLogs.filter((item) => !bStatus || item.status === bStatus);
  const filteredAnomalies = data.billingAnomalies.filter((item) => matchesUserEmailFilter(item.userId, bUser, userMap) && (!bStatus || item.status === bStatus));
  const pagedCredits = paginate(filteredCredits, bPage);
  const pagedOrders = paginate(filteredOrders, bPage);
  const pagedSubs = paginate(filteredSubscriptions, bPage);
  const pagedWebhooks = paginate(filteredWebhooks, bPage);
  const pagedAnomalies = paginate(filteredAnomalies, bPage);

  const tStatus = searchParams.get("t_status") || "";
  const tPriority = searchParams.get("t_priority") || "";
  const tType = searchParams.get("t_type") || "";
  const tUser = searchParams.get("t_user") || "";
  const tProject = searchParams.get("t_project") || "";
  const tAssignee = searchParams.get("t_assignee") || "";
  const tPage = safeNumber(searchParams.get("t_page"), 1);
  const filteredTickets = data.tickets.filter((item) => {
    if (tStatus && item.status !== tStatus) {
      return false;
    }
    if (tPriority && item.priority !== tPriority) {
      return false;
    }
    if (tType && item.type !== tType) {
      return false;
    }
    if (!matchesUserEmailFilter(item.userId, tUser, userMap)) {
      return false;
    }
    if (tProject && item.projectId !== tProject) {
      return false;
    }
    if (tAssignee && item.assignee !== tAssignee) {
      return false;
    }
    return true;
  });
  const pagedTickets = paginate(filteredTickets, tPage);

  const cStatus = searchParams.get("c_status") || "";
  const cPage = safeNumber(searchParams.get("c_page"), 1);
  const filteredCases = data.cases
    .filter((item) => (cStatus ? (cStatus === "online" ? item.online : !item.online) : true))
    .sort((a, b) => a.order - b.order);
  const pagedCases = paginate(filteredCases, cPage);

  function retryFromLog(log: MockLog) {
    askConfirm(
      "确认重试生成？",
      `将基于 requestId=${log.requestId} 触发重试（mock）。`,
      "确认重试",
      () => {
        setData((prev) => ({
          ...prev,
          logs: prev.logs.map((item) =>
            item.id === log.id
              ? { ...item, status: "processing", handled: false, errorSummary: undefined, errorId: undefined }
              : item,
          ),
        }));
        pushToast("已提交重试任务（mock）");
      },
    );
  }

  function refundFromLog(log: MockLog) {
    if (!log.userId) {
      pushToast("该日志未关联用户，无法退还积分");
      return;
    }
    askConfirm("确认退还积分？", `将按日志 ${log.id} 退还 ${Math.abs(log.creditDelta)} 积分。`, "确认退还", () => {
      setData((prev) => {
        const user = prev.users.find((item) => item.id === log.userId);
        const amount = Math.abs(log.creditDelta || 0);
        const nextBalance = (user?.creditBalance ?? 0) + amount;
        const creditRecord: MockCreditRecord = {
          id: `cr-${idCounterRef.current}`,
          userId: log.userId || "unknown",
          projectId: log.projectId,
          type: "refund",
          delta: amount,
          balanceAfter: nextBalance,
          reason: `Refund by log ${log.id}`,
          createdAt: new Date().toISOString(),
        };
        idCounterRef.current += 1;
        return {
          ...prev,
          users: prev.users.map((item) =>
            item.id === log.userId ? { ...item, creditBalance: item.creditBalance + amount } : item,
          ),
          logs: prev.logs.map((item) => (item.id === log.id ? { ...item, handled: true } : item)),
          creditRecords: [creditRecord, ...prev.creditRecords],
        };
      });
      pushToast("积分已退还并写入流水（mock）");
    });
  }

  function markLogHandled(logId: string) {
    setData((prev) => ({
      ...prev,
      logs: prev.logs.map((item) => (item.id === logId ? { ...item, handled: true, status: item.status === "failed" ? "handled" : item.status } : item)),
    }));
    pushToast("日志已标记为已处理");
  }

  function createTicketFromLog(log: MockLog) {
    const ticket: MockTicket = {
      id: `tk-${idCounterRef.current}`,
      title: `来自日志 ${log.id} 的故障排查`,
      content: log.errorSummary || `${log.type}/${log.action} 需要人工排查`,
      userId: log.userId,
      projectId: log.projectId,
      logId: log.id,
      status: "pending",
      priority: "P1",
      type: "bug",
      assignee: "ops-li",
      internalNotes: ["由日志详情创建"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    idCounterRef.current += 1;
    setData((prev) => ({ ...prev, tickets: [ticket, ...prev.tickets] }));
    pushToast("已创建反馈工单（mock）");
  }

  function closeTicket(ticketId: string) {
    askConfirm("确认关闭工单？", "关闭后仍可在工单详情中查看历史处理记录。", "确认关闭", () => {
      setData((prev) => ({
        ...prev,
        tickets: prev.tickets.map((item) =>
          item.id === ticketId ? { ...item, status: "closed", updatedAt: new Date().toISOString() } : item,
        ),
      }));
      pushToast("工单已关闭");
    });
  }

  function deleteCase(caseItem: MockCaseConfig) {
    askConfirm("确认删除案例？", `将删除案例「${caseItem.title}」并从首页案例位移除。`, "确认删除", () => {
      setData((prev) => ({ ...prev, cases: prev.cases.filter((item) => item.id !== caseItem.id) }));
      pushToast("案例已删除");
    });
  }

  function toggleCaseOnline(caseId: string) {
    setData((prev) => ({
      ...prev,
      cases: prev.cases.map((item) => (item.id === caseId ? { ...item, online: !item.online } : item)),
    }));
    pushToast("案例状态已更新");
  }

  function moveCase(caseId: string, direction: "up" | "down") {
    setData((prev) => {
      const rows = [...prev.cases].sort((a, b) => a.order - b.order);
      const index = rows.findIndex((item) => item.id === caseId);
      if (index < 0) {
        return prev;
      }
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= rows.length) {
        return prev;
      }
      const temp = rows[index].order;
      rows[index].order = rows[target].order;
      rows[target].order = temp;
      return { ...prev, cases: rows };
    });
    pushToast("案例排序已调整");
  }

  function toggleSystemSwitch(key: keyof AdminConsoleData["settings"]["switches"]) {
    const nextValue = !data.settings.switches[key];
    askConfirm("确认修改系统开关？", `将把 ${key} 设置为 ${nextValue ? "开启" : "关闭"}。`, "确认修改", () => {
      setData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          switches: {
            ...prev.settings.switches,
            [key]: nextValue,
          },
        },
      }));
      pushToast(`系统开关 ${key} 已更新`);
    });
  }

  function submitAdjustCredit() {
    const amount = Math.max(0, Number(adjustCredit.amount || "0"));
    if (!adjustCredit.userId || !amount || !adjustCredit.reason.trim()) {
      pushToast("请填写完整的积分调整参数");
      return;
    }
    const delta = adjustCredit.adjustmentType === "increase" ? amount : -amount;
    askConfirm("确认调整积分？", "该操作会写入积分流水，建议确认原因和关联项目。", "确认调整", () => {
      setData((prev) => {
        const user = prev.users.find((item) => item.id === adjustCredit.userId);
        const nextBalance = (user?.creditBalance ?? 0) + delta;
        const record: MockCreditRecord = {
          id: `cr-${idCounterRef.current}`,
          userId: adjustCredit.userId,
          projectId: adjustCredit.projectId || undefined,
          type: "adjustment",
          delta,
          balanceAfter: nextBalance,
          reason: adjustCredit.reason.trim(),
          createdAt: new Date().toISOString(),
        };
        idCounterRef.current += 1;
        return {
          ...prev,
          users: prev.users.map((item) =>
            item.id === adjustCredit.userId ? { ...item, creditBalance: item.creditBalance + delta } : item,
          ),
          creditRecords: [record, ...prev.creditRecords],
        };
      });
      pushToast(adjustCredit.notifyUser ? "积分调整成功，已通知用户（mock）" : "积分调整成功（mock）");
      setAdjustCredit({
        open: false,
        userId: "",
        adjustmentType: "increase",
        amount: "",
        reason: "",
        projectId: "",
        notifyUser: true,
      });
    });
  }

  function markAnomalyHandled(item: MockBillingAnomaly) {
    setData((prev) => ({
      ...prev,
      billingAnomalies: prev.billingAnomalies.map((row) => (row.id === item.id ? { ...row, status: "handled" } : row)),
    }));
    pushToast("账务异常已标记处理");
  }

  return (
    <AdminShell
      title="运营后台"
      description={adminDataLoading ? "正在加载真实运营数据..." : "真实数据后台，支持故障排查、对象定位和运营处理。"}
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3">
                <Search size={14} className="text-zinc-500" />
                <input
                  value={globalQ}
                  onChange={(event) => setQuery({ globalQ: event.target.value || null })}
                  placeholder="全局搜索 email / projectId / orderId / requestId / errorId"
                  className="w-full bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">点击结果可跳转详情页或打开 Drawer。</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <Filter size={13} />
              筛选条件已同步 URL，可直接复制链接给开发排查
            </div>
          </div>

          {globalQ ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              {globalResults.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {["用户", "项目", "订单", "日志", "错误"].map((group) => {
                    const items = globalResults.filter((row) => row.group === group);
                    if (!items.length) {
                      return null;
                    }
                    return (
                      <div key={group} className="rounded-lg border border-zinc-200 bg-white p-2">
                        <p className="text-xs font-medium text-zinc-500">{group}</p>
                        <div className="mt-1 space-y-1">
                          {items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleGlobalResultClick(item)}
                              className="block w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:border-zinc-200 hover:bg-zinc-50"
                            >
                              <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                              <p className="text-xs text-zinc-500">{item.subtitle}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-500">
                  搜索无结果，请检查标识符是否正确。
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === "overview" ? (
          <section className="space-y-4">
            <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-800">时间范围</p>
                <div className="inline-flex flex-wrap gap-2">
                  {[
                    { key: "today", label: "今天" },
                    { key: "7d", label: "近 7 天" },
                    { key: "30d", label: "近 30 天" },
                    { key: "custom", label: "自定义" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setQuery({ ov_range: item.key, ov_start: null, ov_end: null })}
                      className={`h-8 rounded-lg border px-3 text-xs ${
                        ovRange === item.key
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-600"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {ovRange === "custom" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={ovStart || ""}
                    onChange={(event) => setQuery({ ov_start: event.target.value || null })}
                    className="h-9 rounded-lg border border-zinc-300 px-3 text-sm"
                  />
                  <input
                    type="date"
                    value={ovEnd || ""}
                    onChange={(event) => setQuery({ ov_end: event.target.value || null })}
                    className="h-9 rounded-lg border border-zinc-300 px-3 text-sm"
                  />
                </div>
              ) : null}
            </article>

            <article className="grid gap-3 md:grid-cols-4">
              {[
                {
                  label: "今日新增用户",
                  value: todayUserCount,
                  click: () => setQuery({ tab: "users", u_range: "today", u_page: "1" }),
                },
                {
                  label: "今日项目数",
                  value: todayProjectCount,
                  click: () => setQuery({ tab: "projects", p_range: "today", p_page: "1" }),
                },
                {
                  label: "当前进行中项目",
                  value: generatingCount,
                  click: () => setQuery({ tab: "projects", p_status: "generating", p_page: "1" }),
                },
                {
                  label: "今日失败项目",
                  value: failedTodayCount,
                  click: () => setQuery({ tab: "logs", l_status: "failed", l_range: "today", l_page: "1" }),
                },
                {
                  label: "LLM 成功率",
                  value: `${llmSuccess}%`,
                  click: () => setQuery({ tab: "logs", l_type: "LLM", l_page: "1" }),
                },
                {
                  label: "Image 成功率",
                  value: `${imageSuccess}%`,
                  click: () => setQuery({ tab: "logs", l_type: "Image", l_page: "1" }),
                },
                {
                  label: "今日消耗积分",
                  value: todayCreditsUsed,
                  click: () => setQuery({ tab: "billing", b_view: "credits", b_page: "1" }),
                },
                {
                  label: "支付成功率",
                  value: `${paymentSuccessRate}%`,
                  click: () => setQuery({ tab: "billing", b_view: "orders", b_status: "paid", b_page: "1" }),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.click}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50"
                >
                  <p className="text-xs text-zinc-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-900">{item.value}</p>
                </button>
              ))}
            </article>

            <article className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-zinc-900">最近关键异常</p>
                <div className="mt-3 space-y-2">
                  {keyErrors.length ? (
                    keyErrors.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedLogId(item.id)}
                        className="block w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50"
                      >
                        <p className="text-sm font-medium text-zinc-900">{item.errorSummary || `${item.type}/${item.action}`}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDateTime(item.createdAt)} · {item.errorId || "-"} · {item.requestId}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">
                      当前时间范围内无关键异常。
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-zinc-900">生成链路漏斗</p>
                <div className="mt-3 space-y-2">
                  {funnel.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setQuery({ tab: "logs", ...node.jump, l_page: "1" })}
                      className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                    >
                      <span className="text-sm text-zinc-700">{node.label}</span>
                      <span className="text-sm font-semibold text-zinc-900">{node.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === "logs" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">故障与日志</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select value={lRange} onChange={(event) => setQuery({ l_range: event.target.value, l_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="today">今天</option>
                <option value="7d">近7天</option>
                <option value="30d">近30天</option>
                <option value="custom">自定义</option>
              </select>
              <select value={lStatus} onChange={(event) => setQuery({ l_status: event.target.value || null, l_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">状态（全部）</option>
                <option value="ok">ok</option>
                <option value="failed">failed</option>
                <option value="processing">processing</option>
                <option value="handled">handled</option>
              </select>
              <select value={lType} onChange={(event) => setQuery({ l_type: event.target.value || null, l_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">类型（全部）</option>
                {Array.from(new Set(data.logs.map((item) => item.type))).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input value={lAction} onChange={(event) => setQuery({ l_action: event.target.value || null, l_page: "1" })} placeholder="动作 action" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={lUser} onChange={(event) => setQuery({ l_user: event.target.value || null, l_page: "1" })} placeholder="user email" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={lProject} onChange={(event) => setQuery({ l_project: event.target.value || null, l_page: "1" })} placeholder="projectId" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={lError} onChange={(event) => setQuery({ l_error: event.target.value || null, l_page: "1" })} placeholder="errorId / errorCode" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <button type="button" onClick={() => setQuery({ l_status: null, l_type: null, l_action: null, l_user: null, l_project: null, l_error: null, l_page: "1" })} className="h-9 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100">
                清空筛选
              </button>
            </div>
            {lRange === "custom" ? (
              <div className="mt-2 flex gap-2">
                <input type="date" value={lStart || ""} onChange={(event) => setQuery({ l_start: event.target.value || null, l_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
                <input type="date" value={lEnd || ""} onChange={(event) => setQuery({ l_end: event.target.value || null, l_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-red-100 bg-red-50/40 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">线上实时日志（ops_events）</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    自动采集浏览器错误、未处理 Promise、失败 API 请求，以及服务端写入的 ops events。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadOpsLogs()}
                  disabled={opsLogsLoading}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {opsLogsLoading ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  刷新线上日志
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "critical", label: "严重错误" },
                    { id: "all", label: "全部错误" },
                    { id: "summary", label: "Summary" },
                    { id: "provider", label: "Provider" },
                    { id: "credits", label: "Credits" },
                    { id: "refund", label: "Refund" },
                    { id: "ui", label: "UI" },
                  ] as Array<{ id: OpsLogScopePreset; label: string }>
                ).map((preset) => {
                  const active = opsLogFilters.scope === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyOpsLogScope(preset.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                <label className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={opsLogFilters.onlySlow}
                    onChange={(event) =>
                      setOpsLogFilters((prev) => ({ ...prev, onlySlow: event.target.checked, page: 1 }))
                    }
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900"
                  />
                  slow only (30s+)
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdvancedOpsFilters((prev) => !prev)}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  {showAdvancedOpsFilters ? "收起高级筛选" : "高级筛选"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={opsLogFilters.userEmail}
                  onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, userEmail: event.target.value, page: 1 }))}
                  placeholder="user email"
                  className="h-9 min-w-[220px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
                <input
                  value={opsLogFilters.projectId}
                  onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, projectId: event.target.value, page: 1 }))}
                  placeholder="projectId"
                  className="h-9 min-w-[180px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
                <input
                  value={opsLogFilters.code}
                  onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, code: event.target.value, page: 1 }))}
                  placeholder="error code"
                  className="h-9 min-w-[180px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
                <input
                  type="datetime-local"
                  value={opsLogFilters.from}
                  onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, from: event.target.value, page: 1 }))}
                  className="h-9 min-w-[220px] rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
                <input
                  type="datetime-local"
                  value={opsLogFilters.to}
                  onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, to: event.target.value, page: 1 }))}
                  className="h-9 min-w-[220px] rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
              </div>
              {showAdvancedOpsFilters ? (
                <div className="mt-2 grid gap-2 md:grid-cols-6">
                  <select
                    value={opsLogFilters.status}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
                  >
                    <option value="">状态（全部）</option>
                    <option value="error">error</option>
                    <option value="info">info</option>
                    <option value="ok">ok</option>
                  </select>
                  <input
                    value={opsLogFilters.category}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, category: event.target.value, page: 1 }))}
                    placeholder="category"
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                  />
                  <input
                    value={opsLogFilters.action}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, action: event.target.value, page: 1 }))}
                    placeholder="action"
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                  />
                  <input
                    value={opsLogFilters.runId}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, runId: event.target.value, page: 1 }))}
                    placeholder="runId"
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                  />
                  <input
                    value={opsLogFilters.jobId}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, jobId: event.target.value, page: 1 }))}
                    placeholder="jobId"
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                  />
                  <input
                    value={opsLogFilters.taskId}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, taskId: event.target.value, page: 1 }))}
                    placeholder="taskId"
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                  />
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">
                  默认只展示严重错误上报。充值失败、语言模型失败、图片生成失败会优先进入这个列表。
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetOpsLogFilters}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-100"
                  >
                    重置筛选
                  </button>
                  <button
                    type="button"
                    onClick={() => loadOpsLogs()}
                    disabled={opsLogsLoading}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    应用筛选
                  </button>
                  <select
                    value={opsLogFilters.limit}
                    onChange={(event) => setOpsLogFilters((prev) => ({ ...prev, limit: event.target.value, page: 1 }))}
                    className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
                  >
                    <option value="50">50</option>
                    <option value="120">120</option>
                    <option value="200">200</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (opsLogFilters.page > 1) {
                        setOpsLogFilters((prev) => ({ ...prev, page: prev.page - 1 }));
                      }
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={opsLogsLoading || opsLogFilters.page <= 1}
                  >
                    上一页
                  </button>
                  <span className="text-xs text-zinc-500">第 {opsLogFilters.page} 页</span>
                  <button
                    type="button"
                    onClick={() => setOpsLogFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={opsLogsLoading || displayOpsLogs.length < Number(opsLogFilters.limit)}
                  >
                    下一页
                  </button>
                </div>
              </div>
              {opsLogSummary?.email ? (
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">User</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">{opsLogSummary.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">{opsLogSummary.userId || "-"}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Membership</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">{opsLogSummary.isMember ? "member" : "non-member"}</p>
                    <p className="mt-1 text-xs text-zinc-500">{opsLogSummary.planName || opsLogSummary.planType || "-"}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Credits</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">
                      {typeof opsLogSummary.currentCredits === "number" ? opsLogSummary.currentCredits : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Last 24h</p>
                    <p className="mt-2 text-sm text-zinc-900">runs: {opsLogSummary.generationCount24h ?? 0}</p>
                    <p className="mt-1 text-sm text-zinc-900">failed: {opsLogSummary.failureCount24h ?? 0}</p>
                    <p className="mt-1 text-sm text-zinc-900">refunds: {opsLogSummary.refundCount24h ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Latest Error</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">{opsLogSummary.latestError?.code || "-"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{opsLogSummary.latestError?.message || "-"}</p>
                  </div>
                </div>
              ) : null}
              {opsLogFilters.scope === "summary" && opsTraceSummaries.length ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-200 px-3 py-2">
                    <p className="text-sm font-medium text-zinc-900">Trace / Run Summary</p>
                    <p className="mt-1 text-xs text-zinc-500">先看链路摘要，再点击切到该 run/job 的时间线。</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1320px] w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-600">
                        <tr>
                          <th className="px-3 py-2 font-medium">创建时间</th>
                          <th className="px-3 py-2 font-medium">项目ID</th>
                          <th className="px-3 py-2 font-medium">用户邮箱</th>
                          <th className="px-3 py-2 font-medium">runId / jobId</th>
                          <th className="px-3 py-2 font-medium">最终状态</th>
                          <th className="px-3 py-2 font-medium">失败步骤</th>
                          <th className="px-3 py-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opsTraceSummaries.map((trace) => (
                          <tr key={trace.traceId} className="border-t border-zinc-200 align-top">
                            <td className="px-3 py-2 text-zinc-600">{formatDateTime(trace.createdAt)}</td>
                            <td className="px-3 py-2 text-zinc-700">{trace.projectId || "-"}</td>
                            <td className="px-3 py-2 text-zinc-700">{trace.userEmail || "-"}</td>
                            <td className="px-3 py-2">
                              <p className="font-mono text-[11px] text-zinc-700">{trace.runId || "-"}</p>
                              <p className="mt-1 font-mono text-[11px] text-zinc-500">{trace.jobId || "-"}</p>
                            </td>
                            <td className="px-3 py-2 text-zinc-700">{trace.finalJobStatus || "-"}</td>
                            <td className="px-3 py-2 text-zinc-700">
                              <p>{trace.failedStep || "-"}</p>
                              <p className="mt-1 text-zinc-500">{trace.errorCode || "-"}</p>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextFilters = {
                                    ...opsLogFilters,
                                    runId: trace.runId || opsLogFilters.runId,
                                    jobId: trace.jobId || opsLogFilters.jobId,
                                    projectId: trace.projectId || opsLogFilters.projectId,
                                    action: "",
                                    scope: "all" as OpsLogScopePreset,
                                    page: 1,
                                  };
                                  setOpsLogFilters(nextFilters);
                                  loadOpsLogs(nextFilters);
                                }}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                查看时间线
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-[1480px] w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">时间</th>
                      <th className="px-3 py-2 font-medium">动作</th>
                      <th className="px-3 py-2 font-medium">项目ID</th>
                      <th className="px-3 py-2 font-medium">用户邮箱</th>
                      <th className="px-3 py-2 font-medium">错误码</th>
                      <th className="px-3 py-2 font-medium">消息</th>
                      <th className="px-3 py-2 font-medium">runId / jobId / taskId</th>
                      <th className="px-3 py-2 font-medium">耗时</th>
                      <th className="px-3 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayOpsLogs.length ? (
                      displayOpsLogs.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200 align-top">
                          <td className="px-3 py-2 text-zinc-600">{formatDateTime(item.createdAt)}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-zinc-900">{item.action}</p>
                            <p className="mt-0.5 text-zinc-500">{item.category}</p>
                            {item.stage ? <p className="mt-0.5 text-zinc-400">{item.stage}</p> : null}
                          </td>
                          <td className="px-3 py-2 text-zinc-700">{item.projectId || "-"}</td>
                          <td className="px-3 py-2 text-zinc-700">{item.userEmail || "-"}</td>
                          <td className="px-3 py-2 text-zinc-700">{item.code || "-"}</td>
                          <td className="max-w-[360px] px-3 py-2 text-zinc-700">
                            <p className="line-clamp-3">{item.message || "-"}</p>
                            <p className="mt-1 text-zinc-400">{item.source || ""}</p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-mono text-[11px] text-zinc-700">{item.runId || "-"}</p>
                            <p className="mt-1 font-mono text-[11px] text-zinc-500">{item.jobId || "-"}</p>
                            <p className="mt-1 font-mono text-[11px] text-zinc-400">{item.taskId || "-"}</p>
                          </td>
                          <td className="px-3 py-2 text-zinc-700">
                            {typeof item.durationMs === "number" ? `${item.durationMs} ms` : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOpsEventId(item.id)}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                查看详情
                              </button>
                              <button
                                type="button"
                                onClick={() => copyText(JSON.stringify(item, null, 2), "线上日志")}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                复制详情
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-zinc-500">
                          {opsLogsLoading ? "正在读取线上日志..." : "当前筛选下没有线上日志。"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-[1200px] w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    {[
                      { key: "createdAt", label: "时间" },
                      { key: "userId", label: "用户" },
                      { key: "projectId", label: "项目" },
                      { key: "type", label: "类型" },
                      { key: "action", label: "动作" },
                      { key: "status", label: "状态" },
                      { key: "durationMs", label: "耗时" },
                      { key: "creditDelta", label: "积分变化" },
                      { key: "errorSummary", label: "错误摘要" },
                    ].map((item) => (
                      <th key={item.key} className="px-3 py-2 font-medium">
                        <button type="button" onClick={() => runSort("l_sort", "l_order", "l_page", lSort, lOrder, item.key)} className="inline-flex items-center gap-1 hover:text-zinc-900">
                          {item.label}
                          <ArrowDownUp size={12} />
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.pageItems.length ? (
                    pagedLogs.pageItems.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-200 align-top">
                        <td className="px-3 py-2 text-zinc-700">{formatDateTime(item.createdAt)}</td>
                        <td className="px-3 py-2">
                          {item.userId ? (
                            <button type="button" onClick={() => openUserDetail(item.userId || "")} className="text-zinc-900 underline underline-offset-2">
                              {userMap.get(item.userId || "")?.email || item.userId}
                            </button>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {item.projectId ? (
                            <button type="button" onClick={() => openProjectDetail(item.projectId || "")} className="text-zinc-900 underline underline-offset-2">
                              {item.projectId}
                            </button>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{item.type}</td>
                        <td className="px-3 py-2">{item.action}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{item.status}</span>
                        </td>
                        <td className="px-3 py-2">{item.durationMs}ms</td>
                        <td className={`px-3 py-2 ${item.creditDelta < 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {item.creditDelta > 0 ? `+${item.creditDelta}` : item.creditDelta}
                        </td>
                        <td className="px-3 py-2">
                          {item.errorSummary ? (
                            <button type="button" onClick={() => setSelectedLogId(item.id)} className="text-left text-red-700 underline underline-offset-2">
                              {item.errorSummary}
                            </button>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                          {item.errorId ? (
                            <button type="button" onClick={() => jumpToLogsWithError(item.errorId || "")} className="mt-1 block text-xs text-zinc-500 underline underline-offset-2">
                              {item.errorId}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => setSelectedLogId(item.id)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                              查看详情
                            </button>
                            <button type="button" onClick={() => copyText(item.requestId, "requestId")} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                              复制 requestId
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-sm text-zinc-500">
                        当前筛选下没有日志数据。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedLogs.page} totalPages={pagedLogs.totalPages} total={pagedLogs.total} onPageChange={(next) => setQuery({ l_page: String(next) })} />
          </section>
        ) : null}

        {activeTab === "projects" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">项目管理</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select value={pRange} onChange={(event) => setQuery({ p_range: event.target.value, p_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="today">今天</option>
                <option value="7d">近7天</option>
                <option value="30d">近30天</option>
                <option value="custom">自定义</option>
              </select>
              <select value={pType} onChange={(event) => setQuery({ p_type: event.target.value || null, p_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">项目类型</option>
                <option value="poster">poster</option>
                <option value="ppt">ppt</option>
                <option value="video">video</option>
              </select>
              <select value={pStatus} onChange={(event) => setQuery({ p_status: event.target.value || null, p_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">项目状态</option>
                <option value="draft">draft</option>
                <option value="generating">generating</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
              </select>
              <input value={pStage} onChange={(event) => setQuery({ p_stage: event.target.value || null, p_page: "1" })} placeholder="当前阶段" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={pText} onChange={(event) => setQuery({ p_text: event.target.value || null, p_page: "1" })} placeholder="文本模型" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={pImage} onChange={(event) => setQuery({ p_image: event.target.value || null, p_page: "1" })} placeholder="图片模型" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={pUser} onChange={(event) => setQuery({ p_user: event.target.value || null, p_page: "1" })} placeholder="user email" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <button type="button" onClick={() => setQuery({ p_type: null, p_status: null, p_stage: null, p_text: null, p_image: null, p_user: null, p_page: "1" })} className="h-9 rounded-lg border border-zinc-300 text-sm hover:bg-zinc-100">
                清空筛选
              </button>
            </div>
            {pRange === "custom" ? (
              <div className="mt-2 flex gap-2">
                <input type="date" value={pStart || ""} onChange={(event) => setQuery({ p_start: event.target.value || null, p_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
                <input type="date" value={pEnd || ""} onChange={(event) => setQuery({ p_end: event.target.value || null, p_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-[1200px] w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    {[
                      { key: "id", label: "projectId" },
                      { key: "userId", label: "用户" },
                      { key: "type", label: "类型" },
                      { key: "topic", label: "主题" },
                      { key: "status", label: "状态" },
                      { key: "stage", label: "当前阶段" },
                      { key: "textModel", label: "模型" },
                      { key: "consumedCredits", label: "消耗积分" },
                      { key: "createdAt", label: "创建时间" },
                    ].map((item) => (
                      <th key={item.key} className="px-3 py-2 font-medium">
                        <button type="button" onClick={() => runSort("p_sort", "p_order", "p_page", pSort, pOrder, item.key)} className="inline-flex items-center gap-1 hover:text-zinc-900">
                          {item.label}
                          <ArrowDownUp size={12} />
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProjects.pageItems.length ? (
                    pagedProjects.pageItems.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-200 align-top">
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => openProjectDetail(item.id)} className="text-zinc-900 underline underline-offset-2">
                            {item.id}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => openUserDetail(item.userId)} className="text-zinc-900 underline underline-offset-2">
                            {userMap.get(item.userId)?.email || item.userId}
                          </button>
                        </td>
                        <td className="px-3 py-2">{item.type}</td>
                        <td className="max-w-[260px] px-3 py-2 text-zinc-700">
                          <p className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                            {getProjectInputText(item)}
                          </p>
                          {shouldShowProjectInputButton(item) ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedProjectInput({
                                  projectId: item.id,
                                  title: item.topic,
                                  input: getProjectInputText(item),
                                })
                              }
                              className="mt-1 text-xs font-medium text-zinc-900 underline underline-offset-2"
                            >
                              查看原文
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{item.status}</span>
                        </td>
                        <td className="px-3 py-2">{item.stage}</td>
                        <td className="px-3 py-2">
                          <p>{item.textModel}</p>
                          <p className="text-xs text-zinc-500">{item.imageModel}</p>
                        </td>
                        <td className="px-3 py-2">{item.consumedCredits}</td>
                        <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => openProjectDetail(item.id)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                              项目详情
                            </button>
                            <button type="button" onClick={() => setQuery({ tab: "logs", l_project: item.id, l_page: "1" })} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                              查看日志
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-sm text-zinc-500">
                        当前筛选下没有项目数据。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedProjects.page} totalPages={pagedProjects.totalPages} total={pagedProjects.total} onPageChange={(next) => setQuery({ p_page: String(next) })} />
          </section>
        ) : null}

        {activeTab === "users" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">用户管理</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select value={uRange} onChange={(event) => setQuery({ u_range: event.target.value, u_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="today">今日注册</option>
                <option value="7d">近7天注册</option>
                <option value="30d">近30天注册</option>
                <option value="custom">自定义</option>
              </select>
              <select value={uSub} onChange={(event) => setQuery({ u_sub: event.target.value || null, u_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">订阅状态</option>
                <option value="free">free</option>
                <option value="trial">trial</option>
                <option value="active">active</option>
                <option value="past_due">past_due</option>
                <option value="expired">expired</option>
              </select>
              <select value={uStatus} onChange={(event) => setQuery({ u_status: event.target.value || null, u_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">用户状态</option>
                <option value="active">active</option>
                <option value="restricted">restricted</option>
                <option value="frozen">frozen</option>
              </select>
              <input value={searchParams.get("u_creditMin") || ""} onChange={(event) => setQuery({ u_creditMin: event.target.value || null, u_page: "1" })} placeholder="最低积分" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={searchParams.get("u_creditMax") || ""} onChange={(event) => setQuery({ u_creditMax: event.target.value || null, u_page: "1" })} placeholder="最高积分" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={searchParams.get("u_projects") || ""} onChange={(event) => setQuery({ u_projects: event.target.value || null, u_page: "1" })} placeholder="项目数 >= n" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={uActive} onChange={(event) => setQuery({ u_active: event.target.value || null, u_page: "1" })} placeholder="最近活跃（天）" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <select value={uFailed} onChange={(event) => setQuery({ u_failed: event.target.value || null, u_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">失败项目</option>
                <option value="yes">仅有失败项目</option>
              </select>
            </div>
            {uRange === "custom" ? (
              <div className="mt-2 flex gap-2">
                <input type="date" value={uStart || ""} onChange={(event) => setQuery({ u_start: event.target.value || null, u_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
                <input type="date" value={uEnd || ""} onChange={(event) => setQuery({ u_end: event.target.value || null, u_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-[1200px] w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    {[
                      { key: "email", label: "email" },
                      { key: "id", label: "userId" },
                      { key: "registeredAt", label: "注册时间" },
                      { key: "subscriptionStatus", label: "订阅状态" },
                      { key: "creditBalance", label: "剩余积分" },
                      { key: "creditConsumed", label: "累计消耗" },
                      { key: "projectCount", label: "项目数" },
                      { key: "failedProjectCount", label: "失败数" },
                      { key: "recentActiveAt", label: "最近活跃" },
                    ].map((item) => (
                      <th key={item.key} className="px-3 py-2 font-medium">
                        <button type="button" onClick={() => runSort("u_sort", "u_order", "u_page", uSort, uOrder, item.key)} className="inline-flex items-center gap-1 hover:text-zinc-900">
                          {item.label}
                          <ArrowDownUp size={12} />
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.pageItems.length ? (
                    pagedUsers.pageItems.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-200 align-top">
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => openUserDetail(item.id)} className="text-zinc-900 underline underline-offset-2">
                            {item.email}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{item.id}</td>
                        <td className="px-3 py-2">{formatDateTime(item.registeredAt)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.subscriptionStatus)}`}>{item.subscriptionStatus}</span>
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setQuery({ tab: "billing", b_view: "credits", b_user: item.email, b_page: "1" })} className="underline underline-offset-2">
                            {item.creditBalance}
                          </button>
                        </td>
                        <td className="px-3 py-2">{item.creditConsumed}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setQuery({ tab: "projects", p_user: item.email, p_page: "1" })} className="underline underline-offset-2">
                            {item.projectCount}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setQuery({ tab: "logs", l_user: item.email, l_status: "failed", l_page: "1" })} className="underline underline-offset-2 text-red-700">
                            {item.failedProjectCount}
                          </button>
                        </td>
                        <td className="px-3 py-2">{formatDateTime(item.recentActiveAt)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAdjustCredit({
                                open: true,
                                userId: item.id,
                                adjustmentType: "increase",
                                amount: "",
                                reason: "",
                                projectId: "",
                                notifyUser: true,
                              })
                            }
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                          >
                            调整积分
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-sm text-zinc-500">
                        当前筛选下没有用户数据。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedUsers.page} totalPages={pagedUsers.totalPages} total={pagedUsers.total} onPageChange={(next) => setQuery({ u_page: String(next) })} />
          </section>
        ) : null}

        {activeTab === "billing" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">积分与订阅</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={billingView} onChange={(event) => setQuery({ b_view: event.target.value, b_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="credits">积分流水</option>
                <option value="orders">Stripe 订单</option>
                <option value="subscriptions">订阅列表</option>
                <option value="webhooks">Webhook 日志</option>
                <option value="anomalies">账务异常</option>
              </select>
              <input value={bUser} onChange={(event) => setQuery({ b_user: event.target.value || null, b_page: "1" })} placeholder="user email" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={bStatus} onChange={(event) => setQuery({ b_status: event.target.value || null, b_page: "1" })} placeholder="status" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <button type="button" onClick={() => setQuery({ b_user: null, b_status: null, b_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-100">
                清空筛选
              </button>
            </div>

            {billingView === "credits" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-[960px] w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">时间</th>
                      <th className="px-3 py-2 font-medium">用户</th>
                      <th className="px-3 py-2 font-medium">类型</th>
                      <th className="px-3 py-2 font-medium">变化</th>
                      <th className="px-3 py-2 font-medium">余额</th>
                      <th className="px-3 py-2 font-medium">关联对象</th>
                      <th className="px-3 py-2 font-medium">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCredits.pageItems.length ? (
                      pagedCredits.pageItems.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => openUserDetail(item.userId)} className="underline underline-offset-2">
                              {getUserEmailLabel(item.userId, userMap)}
                            </button>
                          </td>
                          <td className="px-3 py-2">{item.type}</td>
                          <td className={`px-3 py-2 ${item.delta < 0 ? "text-red-700" : "text-emerald-700"}`}>{item.delta > 0 ? `+${item.delta}` : item.delta}</td>
                          <td className="px-3 py-2">{item.balanceAfter}</td>
                          <td className="px-3 py-2">
                            {item.orderId ? (
                              <button type="button" onClick={() => setSelectedOrderId(item.orderId || "")} className="underline underline-offset-2">
                                {item.orderId}
                              </button>
                            ) : item.projectId ? (
                              <button type="button" onClick={() => openProjectDetail(item.projectId || "")} className="underline underline-offset-2">
                                {item.projectId}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">{item.reason}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-500">
                          当前筛选下没有积分流水。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="p-3">
                  <Pagination page={pagedCredits.page} totalPages={pagedCredits.totalPages} total={pagedCredits.total} onPageChange={(next) => setQuery({ b_page: String(next) })} />
                </div>
              </div>
            ) : null}

            {billingView === "orders" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">orderId</th>
                      <th className="px-3 py-2 font-medium">用户</th>
                      <th className="px-3 py-2 font-medium">金额</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">套餐</th>
                      <th className="px-3 py-2 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOrders.pageItems.length ? (
                      pagedOrders.pageItems.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => setSelectedOrderId(item.id)} className="underline underline-offset-2">
                              {item.id}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => openUserDetail(item.userId)} className="underline underline-offset-2">
                              {getUserEmailLabel(item.userId, userMap)}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            {item.amount} {item.currency}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{item.status}</span>
                          </td>
                          <td className="px-3 py-2">{item.plan}</td>
                          <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                          当前筛选下没有订单。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="p-3">
                  <Pagination page={pagedOrders.page} totalPages={pagedOrders.totalPages} total={pagedOrders.total} onPageChange={(next) => setQuery({ b_page: String(next) })} />
                </div>
              </div>
            ) : null}

            {billingView === "subscriptions" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">subscriptionId</th>
                      <th className="px-3 py-2 font-medium">用户</th>
                      <th className="px-3 py-2 font-medium">计划</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">开始</th>
                      <th className="px-3 py-2 font-medium">续费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSubs.pageItems.length ? (
                      pagedSubs.pageItems.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2">{item.id}</td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => openUserDetail(item.userId)} className="underline underline-offset-2">
                              {getUserEmailLabel(item.userId, userMap)}
                            </button>
                          </td>
                          <td className="px-3 py-2">{item.plan}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{item.status}</span>
                          </td>
                          <td className="px-3 py-2">{formatDateOnly(item.startedAt)}</td>
                          <td className="px-3 py-2">{formatDateOnly(item.renewAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                          当前筛选下没有订阅数据。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="p-3">
                  <Pagination page={pagedSubs.page} totalPages={pagedSubs.totalPages} total={pagedSubs.total} onPageChange={(next) => setQuery({ b_page: String(next) })} />
                </div>
              </div>
            ) : null}

            {billingView === "webhooks" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Webhook ID</th>
                      <th className="px-3 py-2 font-medium">事件</th>
                      <th className="px-3 py-2 font-medium">订单</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">错误信息</th>
                      <th className="px-3 py-2 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWebhooks.pageItems.length ? (
                      pagedWebhooks.pageItems.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2">{item.id}</td>
                          <td className="px-3 py-2">{item.eventType}</td>
                          <td className="px-3 py-2">
                            {item.orderId ? (
                              <button type="button" onClick={() => setSelectedOrderId(item.orderId || "")} className="underline underline-offset-2">
                                {item.orderId}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{item.status}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-700">{item.errorMessage || "-"}</td>
                          <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                          当前筛选下没有 webhook 数据。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="p-3">
                  <Pagination page={pagedWebhooks.page} totalPages={pagedWebhooks.totalPages} total={pagedWebhooks.total} onPageChange={(next) => setQuery({ b_page: String(next) })} />
                </div>
              </div>
            ) : null}

            {billingView === "anomalies" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">异常类型</th>
                      <th className="px-3 py-2 font-medium">摘要</th>
                      <th className="px-3 py-2 font-medium">用户</th>
                      <th className="px-3 py-2 font-medium">项目</th>
                      <th className="px-3 py-2 font-medium">订单</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAnomalies.pageItems.length ? (
                      pagedAnomalies.pageItems.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200 align-top">
                          <td className="px-3 py-2">{item.type}</td>
                          <td className="px-3 py-2 text-zinc-700">{item.summary}</td>
                          <td className="px-3 py-2">
                            {item.userId ? (
                              <button type="button" onClick={() => openUserDetail(item.userId || "")} className="underline underline-offset-2">
                                {getUserEmailLabel(item.userId, userMap)}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {item.projectId ? (
                              <button type="button" onClick={() => openProjectDetail(item.projectId || "")} className="underline underline-offset-2">
                                {item.projectId}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {item.orderId ? (
                              <button type="button" onClick={() => setSelectedOrderId(item.orderId || "")} className="underline underline-offset-2">
                                {item.orderId}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{item.status}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <button type="button" onClick={() => markAnomalyHandled(item)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                                标记已处理
                              </button>
                              <button type="button" onClick={() => {
                                if (item.userId) {
                                  setAdjustCredit({
                                    open: true,
                                    userId: item.userId,
                                    adjustmentType: "increase",
                                    amount: "20",
                                    reason: `Billing anomaly fix ${item.id}`,
                                    projectId: item.projectId || "",
                                    notifyUser: true,
                                  });
                                }
                              }} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                                修复积分
                              </button>
                              <button type="button" onClick={() => {
                                const ticket: MockTicket = {
                                  id: `tk-${idCounterRef.current}`,
                                  title: `账务异常 ${item.id}`,
                                  content: item.summary,
                                  userId: item.userId,
                                  projectId: item.projectId,
                                  status: "pending",
                                  priority: "P1",
                                  type: "billing",
                                  assignee: "ops-finance",
                                  internalNotes: ["由账务异常创建工单"],
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                };
                                idCounterRef.current += 1;
                                setData((prev) => ({ ...prev, tickets: [ticket, ...prev.tickets] }));
                                pushToast("已创建工单");
                              }} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                                创建工单
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-sm text-zinc-500">
                          当前筛选下没有账务异常。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="p-3">
                  <Pagination page={pagedAnomalies.page} totalPages={pagedAnomalies.totalPages} total={pagedAnomalies.total} onPageChange={(next) => setQuery({ b_page: String(next) })} />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "tickets" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">反馈工单</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select value={tStatus} onChange={(event) => setQuery({ t_status: event.target.value || null, t_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">状态</option>
                <option value="pending">待处理</option>
                <option value="in_progress">处理中</option>
                <option value="resolved">已解决</option>
                <option value="closed">已关闭</option>
                <option value="no_action">无需处理</option>
              </select>
              <select value={tPriority} onChange={(event) => setQuery({ t_priority: event.target.value || null, t_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">优先级</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
              <select value={tType} onChange={(event) => setQuery({ t_type: event.target.value || null, t_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">类型</option>
                <option value="bug">bug</option>
                <option value="billing">billing</option>
                <option value="feature">feature</option>
                <option value="quality">quality</option>
                <option value="other">other</option>
              </select>
              <input value={tUser} onChange={(event) => setQuery({ t_user: event.target.value || null, t_page: "1" })} placeholder="user email" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={tProject} onChange={(event) => setQuery({ t_project: event.target.value || null, t_page: "1" })} placeholder="projectId" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={tAssignee} onChange={(event) => setQuery({ t_assignee: event.target.value || null, t_page: "1" })} placeholder="处理人 assignee" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <button type="button" onClick={() => setQuery({ t_status: null, t_priority: null, t_type: null, t_user: null, t_project: null, t_assignee: null, t_page: "1" })} className="h-9 rounded-lg border border-zinc-300 text-sm hover:bg-zinc-100">
                清空筛选
              </button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">工单</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">优先级</th>
                    <th className="px-3 py-2 font-medium">类型</th>
                    <th className="px-3 py-2 font-medium">用户</th>
                    <th className="px-3 py-2 font-medium">项目</th>
                    <th className="px-3 py-2 font-medium">处理人</th>
                    <th className="px-3 py-2 font-medium">更新时间</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTickets.pageItems.length ? (
                    pagedTickets.pageItems.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-200">
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setSelectedTicketId(item.id)} className="text-left underline underline-offset-2">
                            {item.title}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}>{toTicketStatusLabel(item.status)}</span>
                        </td>
                        <td className="px-3 py-2">{item.priority}</td>
                        <td className="px-3 py-2">{item.type}</td>
                        <td className="px-3 py-2">
                          {item.userId ? (
                            <button type="button" onClick={() => openUserDetail(item.userId || "")} className="underline underline-offset-2">
                              {getUserEmailLabel(item.userId, userMap)}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {item.projectId ? (
                            <button type="button" onClick={() => openProjectDetail(item.projectId || "")} className="underline underline-offset-2">
                              {item.projectId}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">{item.assignee}</td>
                        <td className="px-3 py-2">{formatDateTime(item.updatedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => setSelectedTicketId(item.id)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                              详情
                            </button>
                            <button type="button" onClick={() => closeTicket(item.id)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100">
                              关闭工单
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-sm text-zinc-500">
                        当前筛选下没有工单数据。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={pagedTickets.page} totalPages={pagedTickets.totalPages} total={pagedTickets.total} onPageChange={(next) => setQuery({ t_page: String(next) })} />
          </section>
        ) : null}

        {activeTab === "cases" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">案例配置</p>
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">公开 Case 发布</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    从已生成项目复制图片资产到公开存储，生成独立文件地址，避免引用 Workspace 临时 URL。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadPublishedCases}
                  className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-100"
                >
                  {publishedCasesLoading ? "读取中..." : "刷新公开案例"}
                </button>
              </div>
              <div className="mt-4 grid gap-2 lg:grid-cols-6">
                <div className="lg:col-span-6">
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-3">
                    <div className="flex flex-col gap-2 lg:flex-row">
                      <input
                        value={caseProjectSearch.projectId}
                        onChange={(event) => setCaseProjectSearch((prev) => ({ ...prev, projectId: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            searchPublishableCaseProjects();
                          }
                        }}
                        placeholder="按项目 ID 搜索，邮箱可留空"
                        className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm lg:flex-1"
                      />
                      <input
                        value={caseProjectSearch.userEmail}
                        onChange={(event) => setCaseProjectSearch((prev) => ({ ...prev, userEmail: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            searchPublishableCaseProjects();
                          }
                        }}
                        placeholder="按邮箱账号搜索，项目 ID 可留空"
                        className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm lg:flex-1"
                      />
                      <button
                        type="button"
                        onClick={searchPublishableCaseProjects}
                        disabled={caseProjectSearchLoading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {caseProjectSearchLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
                        搜索源项目
                      </button>
                    </div>
                    {caseProjectResults.length ? (
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {caseProjectResults.map((item) => (
                          <button
                            key={`${item.projectId}-${item.userEmail}-${item.outputType}`}
                            type="button"
                            onClick={() => selectPublishableCaseProject(item)}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-zinc-400 hover:bg-white"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-semibold text-zinc-900">{item.title || item.projectId}</p>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] uppercase text-zinc-600">
                                  {item.outputType}
                                </span>
                                {item.alreadyPublished ? (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                                    已公开
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-500">
                                    可发布
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="mt-1 truncate text-xs text-zinc-500">
                              {item.projectId} · {item.userEmail}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {item.generatedAssetCount}/{item.pageCount} 张已生成 · 更新于 {formatDateTime(item.updatedAt)}
                              {item.publishedSlug ? ` · /cases/${item.publishedSlug}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">
                        管理员可只填项目 ID 或只填邮箱搜索全部历史项目；选中结果后可发布到首页案例。
                      </p>
                    )}
                  </div>
                </div>
                <input
                  value={publishCaseForm.projectId}
                  onChange={(event) => setPublishCaseForm((prev) => ({ ...prev, projectId: event.target.value }))}
                  placeholder="projectId（必填，可由搜索结果填入）"
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm lg:col-span-2"
                />
                <input
                  value={publishCaseForm.userEmail}
                  onChange={(event) => setPublishCaseForm((prev) => ({ ...prev, userEmail: event.target.value }))}
                  placeholder="owner email（可选，项目 ID 可自动反查）"
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm lg:col-span-2"
                />
                <select
                  value={publishCaseForm.outputType}
                  onChange={(event) =>
                    setPublishCaseForm((prev) => ({
                      ...prev,
                      outputType: event.target.value as PublishCaseFormState["outputType"],
                    }))
                  }
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                >
                  <option value="poster">Poster</option>
                  <option value="ppt">PPT</option>
                  <option value="video">Video</option>
                </select>
                <button
                  type="button"
                  onClick={publishPublicCaseFromProject}
                  disabled={publishingCase}
                  className="h-10 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishingCase ? "Publishing..." : "Publish"}
                </button>
                <input
                  value={publishCaseForm.title}
                  onChange={(event) => setPublishCaseForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Optional public title"
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm lg:col-span-2"
                />
                <input
                  value={publishCaseForm.category}
                  onChange={(event) => setPublishCaseForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="Category"
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
                <input
                  value={publishCaseForm.authorLabel}
                  onChange={(event) => setPublishCaseForm((prev) => ({ ...prev, authorLabel: event.target.value }))}
                  placeholder="Author label"
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                />
                <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={publishCaseForm.featured}
                    onChange={(event) => setPublishCaseForm((prev) => ({ ...prev, featured: event.target.checked }))}
                  />
                  Featured
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {publishedCases.length ? (
                  publishedCases.map((item) => (
                    <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                          {item.coverUrl ? (
                            <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-400">
                              No cover
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-zinc-900">{item.title}</p>
                            <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {item.outputType.toUpperCase()} · {item.assets?.length || 0} public files · {item.slug}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-500">
                            Source: {item.sourceProjectId || "-"} · {item.sourceUserEmail || "-"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={`/cases/${encodeURIComponent(item.slug)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                            >
                              Open case
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                updatePublishedCase(item, {
                                  status: item.status === "published" ? "draft" : "published",
                                })
                              }
                              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                            >
                              {item.status === "published" ? "Unpublish" : "Publish"}
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePublishedCase(item, { featured: !item.featured })}
                              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                            >
                              {item.featured ? "Unfeature" : "Feature"}
                            </button>
                            {item.assets?.[0]?.fileUrl ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(item.assets?.[0]?.fileUrl || "");
                                  pushToast("已复制首个文件地址");
                                }}
                                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                Copy first file URL
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="col-span-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                    还没有公开发布的 Case。管理员可以先按项目 ID 或邮箱搜索历史项目，再发布到首页。
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <p className="text-sm font-semibold text-zinc-900">旧案例配置（本地 mock）</p>
              <p className="mt-1 text-xs text-zinc-500">保留用于旧后台演示；首页真实公开案例优先读取上方发布数据。</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={cStatus} onChange={(event) => setQuery({ c_status: event.target.value || null, c_page: "1" })} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="">全部状态</option>
                <option value="online">已上线</option>
                <option value="offline">已下线</option>
              </select>
              <button type="button" onClick={() => {
                const source = data.projects[0];
                if (!source) return;
                const item: MockCaseConfig = {
                  id: `case-${idCounterRef.current}`,
                  projectId: source.id,
                  title: `${source.topic}（复制）`,
                  description: "从真实项目复制生成的案例",
                  tags: ["new"],
                  order: (Math.max(...data.cases.map((row) => row.order), 0) || 0) + 10,
                  online: false,
                  coverUrl: "/picture/0207e54b-cd89-4f61-99b2-3d5041609e73.png",
                };
                idCounterRef.current += 1;
                setData((prev) => ({ ...prev, cases: [...prev.cases, item] }));
                pushToast("已从真实项目复制为案例（mock）");
              }} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-100">
                从真实项目复制案例
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pagedCases.pageItems.length ? (
                pagedCases.pageItems.map((item) => (
                  <article key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                        <p className="text-xs text-zinc-500">{item.projectId}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${item.online ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-700 border-zinc-200"}`}>
                        {item.online ? "上线中" : "已下线"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">{item.description}</p>
                    <p className="mt-2 text-xs text-zinc-500">{item.tags.join(" · ")}</p>
                    <p className="mt-2 text-xs text-zinc-500">排序：{item.order}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => moveCase(item.id, "up")} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-white">
                        上移
                      </button>
                      <button type="button" onClick={() => moveCase(item.id, "down")} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-white">
                        下移
                      </button>
                      <button type="button" onClick={() => toggleCaseOnline(item.id)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-white">
                        上/下线
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openProjectDetail(item.projectId)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-white">
                        关联项目
                      </button>
                      <button type="button" onClick={() => deleteCase(item)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-red-700 hover:bg-white">
                        删除案例
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                  当前筛选下没有案例数据。
                </div>
              )}
            </div>
            <Pagination page={pagedCases.page} totalPages={pagedCases.totalPages} total={pagedCases.total} onPageChange={(next) => setQuery({ c_page: String(next) })} />
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">模型配置</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  默认文本模型：<span className="font-medium text-zinc-900">{data.settings.defaultTextModel}</span>
                </p>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  默认图片模型：<span className="font-medium text-zinc-900">{data.settings.defaultImageModel}</span>
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">积分规则</p>
              <div className="mt-3 space-y-2 text-sm text-zinc-700">
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">Poster 基础扣点：{data.settings.creditRules.posterBase}</p>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">PPT 单页扣点：{data.settings.creditRules.pptPerPage}</p>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">Video 单分镜扣点：{data.settings.creditRules.videoPerFrame}</p>
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">管理员权限</p>
              <div className="mt-3 space-y-2 text-sm">
                {data.settings.adminRoles.map((item) => (
                  <div key={`${item.userId}-${item.role}`} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <button type="button" onClick={() => openUserDetail(item.userId)} className="underline underline-offset-2">
                      {getUserEmailLabel(item.userId, userMap)}
                    </button>
                    <span className="uppercase text-zinc-600">{item.role}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">系统开关</p>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  { key: "pauseImageGeneration", label: "暂停图片生成" },
                  { key: "pausePptExport", label: "暂停 PPT 导出" },
                  { key: "pauseVideoGeneration", label: "暂停视频生成" },
                  { key: "maintenanceMode", label: "维护模式" },
                ].map((item) => {
                  const active = data.settings.switches[item.key as keyof AdminConsoleData["settings"]["switches"]];
                  return (
                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <p className="text-zinc-700">{item.label}</p>
                      <button
                        type="button"
                        onClick={() => toggleSystemSwitch(item.key as keyof AdminConsoleData["settings"]["switches"])}
                        className={`inline-flex h-7 items-center rounded-full border px-3 text-xs ${active ? "border-amber-300 bg-amber-50 text-amber-700" : "border-zinc-300 bg-white text-zinc-600"}`}
                      >
                        {active ? "已开启" : "已关闭"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        ) : null}
      </div>

      <Drawer
        open={Boolean(selectedOpsEvent)}
        title={`ops_event ${selectedOpsEvent?.id ?? ""}`}
        onClose={() => setSelectedOpsEventId("")}
      >
        {selectedOpsEvent ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-900">{selectedOpsEvent.action}</p>
              <p className="mt-1 text-zinc-600">
                {selectedOpsEvent.status} / {selectedOpsEvent.code || "-"}
              </p>
              <p className="mt-1 text-zinc-600">{formatDateTime(selectedOpsEvent.createdAt)}</p>
              <p className="mt-1 text-zinc-500">{selectedOpsEvent.message || "-"}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Identifiers</p>
                <p className="mt-2 text-zinc-700">runId: {selectedOpsEvent.runId || "-"}</p>
                <p className="mt-1 text-zinc-700">jobId: {selectedOpsEvent.jobId || "-"}</p>
                <p className="mt-1 text-zinc-700">taskId: {selectedOpsEvent.taskId || "-"}</p>
                <p className="mt-1 text-zinc-700">projectId: {selectedOpsEvent.projectId || "-"}</p>
                <p className="mt-1 text-zinc-700">userEmail: {selectedOpsEvent.userEmail || "-"}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Summary</p>
                <p className="mt-2 text-zinc-700">durationMs: {typeof selectedOpsEvent.durationMs === "number" ? selectedOpsEvent.durationMs : "-"}</p>
                <p className="mt-1 text-zinc-700">source: {selectedOpsEvent.source || "-"}</p>
                <p className="mt-1 text-zinc-700">stage: {selectedOpsEvent.stage || "-"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">details_json</p>
              <pre className="mt-2 overflow-x-auto text-xs text-zinc-100">
                {JSON.stringify(selectedOpsEvent.details || {}, null, 2)}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(selectedOpsEvent, null, 2), "ops_event")}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
              >
                复制详情
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={Boolean(selectedProjectInput)}
        title={`原始输入 ${selectedProjectInput?.projectId ?? ""}`}
        onClose={() => setSelectedProjectInput(null)}
      >
        {selectedProjectInput ? (
          <div className="space-y-3 text-sm text-zinc-700">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="font-medium text-zinc-900">{selectedProjectInput.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{selectedProjectInput.projectId}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-900">完整原始输入</p>
                <button
                  type="button"
                  onClick={() => copyText(selectedProjectInput.input, "原始输入")}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100"
                >
                  复制
                </button>
              </div>
              <pre className="mt-2 max-h-[65vh] whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
                {selectedProjectInput.input}
              </pre>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer open={Boolean(selectedLog)} title={`日志详情 ${selectedLog?.id ?? ""}`} onClose={() => setSelectedLogId("")}>
        {selectedLog ? (
          <>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-medium text-zinc-900">{selectedLog.type} / {selectedLog.action}</p>
              <p className="mt-1 text-zinc-600">
                requestId：
                <button type="button" onClick={() => copyText(selectedLog.requestId, "requestId")} className="underline underline-offset-2">
                  {selectedLog.requestId}
                </button>
              </p>
              {selectedLog.errorId ? (
                <p className="mt-1 text-zinc-600">
                  errorId：
                  <button type="button" onClick={() => jumpToLogsWithError(selectedLog.errorId || "")} className="underline underline-offset-2 text-red-700">
                    {selectedLog.errorId}
                  </button>
                </p>
              ) : null}
              <p className="mt-1 text-zinc-600">状态：{selectedLog.status}</p>
              <p className="mt-1 text-zinc-600">时间：{formatDateTime(selectedLog.createdAt)}</p>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-medium text-zinc-900">关联对象</p>
              <div className="text-sm text-zinc-700">
                <p>
                  用户：
                  {selectedLog.userId ? (
                    <button type="button" onClick={() => openUserDetail(selectedLog.userId || "")} className="underline underline-offset-2">
                      {getUserEmailLabel(selectedLog.userId, userMap)}
                    </button>
                  ) : (
                    "-"
                  )}
                </p>
                <p>
                  项目：
                  {selectedLog.projectId ? (
                    <button type="button" onClick={() => openProjectDetail(selectedLog.projectId || "")} className="underline underline-offset-2">
                      {selectedLog.projectId}
                    </button>
                  ) : (
                    "-"
                  )}
                </p>
                <p>
                  订单：
                  {selectedLog.relatedOrderId ? (
                    <button type="button" onClick={() => setSelectedOrderId(selectedLog.relatedOrderId || "")} className="underline underline-offset-2">
                      {selectedLog.relatedOrderId}
                    </button>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-medium text-zinc-900">请求配置</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">{selectedLog.configSnapshot}</pre>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3">
              <p className="text-sm font-medium text-zinc-900">链路状态</p>
              <p className="mt-2 text-sm text-zinc-700">{selectedLog.pipelineState}</p>
            </div>

            {selectedLog.errorSummary ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">错误信息</p>
                <p className="mt-1">{selectedLog.errorSummary}</p>
                <p className="mt-1 text-xs">{selectedLog.errorCode || "-"}</p>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => copyText(JSON.stringify(selectedLog, null, 2), "完整日志")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                复制完整日志
              </button>
              <button type="button" onClick={() => copyText(selectedLog.requestId, "requestId")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                复制 requestId
              </button>
              <button type="button" onClick={() => retryFromLog(selectedLog)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                重试当前步骤
              </button>
              <button type="button" onClick={() => refundFromLog(selectedLog)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                退还积分
              </button>
              <button type="button" onClick={() => createTicketFromLog(selectedLog)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                创建反馈工单
              </button>
              <button type="button" onClick={() => markLogHandled(selectedLog.id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                标记已处理
              </button>
            </div>
          </>
        ) : null}
      </Drawer>

      <Drawer open={Boolean(selectedOrder)} title={`订单详情 ${selectedOrder?.id ?? ""}`} onClose={() => setSelectedOrderId("")}>
        {selectedOrder ? (
          <>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-medium text-zinc-900">{selectedOrder.id}</p>
              <p className="mt-1 text-zinc-600">
                用户：
                <button type="button" onClick={() => openUserDetail(selectedOrder.userId)} className="underline underline-offset-2">
                  {getUserEmailLabel(selectedOrder.userId, userMap)}
                </button>
              </p>
              <p className="mt-1 text-zinc-600">计划：{selectedOrder.plan}</p>
              <p className="mt-1 text-zinc-600">
                金额：{selectedOrder.amount} {selectedOrder.currency}
              </p>
              <p className="mt-1 text-zinc-600">状态：{selectedOrder.status}</p>
              <p className="mt-1 text-zinc-600">时间：{formatDateTime(selectedOrder.createdAt)}</p>
              <p className="mt-1 text-zinc-600">stripe event：{selectedOrder.stripeEventId}</p>
            </div>
            <button type="button" onClick={() => copyText(JSON.stringify(selectedOrder, null, 2), "订单详情")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
              复制订单详情
            </button>
          </>
        ) : null}
      </Drawer>

      <Drawer open={Boolean(selectedTicket)} title={`工单详情 ${selectedTicket?.id ?? ""}`} onClose={() => setSelectedTicketId("")}>
        {selectedTicket ? (
          <>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-medium text-zinc-900">{selectedTicket.title}</p>
              <p className="mt-1 text-zinc-700">{selectedTicket.content}</p>
              <p className="mt-2 text-zinc-600">优先级：{selectedTicket.priority}</p>
              <p className="mt-1 text-zinc-600">状态：{toTicketStatusLabel(selectedTicket.status)}</p>
              <p className="mt-1 text-zinc-600">类型：{selectedTicket.type}</p>
              <p className="mt-1 text-zinc-600">处理人：{selectedTicket.assignee}</p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">
              <p>关联用户：
                {selectedTicket.userId ? (
                  <button type="button" onClick={() => openUserDetail(selectedTicket.userId || "")} className="ml-1 underline underline-offset-2">
                    {getUserEmailLabel(selectedTicket.userId, userMap)}
                  </button>
                ) : (
                  <span className="ml-1">-</span>
                )}
              </p>
              <p className="mt-1">关联项目：
                {selectedTicket.projectId ? (
                  <button type="button" onClick={() => openProjectDetail(selectedTicket.projectId || "")} className="ml-1 underline underline-offset-2">
                    {selectedTicket.projectId}
                  </button>
                ) : (
                  <span className="ml-1">-</span>
                )}
              </p>
              <p className="mt-1">关联日志：
                {selectedTicket.logId ? (
                  <button type="button" onClick={() => setSelectedLogId(selectedTicket.logId || "")} className="ml-1 underline underline-offset-2">
                    {selectedTicket.logId}
                  </button>
                ) : (
                  <span className="ml-1">-</span>
                )}
              </p>
              <p className="mt-1">关联积分流水：{selectedTicket.creditRecordId || "-"}</p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3 text-sm">
              <p className="font-medium text-zinc-900">处理记录 / 备注</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
                {selectedTicket.internalNotes.map((note, idx) => (
                  <li key={`${selectedTicket.id}-note-${idx}`}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <select
                value={selectedTicket.status}
                onChange={(event) => {
                  const next = event.target.value as MockTicketStatus;
                  setData((prev) => ({
                    ...prev,
                    tickets: prev.tickets.map((item) =>
                      item.id === selectedTicket.id ? { ...item, status: next, updatedAt: new Date().toISOString() } : item,
                    ),
                  }));
                  pushToast("工单状态已更新");
                }}
                className="h-9 w-full rounded-lg border border-zinc-300 px-2 text-sm"
              >
                <option value="pending">待处理</option>
                <option value="in_progress">处理中</option>
                <option value="resolved">已解决</option>
                <option value="closed">已关闭</option>
                <option value="no_action">无需处理</option>
              </select>
              <button type="button" onClick={() => closeTicket(selectedTicket.id)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
                关闭工单
              </button>
            </div>
          </>
        ) : null}
      </Drawer>

      {adjustCredit.open ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900">调整积分</h3>
            <p className="mt-1 text-sm text-zinc-600">危险操作：将写入积分流水，建议核对用户和原因。</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <select value={adjustCredit.adjustmentType} onChange={(event) => setAdjustCredit((prev) => ({ ...prev, adjustmentType: event.target.value as "increase" | "decrease" }))} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm">
                <option value="increase">增加积分</option>
                <option value="decrease">扣减积分</option>
              </select>
              <input value={adjustCredit.amount} onChange={(event) => setAdjustCredit((prev) => ({ ...prev, amount: event.target.value }))} placeholder="积分数量" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm" />
              <input value={adjustCredit.reason} onChange={(event) => setAdjustCredit((prev) => ({ ...prev, reason: event.target.value }))} placeholder="原因（必填）" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm sm:col-span-2" />
              <input value={adjustCredit.projectId} onChange={(event) => setAdjustCredit((prev) => ({ ...prev, projectId: event.target.value }))} placeholder="关联 projectId（可选）" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm sm:col-span-2" />
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
                <input type="checkbox" checked={adjustCredit.notifyUser} onChange={(event) => setAdjustCredit((prev) => ({ ...prev, notifyUser: event.target.checked }))} />
                是否通知用户
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setAdjustCredit((prev) => ({ ...prev, open: false }))} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-100">
                取消
              </button>
              <button type="button" onClick={submitAdjustCredit} className="h-9 rounded-lg bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-700">
                提交调整
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog state={confirmDialog} onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }))} />

      {toasts.length ? (
        <div className="pointer-events-none fixed right-5 top-5 z-[80] space-y-2">
          {toasts.map((item) => (
            <div key={item.id} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg">
              {item.message}
            </div>
          ))}
        </div>
      ) : null}
    </AdminShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 p-6 text-sm text-zinc-500">
          Loading admin console...
        </div>
      }
    >
      <AdminDashboardPageContent />
    </Suspense>
  );
}
