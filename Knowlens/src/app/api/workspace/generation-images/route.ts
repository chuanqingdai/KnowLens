import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { listGenerationImagesByProject } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(nextAuthOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Auth required." }, { status: 401 });
  }
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }
  const rows = listGenerationImagesByProject(projectId);
  return NextResponse.json({
    ok: true,
    images: rows.map((r) => ({
      taskIndex: r.task_index,
      imageUrl: r.image_url,
      rawImageUrl: r.raw_image_url,
      provider: r.provider,
      createdAt: r.created_at,
    })),
  });
}
