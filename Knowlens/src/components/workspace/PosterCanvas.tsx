"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Download,
  Grid3X3,
  LoaderCircle,
  LocateFixed,
  RefreshCw,
  RotateCcw,
  ZoomIn,
} from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
  type NodeProps,
  type Edge,
  type Node,
} from "@xyflow/react";

type SaveState = "saved" | "saving" | "error";

type PosterDraft = {
  headline: string;
  subtitle: string;
  body: string;
  points: string[];
  cta: string;
  size?: string;
  visualType?: string;
};

type PosterPlanItem = {
  index: number;
  title: string;
  focus: string;
};

type PosterCanvasProps = {
  posterCount: number;
  posterDraft: PosterDraft | null;
  posterPlanList: PosterPlanItem[];
  generationTaskStateByIndex?: Record<
    number,
    {
      status: "queued" | "generating" | "retrying" | "success" | "failed";
      attempts: number;
      maxAttempts: number;
      imageUrl?: string;
      error?: string;
      startedAt?: number;
      lastUpdatedAt?: number;
    }
  >;
  onRetryGenerationTask?: (index: number) => void;
  onSaveStateChange?: (saveState: SaveState, hasUnsavedChanges: boolean) => void;
};

type PosterCard = {
  id: string;
  index: number;
  copy: string;
  colorHex: string;
  imageSrc: string;
  status: "idle" | "queued" | "generating" | "retrying" | "ready" | "failed";
  x: number;
  y: number;
  initialCopy: string;
  history: string[];
  errorMessage?: string;
  timeoutAt?: number;
  archives: Array<{
    id: string;
    imageSrc: string;
    createdAt: number;
  }>;
};

type PosterNodeData = {
  card: PosterCard;
  isSelected: boolean;
  onUpdate: (id: string, patch: Partial<PosterCard>) => void;
  onRetry: (id: string) => void;
  onRedraw: (id: string) => void;
  onUndoCopy: (id: string) => void;
  onRestoreCopy: (id: string) => void;
  onDownload: (card: PosterCard) => void;
};

const POSTER_PLACEHOLDER_COLORS = [
  "#E6F0FF",
  "#EAF9F0",
  "#FFF4E6",
  "#F3EEFF",
  "#E9F6FF",
  "#FFEFF5",
  "#F1F7E8",
  "#F3F4F6",
];
const CASE_IMAGES = Array.from({ length: 36 }, (_, idx) => `/case/${idx + 1}.png`);
const PENDING_POSTER_COLOR = "#e5e7eb";

function wrapText(source: string, maxLen: number) {
  const text = source.trim();
  if (!text) {
    return [""];
  }
  const lines: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    lines.push(text.slice(cursor, cursor + maxLen));
    cursor += maxLen;
  }
  return lines;
}

function splitCopy(copy: string, index: number) {
  const lines = copy
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const title = lines[0] || `Poster ${index}`;
  const subtitle = lines[1] || "Knowledge visual poster";
  const body =
    (lines.length > 2 ? lines.slice(2).join(" ") : lines.slice(1).join(" ")) ||
    "Add the core explanation for this poster.";
  return { title, subtitle, body };
}

function buildPosterCardCopy(
  posterDraft: PosterDraft | null | undefined,
  plan: PosterPlanItem | undefined,
  index: number,
  posterCount: number,
) {
  const headline = posterDraft?.headline?.trim() || plan?.title?.trim() || `Poster ${index}`;
  const subtitle = posterDraft?.subtitle?.trim() || posterDraft?.visualType?.trim() || "Knowledge visual poster";
  const body = posterDraft?.body?.trim() || "Add the core explanation for this poster.";
  const points = (posterDraft?.points ?? []).map((point) => point.trim()).filter(Boolean);
  const focus = plan?.focus?.trim() || "";
  const titleLine = posterCount > 1 ? `${headline} (${index}/${posterCount})` : headline;
  return [titleLine, subtitle, body, ...points.map((point) => `- ${point}`), focus ? `- ${focus}` : ""]
    .filter(Boolean)
    .join("\n");
}

function pickNextCaseImage(currentSrc: string, fallbackSeed: number) {
  const matched = currentSrc.match(/\/case\/(\d+)\.png$/);
  if (!matched) {
    return CASE_IMAGES[(fallbackSeed + 1) % CASE_IMAGES.length];
  }
  const currentIdx = Number.parseInt(matched[1], 10) - 1;
  if (!Number.isFinite(currentIdx)) {
    return CASE_IMAGES[(fallbackSeed + 1) % CASE_IMAGES.length];
  }
  return CASE_IMAGES[(currentIdx + 1) % CASE_IMAGES.length];
}

