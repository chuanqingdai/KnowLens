"use client";

import { ArrowLeft, ArrowRight, Download, LoaderCircle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { UserMenu } from "@/components/auth/UserMenu";

type SaveState = "saved" | "saving" | "error";

type TopBarProps = {
  credits: number;
  title?: string;
  stageLabel?: string;
  saveState?: SaveState;
  hasUnsavedChanges?: boolean;
  canvasMode?: "free" | "ppt";
  onDownloadPpt?: () => void;
  onDownloadVideo?: () => void;
  actionsDisabled?: boolean;
  disabledPrimaryActionLabel?: string;
  isExportingPpt?: boolean;
  isComposingVideo?: boolean;
  showOpenCanvasButton?: boolean;
  onOpenCanvas?: () => void;
};

function getSaveStateLabel(saveState: SaveState) {
  if (saveState === "saving") {
    return "Saving...";
  }
  if (saveState === "error") {
    return "Save failed";
  }
  return "Saved";
}

export function TopBar({
  credits,
  title = "Content Workspace",
  stageLabel = "Draft in progress",
  saveState = "saved",
  hasUnsavedChanges = false,
  canvasMode = "free",
  onDownloadPpt,
  onDownloadVideo,
  actionsDisabled = false,
  disabledPrimaryActionLabel,
  isExportingPpt = false,
  isComposingVideo = false,
  showOpenCanvasButton = false,
  onOpenCanvas,
}: TopBarProps) {
  const router = useRouter();
  const showWorkspaceActions = Boolean(onDownloadPpt || onDownloadVideo);
  const showPptAction = canvasMode === "ppt";
  const isPrimaryBusy = showPptAction ? isExportingPpt : isComposingVideo;
  const isPrimaryUnavailable = actionsDisabled || isPrimaryBusy;
  const primaryActionLabel = showPptAction
    ? actionsDisabled && disabledPrimaryActionLabel
      ? disabledPrimaryActionLabel
      : isExportingPpt
        ? "Preparing PPT..."
        : "Download PPT"
    : actionsDisabled && disabledPrimaryActionLabel
      ? disabledPrimaryActionLabel
      : isComposingVideo
        ? "Preparing Video..."
        : "Download Video";

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-zinc-200 bg-white/95 text-zinc-800 backdrop-blur">
      <div className="flex h-full w-full items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (
                hasUnsavedChanges &&
                !window.confirm("You have unsaved changes. Return to Home?")
              ) {
                return;
              }
              router.push("/app");
            }}
            className="inline-flex h-8 w-8 items-center justify-center text-zinc-700 hover:text-zinc-900"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <p
              suppressHydrationWarning
              className="truncate text-[15px] font-semibold leading-5 text-zinc-800"
            >
              {title}
            </p>
            <p suppressHydrationWarning className="mt-0.5 text-[12px] text-zinc-500">
              {stageLabel}
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 sm:flex">
          <span
            suppressHydrationWarning
            className={`text-xs ${
              saveState === "error" ? "text-red-600" : "text-zinc-500"
            }`}
          >
            {getSaveStateLabel(saveState)}
          </span>
          {showWorkspaceActions ? (
            <button
              type="button"
              disabled={isPrimaryUnavailable}
              onClick={showPptAction ? onDownloadPpt : onDownloadVideo}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed ${
                isPrimaryUnavailable
                  ? "bg-zinc-200 text-zinc-600"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              {isPrimaryUnavailable ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {primaryActionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/membership")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            <Zap size={15} className="text-zinc-500" />
            <span suppressHydrationWarning className="font-medium text-zinc-800">
              {credits}
            </span>
            <span className="text-zinc-500">|</span>
            <span className="font-medium">Upgrade</span>
          </button>
          <UserMenu />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:hidden">
          {showOpenCanvasButton ? (
            <button
              type="button"
              onClick={onOpenCanvas}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:translate-y-[1px]"
            >
              <span>Open Canvas</span>
              <ArrowRight size={13} />
            </button>
          ) : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
