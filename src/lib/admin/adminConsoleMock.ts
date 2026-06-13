export type AdminMainTab =
  | "overview"
  | "logs"
  | "projects"
  | "users"
  | "billing"
  | "tickets"
  | "cases"
  | "settings";

export type TimeRangeKey = "today" | "7d" | "30d" | "custom";

export type MockUserStatus = "active" | "restricted" | "frozen";
export type MockSubscriptionStatus = "free" | "trial" | "active" | "past_due" | "expired";
export type MockProjectStatus = "draft" | "generating" | "completed" | "failed";
export type MockProjectStage =
  | "intent_summary"
  | "content_draft"
  | "generation_task_compile"
  | "image_generation"
  | "export"
  | "done";
export type MockDirection = "poster" | "ppt" | "video";
export type MockTextModel = "GPT-5.5" | "GPT-5.4" | "Gemini 3.1 Pro" | "Claude Sonnet 4.6" | "Gemini 2.5" | "DeepSeek V4";
export type MockImageModel = string;
export type MockLogStatus = "ok" | "failed" | "processing" | "handled";
export type MockLogType = "LLM" | "Image" | "Export" | "Billing" | "Auth" | "System";
export type MockTicketStatus = "pending" | "in_progress" | "resolved" | "closed" | "no_action";
export type MockTicketPriority = "P0" | "P1" | "P2" | "P3";
export type MockTicketType = "bug" | "billing" | "feature" | "quality" | "other";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  subscriptionStatus: MockSubscriptionStatus;
  status: MockUserStatus;
  creditBalance: number;
  creditConsumed: number;
  projectCount: number;
  failedProjectCount: number;
  recentActiveAt: string;
};

export type MockProject = {
  id: string;
  userId: string;
  type: MockDirection;
  topic: string;
  originalInput?: string;
  status: MockProjectStatus;
  stage: MockProjectStage;
  textModel: MockTextModel;
  imageModel: MockImageModel;
  consumedCredits: number;
  createdAt: string;
  updatedAt: string;
  requestId: string;
};

export type MockLog = {
  id: string;
  requestId: string;
  errorId?: string;
  projectId?: string;
  userId?: string;
  type: MockLogType;
  action: string;
  status: MockLogStatus;
  durationMs: number;
  creditDelta: number;
  errorSummary?: string;
  errorCode?: string;
  createdAt: string;
  configSnapshot: string;
  pipelineState: string;
  relatedOrderId?: string;
  handled: boolean;
};

export type MockOrder = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: "paid" | "failed" | "refunded" | "pending";
  plan: string;
  createdAt: string;
  stripeEventId: string;
};

export type MockSubscription = {
  id: string;
  userId: string;
  plan: string;
  status: "active" | "canceling" | "past_due" | "expired";
  startedAt: string;
  renewAt: string;
};

export type MockCreditRecord = {
  id: string;
  userId: string;
  orderId?: string;
  projectId?: string;
  type: "topup" | "consume" | "refund" | "adjustment";
  delta: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
};

export type MockWebhookLog = {
  id: string;
  eventType: string;
  orderId?: string;
  status: "ok" | "failed";
  errorMessage?: string;
  createdAt: string;
};

export type MockBillingAnomaly = {
  id: string;
  type:
    | "payment_success_no_credit"
    | "deduct_success_project_failed"
    | "project_failed_no_refund"
    | "subscription_expired_still_member"
    | "negative_credit"
    | "webhook_failed";
  userId?: string;
  projectId?: string;
  orderId?: string;
  status: "open" | "handled";
  summary: string;
  createdAt: string;
};

export type MockTicket = {
  id: string;
  userId?: string;
  projectId?: string;
  logId?: string;
  creditRecordId?: string;
  title: string;
  content: string;
  status: MockTicketStatus;
  priority: MockTicketPriority;
  type: MockTicketType;
  assignee: string;
  internalNotes: string[];
  createdAt: string;
  updatedAt: string;
};

export type MockCaseConfig = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  tags: string[];
  order: number;
  online: boolean;
  coverUrl: string;
};

export type MockSystemSettings = {
  defaultTextModel: MockTextModel;
  defaultImageModel: MockImageModel;
  creditRules: {
    posterBase: number;
    pptPerPage: number;
    videoPerFrame: number;
  };
  adminRoles: Array<{ userId: string; role: "owner" | "admin" | "ops" }>;
  switches: {
    pauseImageGeneration: boolean;
    pausePptExport: boolean;
    pauseVideoGeneration: boolean;
    maintenanceMode: boolean;
  };
};

