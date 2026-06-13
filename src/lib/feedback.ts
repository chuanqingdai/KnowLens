export type FeedbackRecord = {
  id: string;
  type: string;
  detail: string;
  contact: string;
  createdAt: string;
  attachments: string[];
  submitterEmail?: string;
  submitterName?: string;
  status?: "open" | "replied";
  adminReply?: string;
  repliedAt?: string;
  repliedBy?: string;
};

export const FEEDBACK_STORAGE_KEY = "knowlens_feedback_records_v1";

export function getFeedbackRecords() {
  if (typeof window === "undefined") {
    return [] as FeedbackRecord[];
  }
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) {
      return [] as FeedbackRecord[];
    }
    const parsed = JSON.parse(raw) as FeedbackRecord[];
    return parsed.map((item) => ({
      ...item,
      status: item.adminReply?.trim() ? "replied" : (item.status ?? "open"),
    }));
  } catch {
    return [] as FeedbackRecord[];
  }
}

export function saveFeedbackRecords(records: FeedbackRecord[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(records));
}

export function replyFeedbackRecord(
  recordId: string,
  reply: string,
  repliedBy: string,
): FeedbackRecord[] {
  const records = getFeedbackRecords();
  const next = records.map((item) => {
    if (item.id !== recordId) {
      return item;
    }
    return {
      ...item,
      adminReply: reply.trim(),
      repliedBy,
      repliedAt: new Date().toISOString(),
      status: "replied" as const,
    };
  });
  saveFeedbackRecords(next);
  return next;
}
