import type { AttributionPayload, AttributionTouch } from "@/lib/attribution";

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeTouch(input: unknown): AttributionTouch | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const raw = input as Partial<AttributionTouch>;
  const source = clean(raw.source, 120);
  const landingPath = clean(raw.landingPath, 500);
  const capturedAt = clean(raw.capturedAt, 40);
  if (!source || !landingPath || !capturedAt) {
    return undefined;
  }
  return {
    source,
    medium: clean(raw.medium, 120) || undefined,
    campaign: clean(raw.campaign, 180) || undefined,
    term: clean(raw.term, 180) || undefined,
    content: clean(raw.content, 180) || undefined,
    ref: clean(raw.ref, 180) || undefined,
    gclid: clean(raw.gclid, 180) || undefined,
    fbclid: clean(raw.fbclid, 180) || undefined,
    ttclid: clean(raw.ttclid, 180) || undefined,
    msclkid: clean(raw.msclkid, 180) || undefined,
    referrer: clean(raw.referrer, 500) || undefined,
    landingPath,
    capturedAt,
  };
}

export function normalizeAttributionPayload(input: unknown): AttributionPayload | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const raw = input as Partial<AttributionPayload>;
  const firstTouch = normalizeTouch(raw.firstTouch);
  const lastTouch = normalizeTouch(raw.lastTouch);
  if (!firstTouch && !lastTouch) {
    return undefined;
  }
  return { firstTouch, lastTouch };
}

export function attributionSource(input?: AttributionPayload) {
  return clean(input?.lastTouch?.source, 64) || clean(input?.firstTouch?.source, 64) || "unknown";
}

function addMetadataValue(target: Record<string, string>, key: string, value: string) {
  if (value) {
    target[key] = value;
  }
}

export function attributionToStripeMetadata(input?: AttributionPayload): Record<string, string> {
  if (!input) {
    return {};
  }
  const last = input.lastTouch;
  const first = input.firstTouch;
  const metadata: Record<string, string> = {};
  addMetadataValue(metadata, "attribution_source", attributionSource(input));
  addMetadataValue(metadata, "attribution_medium", clean(last?.medium ?? first?.medium, 120));
  addMetadataValue(metadata, "attribution_campaign", clean(last?.campaign ?? first?.campaign, 180));
  addMetadataValue(metadata, "attribution_first_source", clean(first?.source, 120));
  addMetadataValue(metadata, "attribution_first_campaign", clean(first?.campaign, 180));
  addMetadataValue(metadata, "attribution_landing_path", clean(first?.landingPath ?? last?.landingPath, 500));
  addMetadataValue(metadata, "attribution_last_path", clean(last?.landingPath, 500));
  return metadata;
}