export type AdminConsoleData = {
  users: MockUser[];
  projects: MockProject[];
  logs: MockLog[];
  orders: MockOrder[];
  subscriptions: MockSubscription[];
  creditRecords: MockCreditRecord[];
  webhookLogs: MockWebhookLog[];
  billingAnomalies: MockBillingAnomaly[];
  tickets: MockTicket[];
  cases: MockCaseConfig[];
  settings: MockSystemSettings;
};

export type GlobalSearchResult = {
  group: "用户" | "项目" | "订单" | "日志" | "错误";
  id: string;
  title: string;
  subtitle: string;
  kind: "user" | "project" | "order" | "log" | "error";
  refId: string;
};

const seedUsers: MockUser[] = [
  {
    id: "u-admin-001",
    name: "Dai",
    email: "chuanqingdai@gmail.com",
    registeredAt: "2026-05-12T09:12:00.000Z",
    subscriptionStatus: "active",
    status: "active",
    creditBalance: 1580,
    creditConsumed: 4230,
    projectCount: 48,
    failedProjectCount: 3,
    recentActiveAt: "2026-05-31T07:43:00.000Z",
  },
  {
    id: "u-1001",
    name: "Lin",
    email: "lin@scilens.ai",
    registeredAt: "2026-05-29T02:22:00.000Z",
    subscriptionStatus: "free",
    status: "active",
    creditBalance: 42,
    creditConsumed: 190,
    projectCount: 12,
    failedProjectCount: 2,
    recentActiveAt: "2026-05-31T03:10:00.000Z",
  },
  {
    id: "u-1002",
    name: "Zhou",
    email: "zhou@scilens.ai",
    registeredAt: "2026-05-28T11:01:00.000Z",
    subscriptionStatus: "active",
    status: "active",
    creditBalance: 860,
    creditConsumed: 1340,
    projectCount: 26,
    failedProjectCount: 1,
    recentActiveAt: "2026-05-31T05:46:00.000Z",
  },
  {
    id: "u-1003",
    name: "Mia",
    email: "mia@domain.com",
    registeredAt: "2026-05-25T04:33:00.000Z",
    subscriptionStatus: "trial",
    status: "active",
    creditBalance: 120,
    creditConsumed: 560,
    projectCount: 18,
    failedProjectCount: 4,
    recentActiveAt: "2026-05-30T16:04:00.000Z",
  },
  {
    id: "u-1004",
    name: "Alex",
    email: "alex@domain.com",
    registeredAt: "2026-05-14T07:20:00.000Z",
    subscriptionStatus: "past_due",
    status: "restricted",
    creditBalance: -12,
    creditConsumed: 720,
    projectCount: 11,
    failedProjectCount: 3,
    recentActiveAt: "2026-05-29T22:45:00.000Z",
  },
  {
    id: "u-1005",
    name: "Nora",
    email: "nora@domain.com",
    registeredAt: "2026-05-20T13:31:00.000Z",
    subscriptionStatus: "expired",
    status: "frozen",
    creditBalance: 0,
    creditConsumed: 210,
    projectCount: 8,
    failedProjectCount: 1,
    recentActiveAt: "2026-05-23T08:14:00.000Z",
  },
];

