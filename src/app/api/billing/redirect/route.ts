import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("target");
  if (!target) {
    return new Response("Missing target", { status: 400 });
  }

  let url = target;
  try {
    url = decodeURIComponent(target);
  } catch {
    url = target;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid redirect target", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("stripe.com")) {
    return new Response("Unsupported redirect target", { status: 400 });
  }

  return Response.redirect(parsed.toString(), 302);
}
