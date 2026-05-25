"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
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
  onSaveStateChange?: (saveState: SaveState, hasUnsavedChanges: boolean) => void;
};

type PosterCard = {
  id: string;
  index: number;
  copy: string;
  colorHex: string;
  imageSrc: string;
  status: "queued" | "generating" | "ready" | "failed";
  x: number;
  y: number;
  initialCopy: string;
  history: string[];
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
  const title = lines[0] || `海报 ${index}`;
  const subtitle = lines[1] || "知识可视化海报";
  const body = (lines.length > 2 ? lines.slice(2).join(" ") : lines.slice(1).join(" ")) || "补充这张海报的核心讲解内容。";
  return { title, subtitle, body };
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

async function exportPosterImage(card: PosterCard) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
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
  const isGenerating = card.status === "queued" || card.status === "generating";
  const statusLabel =
    card.status === "ready"
      ? "已完成"
      : card.status === "failed"
        ? "生成失败"
        : card.status === "queued"
          ? "待生成"
          : "生成中";
  const statusClass =
    card.status === "ready"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : card.status === "failed"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-zinc-100 text-zinc-600 border-zinc-200";

  return (
    <div
      className={`w-[86vw] max-w-[420px] rounded-xl border bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.1)] transition ${
        isSelected ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-500">海报 {card.index}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canEdit || card.history.length === 0}
            onClick={() => onUndoCopy(card.id)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={11} />
            撤销
          </button>
          <button
            type="button"
            disabled={!canEdit || card.copy === card.initialCopy}
            onClick={() => onRestoreCopy(card.id)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            初稿
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => onRedraw(card.id)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={12} />
            重绘
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => onDownload(card)}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-[11px] font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Download size={12} />
            下载
          </button>
        </div>
      </div>

      <textarea
        value={card.copy}
        onChange={(event) => onUpdate(card.id, { copy: event.target.value })}
        rows={4}
        disabled={!canEdit}
        className="w-full resize-none rounded-md border border-zinc-200 px-2.5 py-2 text-xs leading-5 text-zinc-700 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50"
      />

      <div className="relative mt-2 overflow-hidden rounded-lg border border-zinc-200">
        {card.status === "ready" ? (
          <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-100">
            <Image src={card.imageSrc} alt={`海报占位图${card.index}`} fill className="object-cover" />
          </div>
        ) : (
          <div className="relative aspect-[9/16] w-full" style={{ backgroundColor: PENDING_POSTER_COLOR }}>
            <div className="absolute left-3 top-3 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium text-zinc-700">
              灰色占位
            </div>
          </div>
        )}
        {isGenerating ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 shadow-sm">
              <LoaderCircle size={12} className="animate-spin text-blue-500" />
              正在绘制海报
            </div>
          </div>
        ) : null}
        {card.status === "failed" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <button
              type="button"
              onClick={() => onRetry(card.id)}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-zinc-900 px-3 text-xs text-white hover:bg-zinc-700"
            >
              <RefreshCw size={12} />
              重试本张
            </button>
          </div>
        ) : null}
      </div>

      {card.archives.length ? (
        <div className="mt-2">
          <p className="mb-1 text-[11px] text-zinc-500">历史海报（重绘前）</p>
          <div className="grid grid-cols-4 gap-1.5">
            {card.archives.map((archive) => (
              <div key={archive.id} className="relative aspect-[9/16] overflow-hidden rounded-md border border-zinc-200">
                <Image src={archive.imageSrc} alt="历史海报" fill className="object-cover" />
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
  onSaveStateChange,
}: PosterCanvasProps) {
  const count = Math.max(1, Math.min(10, posterCount));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState("100%");
  const [hasPendingSave, setHasPendingSave] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const saveTimerRef = useRef<number | null>(null);
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
        const points = posterDraft?.points ?? [];
        const fallbackPoint = points[idx % Math.max(1, points.length)] || "";
        return {
          id: `poster-card-${idx + 1}`,
          index: idx + 1,
          copy: `${plan?.title || `${posterDraft?.headline || "海报主题"} · 第${idx + 1}张`}\n${
            posterDraft?.subtitle || posterDraft?.visualType || "信息可视化海报"
          }\n${plan?.focus || fallbackPoint || posterDraft?.body || "补充这张海报的核心讲解内容。"}`,
          colorHex: POSTER_PLACEHOLDER_COLORS[idx % POSTER_PLACEHOLDER_COLORS.length],
          imageSrc: CASE_IMAGES[idx % CASE_IMAGES.length],
          status: "queued" as const,
          x: idx * 468,
          y: 48,
          initialCopy: `${plan?.title || `${posterDraft?.headline || "海报主题"} · 第${idx + 1}张`}\n${
            posterDraft?.subtitle || posterDraft?.visualType || "信息可视化海报"
          }\n${plan?.focus || fallbackPoint || posterDraft?.body || "补充这张海报的核心讲解内容。"}`,
          history: [],
          archives: [],
        };
      }),
    [count, posterDraft, posterPlanList],
  );
  const [cards, setCards] = useState<PosterCard[]>(() => initialCards);
  const initKeyRef = useRef<string>(initKey);

  useEffect(() => {
    if (initKeyRef.current === initKey) {
      return;
    }
    initKeyRef.current = initKey;
    setSelectedCardId(null);
    setHasPendingSave(false);

    let cancelled = false;
    const timers: number[] = [];
    const raf = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }
      setCards(initialCards);
      initialCards.forEach((_, idx) => {
        const startTimer = window.setTimeout(() => {
          if (cancelled) {
            return;
          }
          setCards((prev) =>
            prev.map((item, itemIdx) => (itemIdx === idx ? { ...item, status: "generating" } : item)),
          );
        }, 240 + idx * 560);
        const readyTimer = window.setTimeout(() => {
          if (cancelled) {
            return;
          }
          setCards((prev) =>
            prev.map((item, itemIdx) =>
              itemIdx === idx
                ? {
                    ...item,
                    status: "ready",
                    colorHex: POSTER_PLACEHOLDER_COLORS[(idx + 2) % POSTER_PLACEHOLDER_COLORS.length],
                  }
                : item,
            ),
          );
        }, 720 + idx * 560);
        timers.push(startTimer, readyTimer);
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [initKey, initialCards]);

  useEffect(() => {
    const hasFailed = cards.some((item) => item.status === "failed");
    const hasProcessing = cards.some((item) => item.status === "queued" || item.status === "generating");
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
    setCards((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "generating" } : item)),
    );
    window.setTimeout(() => {
      setCards((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "ready" } : item)),
      );
    }, 760);
  }, []);

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
          <p className="text-sm font-medium text-zinc-800">暂无海报内容</p>
          <p className="mt-1 text-xs text-zinc-500">请先在左侧确认配置并生成文稿</p>
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
            进度 {readyCount}/{cards.length}
            {failedCount ? ` · 失败 ${failedCount}` : ""}
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
            title="撤销上一步"
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
            下载全部
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
            className="!bottom-3 !right-3 !hidden !border !border-zinc-200 !bg-white md:!block"
          />
          <Controls showInteractive={false} className="!bottom-3 !left-3" />
          <Background color="#e5e7eb" gap={26} />
        </ReactFlow>
      </div>
    </section>
  );
}