const seedProjects: MockProject[] = [
  {
    id: "p-9001",
    userId: "u-1001",
    type: "poster",
    topic: "为什么焦虑会加重拖延",
    status: "completed",
    stage: "done",
    textModel: "Gemini 2.5",
    imageModel: "image2-tuzi",
    consumedCredits: 18,
    createdAt: "2026-05-31T01:05:00.000Z",
    updatedAt: "2026-05-31T01:16:00.000Z",
    requestId: "req-kt9f011",
  },
  {
    id: "p-9002",
    userId: "u-1002",
    type: "ppt",
    topic: "地球板块构造与地震带分布",
    status: "generating",
    stage: "image_generation",
    textModel: "GPT-5.4",
    imageModel: "image2-tuzi",
    consumedCredits: 84,
    createdAt: "2026-05-31T03:12:00.000Z",
    updatedAt: "2026-05-31T07:22:00.000Z",
    requestId: "req-kt9f091",
  },
  {
    id: "p-9003",
    userId: "u-1003",
    type: "video",
    topic: "内存基础设施如何影响美股上涨",
    status: "failed",
    stage: "image_generation",
    textModel: "DeepSeek V4",
    imageModel: "duomi",
    consumedCredits: 96,
    createdAt: "2026-05-30T12:12:00.000Z",
    updatedAt: "2026-05-30T12:44:00.000Z",
    requestId: "req-kt8z440",
  },
  {
    id: "p-9004",
    userId: "u-1004",
    type: "poster",
    topic: "SpaceX 上市路径与估值逻辑",
    status: "failed",
    stage: "content_draft",
    textModel: "Gemini 2.5",
    imageModel: "gptsapi",
    consumedCredits: 12,
    createdAt: "2026-05-29T10:02:00.000Z",
    updatedAt: "2026-05-29T10:07:00.000Z",
    requestId: "req-kt7c230",
  },
  {
    id: "p-9005",
    userId: "u-admin-001",
    type: "ppt",
    topic: "Claude Code 学习路线",
    status: "completed",
    stage: "done",
    textModel: "Claude Sonnet 4.6",
    imageModel: "image2-tuzi",
    consumedCredits: 70,
    createdAt: "2026-05-30T20:30:00.000Z",
    updatedAt: "2026-05-30T20:58:00.000Z",
    requestId: "req-kt8n321",
  },
  {
    id: "p-9006",
    userId: "u-1002",
    type: "video",
    topic: "火山喷发机制 12 分镜",
    status: "draft",
    stage: "intent_summary",
    textModel: "Gemini 3.1 Pro",
    imageModel: "image2-tuzi",
    consumedCredits: 0,
    createdAt: "2026-05-31T06:21:00.000Z",
    updatedAt: "2026-05-31T06:23:00.000Z",
    requestId: "req-kt9f610",
  },
];

const seedLogs: MockLog[] = [
  {
    id: "log-5001",
    requestId: "req-kt9f091",
    projectId: "p-9002",
    userId: "u-1002",
    type: "Image",
    action: "batch_generate",
    status: "processing",
    durationMs: 12640,
    creditDelta: -24,
    createdAt: "2026-05-31T07:22:10.000Z",
    configSnapshot: "{\"ratio\":\"16:9\",\"count\":12,\"style\":\"clean-science\"}",
    pipelineState: "task_compile:ok -> image2:running",
    relatedOrderId: "ord-8812",
    handled: false,
  },
  {
    id: "log-5002",
    requestId: "req-kt8z440",
    errorId: "err-img-2031",
    projectId: "p-9003",
    userId: "u-1003",
    type: "Image",
    action: "generate_frame_08",
    status: "failed",
    durationMs: 8420,
    creditDelta: -8,
    errorSummary: "Image provider timeout on frame 8",
    errorCode: "IMAGE_TIMEOUT",
    createdAt: "2026-05-30T12:43:18.000Z",
    configSnapshot: "{\"ratio\":\"16:9\",\"frame\":8,\"provider\":\"duomi\"}",
    pipelineState: "draft:ok -> task_compile:ok -> duomi:timeout",
    handled: false,
  },
  {
    id: "log-5003",
    requestId: "req-kt7c230",
    errorId: "err-llm-992",
    projectId: "p-9004",
    userId: "u-1004",
    type: "LLM",
    action: "build_draft",
    status: "failed",
    durationMs: 3912,
    creditDelta: -4,
    errorSummary: "Draft response schema mismatch",
    errorCode: "DRAFT_SCHEMA_INVALID",
    createdAt: "2026-05-29T10:06:08.000Z",
    configSnapshot: "{\"direction\":\"poster\",\"count\":1}",
    pipelineState: "intent_summary:ok -> draft:invalid_json",
    handled: true,
  },
  {
    id: "log-5004",
    requestId: "req-kt8n321",
    projectId: "p-9005",
    userId: "u-admin-001",
    type: "Export",
    action: "ppt_export",
    status: "ok",
    durationMs: 2140,
    creditDelta: 0,
    createdAt: "2026-05-30T20:58:40.000Z",
    configSnapshot: "{\"slides\":8,\"theme\":\"studio-white\"}",
    pipelineState: "draft:ok -> image:ok -> export:ok",
    handled: true,
  },
  {
    id: "log-5005",
    requestId: "req-kt9f011",
    projectId: "p-9001",
    userId: "u-1001",
    type: "LLM",
    action: "intent_summary",
    status: "ok",
    durationMs: 1330,
    creditDelta: 0,
    createdAt: "2026-05-31T01:05:24.000Z",
    configSnapshot: "{\"direction\":\"poster\",\"lang\":\"zh\"}",
    pipelineState: "intent_summary:ok",
    handled: true,
  },
  {
    id: "log-5006",
    requestId: "req-kt9f011",
    projectId: "p-9001",
    userId: "u-1001",
    type: "Image",
    action: "generate_image",
    status: "ok",
    durationMs: 4890,
    creditDelta: -18,
    createdAt: "2026-05-31T01:14:09.000Z",
    configSnapshot: "{\"provider\":\"image2-tuzi\",\"watermark\":\"free\"}",
    pipelineState: "task_compile:ok -> image2:ok",
    handled: true,
  },
  {
    id: "log-5007",
    requestId: "req-kt7f701",
    errorId: "err-auth-401",
    type: "Auth",
    action: "google_callback",
    status: "failed",
    durationMs: 280,
    creditDelta: 0,
    errorSummary: "OAuth callback domain mismatch",
    errorCode: "GOOGLE_REDIRECT_URI_MISMATCH",
    createdAt: "2026-05-30T22:18:02.000Z",
    configSnapshot: "{\"host\":\"www.knowlens.ai\",\"expected\":\"knowlens.ai\"}",
    pipelineState: "oauth:start -> callback:failed",
    handled: false,
  },
  {
    id: "log-5008",
    requestId: "req-kt8w660",
    errorId: "err-bill-122",
    projectId: "p-9003",
    userId: "u-1003",
    type: "Billing",
    action: "consume_credit",
    status: "failed",
    durationMs: 940,
    creditDelta: -8,
    errorSummary: "Project failed but refund not triggered",
    errorCode: "REFUND_MISSING",
    createdAt: "2026-05-30T12:45:10.000Z",
    configSnapshot: "{\"project\":\"p-9003\",\"deduct\":8}",
    pipelineState: "deduct:ok -> project:failed -> refund:missing",
    handled: false,
  },
];

