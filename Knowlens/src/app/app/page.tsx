"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  Check,
  ChevronDown,
  Crown,
  FileText,
  FolderOpen,
  Globe,
  Headphones,
  Heart,
  Home as HomeIcon,
  ImagePlay,
  Link2,
  Minus,
  Plus,
  SendHorizontal,
  UserCircle2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import { getProjectsByUser } from "@/lib/admin";
import { UserMenu } from "@/components/auth/UserMenu";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getCreditRecords, getSubscriptionByUser } from "@/lib/billing";
import {
  getCaseMetrics,
  incrementCaseView,
  getResolvedFeaturedCases,
  type FeaturedCaseItem,
  featuredCategories as feedCategories,
  normalizeCategoryLabel,
  normalizeFormatLabel,
  toggleCaseLike,
} from "@/lib/featured-cases";
import { PaywallDialog } from "@/components/billing/PaywallDialog";

const navItems = [
  { key: "home", label: "Home", icon: HomeIcon, href: "/app" },
  { key: "projects", label: "Projects", icon: FolderOpen, href: "/projects" },
  { key: "profile", label: "Profile", icon: UserCircle2, href: "/profile" },
];

const recentProjects = [
  {
    id: "p1",
    title: "Black Hole Truth",
    updatedAt: "Updated on 2026-04-11",
    cover: "/picture/f49e94e8-81c8-4982-830c-a5f87128eae5.png",
    format: "Poster",
  },
  {
    id: "p2",
    title: "Electrolysis Reaction",
    updatedAt: "Updated on 2026-02-26",
    cover: "/picture/8755ea1a-c5cc-4644-a505-553ec5905d71.png",
    format: "PPT",
  },
  {
    id: "p3",
    title: "Immune Mechanism",
    updatedAt: "Updated on 2026-02-26",
    cover: "/picture/e32aee6b-1845-409c-b91a-d7667e2f4381.png",
    format: "Video",
    duration: "01:42",
  },
];


const textModelOptions = [
  {
    value: "gemini-2.5",
    label: "Gemini 2.5",
    desc: "Free model for quick drafting and daily content generation.",
    premium: false,
  },
  {
    value: "deepseek-v4",
    label: "DeepSeek V4",
    desc: "Free model with strong bilingual drafting quality.",
    premium: false,
  },
  {
    value: "gpt-5.5",
    label: "GPT-5.5",
    desc: "Premium model for the highest-quality reasoning and writing.",
    premium: true,
  },
  {
    value: "gpt-5.4",
    label: "GPT-5.4",
    desc: "Premium model for stable high-quality generation.",
    premium: true,
  },
  {
    value: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    desc: "Premium model for complex long-context understanding.",
    premium: true,
  },
  {
    value: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    desc: "Premium model for polished language quality and refinement.",
    premium: true,
  },
];

function defaultFreeModelByLocale(locale: "en" | "zh") {
  return locale === "zh" ? "deepseek-v4" : "gemini-2.5";
}

const inputPlaceholders = [
  'Describe what you want to explain, for example: "Why do tides happen?"',
  "Paste a webpage URL and let KnowLens.ai extract key points automatically",
  "Upload a PDF, PPT, or document to generate visual learning content quickly",
];

type SourceKind = "file" | "web" | "youtube" | "podcast";

type SourceItem = {
  id: string;
  kind: SourceKind;
  name: string;
  origin: string;
  status: "extracting" | "ready";
  excerpt: string;
};

function normalizeLegacySourceName(name: string) {
  if (name === "网页链接") {
    return "Web URL";
  }
  if (name === "YouTube 视频") {
    return "YouTube Video";
  }
  if (name === "播客链接") {
    return "Podcast Link";
  }
  return name;
}

