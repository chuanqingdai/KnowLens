export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "inactive" | "active" | "canceling" | "canceled";

export type SubscriptionSnapshot = {
  planId: string;
  planName: string;
  cycle: BillingCycle;
  status: SubscriptionStatus;
  startedAt: string;
  renewAt: string;
  canceledAt?: string;
};

export type CreditRecord = {
  id: string;
  createdAt: string;
  type: "consume" | "topup" | "refund";
  description: string;
  delta: number;
  balance: number;
  userId?: string;
  userEmail?: string;
  projectId?: string;
  projectTitle?: string;
};

const SUBSCRIPTION_KEY = "scilens_subscription_v1";
const CREDIT_RECORDS_KEY = "scilens_credit_records_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isClient() {
  return typeof window !== "undefined";
}

export function getSubscription(): SubscriptionSnapshot | null {
  if (!isClient()) {
    return null;
  }
  return safeParse<SubscriptionSnapshot>(window.localStorage.getItem(SUBSCRIPTION_KEY));
}

export function saveSubscription(snapshot: SubscriptionSnapshot) {
  if (!isClient()) {
    return;
  }
  window.localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(snapshot));
}

function addMonths(base: Date, months: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function activateSubscription(planId: string, planName: string, cycle: BillingCycle) {
  const now = new Date();
  const renewAt = cycle === "yearly" ? addMonths(now, 12) : addMonths(now, 1);
  const snapshot: SubscriptionSnapshot = {
    planId,
    planName,
    cycle,
    status: "active",
    startedAt: now.toISOString(),
    renewAt: renewAt.toISOString(),
  };
  saveSubscription(snapshot);
  return snapshot;
}

export function cancelSubscription() {
  const current = getSubscription();
  if (!current) {
    return null;
  }
  const next: SubscriptionSnapshot = {
    ...current,
    status: "canceling",
    canceledAt: new Date().toISOString(),
  };
  saveSubscription(next);
  return next;
}

function seedCreditRecords() {
  const now = Date.now();
  const initialBalance = 80;
  const records: CreditRecord[] = [
    {
      id: "seed-1",
      createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
      type: "consume",
      description: "火山喷发项目 · 分镜生成",
      delta: -20,
      balance: initialBalance,
      userId: "u-admin",
      userEmail: "chuanqingdai@gmail.com",
      projectId: "p-admin-001",
      projectTitle: "行星运动与万有引力可视化课程",
    },
    {
      id: "seed-2",
      createdAt: new Date(now - 1000 * 60 * 60 * 28).toISOString(),
      type: "consume",
      description: "潮汐原理项目 · 图片重绘",
      delta: -12,
      balance: 100,
      userId: "u-001",
      userEmail: "lin@example.com",
      projectId: "p-002",
      projectTitle: "潮汐原理可视化长图",
    },
    {
      id: "seed-3",
      createdAt: new Date(now - 1000 * 60 * 60 * 40).toISOString(),
      type: "topup",
      description: "会员积分到账",
      delta: 120,
      balance: 112,
      userId: "u-admin",
      userEmail: "chuanqingdai@gmail.com",
    },
  ];
  window.localStorage.setItem(CREDIT_RECORDS_KEY, JSON.stringify(records));
  return records;
}

export function getCreditRecords() {
  if (!isClient()) {
    return [] as CreditRecord[];
  }
  const parsed = safeParse<CreditRecord[]>(window.localStorage.getItem(CREDIT_RECORDS_KEY));
  if (parsed && parsed.length) {
    return parsed;
  }
  return seedCreditRecords();
}

export function appendCreditRecord(input: Omit<CreditRecord, "id" | "createdAt" | "balance">) {
  if (!isClient()) {
    return null;
  }
  const existing = getCreditRecords();
  const latestBalance = existing[0]?.balance ?? 80;
  const nextBalance = latestBalance + input.delta;
  const nextRecord: CreditRecord = {
    id: `record-${Date.now()}`,
    createdAt: new Date().toISOString(),
    balance: nextBalance,
    ...input,
  };
  const nextRecords = [nextRecord, ...existing];
  window.localStorage.setItem(CREDIT_RECORDS_KEY, JSON.stringify(nextRecords));
  return nextRecord;
}
