export type FeedbackRecord = {
  id: string;
  type: string;
  detail: string;
  contact: string;
  createdAt: string;
  attachments: string[];
};

export const FEEDBACK_STORAGE_KEY = "scilens_feedback_records_v1";

export function getFeedbackRecords() {
  if (typeof window === "undefined") {
    return [] as FeedbackRecord[];
  }
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) {
      return [] as FeedbackRecord[];
    }
    return JSON.parse(raw) as FeedbackRecord[];
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
