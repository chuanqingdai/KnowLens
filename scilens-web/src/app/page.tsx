"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

import {
  Check,
  ChevronDown,
  CirclePlus,
  FileText,
  FolderOpen,
  Globe,
  Home as HomeIcon,
  ImagePlay,
  Link2,
  SendHorizontal,
  Upload,
  UserCircle2,
  X,
  Zap,
} from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";

const navItems = [
  { label: "首页", icon: HomeIcon, href: "/" },
  { label: "我的项目", icon: FolderOpen, href: "/projects" },
  { label: "个人主页", icon: UserCircle2, href: "/profile" },
];

const recentProjects = [
  {
    id: "p1",
    title: "黑洞真相",
    updatedAt: "更新于 2026-04-11",
    cover: "/picture/f49e94e8-81c8-4982-830c-a5f87128eae5.png",
    format: "海报",
  },
  {
    id: "p2",
    title: "电解反应",
    updatedAt: "更新于 2026-02-26",
    cover: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png",
    format: "PPT",
  },
  {
    id: "p3",
    title: "免疫机制",
    updatedAt: "更新于 2026-02-26",
    cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png",
    format: "视频",
    duration: "01:42",
  },
];

const feedCategories = [
  "全部",
  "天文",
  "经济",
  "历史",
  "生物",
  "地理",
  "物理",
  "医学",
];

const templateFeedItems = [
  {
    id: "feed-1",
    title: "潮汐原理 1 分钟视觉拆解",
    author: "scilens_lab",
    views: 3482,
    likes: 216,
    cover: "/picture/176e6527-21ef-4528-a0fc-91c879a00b4c.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "视频",
    duration: "01:18",
  },
  {
    id: "feed-2",
    title: "火山喷发机制科普卡片组",
    author: "geology_daily",
    views: 2901,
    likes: 173,
    cover: "/picture/39f7e57c-2e46-4e53-8ba6-756b22ef6437.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "PPT",
  },
  {
    id: "feed-3",
    title: "光合作用分镜教学版",
    author: "bio_classroom",
    views: 4120,
    likes: 301,
    cover: "/picture/0207e54b-cd89-4f61-99b2-3d5041609e73.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "海报",
  },
  {
    id: "feed-4",
    title: "黑洞与时空弯曲长图",
    author: "astro_studio",
    views: 3875,
    likes: 245,
    cover: "/picture/eab2accf-e36a-45a2-89bb-0faa73e518e6.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "视频",
    duration: "02:06",
  },
  {
    id: "feed-5",
    title: "电解反应实验可视化",
    author: "chem_visuals",
    views: 2184,
    likes: 128,
    cover: "/picture/fb1ec712-8275-4b22-989b-756e17684fbe.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "PPT",
  },
  {
    id: "feed-6",
    title: "DNA 复制流程动图脚本",
    author: "gene_space",
    views: 4512,
    likes: 337,
    cover: "/picture/c24ee34d-8ee2-498a-b95d-c17d30640f2a.png",
    coverWidth: 941,
    coverHeight: 1672,
    format: "海报",
  },
  {
    id: "feed-7",
    title: "地震波传播路径解释图",
    author: "earth_scope",
    views: 1965,
    likes: 94,
    cover: "/picture/989f14bd-ff95-4298-a091-57a54ac5332f.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "PPT",
  },
  {
    id: "feed-8",
    title: "免疫记忆机制动画分镜",
    author: "med_edu",
    views: 3687,
    likes: 222,
    cover: "/picture/3f6e9b7d-0d47-4dae-8b43-9be1bd35c232.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "视频",
    duration: "00:54",
  },
  {
    id: "feed-9",
    title: "细胞分裂课堂长图版",
    author: "bio_notes",
    views: 2756,
    likes: 146,
    cover: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png",
    coverWidth: 941,
    coverHeight: 1672,
    format: "海报",
  },
  {
    id: "feed-10",
    title: "免疫防线三层机制",
    author: "med_visual",
    views: 3198,
    likes: 188,
    cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png",
    coverWidth: 941,
    coverHeight: 1672,
    format: "PPT",
  },
  {
    id: "feed-11",
    title: "星系形成过程速览",
    author: "astro_graph",
    views: 2294,
    likes: 121,
    cover: "/picture/feb2b176-157f-44f9-ac52-5a271e25ed6e.png",
    coverWidth: 941,
    coverHeight: 1672,
    format: "视频",
    duration: "01:26",
  },
  {
    id: "feed-12",
    title: "行星轨道与引力关系",
    author: "space_class",
    views: 3544,
    likes: 207,
    cover: "/picture/f49e94e8-81c8-4982-830c-a5f87128eae5.png",
    coverWidth: 1122,
    coverHeight: 1402,
    format: "海报",
  },
  {
    id: "feed-13",
    title: "地层结构图解合集",
    author: "earth_scope",
    views: 2679,
    likes: 139,
    cover: "/picture/9cfe9227-c75b-40d0-a459-8d85064a1e55.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "PPT",
  },
  {
    id: "feed-14",
    title: "熔岩冷却后的地貌演化",
    author: "geo_lab",
    views: 3017,
    likes: 176,
    cover: "/picture/feae00f9-c831-47b1-9b6d-c08b70701e62.png",
    coverWidth: 1672,
    coverHeight: 941,
    format: "视频",
    duration: "01:03",
  },
];

