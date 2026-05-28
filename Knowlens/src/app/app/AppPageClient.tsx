"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
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
  LoaderCircle,
  Menu,
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
import { getCreditRecords, getSubscriptionByUser, syncCreditRecordsFromServer } from "@/lib/billing";
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
  jobId?: string;
  kind: SourceKind;
  name: string;
  origin: string;
  mimeType?: string;
  sizeBytes?: number;
  progress?: number;
  previewUrl?: string;
  status: "queued" | "uploading" | "extracting" | "processing" | "ready" | "failed";
  excerpt: string;
  contentText?: string;
};

type HomeDraftPayload = {
  prompt?: string;
  textModel?: string;
  imageModel?: string;
  sources?: Array<Partial<SourceItem>>;
};

type WorkspaceStartErrorPayload = {
  error?: string;
  code?: string;
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
  if (excerpt === "Queued for processing...") return "Queued for processing...";
  if (excerpt === "Processing upload...") return "Processing upload...";
  if (excerpt === "Processing link...") return "Processing link...";
  if (excerpt === "Processing transcript...") return "Reading transcript...";
  if (excerpt === "Processing webpage text...") return "Reading page text...";
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

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "--";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtensionLabel(fileName: string) {
  const ext = fileName.split(".").pop()?.trim().toUpperCase();
  if (!ext || ext === fileName.toUpperCase()) {
    return "FILE";
  }
  return ext;
}

function getSourceFormatLabel(item: SourceItem) {
  if (item.kind === "youtube") return "YOUTUBE";
  if (item.kind === "podcast") return "PODCAST";
  if (item.kind === "web") return "WEB";
  return getFileExtensionLabel(item.name);
}

function getSourceProgress(item: SourceItem) {
  if (item.status === "ready") return 100;
  if (item.status === "failed") return 0;
  if (item.status === "queued") return Math.max(3, Math.min(item.progress ?? 5, 20));
  if (item.status === "uploading") return Math.max(8, Math.min(item.progress ?? 18, 35));
  if (item.status === "extracting") return Math.max(35, Math.min(item.progress ?? 50, 70));
  return Math.max(60, Math.min(item.progress ?? 72, 98));
}

function getSourceStatusText(item: SourceItem) {
  if (item.status === "ready") return "";
  if (item.status === "failed") return item.excerpt || "Upload failed";
  return "Uploading";
}

function getCompactFileName(name: string, maxLength = 22) {
  if (name.length <= maxLength) return name;
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= name.length - 1) {
    return `${name.slice(0, maxLength - 1)}…`;
  }
  const ext = name.slice(dotIndex + 1);
  const base = name.slice(0, dotIndex);
  const head = Math.max(8, maxLength - ext.length - 4);
  return `${base.slice(0, head)}….${ext}`;
}

function cleanUploadErrorMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Upload failed.";
  }
  if (/ENOENT/i.test(trimmed)) {
    return "Upload failed: file not found.";
  }
  if (/too large|exceeds|file size/i.test(trimmed)) {
    return "Upload failed: file is too large.";
  }
  if (/unsupported|not supported|invalid file type/i.test(trimmed)) {
    return "Upload failed: file type is not supported.";
  }
  if (/network|fetch|timeout/i.test(trimmed)) {
    return "Upload failed: network or server timeout.";
  }
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
}

function getUploadFailureMessageFromJob(job: UploadJobRecord) {
  const code = String(job.errorCode || job.error_code || "").trim().toUpperCase();
  const rawMessage = String(job.errorMessage || job.error_message || "").trim();

  if (code === "UPLOAD_PROVIDER_NOT_CONFIGURED") {
    return "This source type requires premium model setup. Please upgrade or try another source.";
  }
  if (code === "UPLOAD_NETWORK_FAILURE") {
    return "Upload failed due to a network issue. Please retry.";
  }
  if (code === "UPLOAD_WORKER_TIMEOUT") {
    return "Upload timed out during extraction. Please retry.";
  }
  if (code === "UPLOAD_INPUT_TOO_LARGE") {
    return "Upload failed: the source is too large to process.";
  }
  if (code === "UPLOAD_INPUT_INVALID") {
    return "Upload failed: source input is invalid. Please check and retry.";
  }
  if (code === "UPLOAD_SOURCE_FETCH_4XX") {
    return "Upload failed: source link is not accessible. Please verify the URL.";
  }

  const fallback = cleanUploadErrorMessage(rawMessage || "Upload failed.");
  return code ? `${fallback} (${code})` : fallback;
}

function hasFilesInDataTransfer(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return true;
  }
  return Array.from(dataTransfer.types ?? []).includes("Files");
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

const FREE_MODEL_UPLOAD_LIMITS = {
  maxFileCount: 6,
  maxFileSizeBytes: 20 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024,
};

const PREMIUM_MODEL_UPLOAD_LIMITS = {
  maxFileCount: 12,
  maxFileSizeBytes: 80 * 1024 * 1024,
  maxTotalBytes: 240 * 1024 * 1024,
};

const MAX_LINK_SOURCE_COUNT = 1;
const MAX_COMPOSE_TEXT_CHARS = 6000;

