import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { getVideoExportJob } from "@/lib/server/video-export-jobs";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const job = await getVideoExportJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Video export job not found." }, { status: 404 });
    }

    if (job.userEmail) {
      const session = await getServerSession(nextAuthOptions);
      const email = session?.user?.email?.trim().toLowerCase() || "";
      if (email !== job.userEmail) {
        return NextResponse.json({ error: "Video export job not found." }, { status: 404 });
      }
    }

    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Video export job could not be loaded." }, { status: 500 });
  }
}
