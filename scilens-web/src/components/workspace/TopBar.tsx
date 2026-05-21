import { ArrowLeft, Clapperboard, FileDown, UserCircle2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

type SaveState = "saved" | "saving" | "error";

type TopBarProps = {
  credits: number;
  saveState?: SaveState;
  hasUnsavedChanges?: boolean;
  canvasMode?: "free" | "ppt";
  onCanvasModeChange?: (mode: "free" | "ppt") => void;
  onDownloadPpt?: () => void;
  onDownloadVideo?: () => void;
  actionsDisabled?: boolean;
  isExportingPpt?: boolean;
  isComposingVideo?: boolean;
};

function getSaveStateLabel(saveState: SaveState) {
  if (saveState === "saving") {
    return "保存中...";
  }
  if (saveState === "error") {
    return "保存失败";
  }
  return "已保存";
}

export function TopBar({
  credits,
  saveState = "saved",
  hasUnsavedChanges = false,
  canvasMode = "free",
  onCanvasModeChange,
  onDownloadPpt,
  onDownloadVideo,
  actionsDisabled = false,
  isExportingPpt = false,
  isComposingVideo = false,
}: TopBarProps) {
  const router = useRouter();
  const showWorkspaceActions =
    Boolean(onCanvasModeChange) && Boolean(onDownloadPpt || onDownloadVideo);
  const showPptAction = canvasMode === "ppt";
  const isPrimaryBusy = showPptAction ? isExportingPpt : isComposingVideo;
  const primaryActionLabel = showPptAction
    ? isExportingPpt
      ? "下载PPT中..."
      : "下载PPT"
    : isComposingVideo
      ? "合成中..."
      : "合成视频";

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex h-full w-full items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (
                hasUnsavedChanges &&
                !window.confirm("当前有未保存的修改，确定返回功能主页吗？")
              ) {
                return;
              }
              router.push("/");
            }}
            className="inline-flex h-8 w-8 items-center justify-center text-zinc-700 hover:text-zinc-900"
            aria-label="返回"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">
              火山喷发过程科普 PPT
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">内容草稿中</p>
          </div>
        </div>

        {showWorkspaceActions ? (
        <div className="hidden shrink-0 items-center gap-2 lg:ml-3 lg:flex">
          <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => onCanvasModeChange?.("ppt")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                canvasMode === "ppt"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              PPT 模式
            </button>
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => onCanvasModeChange?.("free")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                canvasMode === "free"
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              自由画布
            </button>
          </div>
        </div>
        ) : null}

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
            <span className="font-medium text-zinc-900">{credits}</span>
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
      </div>
    </header>
  );
}
