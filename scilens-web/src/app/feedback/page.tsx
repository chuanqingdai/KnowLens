"use client";

import { useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  FolderOpen,
  Home as HomeIcon,
  ImagePlus,
  LoaderCircle,
  Send,
  UserCircle2,
  X,
} from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import {
  getFeedbackRecords,
  saveFeedbackRecords,
  type FeedbackRecord,
} from "@/lib/feedback";

const navItems = [
  { label: "首页", icon: HomeIcon, href: "/" },
  { label: "我的项目", icon: FolderOpen, href: "/projects" },
  { label: "个人主页", icon: UserCircle2, href: "/profile" },
];

const quickTags = ["Bug 反馈", "交互体验", "模型效果", "导出问题", "功能建议"];

function formatDate(input: string) {
  return new Date(input).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FeedbackPage() {
  const [selectedTag, setSelectedTag] = useState(quickTags[0]);
  const [detail, setDetail] = useState("");
  const [contact, setContact] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<FeedbackRecord[]>(() => getFeedbackRecords());
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
      setError("请选择反馈类型");
      return;
    }
    if (detailLength < 10) {
      setError("请至少输入 10 个字，帮助我们更快定位问题");
      return;
    }
    setError("");
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const newRecord: FeedbackRecord = {
      id: `fb-${Date.now()}`,
      type: selectedTag,
      detail: detail.trim(),
      contact: contact.trim(),
      createdAt: new Date().toISOString(),
      attachments: attachments.map((file) => file.name),
    };

    const nextRecords = [newRecord, ...records].slice(0, 5);
    setRecords(nextRecords);
    saveFeedbackRecords(nextRecords);

    setDetail("");
    setContact("");
    setAttachments([]);
    setSubmitting(false);
    setSubmitSuccess(true);
    window.setTimeout(() => setSubmitSuccess(false), 2500);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">
      <SidebarNav items={navItems} />
      <main className="px-4 pb-10 pt-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mx-auto max-w-4xl">
          <header className="mb-5">
            <p className="text-sm text-zinc-500">Scilens</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">用户反馈</h1>
            <p className="mt-1 text-sm text-zinc-600">
              你可以提交问题或建议，我们会优先处理高频反馈。
            </p>
          </header>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm font-medium text-zinc-900">反馈类型</p>
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
              <label className="mb-1 block text-sm font-medium text-zinc-900">详细描述</label>
              <textarea
                value={detail}
                onChange={(event) => {
                  setDetail(event.target.value);
                  if (error) {
                    setError("");
                  }
                }}
                className="h-40 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
                placeholder="请描述你遇到的问题或建议，例如：在哪个页面、做了什么操作、你期望的结果是什么。"
              />
              <p className="mt-1 text-xs text-zinc-500">至少 10 个字，当前 {detailLength} 字</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">
                  联系方式（可选）
                </label>
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="邮箱 / 微信 / 手机号，方便回访"
                  className="h-10 w-full rounded-xl border border-zinc-300 px-3 text-sm text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-900">
                  上传截图（可选）
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
                  添加附件
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
                        aria-label="移除附件"
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
                反馈已提交，感谢你的建议！
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
                    提交中...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    提交反馈
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-medium text-zinc-900">最近反馈记录</h2>
            {!records.length ? (
              <p className="mt-2 text-sm text-zinc-500">暂无记录，提交后会显示在这里。</p>
            ) : (
              <div className="mt-3 space-y-2">
                {records.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-zinc-900 px-2 py-0.5 text-xs text-white">
                        {record.type}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDate(record.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{record.detail}</p>
                    {record.contact ? (
                      <p className="mt-1 text-xs text-zinc-500">联系方式：{record.contact}</p>
                    ) : null}
                    {record.attachments.length ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        附件：{record.attachments.join(" / ")}
                      </p>
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
