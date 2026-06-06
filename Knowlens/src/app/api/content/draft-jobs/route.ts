import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  createContentDraftJob,
  runContentDraftJob,
  type ContentDraftJobRequest,
} from "@/lib/server/content-draft-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Please sign in before generating draft content." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ContentDraftJobRequest;
    const job = await createContentDraftJob({
      userEmail: email,
      projectId: body.projectId,
      request: body,
    });
    const runtimeContext = {
      origin: request.nextUrl.origin,
      cookie: request.headers.get("cookie"),
    };

    after(async () => {
      await runContentDraftJob(job.id, runtimeContext);
    });

    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft job could not be created.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
