import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  createVideoExportJob,
  runVideoExportJob,
  type VideoExportTimelineInput,
} from "@/lib/server/video-export-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

type CreateVideoExportJobBody = VideoExportTimelineInput & {
  projectId?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || null;
    const body = (await request.json().catch(() => ({}))) as CreateVideoExportJobBody;
    const job = await createVideoExportJob({
      userEmail: email,
      projectId: body.projectId,
      timeline: body,
    });

    after(async () => {
      await runVideoExportJob(job.id);
    });

    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video export job could not be created.";
    const status = message.toLowerCase().includes("missing") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