const textModelOptions = [
  {
    value: "gpt-4.1",
    label: "GPT-4.1",
    desc: "结构化推理能力强，适合知识拆解和脚本生成。",
  },
  {
    value: "gpt-4o",
    label: "GPT-4o",
    desc: "多模态理解更均衡，适合图文混合输入场景。",
  },
];

const videoModelOptions = [
  {
    value: "gpt-image2",
    label: "GPT Image2",
    desc: "出图速度快，适合封面草图和知识图解首稿。",
  },
  {
    value: "kling-1.6",
    label: "Kling 1.6",
    desc: "镜头运动自然，适合短视频分镜动态生成。",
  },
];

const inputPlaceholders = [
  "输入你想讲清楚的知识点，例如“为什么会有潮汐”",
  "直接粘贴网页链接，让 Scilens 自动提炼核心信息",
  "上传 PDF、PPT 或文档，快速生成可视化科普内容",
];

type SourceKind = "file" | "web" | "youtube";

type SourceItem = {
  id: string;
  kind: SourceKind;
  name: string;
  origin: string;
  status: "extracting" | "ready";
  excerpt: string;
};

const supportedUploadAccept = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
  ".m4a",
].join(",");

function guessLinkKind(url: URL): SourceKind {
  const host = url.hostname.replace("www.", "");
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "youtube";
  }
  return "web";
}

function hasValidYoutubeVideoId(url: URL) {
  const host = url.hostname.replace("www.", "");
  if (host.includes("youtu.be")) {
    const id = url.pathname.replace("/", "").trim();
    return id.length >= 6;
  }
  if (host.includes("youtube.com")) {
    const videoId = url.searchParams.get("v")?.trim() ?? "";
    return videoId.length >= 6;
  }
  return false;
}