const seedOrders: MockOrder[] = [
  {
    id: "ord-8812",
    userId: "u-1002",
    amount: 19.99,
    currency: "USD",
    status: "paid",
    plan: "Pro Monthly",
    createdAt: "2026-05-30T18:14:00.000Z",
    stripeEventId: "evt_1Qzz001",
  },
  {
    id: "ord-8813",
    userId: "u-1004",
    amount: 19.99,
    currency: "USD",
    status: "failed",
    plan: "Pro Monthly",
    createdAt: "2026-05-29T07:08:00.000Z",
    stripeEventId: "evt_1Qzz021",
  },
  {
    id: "ord-8814",
    userId: "u-1003",
    amount: 49.0,
    currency: "USD",
    status: "paid",
    plan: "Studio Monthly",
    createdAt: "2026-05-28T11:44:00.000Z",
    stripeEventId: "evt_1Qzz099",
  },
];

const seedSubscriptions: MockSubscription[] = [
  {
    id: "sub-221",
    userId: "u-1002",
    plan: "Pro Monthly",
    status: "active",
    startedAt: "2026-05-30T18:14:22.000Z",
    renewAt: "2026-06-30T18:14:22.000Z",
  },
  {
    id: "sub-222",
    userId: "u-1004",
    plan: "Pro Monthly",
    status: "past_due",
    startedAt: "2026-04-29T07:08:00.000Z",
    renewAt: "2026-05-29T07:08:00.000Z",
  },
  {
    id: "sub-223",
    userId: "u-admin-001",
    plan: "Studio Annual",
    status: "active",
    startedAt: "2026-01-03T08:00:00.000Z",
    renewAt: "2027-01-03T08:00:00.000Z",
  },
];

