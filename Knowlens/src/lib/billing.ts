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

const SUBSCRIPTION_KEY = "knowlens_subscription_v1";
const CREDIT_RECORDS_KEY = "knowlens_credit_records_v1";
const LOCAL_DEV_EMAIL = "local@knowlens.ai";
const LOCAL_DEV_CREDIT_TARGET = 500;
const LOCAL_DEV_CREDIT_INIT_KEY = "knowlens_local_dev_credit_init_v1";

function normalizeScope(email?: string | null) {
  const value = (email ?? "").trim().toLowerCase();
  return value || "guest";
}

function scopedKey(base: string, email?: string | null) {
  return `${base}:${normalizeScope(email)}`;
}

function isLocalDevEmail(email?: string | null) {
  return normalizeScope(email) === LOCAL_DEV_EMAIL;
}

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

export function getSubscriptionByUser(email?: string | null): SubscriptionSnapshot | null {
  if (!isClient()) {
    return null;
  }
  if (!email) {
    return null;
  }

  const scoped = safeParse<SubscriptionSnapshot>(
    window.localStorage.getItem(scopedKey(SUBSCRIPTION_KEY, email)),
  );
  if (scoped) {
    return scoped;
  }

  const legacy = safeParse<SubscriptionSnapshot>(window.localStorage.getItem(SUBSCRIPTION_KEY));
  if (!legacy) {
    return null;
  }
  window.localStorage.setItem(scopedKey(SUBSCRIPTION_KEY, email), JSON.stringify(legacy));
  return legacy;
}

export function saveSubscription(snapshot: SubscriptionSnapshot, email?: string | null) {
  if (!isClient()) {
    return;
  }
  if (!email) {
    window.localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(snapshot));
    return;
  }
  window.localStorage.setItem(scopedKey(SUBSCRIPTION_KEY, email), JSON.stringify(snapshot));
}

function addMonths(base: Date, months: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function activateSubscription(
  planId: string,
  planName: string,
  cycle: BillingCycle,
  email?: string | null,
) {
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
  saveSubscription(snapshot, email);
  return snapshot;
}

export function cancelSubscription(email?: string | null) {
  const current = getSubscriptionByUser(email);
  if (!current) {
    return null;
  }
  const next: SubscriptionSnapshot = {
    ...current,
    status: "canceling",
    canceledAt: new Date().toISOString(),
  };
  saveSubscription(next, email);
  return next;
}

export function getCreditRecords(email?: string | null) {
  if (!isClient()) {
    return [] as CreditRecord[];
  }
  const key = email ? scopedKey(CREDIT_RECORDS_KEY, email) : CREDIT_RECORDS_KEY;
  const parsed = safeParse<CreditRecord[]>(window.localStorage.getItem(key)) ?? [];
  const initKey = scopedKey(LOCAL_DEV_CREDIT_INIT_KEY, email);
  const shouldInitLocalDevCredits =
    Boolean(email) &&
    isLocalDevEmail(email) &&
    window.localStorage.getItem(initKey) !== "1";
  if (shouldInitLocalDevCredits) {
    const latestBalance = parsed[0]?.balance ?? 50;
    const delta = LOCAL_DEV_CREDIT_TARGET - latestBalance;
    const nextRecord: CreditRecord = {
      id: `record-${Date.now()}`,
      createdAt: new Date().toISOString(),
      type: delta >= 0 ? "topup" : "refund",
      description: "Local development credit alignment",
      delta,
      balance: LOCAL_DEV_CREDIT_TARGET,
      userEmail: normalizeScope(email),
    };
    const nextRecords = [nextRecord, ...parsed];
    window.localStorage.setItem(key, JSON.stringify(nextRecords));
    window.localStorage.setItem(initKey, "1");
    return nextRecords;
  }
  if (parsed.length) {
    return parsed;
  }

  if (!email) {
    return [] as CreditRecord[];
  }

  const legacy = safeParse<CreditRecord[]>(window.localStorage.getItem(CREDIT_RECORDS_KEY));
  if (!legacy?.length) {
    return [] as CreditRecord[];
  }
  const normalizedEmail = normalizeScope(email);
  const filtered = legacy.filter(
    (item) => (item.userEmail ?? "").trim().toLowerCase() === normalizedEmail,
  );
  window.localStorage.setItem(key, JSON.stringify(filtered));
  if (isLocalDevEmail(email)) {
    window.localStorage.removeItem(scopedKey(LOCAL_DEV_CREDIT_INIT_KEY, email));
  }
  return filtered;
}

export function appendCreditRecord(
  input: Omit<CreditRecord, "id" | "createdAt" | "balance">,
  email?: string | null,
) {
  if (!isClient()) {
    return null;
  }
  const scopeEmail = input.userEmail ?? email;
  const existing = getCreditRecords(scopeEmail);
  const latestBalance = existing[0]?.balance ?? 50;
  const nextBalance = latestBalance + input.delta;
  const nextRecord: CreditRecord = {
    id: `record-${Date.now()}`,
    createdAt: new Date().toISOString(),
    balance: nextBalance,
    ...input,
  };
  const nextRecords = [nextRecord, ...existing];
  const key = scopeEmail ? scopedKey(CREDIT_RECORDS_KEY, scopeEmail) : CREDIT_RECORDS_KEY;
  window.localStorage.setItem(key, JSON.stringify(nextRecords));
  return nextRecord;
}

export function setCreditRecords(
  records: CreditRecord[],
  email?: string | null,
) {
  if (!isClient()) {
    return;
  }
  const key = email ? scopedKey(CREDIT_RECORDS_KEY, email) : CREDIT_RECORDS_KEY;
  window.localStorage.setItem(key, JSON.stringify(records));
}

export async function syncCreditRecordsFromServer(email?: string | null) {
  if (!isClient()) {
    return [] as CreditRecord[];
  }
  const scopeEmail = (email ?? "").trim().toLowerCase();
  if (!scopeEmail) {
    return getCreditRecords(email);
  }
  const response = await fetch("/api/billing/credits", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`CREDIT_SYNC_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as {
    ok?: boolean;
    records?: CreditRecord[];
  };
  const records = Array.isArray(payload.records) ? payload.records : [];
  setCreditRecords(records, scopeEmail);
  return records;
}