async function extractFromFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const canReadText =
    file.type.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv");

  if (canReadText) {
    const rawText = await file.text();
    const cleaned = rawText.replace(/\s+/g, " ").trim();
    if (cleaned.length > 180) {
      return `${cleaned.slice(0, 180)}...`;
    }
    return cleaned || "文本内容较短，已完成解析。";
  }

  if (file.type.startsWith("image/")) {
    return `已识别图片素材「${file.name}」，可用于自动图文解释与画面提示词生成。`;
  }

  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
    return `已识别音视频素材「${file.name}」，已完成字幕草稿提取，可继续用于脚本生成。`;
  }

  return `已识别文档「${file.name}」，已提取目录与关键段落，可继续生成可视化内容。`;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [textModel, setTextModel] = useState(textModelOptions[0].value);
  const [videoModel, setVideoModel] = useState(videoModelOptions[0].value);
  const [openMenu, setOpenMenu] = useState<"text" | "video" | null>(null);
  const [composeInput, setComposeInput] = useState("");
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeCategory, setActiveCategory] = useState(feedCategories[0]);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuLayerRef = useRef<HTMLDivElement | null>(null);

  const selectedTextModel =
    textModelOptions.find((item) => item.value === textModel) ?? textModelOptions[0];
  const selectedVideoModel =
    videoModelOptions.find((item) => item.value === videoModel) ?? videoModelOptions[0];

  useEffect(() => {
    const currentText = inputPlaceholders[placeholderIndex];
    const typedDone = typedPlaceholder === currentText;
    const deletedDone = typedPlaceholder.length === 0;

    let delay = isDeleting ? 35 : 65;
    if (!isDeleting && typedDone) {
      delay = 1300;
    } else if (isDeleting && deletedDone) {
      delay = 240;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting) {
        if (typedDone) {
          setIsDeleting(true);
          return;
        }
        setTypedPlaceholder(currentText.slice(0, typedPlaceholder.length + 1));
        return;
      }

      if (deletedDone) {
        setIsDeleting(false);
        setPlaceholderIndex((prev) => (prev + 1) % inputPlaceholders.length);
        return;
      }
      setTypedPlaceholder(currentText.slice(0, typedPlaceholder.length - 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [typedPlaceholder, isDeleting, placeholderIndex]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuLayerRef.current) {
        return;
      }
      if (!menuLayerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setLinkInputOpen(false);
        setLinkError("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!uploadToast) {
      return;
    }
    const timer = window.setTimeout(() => setUploadToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [uploadToast]);

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const items = files.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "file" as SourceKind,
      name: file.name,
      origin: file.name,
      status: "extracting" as const,
      excerpt: "正在提取文本内容...",
    }));

    setSourceItems((prev) => [...items, ...prev].slice(0, 6));

    const extracted = await Promise.all(
      files.map(async (file, idx) => {
        const excerpt = await extractFromFile(file);
        return { id: items[idx].id, excerpt };
      }),
    );

    setSourceItems((prev) =>
      prev.map((item) => {
        const target = extracted.find((x) => x.id === item.id);
        if (!target) {
          return item;
        }
        return {
          ...item,
          status: "ready",
          excerpt: target.excerpt,
        };
      }),
    );
    setUploadToast(`已导入 ${files.length} 个文件，文本提取完成`);
    event.target.value = "";
  }

  async function handleSubmitLink() {
    const value = linkValue.trim();
    if (!value) {
      setLinkError("请输入网页链接或 YouTube 链接");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      setLinkError("链接格式不正确，请输入完整 URL（含 http:// 或 https://）");
      return;
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      setLinkError("仅支持 http / https 链接");
      return;
    }

    const kind = guessLinkKind(parsed);
    const isYoutube = kind === "youtube";

    if (isYoutube && !hasValidYoutubeVideoId(parsed)) {
      setLinkError("YouTube 链接缺少有效视频 ID，请检查后重试");
      return;
    }

    if (!isYoutube && !parsed.hostname.includes(".")) {
      setLinkError("网页链接域名不完整，请输入可访问的网页 URL");
      return;
    }

    const itemId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pendingItem: SourceItem = {
      id: itemId,
      kind,
      name: isYoutube ? "YouTube 视频" : "网页链接",
      origin: value,
      status: "extracting",
      excerpt: isYoutube ? "正在提取视频字幕..." : "正在提取网页正文...",
    };

    setSourceItems((prev) => [pendingItem, ...prev].slice(0, 6));
    setLinkValue("");
    setLinkInputOpen(false);
    setLinkError("");

    await new Promise((resolve) => window.setTimeout(resolve, 700));

    setSourceItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        return {
          ...item,
          status: "ready",
          excerpt: isYoutube
            ? "字幕提取完成：本视频主要讲解核心概念、关键步骤与实际案例。"
            : "正文提取完成：已识别标题、核心观点与主要段落，可继续生成脚本。",
        };
      }),
    );
    setUploadToast(isYoutube ? "YouTube 字幕提取完成" : "网页正文提取完成");
  }

  function removeSourceItem(id: string) {
    setSourceItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleGoGenerate() {
    const payload = {
      prompt: composeInput.trim(),
      textModel,
      imageModel: videoModel,
      sources: sourceItems,
    };
    if (typeof window !== "undefined") {
      sessionStorage.setItem("scilens-home-draft", JSON.stringify(payload));
    }
    router.push("/workspace");
  }

  return (
    <div className="min-h-screen bg-page text-zinc-900">
      <SidebarNav items={navItems} />

      <main className="px-4 py-6 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="fixed right-6 top-6 z-50 hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            <Zap size={15} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">80</span>
            <span className="text-zinc-500">|</span>
            <span className="font-medium">升级</span>
          </button>
          <button
            type="button"
            aria-label="用户中心"
            title="用户中心"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2d8cff] text-white transition hover:brightness-95"
          >
            <UserCircle2 size={19} />
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <div className="grid grid-cols-3 gap-2 md:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.href)}
                    aria-label={item.label}
                    title={item.label}
                    className={`flex h-11 items-center justify-center rounded-md border ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700"
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>

            <div className="h-2" />

            <section className="relative z-20 mx-auto flex min-h-[56vh] w-full max-w-3xl flex-col justify-center">
              <div className="mb-6 flex flex-col items-center text-center">
                <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
                  <span className="text-blue-600">SciLens</span> 知识可视化创作
                </h1>
                <p className="mt-2 text-base text-zinc-500">
                  将网页、视频和播客等内容，一键转化为可视化长图、PPT 或视频
                </p>
              </div>

              <div
                ref={menuLayerRef}
                className="relative rounded-[30px] border border-zinc-200 bg-zinc-50 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={supportedUploadAccept}
                  onChange={handleUploadChange}
                  className="hidden"
                />
                <label className="block">
                  <span className="sr-only">创作输入</span>
                  <textarea
                    value={composeInput}
                    onChange={(event) => setComposeInput(event.target.value)}
                    className="h-52 min-h-44 w-full max-h-64 resize-y rounded-[30px] bg-transparent px-6 py-6 pb-20 text-base leading-7 text-zinc-800 outline-none placeholder:text-zinc-400"
                    placeholder={typedPlaceholder}
                  />
                </label>

                {sourceItems.length ? (
                  <div className="mx-5 mt-1 rounded-2xl border border-zinc-200 bg-white/85 p-2">
                    <div className="space-y-1.5">
                      {sourceItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                        >
                          <span className="mt-0.5 text-zinc-500">
                            {item.kind === "youtube" ? (
                              <ImagePlay size={13} />
                            ) : item.kind === "web" ? (
                              <Globe size={13} />
                            ) : (
                              <FileText size={13} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-zinc-900">
                              {item.name}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500">{item.origin}</p>
                            <p className="mt-0.5 text-[11px] leading-4 text-zinc-600">
                              {item.excerpt}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                                item.status === "ready"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {item.status === "ready" ? "已提取" : "提取中"}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSourceItem(item.id)}
                              className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                              aria-label="移除来源"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 px-5 py-4">
                  <div className="pointer-events-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="上传资料"
                      title="上传资料"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                    >
                      <Upload size={15} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkInputOpen((prev) => !prev);
                          setLinkError("");
                        }}
                        aria-label="添加链接"
                        title="添加链接"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                      >
                        <Link2 size={15} />
                      </button>
                      {linkInputOpen ? (
                        <div className="absolute bottom-12 left-0 z-[80] w-[min(92vw,440px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
                          <p className="mb-2 text-sm text-zinc-500">
                            支持网页链接和 YouTube 链接
                          </p>
                          <input
                            value={linkValue}
                            onChange={(event) => {
                              setLinkValue(event.target.value);
                              if (linkError) {
                                setLinkError("");
                              }
                            }}
                            placeholder="粘贴链接后回车或点击提取"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleSubmitLink();
                              }
                            }}
                            className="h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSubmitLink()}
                            className="mt-3 inline-flex h-9 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                          >
                            提取文本
                          </button>
                          {linkError ? (
                            <p className="mt-2 text-xs text-red-600">{linkError}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="pointer-events-auto flex items-center gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenu((prev) => (prev === "text" ? null : "text"))}
                        className="inline-flex h-10 w-40 items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                      >
                        {selectedTextModel.label}
                        <ChevronDown
                          size={14}
                          className={`text-zinc-500 transition ${openMenu === "text" ? "rotate-180" : ""}`}
                        />
                      </button>
                      {openMenu === "text" ? (
                        <div className="absolute bottom-12 left-0 z-[80] w-[270px] rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
                          {textModelOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setTextModel(option.value);
                                setOpenMenu(null);
                              }}
                              className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-zinc-100"
                            >
                              <span className="flex items-center justify-between text-sm font-medium text-zinc-900">
                                {option.label}
                                {textModel === option.value ? <Check size={14} /> : null}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                {option.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenu((prev) => (prev === "video" ? null : "video"))}
                        className="inline-flex h-10 w-40 items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                      >
                        {selectedVideoModel.label}
                        <ChevronDown
                          size={14}
                          className={`text-zinc-500 transition ${openMenu === "video" ? "rotate-180" : ""}`}
                        />
                      </button>
                      {openMenu === "video" ? (
                        <div className="absolute bottom-12 left-0 z-[80] w-[270px] rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
                          {videoModelOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setVideoModel(option.value);
                                setOpenMenu(null);
                              }}
                              className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-zinc-100"
                            >
                              <span className="flex items-center justify-between text-sm font-medium text-zinc-900">
                                {option.label}
                                {videoModel === option.value ? <Check size={14} /> : null}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                {option.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoGenerate}
                    className="pointer-events-auto ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
                  >
                    <SendHorizontal size={15} />
                    生成
                  </button>
                </div>
              </div>
            </section>

            <section className="mx-auto w-full max-w-6xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  最近项目
                </h2>
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="text-sm text-zinc-500 transition hover:text-zinc-800"
                >
                  查看全部
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  className="rounded-2xl border border-dashed border-zinc-300 bg-white p-2 text-left transition hover:border-zinc-400 hover:text-zinc-600"
                >
                  <div className="flex h-44 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                    <CirclePlus size={30} />
                  </div>
                  <p className="px-1 pb-1 pt-3 text-lg font-medium leading-none text-zinc-900">
                    New Project
                  </p>
                </button>
                {recentProjects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                  >
                    <div
                      className="relative aspect-video w-full rounded-xl bg-zinc-100 bg-cover bg-center"
                      style={{ backgroundImage: `url("${project.cover}")` }}
                    >
                      <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                        {project.format}
                      </span>
                      {project.format === "视频" && project.duration ? (
                        <span className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                          {project.duration}
                        </span>
                      ) : null}
                    </div>
                    <div className="px-1 pb-1 pt-3">
                      <p className="text-lg font-medium leading-none text-zinc-900">
                        {project.title}
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">{project.updatedAt}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mx-auto w-full max-w-6xl">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900">
                优秀案例
              </h2>
              <div className="mb-4 flex flex-wrap gap-2">
                {feedCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      activeCategory === category
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="columns-1 gap-4 [column-gap:1rem] md:columns-2 xl:columns-4">
                {templateFeedItems.map((item) => (
                  <article
                    key={item.id}
                    className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)]"
                  >
                    <div className="relative w-full bg-zinc-100">
                      <Image
                        src={item.cover}
                        alt={item.title}
                        width={item.coverWidth}
                        height={item.coverHeight}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        className="h-auto w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                        {item.format}
                      </span>
                      {item.format === "视频" && item.duration ? (
                        <span className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] text-white">
                          {item.duration}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="text-lg font-medium leading-6 text-zinc-900">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
                        <span>@{item.author}</span>
                        <span>
                          {item.views} 观看 · {item.likes} 喜欢
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
        </div>
      </main>
      {uploadToast ? (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {uploadToast}
        </div>
      ) : null}
    </div>
  );
}