function normalizeLegacySourceExcerpt(excerpt: string) {
  if (excerpt === "正在提取文本内容...") {
    return "Extracting text content...";
  }
  if (excerpt === "正在提取视频字幕...") {
    return "Extracting video transcript...";
  }
  if (excerpt === "正在提取网页正文...") {
    return "Extracting webpage text...";
  }
  if (excerpt === "正在提取播客字幕...") {
    return "Extracting podcast transcript...";
  }
  if (excerpt === "文本内容较短，已完成解析。") {
    return "The extracted text is short. Parsing completed.";
  }
  if (excerpt.includes("字幕提取完成")) {
    return "Transcript extracted: key concepts, steps, and practical examples were detected.";
  }
  if (excerpt.includes("正文提取完成")) {
    return "Text extracted: title, key viewpoints, and main sections were identified.";
  }
  if (excerpt.includes("播客字幕提取完成")) {
    return "Transcript extracted: key arguments, examples, and speaking structure were identified.";
  }
  if (excerpt.includes("已识别图片素材")) {
    return "Image source detected. It can be used for visual explanation and prompt generation.";
  }
  if (excerpt.includes("已识别音视频素材")) {
    return "Audio/video source detected. Transcript draft extracted and ready for scripting.";
  }
  if (excerpt.includes("已识别文档")) {
    return "Document detected. Outline and key paragraphs extracted for visual generation.";
  }
  return excerpt;
}

const projectTitleEnMap: Record<string, string> = {
  "火山喷发过程科普 PPT": "Volcanic Eruption Explainer PPT",
  "潮汐原理可视化长图": "Tide Mechanism Visual Poster",
  "DNA 复制流程演示": "DNA Replication Process",
  "行星运动与万有引力可视化课程": "Planetary Motion & Gravity Course",
  "细胞分裂全过程课堂 PPT": "Cell Division Classroom PPT",
  "货币通胀机制图解短视频": "Inflation Mechanism Short Video",
  "地震波传播与板块运动长图": "Seismic Waves & Plate Tectonics Poster",
};

function formatRecentProjectTitle(title: string, locale: "en" | "zh", index: number) {
  if (locale !== "en") {
    return title;
  }
  const mapped = projectTitleEnMap[title];
  if (mapped) {
    return mapped;
  }
  const hasCjk = /[\u3400-\u9fff]/.test(title);
  if (hasCjk) {
    return `Visual Knowledge Project ${index + 1}`;
  }
  return title;
}

const supportedUploadAccept = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".epub",
  ".ppt",
  ".pptx",
  ".key",
  ".xls",
  ".xlsx",
  ".csv",
  ".tsv",
  ".json",
  ".xml",
  ".txt",
  ".md",
  ".srt",
  ".vtt",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".aac",
  ".ogg",
].join(",");

const MIN_COMPOSER_HEIGHT = 132;
const MAX_COMPOSER_HEIGHT = 260;
const DEFAULT_COVER_FALLBACK = "/picture/text-to-poster.png";
const ENABLE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_IMAGE_LOAD === "true";
const loadedImageCache = new Set<string>();

type ProgressiveCoverProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
};