const MIN_COMPOSER_HEIGHT = 132;
const MAX_COMPOSER_HEIGHT = 260;
const DEFAULT_COVER_FALLBACK = "/picture/text-to-poster.png";
const ENABLE_IMAGE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_IMAGE_LOAD === "true";
const HOME_DRAFT_KEY = "knowlens-home-draft";
const GENERATE_INTENT_KEY = "knowlens:generate-intent";
const GENERATE_INTENT_TTL_MS = 15 * 60 * 1000;
const MEMBERSHIP_SOURCE_KEY = "knowlens:membership-source";
const loadedImageCache = new Set<string>();

function normalizeDraftSourceKind(kind: string | undefined): SourceKind {
  if (kind === "youtube" || kind === "podcast" || kind === "web") {
    return kind;
  }
  return "file";
}

function mapWorkspaceStartErrorMessage(code: string | undefined, fallback: string | undefined) {
  if (code === "WORKSPACE_START_EMPTY_INPUT") {
    return "Enter your topic or attach at least one source to continue.";
  }
  if (code === "WORKSPACE_START_AUTH_REQUIRED") {
    return "Please sign in to continue.";
  }
  if (code === "WORKSPACE_START_DAILY_LIMIT") {
    return "You reached today's project-start limit. Continue from existing projects or try again tomorrow.";
  }
  if (code === "WORKSPACE_START_RATE_LIMIT") {
    return "You're creating projects too quickly. Please wait a moment and retry.";
  }
  if (code === "WORKSPACE_START_FORBIDDEN_ORIGIN") {
    return "Request verification failed. Please refresh and try again.";
  }
  return fallback || "Unable to start a new project right now. Please try again later.";
}

function trackAppEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", eventName, params);
    }
  } catch {
    // analytics should never interrupt product flow
  }
}

