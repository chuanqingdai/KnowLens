import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/server/admin-auth";
import { listOpsEvents, readOpsLogFileByUserEmail } from "@/lib/server/store";

export const runtime = "nodejs";

function parseIntInRange(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const userEmail = (request.nextUrl.searchParams.get("userEmail") ?? "").trim().toLowerCase();
  const format = (request.nextUrl.searchParams.get("format") ?? "jsonl").trim().toLowerCase();
  const limit = parseIntInRange(request.nextUrl.searchParams.get("limit"), 800, 1, 5000);
  if (!userEmail) {
    return NextResponse.json({ error: "userEmail is required." }, { status: 400 });
  }

  const fileResult = readOpsLogFileByUserEmail(userEmail, limit);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `ops-${userEmail.replace(/[^a-z0-9@._-]+/gi, "_")}-${timestamp}`;

  if (format === "json") {
    const dbLogs = listOpsEvents({
      userEmail,
      limit,
    });
    return new NextResponse(JSON.stringify({ userEmail, generatedAt: new Date().toISOString(), logs: dbLogs }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${baseName}.json\"`,
      },
    });
  }

  if (fileResult.lines.length > 0) {
    return new NextResponse(fileResult.lines.join("\n") + "\n", {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${baseName}.jsonl\"`,
        "X-KnowLens-Log-Path": fileResult.path,
      },
    });
  }

  const dbLogs = listOpsEvents({
    userEmail,
    limit,
  });
  const ndjson = dbLogs.map((row) => JSON.stringify(row)).join("\n");
  return new NextResponse(ndjson + (ndjson ? "\n" : ""), {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${baseName}.jsonl\"`,
      "X-KnowLens-Log-Path": fileResult.path,
    },
  });
}