function reportPosterDownloadEvent(input: {
  status: "ok" | "error";
  code?: string;
  message?: string;
  cardIndex: number;
}) {
  void fetch("/api/telemetry/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "download",
      action: input.status === "ok" ? "poster_download_success" : "poster_download_failed",
      status: input.status,
      source: "poster",
      code: input.code,
      message: input.message,
      details: {
        cardIndex: input.cardIndex,
      },
    }),
  }).catch(() => undefined);
}

async function exportPosterImage(card: PosterCard) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reportPosterDownloadEvent({
        status: "error",
        code: "POSTER_CANVAS_UNAVAILABLE",
        message: "Canvas context is unavailable.",
        cardIndex: card.index,
      });
      return;
    }
    const { title, subtitle, body } = splitCopy(card.copy, card.index);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 56px sans-serif";
    wrapText(title, 16)
      .slice(0, 2)
      .forEach((line, idx) => {
        ctx.fillText(line, 60, 96 + idx * 68);
      });

    ctx.fillStyle = "#4b5563";
    ctx.font = "32px sans-serif";
    wrapText(subtitle, 24)
      .slice(0, 1)
      .forEach((line) => {
        ctx.fillText(line, 60, 250);
      });

    const imageBox = { x: 60, y: 300, w: 960, h: 1280 };
    const shouldUseImage = card.status === "ready" && Boolean(card.imageSrc);
    if (shouldUseImage && card.imageSrc) {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.src = card.imageSrc;
      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        const scale = Math.max(imageBox.w / image.naturalWidth, imageBox.h / image.naturalHeight);
        const drawW = image.naturalWidth * scale;
        const drawH = image.naturalHeight * scale;
        const drawX = imageBox.x + (imageBox.w - drawW) / 2;
        const drawY = imageBox.y + (imageBox.h - drawH) / 2;
        ctx.drawImage(image, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = card.colorHex;
        ctx.fillRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h);
      }
    } else {
      ctx.fillStyle = PENDING_POSTER_COLOR;
      ctx.fillRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h);
      ctx.fillStyle = "rgba(17,24,39,0.08)";
      ctx.fillRect(imageBox.x + 44, imageBox.y + 80, imageBox.w - 88, 4);
      ctx.fillRect(imageBox.x + 44, imageBox.y + 140, imageBox.w - 188, 4);
      ctx.fillRect(imageBox.x + 44, imageBox.y + 340, imageBox.w - 120, 4);
    }

    ctx.fillStyle = "#111827";
    ctx.font = "30px sans-serif";
    wrapText(body, 26)
      .slice(0, 3)
      .forEach((line, idx) => {
        ctx.fillText(line, 60, 1665 + idx * 44);
      });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `KnowLens-海报-${card.index}.png`;
    link.click();
    reportPosterDownloadEvent({
      status: "ok",
      cardIndex: card.index,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poster download failed.";
    reportPosterDownloadEvent({
      status: "error",
      code: "POSTER_DOWNLOAD_FAILED",
      message,
      cardIndex: card.index,
    });
  }
}