function ProgressiveCover({
  src,
  fallbackSrc,
  alt,
  className = "h-full w-full object-cover",
  loading = "lazy",
}: ProgressiveCoverProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [loaded, setLoaded] = useState(() => loadedImageCache.has(src));
  const [attemptedFallback, setAttemptedFallback] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgSrc(src);
    setAttemptedFallback(false);
    setLoaded(loadedImageCache.has(src));
  }, [src]);

  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      loadedImageCache.add(imgSrc);
      setLoaded(true);
    }
  }, [imgSrc]);

  return (
    <div className="relative h-full w-full">
      <div
        className={`absolute inset-0 bg-zinc-200 transition-opacity ${
          loaded ? "opacity-0" : "animate-pulse opacity-100"
        }`}
      />
      <img
        src={imgSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        ref={imageRef}
        onLoad={() => {
          loadedImageCache.add(imgSrc);
          setLoaded(true);
        }}
        onError={() => {
          if (fallbackSrc && !attemptedFallback && imgSrc !== fallbackSrc) {
            if (ENABLE_IMAGE_DEBUG) {
              console.error("[ImageDebug][app] optimized cover failed, fallback enabled", {
                src,
                fallbackSrc,
                currentSrc: imgSrc,
                alt,
                page: typeof window !== "undefined" ? window.location.pathname : "",
              });
            }
            setImgSrc(fallbackSrc);
            setAttemptedFallback(true);
            setLoaded(false);
            return;
          }
          if (imgSrc !== DEFAULT_COVER_FALLBACK) {
            if (ENABLE_IMAGE_DEBUG) {
              console.error("[ImageDebug][app] fallback cover failed, use default cover", {
                src,
                fallbackSrc,
                currentSrc: imgSrc,
                defaultFallback: DEFAULT_COVER_FALLBACK,
                alt,
                page: typeof window !== "undefined" ? window.location.pathname : "",
              });
            }
            setImgSrc(DEFAULT_COVER_FALLBACK);
            setLoaded(false);
            return;
          }
          if (ENABLE_IMAGE_DEBUG) {
            console.error("[ImageDebug][app] default cover failed", {
              src,
              fallbackSrc,
              currentSrc: imgSrc,
              alt,
              page: typeof window !== "undefined" ? window.location.pathname : "",
            });
          }
          setLoaded(true);
        }}
        className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function toOptimizedCaseCover(path: string) {
  return `/app-optimized${path}`;
}

function guessLinkKind(url: URL): SourceKind {
  const host = url.hostname.replace("www.", "");
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "youtube";
  }
  if (isPodcastLink(url)) {
    return "podcast";
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

function isPodcastLink(url: URL) {
  const host = url.hostname.replace("www.", "").toLowerCase();
  const path = url.pathname.toLowerCase();

  if (
    host.includes("podcasts.apple.com") ||
    host.includes("open.spotify.com") ||
    host.includes("anchor.fm") ||
    host.includes("castbox.fm") ||
    host.includes("overcast.fm") ||
    host.includes("pocketcasts.com") ||
    host.includes("xiaoyuzhoufm.com") ||
    host.includes("music.163.com")
  ) {
    return true;
  }

  if (host.includes("podcast") || path.includes("/podcast")) {
    return true;
  }

  return /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(path);
}

function isMediaFile(file: File) {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    return true;
  }
  return /\.(mp4|mov|avi|mkv|mp3|wav|m4a|flac|aac|ogg)$/i.test(file.name.toLowerCase());
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
    return cleaned || "The extracted text is short. Parsing completed.";
  }

  if (file.type.startsWith("image/")) {
    return `Image source detected: "${file.name}". It can be used for visual explanation and prompt generation.`;
  }

  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
    return `Audio/video source detected: "${file.name}". Transcript draft extracted and ready for scripting.`;
  }

  return `Document detected: "${file.name}". Outline and key paragraphs extracted for visual generation.`;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { locale } = useLocale();
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  const [textModel, setTextModel] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<"text" | null>(null);
  const [textMenuOpenUp, setTextMenuOpenUp] = useState(true);
  const [textMenuMaxHeight, setTextMenuMaxHeight] = useState(360);
  const [composeInput, setComposeInput] = useState("");
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const [modelPaywallOpen, setModelPaywallOpen] = useState(false);
  const [mediaUploadPaywallOpen, setMediaUploadPaywallOpen] = useState(false);
  const hasMembership = useMemo(() => {
    const subscription = getSubscriptionByUser(currentEmail);
    return !!subscription && (subscription.status === "active" || subscription.status === "canceling");
  }, [currentEmail]);
  const currentCredits = useMemo(() => getCreditRecords(currentEmail)[0]?.balance ?? 80, [currentEmail]);
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeCategory, setActiveCategory] = useState(feedCategories[0]);
  const [featuredItems] = useState<FeaturedCaseItem[]>(() => getResolvedFeaturedCases());
  const [featuredVisibleCount, setFeaturedVisibleCount] = useState(8);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FeaturedCaseItem | null>(null);
  const [previewPaywallOpen, setPreviewPaywallOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [isStartingWorkspace, setIsStartingWorkspace] = useState(false);
  const [, setMetricVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuLayerRef = useRef<HTMLDivElement | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const textModelButtonRef = useRef<HTMLButtonElement | null>(null);
  const featuredLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  const resolvedTextModel = textModel ?? defaultFreeModelByLocale(locale);
  const selectedTextModel =
    textModelOptions.find((item) => item.value === resolvedTextModel) ?? textModelOptions[0];

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

  useEffect(() => {
    const node = composeRef.current;
    if (!node) {
      return;
    }
    node.style.height = `${MIN_COMPOSER_HEIGHT}px`;
    const nextHeight = Math.min(node.scrollHeight, MAX_COMPOSER_HEIGHT);
    node.style.height = `${Math.max(nextHeight, MIN_COMPOSER_HEIGHT)}px`;
    node.style.overflowY = node.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [composeInput]);

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    const blockedMediaFiles = selectedFiles.filter((file) => isMediaFile(file));
    const allowedFiles =
      !hasMembership && blockedMediaFiles.length
        ? selectedFiles.filter((file) => !isMediaFile(file))
        : selectedFiles;

    if (!hasMembership && blockedMediaFiles.length) {
      setMediaUploadPaywallOpen(true);
      setUploadToast(
        `Audio/video files require a premium model (GPT-5.5). ${blockedMediaFiles.length} file(s) blocked.`,
      );
    }

    const files = allowedFiles;
    if (!files.length) {
      event.target.value = "";
      return;
    }

    const items = files.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "file" as SourceKind,
      name: file.name,
      origin: file.name,
      status: "extracting" as const,
      excerpt: "Extracting text content...",
    }));

    setSourceItems((prev) => [...items, ...prev]);
    setUploadProgress({ done: 0, total: files.length });

    const extracted: Array<{ id: string; excerpt: string }> = [];
    for (let idx = 0; idx < files.length; idx += 1) {
      const excerpt = await extractFromFile(files[idx]);
      extracted.push({ id: items[idx].id, excerpt });
      setUploadProgress({ done: idx + 1, total: files.length });
    }

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
    window.setTimeout(() => setUploadProgress(null), 500);
    setUploadToast(`Imported ${files.length} file(s). Text extraction completed.`);
    event.target.value = "";
  }

  async function handleSubmitLink() {
    const value = linkValue.trim();
    if (!value) {
      setLinkError("Please enter a webpage, YouTube, or podcast URL.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      setLinkError("Invalid link format. Enter a full URL including http:// or https://.");
      return;
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      setLinkError("Only http and https links are supported.");
      return;
    }

    const kind = guessLinkKind(parsed);
    const isYoutube = kind === "youtube";

    if (isYoutube && !hasValidYoutubeVideoId(parsed)) {
      setLinkError("The YouTube URL is missing a valid video ID. Please check and try again.");
      return;
    }

    if (!isYoutube && !parsed.hostname.includes(".")) {
      setLinkError("Incomplete domain. Please enter an accessible webpage URL.");
      return;
    }

    const itemId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pendingItem: SourceItem = {
      id: itemId,
      kind,
      name: isYoutube ? "YouTube Video" : kind === "podcast" ? "Podcast Link" : "Web URL",
      origin: value,
      status: "extracting",
      excerpt:
        kind === "youtube"
          ? "Extracting video transcript..."
          : kind === "podcast"
            ? "Extracting podcast transcript..."
            : "Extracting webpage text...",
    };

    setSourceItems((prev) => [pendingItem, ...prev]);
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
          excerpt:
            kind === "youtube"
              ? "Transcript extracted: key concepts, steps, and practical examples were detected."
              : kind === "podcast"
                ? "Transcript extracted: key arguments, examples, and speaking structure were identified."
                : "Text extracted: title, key viewpoints, and main sections were identified.",
        };
      }),
    );
    setUploadToast(
      kind === "youtube"
        ? "YouTube transcript extraction completed."
        : kind === "podcast"
          ? "Podcast transcript extraction completed."
          : "Webpage text extraction completed.",
    );
  }

  function removeSourceItem(id: string) {
    setSourceItems((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleTextModelMenu() {
    if (openMenu === "text") {
      setOpenMenu(null);
      return;
    }
    const rect = textModelButtonRef.current?.getBoundingClientRect();
    const viewportHeight =
      typeof window === "undefined" ? 800 : window.innerHeight || 800;
    const spaceAbove = rect ? rect.top : viewportHeight * 0.5;
    const spaceBelow = rect ? viewportHeight - rect.bottom : viewportHeight * 0.5;
    const openUp = spaceAbove >= spaceBelow;
    const available = openUp ? spaceAbove - 16 : spaceBelow - 16;
    setTextMenuOpenUp(openUp);
    setTextMenuMaxHeight(Math.max(180, Math.min(available, 420)));
    setOpenMenu("text");
  }

  function openMembershipFromHome() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("membership:return-path", pathname || "/");
    }
    router.push("/membership");
  }

  async function handleGoGenerate() {
    if (isStartingWorkspace) {
      return;
    }
    const payload = {
      prompt: composeInput.trim(),
      textModel: resolvedTextModel,
      imageModel: "gpt-image2",
      sources: sourceItems,
    };
    setIsStartingWorkspace(true);
    try {
      const response = await fetch("/api/workspace/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        payload?: typeof payload;
        error?: string;
      };
      if (!response.ok || !data?.ok || !data.payload) {
        setUploadToast(data?.error || "Unable to start a new project right now. Please try again later.");
        return;
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("knowlens-home-draft", JSON.stringify(data.payload));
      }
      router.push("/workspace");
    } catch {
      setUploadToast("Unable to start a new project right now. Please try again later.");
    } finally {
      setIsStartingWorkspace(false);
    }
  }

  function handleFeaturedDownload() {
    if (!previewItem) {
      return;
    }
    if (!hasMembership) {
      setPreviewPaywallOpen(true);
      return;
    }
    const link = document.createElement("a");
    link.href = previewItem.cover;
    link.download = `${toFileSlug(previewItem.title)}.png`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openFeaturedPreview(item: FeaturedCaseItem) {
    incrementCaseView(item.id, currentEmail);
    setMetricVersion((prev) => prev + 1);
    setPreviewZoom(1);
    setPreviewItem(item);
  }

  function closeFeaturedPreview() {
    setPreviewZoom(1);
    setPreviewItem(null);
  }

  function applyPreviewZoom(nextZoom: number) {
    const clamped = Math.max(1, Math.min(3, Number(nextZoom.toFixed(2))));
    setPreviewZoom(clamped);

    window.requestAnimationFrame(() => {
      const node = previewScrollRef.current;
      if (!node || clamped <= 1) {
        return;
      }
      const centerX = Math.max(0, (node.scrollWidth - node.clientWidth) / 2);
      const centerY = Math.max(0, (node.scrollHeight - node.clientHeight) / 2);
      node.scrollTo({ left: centerX, top: centerY, behavior: "smooth" });
    });
  }

  function handleFeaturedCategoryChange(category: string) {
    setActiveCategory(category);
    setFeaturedVisibleCount(8);
  }

  function handleToggleLike(item: FeaturedCaseItem) {
    toggleCaseLike(item.id, currentEmail);
    setMetricVersion((prev) => prev + 1);
  }

  const localizedNavItems = navItems.map((item) => ({
    label: item.label,
    icon: item.icon,
    href: item.href,
  }));

  const resolvedRecentProjects = useMemo(() => {
    if (!currentEmail) {
      return recentProjects;
    }
    const covers = recentProjects.map((item) => item.cover);
    const ownedProjects = getProjectsByUser(currentEmail)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return ownedProjects.slice(0, 8).map((project, index) => ({
      id: project.id,
      title: formatRecentProjectTitle(project.title, locale, index),
      updatedAt: `Updated ${project.updatedAt}`,
      cover: covers[index % covers.length] || recentProjects[0].cover,
      format: normalizeFormatLabel(project.format || "海报"),
      duration: project.duration,
    }));
  }, [currentEmail, locale]);

  const featuredFilteredItems = useMemo(
    () =>
      featuredItems.filter(
        (item) =>
          activeCategory === "All" || normalizeCategoryLabel(item.category) === activeCategory,
      ),
    [activeCategory, featuredItems],
  );

  const featuredVisibleItems = useMemo(
    () => featuredFilteredItems.slice(0, featuredVisibleCount),
    [featuredFilteredItems, featuredVisibleCount],
  );

  const hasMoreFeaturedItems = featuredVisibleCount < featuredFilteredItems.length;

  useEffect(() => {
    const target = featuredLoadMoreRef.current;
    if (!target || !hasMoreFeaturedItems) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        setFeaturedVisibleCount((prev) => Math.min(prev + 8, featuredFilteredItems.length));
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreFeaturedItems, featuredFilteredItems.length]);

  return (
    <div className="min-h-screen bg-page text-zinc-900">
      <SidebarNav items={localizedNavItems} />

      <main className="px-3 py-4 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mb-3 flex items-center justify-end gap-2 md:hidden">
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
          >
            <Zap size={14} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">{currentCredits}</span>
            <span className="text-zinc-500">|</span>
            <span className="font-medium">Upgrade</span>
          </button>
          <UserMenu />
        </div>
        <div className="fixed right-6 top-6 z-50 hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            <Zap size={15} className="text-zinc-500" />
            <span className="font-medium text-zinc-900">{currentCredits}</span>
            <span className="text-zinc-500">|</span>
            <span className="font-medium">Upgrade</span>
          </button>
          <UserMenu />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
            <div className="grid grid-cols-3 gap-2 md:hidden">
              {localizedNavItems.map((item) => {
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

            <div className="h-1 sm:h-2" />

            <section className="relative z-20 mx-auto flex min-h-[48vh] w-full max-w-3xl flex-col justify-center sm:min-h-[56vh]">
              <div className="mb-6 flex flex-col items-center text-center">
                <h1 className="text-[30px] font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                  <span className="text-blue-600">KnowLens.ai</span> Visual Creation Studio
                </h1>
                <p className="mt-2 text-sm text-zinc-500 sm:text-base">
                  Turn webpages, videos, and podcasts into visual long-form graphics, PPTs, or
                  videos.
                </p>
              </div>

              <div
                ref={menuLayerRef}
                className="rounded-[30px] border border-zinc-200 bg-zinc-50 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
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
                  <span className="sr-only">Creation input</span>
                  <textarea
                    ref={composeRef}
                    value={composeInput}
                    onChange={(event) => setComposeInput(event.target.value)}
                    className="w-full resize-none rounded-t-[30px] bg-transparent px-6 py-6 text-base leading-7 text-zinc-800 outline-none placeholder:text-zinc-400"
                    placeholder={typedPlaceholder}
                  />
                </label>

                {sourceItems.length ? (
                  <div className="mx-5 mt-1 rounded-2xl border border-zinc-200 bg-white/85 p-2">
                    <div className="max-h-56 space-y-1.5 overflow-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
                      {sourceItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                        >
                          <span className="mt-0.5 text-zinc-500">
                            {item.kind === "youtube" ? (
                              <ImagePlay size={13} />
                            ) : item.kind === "podcast" ? (
                              <Headphones size={13} />
                            ) : item.kind === "web" ? (
                              <Globe size={13} />
                            ) : (
                              <FileText size={13} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-zinc-900">
                              {normalizeLegacySourceName(item.name)}
                            </p>
                            <p className="truncate text-[11px] text-zinc-500">{item.origin}</p>
                            <p className="mt-0.5 text-[11px] leading-4 text-zinc-600">
                              {normalizeLegacySourceExcerpt(item.excerpt)}
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
                              {item.status === "ready" ? "Ready" : "Extracting"}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSourceItem(item.id)}
                              className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                              aria-label="Remove source"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {uploadProgress ? (
                      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Uploading & extracting...</span>
                          <span>
                            {uploadProgress.done}/{uploadProgress.total}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full bg-zinc-800 transition-all duration-200"
                            style={{
                              width: `${Math.round((uploadProgress.done / Math.max(uploadProgress.total, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload files"
                      title="Upload files"
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
                        aria-label="Add link"
                        title="Add link"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100"
                      >
                        <Link2 size={15} />
                      </button>
                      {linkInputOpen ? (
                        <div className="absolute bottom-12 left-0 z-[80] w-[min(92vw,440px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
                          <p className="mb-2 text-sm text-zinc-500">
                            Supports webpage URLs, YouTube URLs, and podcast URLs
                          </p>
                          <input
                            value={linkValue}
                            onChange={(event) => {
                              setLinkValue(event.target.value);
                              if (linkError) {
                                setLinkError("");
                              }
                            }}
                            placeholder="Paste a link and press Enter or click Extract"
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
                            Extract text
                          </button>
                          {linkError ? (
                            <p className="mt-2 text-xs text-red-600">{linkError}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative w-[calc(50%-6px)] min-w-[130px] sm:w-auto">
                      <button
                        ref={textModelButtonRef}
                        type="button"
                        onClick={toggleTextModelMenu}
                        className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 sm:w-36"
                      >
                        <span className="truncate">{selectedTextModel.label}</span>
                        <ChevronDown
                          size={14}
                          className={`text-zinc-500 transition ${openMenu === "text" ? "rotate-180" : ""}`}
                        />
                      </button>
                      {openMenu === "text" ? (
                        <div
                          className={`absolute left-0 z-[80] w-[310px] rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_35px_rgba(15,23,42,0.18)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 ${
                            textMenuOpenUp ? "bottom-12" : "top-12"
                          }`}
                          style={{ maxHeight: textMenuMaxHeight, overflowY: "auto" }}
                        >
                          {textModelOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (option.premium && !hasMembership) {
                                  setModelPaywallOpen(true);
                                  setOpenMenu(null);
                                  return;
                                }
                                setTextModel(option.value);
                                setOpenMenu(null);
                              }}
                              className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-zinc-100"
                            >
                              <span className="flex items-center justify-between text-sm font-medium text-zinc-900">
                                <span className="inline-flex items-center gap-1.5">{option.label}</span>
                                <span className="inline-flex items-center gap-1.5">
                                  {option.premium ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.45)]">
                                      <Crown size={11} />
                                    </span>
                                  ) : null}
                                  {resolvedTextModel === option.value ? <Check size={14} /> : null}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                {option.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleGoGenerate}
                      disabled={isStartingWorkspace}
                      className="mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:mt-0 sm:w-auto"
                    >
                      <SendHorizontal size={15} />
                      {isStartingWorkspace ? "Starting..." : "Generate"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {resolvedRecentProjects.length ? (
            <section className="mx-auto w-full max-w-6xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                  Recent Projects
                </h2>
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="text-sm text-zinc-500 transition hover:text-zinc-800"
                >
                  View all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {resolvedRecentProjects.map((project) => (
                  <article
                    key={project.id}
                    className="group rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-100">
                      <ProgressiveCover
                        src={toOptimizedCaseCover(project.cover)}
                        fallbackSrc={project.cover}
                        alt={project.title}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                      />
                      <span className="absolute left-2 top-2 inline-flex items-center rounded-md border border-white/25 bg-black/78 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[2px]">
                        {normalizeFormatLabel(project.format)}
                      </span>
                    </div>
                    <div className="px-1 pb-1 pt-3">
                      <p className="text-[15px] font-medium leading-6 text-zinc-900">
                        {project.title}
                      </p>
                      <p className="mt-2 text-sm text-zinc-500">{project.updatedAt}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            ) : null}

            <section className="mx-auto w-full max-w-6xl">
              <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900">
                Featured Cases
              </h2>
              <div className="mb-4 flex flex-wrap gap-2">
                {feedCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleFeaturedCategoryChange(category)}
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

              <div className="columns-2 gap-4 [column-gap:1rem] md:columns-3 lg:columns-4">
                {featuredVisibleItems.map((item) => {
                    const metric = getCaseMetrics(item.id, item.views, item.likes, currentEmail);
                    return (
                  <article
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openFeaturedPreview(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openFeaturedPreview(item);
                      }
                    }}
                    className="group mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                  >
                    <div className="relative w-full bg-zinc-100">
                      <div style={{ aspectRatio: `${item.coverWidth}/${item.coverHeight}` }}>
                        <ProgressiveCover
                          src={toOptimizedCaseCover(item.cover)}
                          fallbackSrc={item.cover}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                        />
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500">
                          {normalizeFormatLabel(item.format)}
                        </span>
                        <span className="truncate">@{item.author}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleLike(item);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition ${
                            metric.liked
                              ? "bg-rose-50 text-rose-600"
                              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                          }`}
                          aria-label={metric.liked ? "Unlike" : "Like"}
                        >
                          <Heart size={12} className={metric.liked ? "fill-current" : ""} />
                          <span>{metric.likes}</span>
                        </button>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">
                          {metric.views} views
                        </span>
                      </div>
                    </div>
                  </article>
                    );
                })}
              </div>
              <div className="mt-4 flex justify-center" ref={hasMoreFeaturedItems ? featuredLoadMoreRef : undefined}>
                {hasMoreFeaturedItems ? (
                  <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500">
                    Scroll down to load more cases ({featuredVisibleItems.length}/{featuredFilteredItems.length})
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
                    You reached the end — all {featuredFilteredItems.length} featured cases are shown.
                  </div>
                )}
              </div>
            </section>
        </div>
      </main>
      {uploadToast ? (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {uploadToast}
        </div>
      ) : null}
      <PaywallDialog
        open={modelPaywallOpen}
        title="Premium model access required"
        description="This advanced model is available for members only. Upgrade your plan to unlock premium model quality."
        showPromoBanner
        onClose={() => setModelPaywallOpen(false)}
        onConfirm={() => {
          setModelPaywallOpen(false);
          openMembershipFromHome();
        }}
        confirmLabel="Upgrade for Premium Models"
      />
      {previewItem ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
            onClick={closeFeaturedPreview}
          />
          <div className="relative z-[111] w-full max-w-5xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const metric = getCaseMetrics(previewItem.id, previewItem.views, previewItem.likes, currentEmail);
                  return (
                    <button
                      type="button"
                      onClick={() => handleToggleLike(previewItem)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition ${
                        metric.liked
                          ? "border-rose-300 bg-rose-50 text-rose-600"
                          : "border-white/20 bg-black/40 text-white hover:bg-black/55"
                      }`}
                    >
                      <Heart size={14} className={metric.liked ? "fill-current" : ""} />
                      <span>{metric.likes}</span>
                    </button>
                  );
                })()}
                <div className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/15 bg-black/45 px-1">
                  <button
                    type="button"
                    onClick={() => applyPreviewZoom(previewZoom - 0.25)}
                    disabled={previewZoom <= 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/90 transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Zoom out"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[48px] text-center text-xs font-medium text-white/90">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => applyPreviewZoom(previewZoom + 0.25)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
                    aria-label="Zoom in"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleFeaturedDownload}
                  className="inline-flex h-9 items-center rounded-xl bg-white px-3.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  Download
                </button>
              </div>
              <button
                type="button"
                onClick={closeFeaturedPreview}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-white hover:bg-black/60"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
              <div
                ref={previewScrollRef}
                className={`max-h-[88vh] bg-zinc-950/45 p-1 sm:p-1.5 ${
                  previewZoom > 1
                    ? "overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    : "overflow-hidden"
                }`}
              >
                <img
                  src={previewItem.cover}
                  alt={previewItem.title}
                  className="mx-auto h-auto rounded-xl object-contain"
                  style={
                    previewZoom <= 1
                      ? { maxWidth: "100%", maxHeight: "86vh" }
                      : { width: `${previewZoom * 100}%`, maxWidth: "none", height: "auto" }
                  }
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <PaywallDialog
        open={previewPaywallOpen}
        title="Membership required for downloads"
        description="Image download is available to members only. Upgrade your plan to unlock high-quality downloads."
        showPromoBanner
        onClose={() => setPreviewPaywallOpen(false)}
        onConfirm={() => {
          setPreviewPaywallOpen(false);
          closeFeaturedPreview();
          openMembershipFromHome();
        }}
        confirmLabel="Upgrade to Download"
      />
      <PaywallDialog
        open={mediaUploadPaywallOpen}
        title="Premium membership required for media files"
        description="Audio and video file processing requires a premium language model (GPT-5.5). Upgrade to continue with multimedia extraction."
        showPromoBanner
        onClose={() => setMediaUploadPaywallOpen(false)}
        onConfirm={() => {
          setMediaUploadPaywallOpen(false);
          openMembershipFromHome();
        }}
        confirmLabel="Upgrade for Media Processing"
      />
    </div>
  );
}

function toFileSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "featured-case"
  );
}
