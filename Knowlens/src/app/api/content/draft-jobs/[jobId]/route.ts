import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  getContentDraftJob,
  runContentDraftJob,
  shouldResumeContentDraftJob,
} from "@/lib/server/content-draft-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const job = await getContentDraftJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Draft job not found." }, { status: 404 });
    }

    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (job.userEmail && email !== job.userEmail) {
      return NextResponse.json({ error: "Draft job not found." }, { status: 404 });
    }

    if (shouldResumeContentDraftJob(job)) {
      const runtimeContext = {
        origin: request.nextUrl.origin,
        cookie: request.headers.get("cookie"),
      };
      after(async () => {
        await runContentDraftJob(job.id, runtimeContext);
      });
    }

    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Draft job could not be loaded." }, { status: 500 });
  }
}
