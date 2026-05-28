"use client";

import { useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CircleCheck,
  Clock3,
  FolderOpen,
  Home as HomeIcon,
  ImagePlus,
  LoaderCircle,
  Send,
  UserCircle2,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import {
  getFeedbackRecords,
  replyFeedbackRecord,
  saveFeedbackRecords,
  type FeedbackRecord,
} from "@/lib/feedback";
import { resolveRoleByEmail } from "@/lib/auth";

const navItems = [
  { label: "Home", icon: HomeIcon, href: "/app" },
  { label: "My Projects", icon: FolderOpen, href: "/projects" },
  { label: "Profile", icon: UserCircle2, href: "/profile" },
];

const quickTags = ["Bug Report", "UX Feedback", "Model Quality", "Export Issue", "Feature Request"];

function formatDate(input: string) {
  return new Date(input).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emailAlias(email?: string) {
  const normalized = (email || "").trim().toLowerCase();
  const namePart = normalized.split("@")[0]?.trim() || "Guest";
  return namePart || "Guest";
}

function avatarInitial(name?: string) {
  const safe = (name || "G").trim();
  return (safe[0] || "G").toUpperCase();
}

function createFeedbackId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `fb-${crypto.randomUUID()}`;
  }
  return `fb-${Math.random().toString(36).slice(2, 10)}`;
}

export default function FeedbackPage() {
  const { data: session } = useSession();
  const currentEmail = (session?.user?.email || "").trim().toLowerCase();
  const isAdmin = resolveRoleByEmail(currentEmail) === "admin";
  const [selectedTag, setSelectedTag] = useState(quickTags[0]);
  const [detail, setDetail] = useState("");
  const [contact, setContact] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<FeedbackRecord[]>(() => getFeedbackRecords());
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const detailLength = detail.trim().length;
  const canSubmit = useMemo(() => {
    return Boolean(selectedTag && detailLength >= 10 && !submitting);
  }, [selectedTag, detailLength, submitting]);

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }
    setAttachments((prev) => [...prev, ...files].slice(0, 4));
    event.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmit() {
    if (!selectedTag) {
      setError("Please select a feedback type.");
      return;
    }
    if (detailLength < 10) {
      setError("Please enter at least 10 characters so I can locate the issue faster.");
      return;
    }
    setError("");
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const newRecord: FeedbackRecord = {
      id: createFeedbackId(),
      type: selectedTag,
      detail: detail.trim(),
      contact: contact.trim(),
      createdAt: new Date().toISOString(),
      attachments: attachments.map((file) => file.name),
      submitterEmail: currentEmail || undefined,
      submitterName: emailAlias(currentEmail || undefined),
      status: "open",
    };

    const nextRecords = [newRecord, ...records];
    setRecords(nextRecords);
    saveFeedbackRecords(nextRecords);

    setDetail("");
    setContact("");
    setAttachments([]);
    setSubmitting(false);
    setSubmitSuccess(true);
    window.setTimeout(() => setSubmitSuccess(false), 2500);
  }

  function handleReply(recordId: string) {
    if (!isAdmin) {
      return;
    }
    const draft = (replyDrafts[recordId] || "").trim();
    if (draft.length < 3) {
      return;
    }
    const next = replyFeedbackRecord(recordId, draft, emailAlias(currentEmail));
    setRecords(next);
    setReplyDrafts((prev) => ({ ...prev, [recordId]: "" }));
  }

  const visibleRecords = (() => {
    if (isAdmin) {
      return records;
    }
    if (!currentEmail) {
      return records.filter((record) => !record.submitterEmail);
    }
    return records.filter(
      (record) => (record.submitterEmail || "").trim().toLowerCase() === currentEmail,
    );
  })();

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-3 pb-10 pt-4 sm:px-6 sm:pt-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-4xl">
          <header className="mb-5">
            <p className="text-sm text-zinc-500">KnowLens.ai</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Feedback</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Share bugs, suggestions, or product ideas. Frequent issues are prioritized first.
            </p>
          </header>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm font-medium text-zinc-900">Feedback Type</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedTag(tag);
                    if (error) {
                      setError("");
                    }
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                    selectedTag === tag
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-zinc-900">Details</label>
              <textarea
                value={detail}
                onChange={(event) => {
                  setDetail(event.target.value);
                  if (error) {
                    setError("");
                  }
                }}
                className="h-40 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
                placeholder="Describe what happened, where it happened, what you did, and what you expected."
              />
              <p className="mt-1 text-xs text-zinc-500">Minimum 10 characters. Current: {detailLength}</p>
            </div>

            <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">
                  Contact (optional)
                </label>
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="Email or other contact info for follow-up"
                  className="h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">
                  Attachments (optional)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFilesChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  <ImagePlus size={14} />
                  Add Attachment
                </button>
              </div>
            </div>

            {attachments.length ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                <div className="space-y-1.5">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        aria-label="Remove attachment"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {submitSuccess ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CircleCheck size={14} />
                Feedback submitted. Thank you for helping improve KnowLens.ai.
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {submitting ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-900">Submission History</h2>
              <span className="text-xs text-zinc-500">
                {isAdmin ? "Admin view: all feedback" : "Your feedback only"}
              </span>
            </div>
            {!visibleRecords.length ? (
              <p className="mt-2 text-sm text-zinc-500">
                No records yet. Submitted feedback will appear here.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {visibleRecords.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
                          {avatarInitial(record.submitterName || record.submitterEmail)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-zinc-800">
                            {emailAlias(record.submitterName || record.submitterEmail)}
                          </p>
                          <p className="text-[11px] text-zinc-500">{formatDate(record.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-zinc-900 px-2 py-0.5 text-xs text-white">
                          {record.type}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                            record.status === "replied"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {record.status === "replied" ? (
                            <>
                              <BadgeCheck size={12} />
                              Replied
                            </>
                          ) : (
                            <>
                              <Clock3 size={12} />
                              Open
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{record.detail}</p>
                    {record.contact ? (
                      <p className="mt-1 text-xs text-zinc-500">Contact: {record.contact}</p>
                    ) : null}
                    {record.attachments.length ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Attachments: {record.attachments.join(" / ")}
                      </p>
                    ) : null}
                    {record.adminReply ? (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <p className="text-[11px] font-medium text-emerald-700">
                          Admin Reply
                          {record.repliedBy ? ` · ${record.repliedBy}` : ""}
                          {record.repliedAt ? ` · ${formatDate(record.repliedAt)}` : ""}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-emerald-900">{record.adminReply}</p>
                      </div>
                    ) : null}
                    {isAdmin ? (
                      <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                          Admin reply
                        </label>
                        <textarea
                          value={replyDrafts[record.id] || ""}
                          onChange={(event) =>
                            setReplyDrafts((prev) => ({
                              ...prev,
                              [record.id]: event.target.value,
                            }))
                          }
                          placeholder="Reply to this feedback..."
                          className="h-20 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-500"
                        />
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleReply(record.id)}
                            disabled={(replyDrafts[record.id] || "").trim().length < 3}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                          >
                            <Send size={12} />
                            Send reply
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
