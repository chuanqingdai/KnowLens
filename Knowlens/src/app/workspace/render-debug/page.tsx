import { notFound } from "next/navigation";
import { PosterCanvas } from "@/components/workspace/PosterCanvas";
import {
  buildGenerationTaskStateByIndexFromNormalized,
  normalizeImageBatchTaskResults,
} from "@/lib/workspace/image-task-bridge";

const FALLBACK_MOCK_IMAGE_URL =
  "https://apioss20.sydney-ai.com/img/174/t9il_0UNjpQmjxFqjxQAjxQnfx1m10kNt7TgYsFuksWxtvFN1a_ljpMm1xkmXaMV1aklX5oItaMm10ezjaQlX9hnX0-u1a_q103lX01TXpQAX4Tgkx1qfv24kAVmR8_=/gi2007i-144x144-1780044357126-ab388bbc.png";

export default function WorkspaceRenderDebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const mockImageUrl = (process.env.IMAGE_GENERATION_MOCK_URL || FALLBACK_MOCK_IMAGE_URL).trim();
  const mockBatchTasks = [
    {
      taskId: "mock-bridge-task-1",
      index: 1,
      status: "asset_ready",
      ok: true,
      imageUrl: mockImageUrl,
      rawImageUrl: mockImageUrl,
      error: null,
      errorCode: null,
    },
  ] as const;
  const normalizedResults = normalizeImageBatchTaskResults({
    taskResults: [...mockBatchTasks],
    requestedTaskIndexes: [1],
  });
  const generationTaskStateByIndex = buildGenerationTaskStateByIndexFromNormalized({
    normalizedResults,
    maxAttempts: 1,
  });

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f7f8] text-zinc-900">
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-5 pt-4">
        <h1 className="text-base font-semibold">Workspace Render Debug (Development Only)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          PosterCanvas receives a mocked success task state with a fixed image URL.
        </p>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-[1400px] flex-1 px-5 pb-6">
        <div className="h-[calc(100vh-132px)] min-h-[640px] overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <PosterCanvas
            posterCount={1}
            posterDraft={{
              headline: "Render Debug Poster",
              subtitle: "PosterCanvas image rendering verification",
              body: "This page bypasses the full wizard and validates whether PosterCanvas can render a ready-state image.",
              points: [
                "No real provider call",
                "Mock batch response normalized through shared bridge helper",
                "Use data-testid hooks for deterministic checks",
              ],
              cta: "Debug mode",
            }}
            posterPlanList={[
              {
                index: 1,
                title: "PosterCanvas Render Check",
                focus: "Verify image visibility and DOM load states.",
              },
            ]}
            generationTaskStateByIndex={generationTaskStateByIndex}
          />
        </div>
      </div>
    </main>
  );
}