function PosterNode({ data }: NodeProps<Node<PosterNodeData>>) {
  const {
    card,
    isSelected,
    onUpdate,
    onRetry,
    onRedraw,
    onUndoCopy,
    onRestoreCopy,
    onDownload,
  } = data;
  const canEdit = card.status === "ready";
  const isGenerating =
    card.status === "queued" || card.status === "generating" || card.status === "retrying";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const minHeight = 108;
    const maxHeight = 220;
    el.style.height = "0px";
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [card.copy]);

  return (
    <div
      className={`w-[86vw] max-w-[420px] rounded-xl border bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.1)] transition ${
        isSelected ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-500">Poster {card.index}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canEdit || card.history.length === 0}
            onClick={() => onUndoCopy(card.id)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={11} />
            Undo
          </button>
          <button
            type="button"
            disabled={!canEdit || card.copy === card.initialCopy}
            onClick={() => onRestoreCopy(card.id)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Draft
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => onDownload(card)}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3.5 text-[11px] font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={card.copy}
          onChange={(event) => onUpdate(card.id, { copy: event.target.value })}
          rows={4}
          disabled={!canEdit}
          className="min-h-[108px] w-full resize-none rounded-md border border-zinc-200 px-2.5 pb-10 pt-2 text-xs leading-5 text-zinc-700 outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50"
        />
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => onRedraw(card.id)}
          className="absolute bottom-2 right-2 inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={11} />
          Redraw
        </button>
      </div>

      <div className="relative mt-2 overflow-hidden rounded-lg border border-zinc-200">
        {card.status === "ready" ? (
          <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-100">
            <img
              src={card.imageSrc}
              alt={`Poster ${card.index}`}
              className="block h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => {
                console.warn("[PosterCanvas] image load failed:", card.imageSrc);
                onUpdate(card.id, {
                  status: "failed",
                  errorMessage: "Image failed to load from provider URL. Please retry.",
                });
              }}
            />
          </div>
        ) : (
          <div className="relative aspect-[9/16] w-full" style={{ backgroundColor: PENDING_POSTER_COLOR }} />
        )}
        {isGenerating ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm">
              <LoaderCircle size={12} className="animate-spin text-blue-500" />
              Rendering poster
            </div>
          </div>
        ) : null}
        {card.status === "failed" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 px-4 backdrop-blur-[1px]">
            <div className="max-w-[220px] rounded-lg border border-red-200 bg-white px-3 py-2 text-center shadow-sm">
              <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircle size={15} />
              </div>
              <p className="text-xs font-medium text-zinc-800">Generation failed</p>
              <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                {card.errorMessage || "Please retry from this card."}
              </p>
              <button
                type="button"
                onClick={() => onRetry(card.id)}
                className="mt-2 inline-flex h-8 items-center gap-1 rounded-md bg-zinc-900 px-3 text-xs text-white hover:bg-zinc-700"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          </div>
        ) : null}
        {card.status === "ready" && card.errorMessage ? (
          <div className="absolute inset-x-0 bottom-0 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {card.errorMessage}
          </div>
        ) : null}
      </div>

      {card.archives.length ? (
        <div className="mt-2">
          <p className="mb-1 text-[11px] text-zinc-500">History (before redraw)</p>
          <div className="grid grid-cols-4 gap-1.5">
            {card.archives.map((archive) => (
              <div key={archive.id} className="relative aspect-[9/16] overflow-hidden rounded-md border border-zinc-200">
                <img
                  src={archive.imageSrc}
                  alt="Poster history"
                  className="block h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PosterCanvas({
  posterCount,
  posterDraft,
  posterPlanList,
  generationTaskStateByIndex,
  onRetryGenerationTask,
  onSaveStateChange,
}: PosterCanvasProps) {
  const count = Math.max(1, Math.min(10, posterCount));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState("100%");
  const [hasPendingSave, setHasPendingSave] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasAutoFocusedFirstCardRef = useRef(false);
  const initKey = useMemo(() => {
    const draftPart = [
      posterDraft?.headline ?? "",
      posterDraft?.subtitle ?? "",
      posterDraft?.body ?? "",
      posterDraft?.visualType ?? "",
      (posterDraft?.points ?? []).join("||"),
    ].join("|");
    const planPart = posterPlanList
      .map((item) => `${item.index}|${item.title}|${item.focus}`)
      .join("||");
    return `${count}__${draftPart}__${planPart}`;
  }, [
    count,
    posterDraft?.body,
    posterDraft?.headline,
    posterDraft?.points,
    posterDraft?.subtitle,
    posterDraft?.visualType,
    posterPlanList,
  ]);
  const initialCards = useMemo<PosterCard[]>(
    () =>
      Array.from({ length: count }, (_, idx) => {
        const plan = posterPlanList[idx];
        const copy = buildPosterCardCopy(posterDraft, plan, idx + 1, count);
        return {
          id: `poster-card-${idx + 1}`,
          index: idx + 1,
          copy,
          colorHex: POSTER_PLACEHOLDER_COLORS[idx % POSTER_PLACEHOLDER_COLORS.length],
          imageSrc: CASE_IMAGES[idx % CASE_IMAGES.length],
          status: "idle" as const,
          x: idx * 468,
          y: 48,
          initialCopy: copy,
          history: [],
          archives: [],
        };
      }),
    [count, posterDraft, posterPlanList],
  );
  const [cards, setCards] = useState<PosterCard[]>(() => initialCards);
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    initKeyRef.current = initKey;
    hasAutoFocusedFirstCardRef.current = false;
    setSelectedCardId(null);
    setHasPendingSave(false);

    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }
      setCards(initialCards);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [initKey, initialCards]);

  useEffect(() => {
    if (hasAutoFocusedFirstCardRef.current || !cards.length) {
      return;
    }
    const firstCard = [...cards].sort((a, b) => a.index - b.index)[0];
    if (!firstCard) {
      return;
    }
    hasAutoFocusedFirstCardRef.current = true;
    setSelectedCardId(firstCard.id);
    window.requestAnimationFrame(() => {
      flowRef.current?.setCenter(firstCard.x + 210, firstCard.y + 380, {
        zoom: 0.86,
        duration: 220,
      });
    });
  }, [cards]);

  useEffect(() => {
    if (!generationTaskStateByIndex) {
      return;
    }
    setCards((prev) =>
      prev.map((item) => {
        const taskState = generationTaskStateByIndex[item.index];
        if (!taskState) {
          return item;
        }
        if (taskState.status === "success" && taskState.imageUrl) {
          return {
            ...item,
            status: "ready",
            imageSrc: taskState.imageUrl,
            colorHex: POSTER_PLACEHOLDER_COLORS[(item.index + 2) % POSTER_PLACEHOLDER_COLORS.length],
            errorMessage: undefined,
            timeoutAt: undefined,
          };
        }
        if (taskState.status === "failed") {
          return {
            ...item,
            status: "failed",
            errorMessage: taskState.error || "Please retry from this card.",
            timeoutAt: undefined,
          };
        }
        if (
          taskState.status === "queued" ||
          taskState.status === "generating" ||
          taskState.status === "retrying"
        ) {
          return {
            ...item,
            status: taskState.status,
            errorMessage: undefined,
            timeoutAt: taskState.startedAt,
          };
        }
        return item;
      }),
    );
  }, [generationTaskStateByIndex]);

  useEffect(() => {
    const hasFailed = cards.some((item) => item.status === "failed");
    const hasProcessing = cards.some(
      (item) => item.status === "queued" || item.status === "generating" || item.status === "retrying",
    );
    if (hasFailed) {
      onSaveStateChange?.("error", true);
      return;
    }
    if (hasPendingSave || hasProcessing) {
      onSaveStateChange?.("saving", true);
      return;
    }
    onSaveStateChange?.("saved", false);
  }, [cards, hasPendingSave, onSaveStateChange]);

  const handleUpdateCard = useCallback((id: string, patch: Partial<PosterCard>) => {
    setCards((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (typeof patch.copy === "string" && patch.copy !== item.copy) {
          return {
            ...item,
            ...patch,
            history: [...item.history, item.copy].slice(-20),
          };
        }
        return { ...item, ...patch };
      }),
    );
    setHasPendingSave(true);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setHasPendingSave(false);
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleUndoCopy = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.history.length === 0) {
          return item;
        }
        const nextHistory = item.history.slice(0, -1);
        const last = item.history[item.history.length - 1] ?? item.copy;
        return { ...item, copy: last, history: nextHistory };
      }),
    );
    setHasPendingSave(true);
  }, []);

  const handleRestoreCopy = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (item.copy === item.initialCopy) {
          return item;
        }
        return {
          ...item,
          history: [...item.history, item.copy].slice(-20),
          copy: item.initialCopy,
        };
      }),
    );
    setHasPendingSave(true);
  }, []);

  const handleRetryCard = useCallback((id: string) => {
    const index = Number(id.replace("poster-card-", ""));
    if (!Number.isFinite(index)) {
      return;
    }
    setCards((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "retrying", errorMessage: undefined } : item,
      ),
    );
    onRetryGenerationTask?.(index);
  }, [onRetryGenerationTask]);

  const handleRedrawCard = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.status !== "ready") {
          return item;
        }
        const archived = {
          id: `${item.id}-archive-${Date.now()}`,
          imageSrc: item.imageSrc,
          createdAt: Date.now(),
        };
        return {
          ...item,
          archives: [archived, ...item.archives].slice(0, 12),
          imageSrc: pickNextCaseImage(item.imageSrc, item.index),
          status: "generating",
        };
      }),
    );
    window.setTimeout(() => {
      setCards((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "ready" } : item)),
      );
    }, 860);
  }, []);

  const handleDownloadCard = useCallback((card: PosterCard) => {
    void exportPosterImage(card);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (isBulkDownloading) {
      return;
    }
    const readyCards = cards.filter((item) => item.status === "ready").sort((a, b) => a.index - b.index);
    if (!readyCards.length) {
      return;
    }
    setIsBulkDownloading(true);
    for (let idx = 0; idx < readyCards.length; idx += 1) {
      await exportPosterImage(readyCards[idx]);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    setIsBulkDownloading(false);
  }, [cards, isBulkDownloading]);

  const handleAutoLayout = useCallback(() => {
    setCards((prev) =>
      prev.map((item, idx) => ({
        ...item,
        x: idx * 468,
        y: 48,
      })),
    );
  }, []);

  const handleSortByPosition = useCallback(() => {
    setCards((prev) => {
      const sorted = [...prev].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
      return sorted.map((item, idx) => ({
        ...item,
        index: idx + 1,
      }));
    });
  }, []);

  const handleFitAll = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.14, duration: 250 });
  }, []);

  const handleFocusSelected = useCallback(() => {
    if (!selectedCardId || !flowRef.current) {
      return;
    }
    const target = cards.find((item) => item.id === selectedCardId);
    if (!target) {
      return;
    }
    flowRef.current.setCenter(target.x + 210, target.y + 380, { zoom: 0.86, duration: 240 });
  }, [cards, selectedCardId]);

  const nodes = useMemo<Node[]>(
    () =>
      cards.map((card) => ({
        id: card.id,
        type: "poster",
        position: { x: card.x, y: card.y },
        data: {
          card,
          isSelected: selectedCardId === card.id,
          onUpdate: handleUpdateCard,
          onRetry: handleRetryCard,
          onRedraw: handleRedrawCard,
          onUndoCopy: handleUndoCopy,
          onRestoreCopy: handleRestoreCopy,
          onDownload: handleDownloadCard,
        } as PosterNodeData,
      })),
    [
      cards,
      selectedCardId,
      handleDownloadCard,
      handleRedrawCard,
      handleRestoreCopy,
      handleRetryCard,
      handleUndoCopy,
      handleUpdateCard,
    ],
  );

  const edges = useMemo<Edge[]>(() => [], []);
  const nodeTypes = useMemo(() => ({ poster: PosterNode }), []);
  const readyCount = cards.filter((item) => item.status === "ready").length;
  const failedCount = cards.filter((item) => item.status === "failed").length;
  const selectedCard = selectedCardId ? cards.find((item) => item.id === selectedCardId) : null;
  const showCanvasArrangeTools = false;

  if (!cards.length) {
    return (
      <section className="flex h-full w-full items-center justify-center border border-zinc-200 bg-white">
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-800">No poster content yet</p>
          <p className="mt-1 text-xs text-zinc-500">Confirm settings and generate draft content first.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {showCanvasArrangeTools ? (
            <>
              <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                <button
                  type="button"
                  onClick={handleFitAll}
                  title="全部适配"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-white"
                >
                  <Grid3X3 size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleFocusSelected}
                  title="聚焦当前"
                  disabled={!selectedCard}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-white disabled:opacity-40"
                >
                  <LocateFixed size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                <button
                  type="button"
                  onClick={handleAutoLayout}
                  title="自动排布"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-white"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleSortByPosition}
                  title="按位置排序"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-white"
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>
            </>
          ) : null}
          <span className="text-xs text-zinc-500">
            Progress {readyCount}/{cards.length}
            {failedCount ? ` · Failed ${failedCount}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
            <ZoomIn size={12} />
            {zoomLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              if (selectedCard) {
                handleUndoCopy(selectedCard.id);
              }
            }}
            disabled={!selectedCard || selectedCard.history.length === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
            title="Undo"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={isBulkDownloading || readyCount === 0}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isBulkDownloading ? <LoaderCircle size={12} className="animate-spin" /> : <Download size={12} />}
            Download All
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow
          onInit={(instance) => {
            flowRef.current = instance;
            setZoomLabel(`${Math.round(instance.getZoom() * 100)}%`);
          }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onPaneClick={() => setSelectedCardId(null)}
          onNodeClick={(_, node) => setSelectedCardId(node.id)}
          onNodeDragStop={(_, node) => {
            setCards((prev) =>
              prev.map((item) =>
                item.id === node.id
                  ? {
                      ...item,
                      x: node.position.x,
                      y: node.position.y,
                    }
                  : item,
              ),
            );
          }}
          onMoveEnd={(_, viewport) => {
            setZoomLabel(`${Math.round((viewport.zoom ?? 1) * 100)}%`);
          }}
          fitView
          fitViewOptions={{ padding: 0.14, minZoom: 0.32, maxZoom: 1.1 }}
          panOnDrag
          zoomOnPinch
          zoomOnScroll
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
        >
          <MiniMap
            pannable
            zoomable
            nodeColor={() => "#111827"}
            maskColor="rgba(15,23,42,0.14)"
            className="!bottom-3 !right-3 !hidden !h-[96px] !w-[72px] !border !border-zinc-200 !bg-white md:!block"
          />
          <Controls showInteractive={false} className="!bottom-3 !left-3" />
          <Background color="#e5e7eb" gap={26} />
        </ReactFlow>
      </div>
    </section>
  );
}
