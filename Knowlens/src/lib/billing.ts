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

export type CheckoutReturnNotice = {
  status: "success" | "error";
  message: string;
  returnPath?: string;
  source?: string;
  createdAt: string;
};

const SUBSCRIPTION_KEY = "knowlens_subscription_v1";
const CREDIT_RECORDS_KEY = "knowlens_credit_records_v1";
const CHECKOUT_RETURN_NOTICE_KEY = "knowlens-checkout-return-notice-v1";

function normalizeScope(email?: string | null) {
  const value = (email ?? "").trim().toLowerCase();
  return value || "guest";
}

function scopedKey(base: string, email?: string | null) {
  return `${base}:${normalizeScope(email)}`;
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
  return filtered;
}

function syncCreditRecordToServer(
  input: Omit<CreditRecord, "id" | "createdAt" | "balance">,
  email?: string | null,
) {
  if (!isClient()) {
    return;
  }
  const scopeEmail = input.userEmail ?? email;
  if (!scopeEmail) {
    return;
  }
  void appendCreditRecordOnServer(input, scopeEmail).catch(() => {
    // Keep the optimistic local cache; the next server sync will correct it.
  });
}

export async function appendCreditRecordOnServer(
  input: Omit<CreditRecord, "id" | "createdAt" | "balance"> & {
    runId?: string;
    jobId?: string;
    entrySource?: string;
    estimatedCreditsCost?: number;
    creditsBefore?: number;
    creditsAfter?: number;
    creditBalanceSource?: string;
    consumeResult?: "success" | "failure" | "unknown";
    refundReason?: string;
  },
  email?: string | null,
) {
  if (!isClient()) {
    return null;
  }
  const scopeEmail = input.userEmail ?? email;
  if (!scopeEmail) {
    return null;
  }
  const response = await fetch("/api/billing/credits", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      type: input.type,
      description: input.description,
      delta: input.delta,
      userId: input.userId,
      projectId: input.projectId,
      projectTitle: input.projectTitle,
      runId: input.runId,
      jobId: input.jobId,
      entrySource: input.entrySource,
      estimatedCreditsCost: input.estimatedCreditsCost,
      creditsBefore: input.creditsBefore,
      creditsAfter: input.creditsAfter,
      creditBalanceSource: input.creditBalanceSource,
      consumeResult: input.consumeResult,
      refundReason: input.refundReason,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    records?: CreditRecord[];
    code?: string;
    error?: string;
  };
  if (!response.ok) {
    await syncCreditRecordsFromServer(scopeEmail).catch(() => undefined);
    throw new Error(payload.code || payload.error || `CREDIT_WRITE_HTTP_${response.status}`);
  }
  const records = Array.isArray(payload.records) ? payload.records : [];
  setCreditRecords(records, scopeEmail);
  return records[0] ?? null;
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
  syncCreditRecordToServer(input, email);
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

export function saveCheckoutReturnNotice(notice: CheckoutReturnNotice) {
  if (!isClient()) {
    return;
  }
  window.sessionStorage.setItem(CHECKOUT_RETURN_NOTICE_KEY, JSON.stringify(notice));
}

export function readCheckoutReturnNotice() {
  if (!isClient()) {
    return null as CheckoutReturnNotice | null;
  }
  return safeParse<CheckoutReturnNotice>(window.sessionStorage.getItem(CHECKOUT_RETURN_NOTICE_KEY));
}

export function consumeCheckoutReturnNotice() {
  if (!isClient()) {
    return null as CheckoutReturnNotice | null;
  }
  const notice = readCheckoutReturnNotice();
  window.sessionStorage.removeItem(CHECKOUT_RETURN_NOTICE_KEY);
  return notice;
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
    subscription?: SubscriptionSnapshot | null;
  };
  const records = Array.isArray(payload.records) ? payload.records : [];
  setCreditRecords(records, scopeEmail);
  if (payload.subscription) {
    saveSubscription(payload.subscription, scopeEmail);
  }
  return records;
}