function shouldRetryWorkspaceStart(error: unknown) {
  if (!(error instanceof Error)) {
    return true;
  }
  const message = (error.message || "").toLowerCase();
  if (!message) {
    return true;
  }
  if (message.includes("abort") || message.includes("timeout")) {
    return true;
  }
  if (message.includes("network") || message.includes("failed to fetch") || message.includes("load failed")) {
    return true;
  }
  return false;
}

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
        className={`absolute inset-0 transition-opacity ${
          loaded ? "opacity-0" : "skeleton-shimmer opacity-100"
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

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
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

function isPremiumTextModel(modelValue: string) {
  return textModelOptions.some((option) => option.value === modelValue && option.premium);
}

function sourceItemNeedsPremium(item: SourceItem) {
  if (item.kind === "youtube" || item.kind === "podcast") {
    return true;
  }
  if (item.kind === "file") {
    return /\.(mp4|mov|avi|mkv|mp3|wav|m4a|flac|aac|ogg)$/i.test(item.origin.toLowerCase());
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

type UploadJobRecord = {
  id: string;
  file_name?: string;
  fileName?: string;
  mime_type?: string;
  mimeType?: string;
  source_kind?: SourceKind;
  sourceKind?: SourceKind;
  source_url?: string | null;
  sourceUrl?: string | null;
  status?: SourceItem["status"];
  progress?: number;
  error_message?: string | null;
  errorMessage?: string | null;
  error_code?: string | null;
  errorCode?: string | null;
  result_excerpt?: string | null;
  resultExcerpt?: string | null;
  result_text?: string | null;
  resultText?: string | null;
  result_kind?: string | null;
  resultKind?: string | null;
  public_url?: string | null;
  publicUrl?: string | null;
  storage_key?: string | null;
  storageKey?: string | null;
  created_at?: string;
  createdAt?: string;
};

function normalizeUploadJobStatus(status: string | undefined): SourceItem["status"] {
  if (status === "done") {
    return "ready";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "processing") {
    return "processing";
  }
  if (status === "queued") {
    return "queued";
  }
  return "extracting";
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
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
  const [currentCredits, setCurrentCredits] = useState(80);
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
  const [previewImageLoaded, setPreviewImageLoaded] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<Record<string, UploadJobRecord>>({});
  const [isStartingWorkspace, setIsStartingWorkspace] = useState(false);
  const [isDragOverPage, setIsDragOverPage] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [, setMetricVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuLayerRef = useRef<HTMLDivElement | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);
  const textModelButtonRef = useRef<HTMLButtonElement | null>(null);
  const featuredLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const composeLimitToastShownRef = useRef(false);
  const dragDepthRef = useRef(0);
  const notifiedUploadFailureIdsRef = useRef<Set<string>>(new Set());
  const autoGenerateOnceRef = useRef(false);
  const startedWorkspaceNavigationRef = useRef(false);
  const creditSyncInFlightRef = useRef(false);
  const creditSyncedEmailRef = useRef("");

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !currentEmail) {
      return;
    }
    if (creditSyncedEmailRef.current === currentEmail) {
      return;
    }
    if (creditSyncInFlightRef.current) {
      return;
    }
    creditSyncInFlightRef.current = true;
    let canceled = false;
    void syncCreditRecordsFromServer(currentEmail)
      .then((records) => {
        if (canceled) {
          return;
        }
        const nextBalance =
          records[0]?.balance ??
          getCreditRecords(currentEmail)[0]?.balance ??
          80;
        setCurrentCredits((prev) => (prev === nextBalance ? prev : nextBalance));
        creditSyncedEmailRef.current = currentEmail;
      })
      .catch(() => {
        if (canceled) {
          return;
        }
        const fallbackBalance = getCreditRecords(currentEmail)[0]?.balance ?? 80;
        setCurrentCredits((prev) => (prev === fallbackBalance ? prev : fallbackBalance));
      })
      .finally(() => {
        if (canceled) {
          return;
        }
        creditSyncInFlightRef.current = false;
      });
    return () => {
      canceled = true;
      creditSyncInFlightRef.current = false;
    };
  }, [currentEmail, sessionStatus]);

  const resolvedTextModel = textModel ?? defaultFreeModelByLocale(locale);
  const isPremiumModelSelected = hasMembership && isPremiumTextModel(resolvedTextModel);
  const uploadLimits = isPremiumModelSelected
    ? PREMIUM_MODEL_UPLOAD_LIMITS
    : FREE_MODEL_UPLOAD_LIMITS;
  const linkSourceCount = sourceItems.filter((item) => item.kind !== "file").length;
  const hasLinkSource = linkSourceCount >= MAX_LINK_SOURCE_COUNT;
  const fileSourceCount = sourceItems.filter((item) => item.kind === "file").length;
  const fileSourceBytes = sourceItems
    .filter((item) => item.kind === "file")
    .reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
  const selectedTextModel =
    textModelOptions.find((item) => item.value === resolvedTextModel) ?? textModelOptions[0];

  function updateComposeInput(nextRawValue: string) {
    if (nextRawValue.length <= MAX_COMPOSE_TEXT_CHARS) {
      composeLimitToastShownRef.current = false;
      setComposeInput(nextRawValue);
      return;
    }
    const trimmedValue = nextRawValue.slice(0, MAX_COMPOSE_TEXT_CHARS);
    setComposeInput(trimmedValue);
    if (!composeLimitToastShownRef.current) {
      setUploadToast(`Input limit reached (${MAX_COMPOSE_TEXT_CHARS} characters max).`);
      composeLimitToastShownRef.current = true;
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let shouldHydrate = !composeInput.trim() && sourceItems.length === 0;
    if (!shouldHydrate) {
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(HOME_DRAFT_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as HomeDraftPayload;
      const normalizedPrompt = String(parsed.prompt || "");
      const normalizedTextModel = String(parsed.textModel || "").trim();
      const normalizedSources: SourceItem[] = Array.isArray(parsed.sources)
        ? parsed.sources
            .filter((item): item is Partial<SourceItem> => Boolean(item && typeof item === "object"))
            .map((item, idx) => {
              const status: SourceItem["status"] = item.status === "ready" ? "ready" : "failed";
              return {
                id: item.id || `cached-${idx}-${Date.now()}`,
                kind: normalizeDraftSourceKind(item.kind),
                name: String(item.name || "Source"),
                origin: String(item.origin || ""),
                mimeType: item.mimeType ? String(item.mimeType) : undefined,
                sizeBytes: typeof item.sizeBytes === "number" ? item.sizeBytes : undefined,
                status,
                progress: status === "ready" ? 100 : 0,
                excerpt: String(item.excerpt || ""),
                contentText: item.contentText ? String(item.contentText) : undefined,
              };
            })
            .filter((item) => item.status === "ready")
            .slice(0, 30)
        : [];
      if (normalizedPrompt) {
        setComposeInput(normalizedPrompt.slice(0, MAX_COMPOSE_TEXT_CHARS));
      }
      if (normalizedTextModel) {
        const hasModel = textModelOptions.some((option) => option.value === normalizedTextModel);
        if (hasModel) {
          setTextModel(normalizedTextModel);
        }
      }
      if (normalizedSources.length) {
        setSourceItems((prev) => {
          if (prev.length > 0) {
            return prev;
          }
          return normalizedSources;
        });
      }
    } catch {
      // ignore broken cached payload
    }
  }, [composeInput, sourceItems.length]);

  useEffect(() => {
    const currentText = inputPlaceholders[placeholderIndex];
    const typedDone = typedPlaceholder === currentText;
    const deletedDone = typedPlaceholder.length === 0;

    let delay = isDeleting ? 25 : 45;
    if (!isDeleting && typedDone) {
      delay = 2000;
    } else if (isDeleting && deletedDone) {
      delay = 180;
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
    function preventBrowserOpenOnDrop(event: globalThis.DragEvent) {
      if (!hasFilesInDataTransfer(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener("dragover", preventBrowserOpenOnDrop);
    window.addEventListener("drop", preventBrowserOpenOnDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserOpenOnDrop);
      window.removeEventListener("drop", preventBrowserOpenOnDrop);
    };
  }, []);

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

  useEffect(() => {
    let isActive = true;
    let timer: number | undefined;

    async function syncJobs() {
      try {
        const url = currentEmail
          ? `/api/upload/jobs?userEmail=${encodeURIComponent(currentEmail)}`
          : "/api/upload/jobs";
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { jobs?: UploadJobRecord[] };
        if (!isActive || !Array.isArray(data.jobs)) {
          return;
        }
        const nextJobs = Object.fromEntries(data.jobs.map((job) => [job.id, job]));
        setUploadJobs(nextJobs);
        setSourceItems((prev) =>
          prev.reduce<SourceItem[]>((acc, item) => {
            if (!item.jobId) {
              acc.push(item);
              return acc;
            }
            const job = nextJobs[item.jobId];
            if (!job) {
              acc.push(item);
              return acc;
            }
            const status = normalizeUploadJobStatus(job.status);
            const resultText = String(job.resultText || job.result_text || "").trim();
            const resultExcerpt = String(job.resultExcerpt || job.result_excerpt || "").trim();
            const nextProgress =
              typeof job.progress === "number" && Number.isFinite(job.progress)
                ? Math.max(0, Math.min(Math.round(job.progress), 100))
                : item.progress;
            const nextItem = {
              ...item,
              status,
              progress: status === "ready" ? 100 : status === "failed" ? 0 : nextProgress,
              excerpt:
                job.errorMessage ||
                job.error_message ||
                resultExcerpt ||
                (resultText ? `${resultText.slice(0, 180)}${resultText.length > 180 ? "..." : ""}` : "") ||
                item.excerpt,
              contentText: resultText || item.contentText,
            };
            if (status === "failed") {
              if (!notifiedUploadFailureIdsRef.current.has(job.id)) {
                notifiedUploadFailureIdsRef.current.add(job.id);
                window.setTimeout(() => {
                  setUploadToast(getUploadFailureMessageFromJob(job));
                }, 0);
              }
              if (nextItem.previewUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(nextItem.previewUrl);
              }
              return acc;
            }
            acc.push(nextItem);
            return acc;
          }, []),
        );
      } catch {
        // ignore polling errors
      }
    }

    syncJobs();
    timer = window.setInterval(syncJobs, 2500);
    return () => {
      isActive = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [currentEmail]);

  async function enqueueSelectedFiles(selectedFiles: File[]) {
    const blockedMediaFiles = selectedFiles.filter((file) => isMediaFile(file));
    const allowedFiles =
      !hasMembership && blockedMediaFiles.length
        ? selectedFiles.filter((file) => !isMediaFile(file))
        : selectedFiles;

    if (!hasMembership && blockedMediaFiles.length) {
      setMediaUploadPaywallOpen(true);
    }

    if (!allowedFiles.length) {
      return;
    }

    const remainingSlots = uploadLimits.maxFileCount - fileSourceCount;
    if (remainingSlots <= 0) {
      return;
    }

    const files = allowedFiles.slice(0, remainingSlots);

    const acceptedFiles: File[] = [];
    let runningTotal = fileSourceBytes;

    files.forEach((file) => {
      if (file.size > uploadLimits.maxFileSizeBytes) {
        return;
      }
      if (runningTotal + file.size > uploadLimits.maxTotalBytes) {
        return;
      }
      runningTotal += file.size;
      acceptedFiles.push(file);
    });

    if (!acceptedFiles.length) {
      return;
    }

    const items = acceptedFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "file" as SourceKind,
      name: file.name,
      origin: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      progress: 5,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      status: "queued" as const,
      excerpt: "Queued for processing...",
    }));

    setSourceItems((prev) => [...items, ...prev]);

    try {
      for (let idx = 0; idx < acceptedFiles.length; idx += 1) {
        const file = acceptedFiles[idx];
        const formData = new FormData();
        formData.append("userEmail", currentEmail);
        formData.append("fileName", file.name);
        formData.append("mimeType", file.type || "application/octet-stream");
        formData.append("fileSize", String(file.size));
        formData.append("sourceKind", "file");
        formData.append("file", file);

        const response = await fetch("/api/upload/jobs", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as {
          job?: { jobId?: string };
          error?: string;
        };
        if (!response.ok || !data.job?.jobId) {
          throw new Error(data.error || "Upload job failed");
        }

        const jobId = data.job.jobId;
        setSourceItems((prev) =>
          prev.map((item) =>
            item.id === items[idx].id
              ? {
                  ...item,
                  jobId,
                  status: "processing",
                  progress: 65,
                  excerpt: "Processing upload...",
                }
              : item,
          ),
        );
        setUploadJobs((prev) => ({
          ...prev,
          [jobId]: {
            id: jobId,
            status: "processing",
            progress: 0,
            file_name: file.name,
            fileName: file.name,
            mime_type: file.type,
            mimeType: file.type,
            source_kind: "file",
            sourceKind: "file",
          },
        }));
      }
    } catch (error) {
      setSourceItems((prev) => {
        const next = prev.filter((item) => !items.some((candidate) => candidate.id === item.id));
        items.forEach((item) => {
          if (item.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl);
          }
        });
        return next;
      });
    } finally {
      // no-op
    }
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    await enqueueSelectedFiles(selectedFiles);
    event.target.value = "";
  }

  function handlePageDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOverPage(true);
  }

  function handlePageDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragOverPage) {
      setIsDragOverPage(true);
    }
  }

  function handlePageDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOverPage(false);
    }
  }

  function handlePageDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasFilesInDataTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOverPage(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) {
      return;
    }
    void enqueueSelectedFiles(files);
  }

  async function handleSubmitLink(rawInput?: string) {
    const value = (rawInput ?? linkValue).trim();
    if (!value) {
      setLinkError("Please enter a webpage, YouTube, or podcast URL.");
      return;
    }
    if (hasLinkSource) {
      setLinkError("Only one link can be attached per project. Remove the current link first.");
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
    const isTranscriptMediaLink = kind === "youtube" || kind === "podcast";

    if (!hasMembership && isTranscriptMediaLink) {
      setMediaUploadPaywallOpen(true);
      setLinkError(
        "YouTube/podcast transcript extraction requires a premium language model. Please upgrade to continue.",
      );
      return;
    }

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
      mimeType: "text/plain",
      sizeBytes: value.length,
      progress: 20,
      status: "processing",
      excerpt:
        kind === "youtube"
          ? "Processing transcript..."
          : kind === "podcast"
            ? "Processing transcript..."
            : "Processing webpage text...",
    };

    setSourceItems((prev) => [pendingItem, ...prev]);
    setLinkValue(rawInput ? linkValue : "");
    setLinkInputOpen(false);
    setLinkError("");

    try {
      const response = await fetch("/api/upload/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: currentEmail,
          fileName: pendingItem.name,
          mimeType: "text/plain",
          fileSize: value.length,
          sourceKind: kind,
          sourceUrl: value,
        }),
      });
      const data = (await response.json()) as {
        job?: { jobId?: string };
        error?: string;
      };
      const jobId = data.job?.jobId?.trim() ?? "";
      if (!response.ok || !jobId) {
        throw new Error(data.error || "Link processing failed");
      }

      setSourceItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                jobId,
                progress: 60,
                excerpt: "Processing link...",
              }
            : item,
        ),
      );
      setUploadJobs((prev) => ({
        ...prev,
        [jobId]: {
          id: jobId,
          status: "processing",
          progress: 0,
          file_name: pendingItem.name,
          fileName: pendingItem.name,
          mime_type: "text/plain",
          mimeType: "text/plain",
          source_kind: kind,
          sourceKind: kind,
          source_url: value,
          sourceUrl: value,
        },
      }));
      setUploadToast(
        kind === "youtube"
          ? "YouTube transcript job queued."
          : kind === "podcast"
            ? "Podcast transcript job queued."
            : "Webpage text job queued.",
      );
    } catch (error) {
      setSourceItems((prev) => {
        const next = prev.filter((item) => item.id !== itemId);
        const removed = prev.find((item) => item.id === itemId);
        if (removed?.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(removed.previewUrl);
        }
        return next;
      });
      setUploadToast(
        cleanUploadErrorMessage(
          error instanceof Error ? error.message : "Link processing failed.",
        ),
      );
    }
  }

  function removeSourceItem(id: string) {
    setSourceItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
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

  async function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const clipboard = event.clipboardData;
    if (!clipboard) {
      return;
    }

    const files = Array.from(clipboard.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      await enqueueSelectedFiles(files);
      return;
    }

    const pastedText = clipboard.getData("text/plain").trim();
    if (!pastedText) {
      return;
    }
    const pastedUrl = parseHttpUrl(pastedText);
    if (!pastedUrl) {
      return;
    }
    event.preventDefault();
    await handleSubmitLink(pastedUrl.toString());
    setUploadToast("Link detected from paste and queued.");
  }

  function buildWorkspacePayload() {
    const readySources = sourceItems.filter((item) => item.status === "ready");
    return {
      prompt: composeInput.trim(),
      textModel: resolvedTextModel,
      imageModel: "gpt-image2",
      sources: readySources,
    };
  }

  function persistHomeDraft(payload?: ReturnType<typeof buildWorkspacePayload>) {
    if (typeof window === "undefined") {
      return;
    }
    const nextPayload = payload ?? buildWorkspacePayload();
    window.sessionStorage.setItem(HOME_DRAFT_KEY, JSON.stringify(nextPayload));
  }

  async function createWorkspaceStartRequestWithRetry(payload: ReturnType<typeof buildWorkspacePayload>) {
    const maxAttempts = 2;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch("/api/workspace/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        return response;
      } catch (error) {
        lastError = error;
        const retryable = shouldRetryWorkspaceStart(error);
        if (!retryable || attempt >= maxAttempts) {
          throw error;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, 280);
        });
      }
    }
    throw lastError || new Error("Workspace start request failed.");
  }

  function rememberGenerateIntent() {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.sessionStorage.setItem(
        GENERATE_INTENT_KEY,
        JSON.stringify({
          createdAt: Date.now(),
        }),
      );
    } catch {
      // ignore storage quota errors
    }
  }

  function openMembershipFromHome(
    source: "model_paywall" | "media_paywall" | "preview_paywall" | "upgrade_button" = "model_paywall",
  ) {
    trackAppEvent("checkout_open_from_paywall", {
      source,
      from: "home",
      model: resolvedTextModel,
      has_sources: sourceItems.length > 0,
    });
    persistHomeDraft();
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("membership:return-path", pathname || "/");
      window.sessionStorage.setItem(MEMBERSHIP_SOURCE_KEY, source);
    }
    router.push("/membership");
  }

  async function handleGoGenerate() {
    if (isStartingWorkspace) {
      return;
    }
    startedWorkspaceNavigationRef.current = false;
    setIsStartingWorkspace(true);
    trackAppEvent("generate_click", {
      from: "home",
      model: resolvedTextModel,
      has_prompt: composeInput.trim().length > 0,
      source_count: sourceItems.length,
    });
    if (sessionStatus === "loading") {
      setUploadToast("Checking your account. Please try again in a second.");
      setIsStartingWorkspace(false);
      return;
    }
    const payload = buildWorkspacePayload();
    if (!currentEmail) {
      persistHomeDraft(payload);
      rememberGenerateIntent();
      trackAppEvent("generate_requires_login", {
        from: "home",
        model: resolvedTextModel,
      });
      startedWorkspaceNavigationRef.current = true;
      router.prefetch("/workspace");
      router.push(`/auth?callbackUrl=${encodeURIComponent("/app?intent=generate")}`);
      return;
    }
    const hasPremiumRequiredSource = sourceItems.some((item) => sourceItemNeedsPremium(item));
    if (!hasMembership && hasPremiumRequiredSource) {
      setMediaUploadPaywallOpen(true);
      trackAppEvent("generate_blocked_premium_source", {
        from: "home",
        source_count: sourceItems.length,
      });
      setUploadToast(
        "Some uploaded sources require a premium language model for transcript extraction. Please upgrade to generate.",
      );
      setIsStartingWorkspace(false);
      return;
    }
    if (!hasMembership && isPremiumTextModel(resolvedTextModel)) {
      setModelPaywallOpen(true);
      trackAppEvent("generate_blocked_premium_model", {
        from: "home",
        model: resolvedTextModel,
      });
      setUploadToast(
        "The selected language model is a premium model. Please upgrade to generate with this model.",
      );
      setIsStartingWorkspace(false);
      return;
    }
    const pendingSources = sourceItems.filter((item) => item.status !== "ready" && item.status !== "failed");
    if (pendingSources.length > 0) {
      setUploadToast(
        "Some files are still being processed. Wait for extraction to finish, or remove pending files before generating.",
      );
      setIsStartingWorkspace(false);
      return;
    }
    try {
      const response = await createWorkspaceStartRequestWithRetry(payload);
      const data = (await response.json()) as {
        ok?: boolean;
        payload?: typeof payload;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data?.ok || !data.payload) {
        const failedCode = (data as WorkspaceStartErrorPayload)?.code;
        trackAppEvent("workspace_start_fail_code", {
          from: "home",
          code: failedCode || `HTTP_${response.status}`,
          model: resolvedTextModel,
        });
        if (response.status >= 500 && typeof window !== "undefined") {
          persistHomeDraft(payload);
          startedWorkspaceNavigationRef.current = true;
          router.prefetch("/workspace");
          router.push("/workspace");
          return;
        }
        setUploadToast(
          mapWorkspaceStartErrorMessage(
            failedCode,
            data?.error || "Unable to start a new project right now. Please try again later.",
          ),
        );
        return;
      }
      if (typeof window !== "undefined") {
        persistHomeDraft(data.payload);
        window.sessionStorage.removeItem(GENERATE_INTENT_KEY);
      }
      trackAppEvent("workspace_start_success", {
        from: "home",
        model: resolvedTextModel,
        source_count: payload.sources.length,
      });
      startedWorkspaceNavigationRef.current = true;
      router.prefetch("/workspace");
      router.push("/workspace");
    } catch {
      if (typeof window !== "undefined") {
        persistHomeDraft(payload);
      }
      trackAppEvent("workspace_start_fail_code", {
        from: "home",
        code: "NETWORK_OR_RUNTIME",
        model: resolvedTextModel,
      });
      startedWorkspaceNavigationRef.current = true;
      router.prefetch("/workspace");
      router.push("/workspace");
    } finally {
      if (!startedWorkspaceNavigationRef.current) {
        setIsStartingWorkspace(false);
      }
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    const isEnterSubmit = event.key === "Enter" && !event.shiftKey;
    if (isSubmitCombo || isEnterSubmit) {
      event.preventDefault();
      void handleGoGenerate();
      return;
    }
    if (event.key === "Escape") {
      setOpenMenu(null);
      setLinkInputOpen(false);
      setLinkError("");
    }
  }

  function handleLinkInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const isSubmitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    const isEnterSubmit = event.key === "Enter";
    if (isSubmitCombo || isEnterSubmit) {
      event.preventDefault();
      void handleSubmitLink();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setLinkInputOpen(false);
      setLinkError("");
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
    setPreviewImageLoaded(false);
    setPreviewItem(item);
  }

  function closeFeaturedPreview() {
    setPreviewZoom(1);
    setPreviewImageLoaded(false);
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
      format: normalizeFormatLabel(project.format || "Poster"),
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

  useEffect(() => {
    if (autoGenerateOnceRef.current) {
      return;
    }
    if (sessionStatus !== "authenticated" || !currentEmail || isStartingWorkspace) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const intentFromQuery = new URLSearchParams(window.location.search).get("intent") === "generate";
    let hasIntentFromStorage = false;
    try {
      const raw = window.sessionStorage.getItem(GENERATE_INTENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { createdAt?: number };
        const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
        hasIntentFromStorage = Date.now() - createdAt <= GENERATE_INTENT_TTL_MS;
      }
    } catch {
      hasIntentFromStorage = false;
    }
    if (!intentFromQuery && !hasIntentFromStorage) {
      return;
    }
    const hasInput = composeInput.trim().length > 0 || sourceItems.length > 0;
    if (!hasInput) {
      return;
    }
    autoGenerateOnceRef.current = true;
    trackAppEvent("generate_auto_resume_after_login", {
      from: "home",
      model: resolvedTextModel,
    });
    void handleGoGenerate();
  }, [
    composeInput,
    currentEmail,
    isStartingWorkspace,
    resolvedTextModel,
    sessionStatus,
    sourceItems.length,
  ]);

  return (
    <div
      className="min-h-screen bg-page text-zinc-900"
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      <SidebarNav
        items={localizedNavItems}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="px-3 py-4 sm:px-6 md:pl-[6.5rem] lg:px-12 lg:pl-[7.5rem]">
        <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100"
            aria-label="Open navigation"
            title="Open navigation"
          >
            <Menu size={15} />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openMembershipFromHome("upgrade_button")}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:bg-zinc-100"
            >
              <Zap size={14} className="text-zinc-500" />
              <span className="font-medium text-zinc-900">{currentCredits}</span>
              <span className="text-zinc-500">|</span>
              <span className="font-medium">Upgrade</span>
            </button>
            <UserMenu />
          </div>
        </div>
        <div className="fixed right-6 top-6 z-50 hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => openMembershipFromHome("upgrade_button")}
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
          <div className="h-1 sm:h-2" />

          <section className="relative z-20 mx-auto flex min-h-[48vh] w-full max-w-3xl flex-col justify-center sm:min-h-[56vh]">
            <div className="mb-6 flex flex-col items-center text-center">
              <p className="text-sm font-medium text-blue-600">KnowLens.ai</p>
              <h1 className="mt-1 text-center text-[clamp(1.3rem,6vw,2.55rem)] font-semibold leading-[1.08] tracking-tight text-zinc-900">
                <span className="block whitespace-nowrap">AI Infographic</span>
                <span className="block whitespace-nowrap">Generator for Learning</span>
              </h1>
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
                    maxLength={MAX_COMPOSE_TEXT_CHARS}
                    onChange={(event) => updateComposeInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    onPaste={(event) => {
                      void handleComposerPaste(event);
                    }}
                    className="w-full resize-none rounded-t-[30px] bg-transparent px-6 py-6 text-base leading-7 text-zinc-800 outline-none placeholder:text-zinc-400"
                    placeholder={typedPlaceholder}
                  />
                </label>

                {sourceItems.length ? (
                  <div className="mx-5 mt-1">
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
                      {sourceItems.map((item) => (
                        <div
                          key={item.id}
                          className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white"
                        >
                          {item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-zinc-500">
                              {item.kind === "youtube" ? (
                                <ImagePlay size={26} />
                              ) : item.kind === "podcast" ? (
                                <Headphones size={26} />
                              ) : item.kind === "web" ? (
                                <Globe size={26} />
                              ) : (
                                <FileText size={26} />
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => removeSourceItem(item.id)}
                            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                            aria-label="Remove source"
                          >
                            <X size={14} />
                          </button>

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/55 to-transparent px-2 pb-1.5 pt-5 text-white">
                            <p className="truncate text-[10px] font-medium">
                              {getCompactFileName(normalizeLegacySourceName(item.name))}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-white/85">
                              {getSourceFormatLabel(item)} · {formatFileSize(item.sizeBytes)}
                            </p>
                            {getSourceStatusText(item) ? (
                              <p className="mt-0.5 truncate text-[10px] text-white/90">
                                {getSourceStatusText(item)}
                              </p>
                            ) : null}
                            {item.status !== "ready" && item.status !== "failed" ? (
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/30">
                                <div
                                  className="h-full rounded-full bg-white transition-all duration-300"
                                  style={{ width: `${getSourceProgress(item)}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
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
                          if (hasLinkSource) {
                            setUploadToast("Only one link is allowed per project.");
                            return;
                          }
                          setLinkInputOpen((prev) => !prev);
                          setLinkError("");
                        }}
                        aria-label="Add link"
                        title="Add link"
                        disabled={hasLinkSource}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                          hasLinkSource
                            ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        <Link2 size={15} />
                      </button>
                      {linkInputOpen ? (
                        <div className="absolute bottom-12 left-0 z-[80] w-[min(92vw,440px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
                          <p className="mb-2 whitespace-pre-line text-sm text-zinc-500">
                            Supports webpage URLs, YouTube URLs, and podcast URLs (Apple Podcasts, Spotify, YouTube Music).
                            {"\n"}YouTube/podcast transcript extraction requires a premium language model.
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
                            onKeyDown={handleLinkInputKeyDown}
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
                      title="Generate (Enter / Ctrl+Enter)"
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
                    className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
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
                    <div className="px-3 pb-3 pt-2.5">
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

              <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
                {featuredVisibleItems.map((item, index) => {
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
                    className="group mb-4 inline-block w-full break-inside-avoid-column overflow-hidden rounded-xl border border-zinc-200 bg-white align-top shadow-[0_10px_25px_rgba(15,23,42,0.05)] transition hover:border-zinc-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                  >
                    <div className="relative w-full bg-zinc-100">
                      <div style={{ aspectRatio: `${item.coverWidth}/${item.coverHeight}` }}>
                        <ProgressiveCover
                          src={toOptimizedCaseCover(item.cover)}
                          fallbackSrc={item.cover}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                          loading={index < 8 ? "eager" : "lazy"}
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
        <div className="fixed left-1/2 top-3 z-[90] w-[calc(100%-1.5rem)] max-w-[560px] -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white shadow-lg sm:top-6 sm:w-auto sm:px-4">
          {uploadToast}
        </div>
      ) : null}
      {isDragOverPage ? (
        <div className="pointer-events-none fixed inset-0 z-[95] bg-black/72 backdrop-blur-[2px]">
          <div className="flex h-full w-full items-center justify-center px-4">
            <div className="w-full max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                <div className="relative h-16 w-16">
                  <span className="absolute -left-5 top-1 inline-flex h-10 w-10 rotate-[-18deg] items-center justify-center rounded-xl bg-indigo-200 text-indigo-900 shadow-[0_6px_18px_rgba(79,70,229,0.35)]">
                    <FileText size={18} />
                  </span>
                  <span className="absolute -right-5 top-1 inline-flex h-10 w-10 rotate-[14deg] items-center justify-center rounded-xl bg-indigo-100 text-indigo-900 shadow-[0_6px_18px_rgba(79,70,229,0.35)]">
                    <Link2 size={18} />
                  </span>
                  <span className="absolute left-1/2 top-5 inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.45)]">
                    <ImagePlay size={20} />
                  </span>
                </div>
              </div>
              <p className="text-[30px] font-semibold tracking-tight text-white sm:text-[38px]">Add anything</p>
              <p className="mt-3 text-[22px] font-medium leading-tight text-white/92 sm:text-[28px]">Drop files to upload</p>
            </div>
          </div>
        </div>
      ) : null}
      <PaywallDialog
        open={modelPaywallOpen}
        title="Membership required"
        description="This language model is available to members only. Please go to the membership page to continue."
        compact
        onClose={() => setModelPaywallOpen(false)}
        onConfirm={() => {
          setModelPaywallOpen(false);
          openMembershipFromHome("model_paywall");
        }}
        confirmLabel="Go to Membership"
      />
      {previewItem ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
            onClick={closeFeaturedPreview}
          />
          <div className="relative z-[111] w-full max-w-5xl">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeFeaturedPreview}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/40 text-white hover:bg-black/60"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
              <div
                ref={previewScrollRef}
                className={`max-h-[82dvh] bg-zinc-950/45 sm:max-h-[88vh] ${
                  previewZoom > 1
                    ? "overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    : "overflow-hidden"
                }`}
              >
                {!previewImageLoaded ? (
                  <div className="skeleton-shimmer mx-auto h-[62dvh] w-full max-w-[520px] rounded-lg sm:h-[72vh]" />
                ) : null}
                <img
                  src={previewItem.cover}
                  alt={previewItem.title}
                  className={`mx-auto h-auto rounded-lg object-contain transition-opacity duration-300 ${
                    previewImageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  style={
                    previewZoom <= 1
                      ? { maxWidth: "100%", maxHeight: "86vh" }
                      : { width: `${previewZoom * 100}%`, maxWidth: "none", height: "auto" }
                  }
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  onLoad={() => setPreviewImageLoaded(true)}
                  onError={() => setPreviewImageLoaded(true)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <PaywallDialog
        open={previewPaywallOpen}
        title="Membership required"
        description="Image downloads are available to members only. Please go to the membership page to continue."
        compact
        onClose={() => setPreviewPaywallOpen(false)}
        onConfirm={() => {
          setPreviewPaywallOpen(false);
          closeFeaturedPreview();
          openMembershipFromHome("preview_paywall");
        }}
        confirmLabel="Go to Membership"
      />
      <PaywallDialog
        open={mediaUploadPaywallOpen}
        title="Membership required"
      description="Audio, video, YouTube, and podcast transcript extraction require a premium language model. Please go to the membership page to continue."
        compact
        onClose={() => setMediaUploadPaywallOpen(false)}
        onConfirm={() => {
          setMediaUploadPaywallOpen(false);
          openMembershipFromHome("media_paywall");
        }}
        confirmLabel="Go to Membership"
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
