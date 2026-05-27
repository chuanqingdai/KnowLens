"use client";

import { ArrowLeft, Clapperboard, FileDown, Zap } from "lucide-react";
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
  isExportingPpt?: boolean;
  isComposingVideo?: boolean;
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
  isExportingPpt = false,
  isComposingVideo = false,
}: TopBarProps) {
  const router = useRouter();
  const showWorkspaceActions = Boolean(onDownloadPpt || onDownloadVideo);
  const showPptAction = canvasMode === "ppt";
  const isPrimaryBusy = showPptAction ? isExportingPpt : isComposingVideo;
  const primaryActionLabel = showPptAction
    ? isExportingPpt
      ? "Exporting PPT..."
      : "Export PPT"
    : isComposingVideo
      ? "Composing..."
      : "Compose Video";

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
            <p className="truncate text-[15px] font-semibold leading-5 text-zinc-800">
              {title}
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-500">{stageLabel}</p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 sm:flex">
          <span
            className={`text-xs ${
              saveState === "error" ? "text-red-600" : "text-zinc-500"
            }`}
          >
            {getSaveStateLabel(saveState)}
          </span>
          {showWorkspaceActions ? (
            <button
              type="button"
              disabled={actionsDisabled || isPrimaryBusy}
              onClick={showPptAction ? onDownloadPpt : onDownloadVideo}
              className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                showPptAction ? "bg-zinc-900 hover:bg-zinc-700" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {showPptAction ? (
                <FileDown size={13} className="mr-1.5" />
              ) : (
                <Clapperboard size={13} className="mr-1.5" />
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
            <span className="font-medium text-zinc-800">{credits}</span>
            <span className="text-zinc-500">|</span>
            <span className="font-medium">Upgrade</span>
          </button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