const seedCreditRecords: MockCreditRecord[] = [
  {
    id: "cr-7301",
    userId: "u-1002",
    orderId: "ord-8812",
    type: "topup",
    delta: 1000,
    balanceAfter: 920,
    reason: "Topup via Stripe",
    createdAt: "2026-05-30T18:15:11.000Z",
  },
  {
    id: "cr-7302",
    userId: "u-1002",
    projectId: "p-9002",
    type: "consume",
    delta: -84,
    balanceAfter: 836,
    reason: "PPT generation (12 pages)",
    createdAt: "2026-05-31T07:22:09.000Z",
  },
  {
    id: "cr-7303",
    userId: "u-1003",
    projectId: "p-9003",
    type: "consume",
    delta: -96,
    balanceAfter: 112,
    reason: "Video generation (12 frames)",
    createdAt: "2026-05-30T12:30:10.000Z",
  },
  {
    id: "cr-7304",
    userId: "u-1003",
    projectId: "p-9003",
    type: "refund",
    delta: 40,
    balanceAfter: 152,
    reason: "Partial refund for failed frames",
    createdAt: "2026-05-30T13:20:10.000Z",
  },
  {
    id: "cr-7305",
    userId: "u-1004",
    type: "adjustment",
    delta: -12,
    balanceAfter: -12,
    reason: "Subscription past due settlement",
    createdAt: "2026-05-29T12:00:00.000Z",
  },
];

const seedWebhookLogs: MockWebhookLog[] = [
  {
    id: "wh-501",
    eventType: "invoice.payment_succeeded",
    orderId: "ord-8812",
    status: "ok",
    createdAt: "2026-05-30T18:14:22.000Z",
  },
  {
    id: "wh-502",
    eventType: "invoice.payment_failed",
    orderId: "ord-8813",
    status: "failed",
    errorMessage: "Card declined",
    createdAt: "2026-05-29T07:08:42.000Z",
  },
];

const seedBillingAnomalies: MockBillingAnomaly[] = [
  {
    id: "ab-001",
    type: "payment_success_no_credit",
    userId: "u-1001",
    orderId: "ord-8821",
    status: "open",
    summary: "Payment success but no topup record created",
    createdAt: "2026-05-31T02:15:00.000Z",
  },
  {
    id: "ab-002",
    type: "project_failed_no_refund",
    userId: "u-1003",
    projectId: "p-9003",
    status: "open",
    summary: "Project failed with missing refund for 7 frames",
    createdAt: "2026-05-30T12:49:00.000Z",
  },
  {
    id: "ab-003",
    type: "negative_credit",
    userId: "u-1004",
    status: "open",
    summary: "User balance below zero",
    createdAt: "2026-05-29T12:02:00.000Z",
  },
  {
    id: "ab-004",
    type: "webhook_failed",
    orderId: "ord-8813",
    status: "handled",
    summary: "Stripe webhook retried and recovered",
    createdAt: "2026-05-29T07:20:00.000Z",
  },
];

const seedTickets: MockTicket[] = [
  {
    id: "tk-9001",
    userId: "u-1003",
    projectId: "p-9003",
    logId: "log-5002",
    creditRecordId: "cr-7303",
    title: "视频第8帧生成失败",
    content: "用户反馈视频第8帧一直失败，怀疑是模型问题。",
    status: "pending",
    priority: "P1",
    type: "bug",
    assignee: "ops-li",
    internalNotes: ["等待 image2 服务日志复核"],
    createdAt: "2026-05-30T12:48:00.000Z",
    updatedAt: "2026-05-30T13:00:00.000Z",
  },
  {
    id: "tk-9002",
    userId: "u-1004",
    title: "会员扣费失败但权限未回收",
    content: "订阅到期后仍显示会员功能。",
    status: "in_progress",
    priority: "P0",
    type: "billing",
    assignee: "ops-wang",
    internalNotes: ["已拉取 webhook 重放日志"],
    createdAt: "2026-05-29T08:10:00.000Z",
    updatedAt: "2026-05-30T09:55:00.000Z",
  },
  {
    id: "tk-9003",
    userId: "u-1001",
    projectId: "p-9001",
    title: "建议增加海报封面模板",
    content: "希望支持更强的 YouTube 封面风格。",
    status: "no_action",
    priority: "P3",
    type: "feature",
    assignee: "product-chen",
    internalNotes: ["并入 Q3 模板计划"],
    createdAt: "2026-05-31T01:40:00.000Z",
    updatedAt: "2026-05-31T02:01:00.000Z",
  },
];

const seedCases: MockCaseConfig[] = [
  {
    id: "case-301",
    projectId: "p-9005",
    title: "Claude Code 学习路线（8页）",
    description: "从入门到实战，按章节推进。",
    tags: ["AI", "编程", "教程"],
    order: 10,
    online: true,
    coverUrl: "/case/business-cycle-works.png",
  },
  {
    id: "case-302",
    projectId: "p-9001",
    title: "焦虑与拖延机制海报",
    description: "一图看懂心理机制和打断动作。",
    tags: ["心理学", "科普"],
    order: 20,
    online: true,
    coverUrl: "/picture/176e6527-21ef-4528-a0fc-91c879a00b4c.png",
  },
  {
    id: "case-303",
    projectId: "p-9002",
    title: "地球板块构造 12 页 PPT",
    description: "适合课堂讲解的地理知识结构。",
    tags: ["地理", "课堂"],
    order: 30,
    online: false,
    coverUrl: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png",
  },
];

