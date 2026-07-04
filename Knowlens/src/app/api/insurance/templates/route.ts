import { NextResponse } from "next/server";
import { insuranceShowcaseTemplates } from "@/app/insurance/page";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      templates: insuranceShowcaseTemplates,
      total: insuranceShowcaseTemplates.length,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
