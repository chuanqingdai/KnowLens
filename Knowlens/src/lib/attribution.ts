export type AttributionTouch = {
  source: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  ref?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  msclkid?: string;
  referrer?: string;
  landingPath: string;
  capturedAt: string;
};

export type AttributionPayload = {
  firstTouch?: AttributionTouch;
  lastTouch?: AttributionTouch;
};

const FIRST_TOUCH_KEY = "knowlens:attribution:first-touch";
const LAST_TOUCH_KEY = "knowlens:attribution:last-touch";
const TOUCH_LOG_KEY_PREFIX = "knowlens:attribution:logged:";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "via",
  "source",
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
];

function clean(value: string | null | undefined, max = 240) {
  return (value ?? "").trim().slice(0, max);
}

function parseStoredTouch(raw: string | null) {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AttributionTouch>;
    const source = clean(parsed.source, 120);
    const landingPath = clean(parsed.landingPath, 500);
    const capturedAt = clean(parsed.capturedAt, 40);
    if (!source || !landingPath || !capturedAt) {
      return undefined;
    }
    return {
      source,
      medium: clean(parsed.medium, 120) || undefined,
      campaign: clean(parsed.campaign, 180) || undefined,
      term: clean(parsed.term, 180) || undefined,
      content: clean(parsed.content, 180) || undefined,
      ref: clean(parsed.ref, 180) || undefined,
      gclid: clean(parsed.gclid, 180) || undefined,
      fbclid: clean(parsed.fbclid, 180) || undefined,
      ttclid: clean(parsed.ttclid, 180) || undefined,
      msclkid: clean(parsed.msclkid, 180) || undefined,
      referrer: clean(parsed.referrer, 500) || undefined,
      landingPath,
      capturedAt,
    } satisfies AttributionTouch;
  } catch {
    return undefined;
  }
}

function writeStoredTouch(key: string, touch: AttributionTouch) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(touch));
  } catch {
    // Attribution should never interrupt the user flow.
  }
}

function readStoredTouch(key: string) {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return parseStoredTouch(window.localStorage.getItem(key));
  } catch {
    return undefined;
  }
}

function hasTrackingSignal(params: URLSearchParams) {
  return TRACKING_PARAMS.some((param) => clean(params.get(param)));
}

function isExternalReferrer(referrer: string) {
  if (typeof window === "undefined" || !referrer) {
    return false;
  }
  try {
    return new URL(referrer).hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

function buildTouchFromLocation() {
  if (typeof window === "undefined") {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  const hasParams = hasTrackingSignal(params);
  const referrer = clean(document.referrer, 500);
  const hasExternalReferrer = isExternalReferrer(referrer);
  const existingFirst = readStoredTouch(FIRST_TOUCH_KEY);

  if (!hasParams && existingFirst) {
    return undefined;
  }

  if (!hasParams && !hasExternalReferrer && existingFirst) {
    return undefined;
  }

  const explicitSource =
    clean(params.get("utm_source"), 120) ||
    clean(params.get("source"), 120) ||
    clean(params.get("via"), 120) ||
    clean(params.get("ref"), 120);
  const paidClickSource =
    clean(params.get("gclid")) ? "google_ads" :
      clean(params.get("fbclid")) ? "meta_ads" :
        clean(params.get("ttclid")) ? "tiktok_ads" :
          clean(params.get("msclkid")) ? "microsoft_ads" :
            "";
  const source = explicitSource || paidClickSource || (hasExternalReferrer ? "referral" : "direct");

  return {
    source,
    medium: clean(params.get("utm_medium"), 120) || (paidClickSource ? "paid" : undefined),
    campaign: clean(params.get("utm_campaign"), 180) || undefined,
    term: clean(params.get("utm_term"), 180) || undefined,
    content: clean(params.get("utm_content"), 180) || undefined,
    ref: clean(params.get("ref"), 180) || clean(params.get("via"), 180) || undefined,
    gclid: clean(params.get("gclid"), 180) || undefined,
    fbclid: clean(params.get("fbclid"), 180) || undefined,
    ttclid: clean(params.get("ttclid"), 180) || undefined,
    msclkid: clean(params.get("msclkid"), 180) || undefined,
    referrer: referrer || undefined,
    landingPath: `${window.location.pathname}${window.location.search}`,
    capturedAt: new Date().toISOString(),
  } satisfies AttributionTouch;
}

export function captureAttributionFromLocation() {
  const touch = buildTouchFromLocation();
  if (!touch) {
    return undefined;
  }

  if (!readStoredTouch(FIRST_TOUCH_KEY)) {
    writeStoredTouch(FIRST_TOUCH_KEY, touch);
  }
  writeStoredTouch(LAST_TOUCH_KEY, touch);
  return touch;
}

export function readAttributionPayload(): AttributionPayload {
  return {
    firstTouch: readStoredTouch(FIRST_TOUCH_KEY),
    lastTouch: readStoredTouch(LAST_TOUCH_KEY),
  };
}

export function buildAttributionSource(attribution?: AttributionPayload | null) {
  return (
    clean(attribution?.lastTouch?.source, 64) ||
    clean(attribution?.firstTouch?.source, 64) ||
    "unknown"
  );
}

export function shouldLogAttributionTouch(touch: AttributionTouch) {
  if (typeof window === "undefined") {
    return false;
  }
  const key = `${TOUCH_LOG_KEY_PREFIX}${touch.capturedAt}:${touch.source}:${touch.landingPath}`;
  try {
    if (window.sessionStorage.getItem(key) === "1") {
      return false;
    }
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}