const seedSettings: MockSystemSettings = {
  defaultTextModel: "GPT-5.4",
  defaultImageModel: "image2-tuzi",
  creditRules: {
    posterBase: 12,
    pptPerPage: 7,
    videoPerFrame: 8,
  },
  adminRoles: [
    { userId: "u-admin-001", role: "owner" },
    { userId: "u-1002", role: "admin" },
    { userId: "u-1001", role: "ops" },
  ],
  switches: {
    pauseImageGeneration: false,
    pausePptExport: false,
    pauseVideoGeneration: false,
    maintenanceMode: false,
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createAdminConsoleMockData(): AdminConsoleData {
  return {
    users: clone(seedUsers),
    projects: clone(seedProjects),
    logs: clone(seedLogs),
    orders: clone(seedOrders),
    subscriptions: clone(seedSubscriptions),
    creditRecords: clone(seedCreditRecords),
    webhookLogs: clone(seedWebhookLogs),
    billingAnomalies: clone(seedBillingAnomalies),
    tickets: clone(seedTickets),
    cases: clone(seedCases),
    settings: clone(seedSettings),
  };
}

function includesQuery(parts: Array<string | number | undefined>, query: string) {
  const merged = parts
    .map((item) => (item == null ? "" : String(item).toLowerCase()))
    .join(" ");
  return merged.includes(query);
}

export function searchAdminGlobal(data: AdminConsoleData, keyword: string): GlobalSearchResult[] {
  const q = keyword.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const users = data.users
    .filter((user) => includesQuery([user.id, user.email, user.name], q))
    .slice(0, 5)
    .map<GlobalSearchResult>((user) => ({
      group: "用户",
      id: `g-user-${user.id}`,
      title: user.email,
      subtitle: user.id,
      kind: "user",
      refId: user.id,
    }));

  const projects = data.projects
    .filter((project) => includesQuery([project.id, project.topic, project.requestId], q))
    .slice(0, 5)
    .map<GlobalSearchResult>((project) => ({
      group: "项目",
      id: `g-project-${project.id}`,
      title: project.topic,
      subtitle: project.id,
      kind: "project",
      refId: project.id,
    }));

  const orders = data.orders
    .filter((order) => includesQuery([order.id, order.status, order.plan], q))
    .slice(0, 5)
    .map<GlobalSearchResult>((order) => ({
      group: "订单",
      id: `g-order-${order.id}`,
      title: order.id,
      subtitle: `${order.plan} · ${order.status}`,
      kind: "order",
      refId: order.id,
    }));

  const logs = data.logs
    .filter((log) => includesQuery([log.id, log.requestId, log.action, log.type], q))
    .slice(0, 5)
    .map<GlobalSearchResult>((log) => ({
      group: "日志",
      id: `g-log-${log.id}`,
      title: log.requestId,
      subtitle: `${log.type}/${log.action} · ${log.status}`,
      kind: "log",
      refId: log.id,
    }));

  const errors = data.logs
    .filter((log) => Boolean(log.errorId) && includesQuery([log.errorId, log.errorCode, log.errorSummary], q))
    .slice(0, 5)
    .map<GlobalSearchResult>((log) => ({
      group: "错误",
      id: `g-error-${log.errorId}`,
      title: log.errorId || "-",
      subtitle: log.errorSummary || log.errorCode || "-",
      kind: "error",
      refId: log.errorId || "",
    }));

  return [...users, ...projects, ...orders, ...logs, ...errors];
}

export function getUserById(data: AdminConsoleData, userId: string) {
  return data.users.find((item) => item.id === userId) || null;
}

export function getProjectById(data: AdminConsoleData, projectId: string) {
  return data.projects.find((item) => item.id === projectId) || null;
}

export function getLogById(data: AdminConsoleData, logId: string) {
  return data.logs.find((item) => item.id === logId) || null;
}

export function getOrderById(data: AdminConsoleData, orderId: string) {
  return data.orders.find((item) => item.id === orderId) || null;
}
