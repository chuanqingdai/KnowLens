"use client";

import { useEffect } from "react";

const TELEMETRY_ENDPOINT = "/api/telemetry/client-log";
const MAX_MESSAGE_CHARS = 500;
const MAX_DETAIL_CHARS = 1800;

function clampText(input: unknown, max = MAX_MESSAGE_CHARS) {
  return String(input ?? "").slice(0, max);
}

function safeJson(input: unknown, max = MAX_DETAIL_CHARS) {
  try {
    return JSON.stringify(input).slice(0, max);
  } catch {
    return "";
  }
}

function buildGaEventName(category: unknown, action: unknown) {
  const raw = `${category || "event"}_${action || "unknown"}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (raw || "knowlens_event").slice(0, 40);
}

function parseTelemetryBody(body: unknown) {
  if (typeof body !== "string") {
    return null;
  }
  try {
    return JSON.parse(body) as {
      category?: string;
      action?: string;
      status?: string;
      source?: string;
      code?: string;
      message?: string;
      projectId?: string;
      details?: unknown;
    };
  } catch {
    return null;
  }
}

function mirrorTelemetryToGoogleAnalytics(url: string, init?: RequestInit) {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !url.includes("/api/telemetry/")
  ) {
    return;
  }
  const parsed = parseTelemetryBody(init?.body);
  if (!parsed?.category || !parsed.action) {
    return;
  }
  emitGoogleAnalyticsEvent(parsed);
}

function emitGoogleAnalyticsEvent(input: {
  category?: string;
  action?: string;
  status?: string;
  source?: string;
  code?: string;
  message?: string;
  projectId?: string;
  details?: unknown;
}) {
  if (
    typeof window === "undefined" ||
    typeof window.gtag !== "function" ||
    !input.category ||
    !input.action
  ) {
    return;
  }
  window.gtag("event", buildGaEventName(input.category, input.action), {
    event_category: input.category,
    event_label: input.action,
    status: input.status || "info",
    source: clampText(input.source, 80),
    code: clampText(input.code, 80),
    message: clampText(input.message, 120),
    project_id: clampText(input.projectId, 120),
    page_path: `${window.location.pathname}${window.location.search}`,
    details_json: safeJson(input.details, 500),
  });
}

function normalizeUrl(input: unknown) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input instanceof Request
          ? input.url
          : "";
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw, window.location.origin);
    return `${parsed.pathname}${parsed.search}`.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

function shouldSkipUrl(url: string) {
  return (
    !url ||
    url.includes(TELEMETRY_ENDPOINT) ||
    url.includes("/api/telemetry/event") ||
    url.includes("/_next/") ||
    url.startsWith("data:")
  );
}

function reportClientError(input: {
  action: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  const payload = {
    category: "client",
    action: input.action,
    status: "error",
    source: typeof window === "undefined" ? "unknown" : window.location.pathname,
    code: input.code,
    message: clampText(input.message),
    details: {
      pageUrl: typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`,
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      ...input.details,
    },
  };
  const body = JSON.stringify(payload);
  emitGoogleAnalyticsEvent(payload);
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(TELEMETRY_ENDPOINT, blob)) {
        return;
      }
    }
  } catch {
    // Fall through to fetch.
  }
  void fetch(TELEMETRY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function ClientErrorReporter() {
  useEffect(() => {
    const reportedKeys = new Map<string, number>();
    const shouldReport = (key: string) => {
      const now = Date.now();
      const previous = reportedKeys.get(key) ?? 0;
      if (now - previous < 10_000) {
        return false;
      }
      reportedKeys.set(key, now);
      return true;
    };

    const onError = (event: ErrorEvent) => {
      const message = event.message || event.error?.message || "Unhandled browser error.";
      const key = `error:${message}:${event.filename}:${event.lineno}:${event.colno}`;
      if (!shouldReport(key)) {
        return;
      }
      reportClientError({
        action: "browser_error",
        code: "CLIENT_UNHANDLED_ERROR",
        message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: clampText(event.error?.stack, 1200),
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : clampText(reason || "Unhandled promise rejection.");
      const key = `rejection:${message}`;
      if (!shouldReport(key)) {
        return;
      }
      reportClientError({
        action: "unhandled_rejection",
        code: "CLIENT_UNHANDLED_REJECTION",
        message,
        details: {
          stack: reason instanceof Error ? clampText(reason.stack, 1200) : "",
          reason: reason instanceof Error ? "" : clampText(reason, 1200),
        },
      });
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = normalizeUrl(input);
      const method =
        init?.method ||
        (input instanceof Request ? input.method : "GET");
      const startedAt = Date.now();
      mirrorTelemetryToGoogleAnalytics(url, init);
      try {
        const response = await originalFetch(input, init);
        if (
          url.startsWith("/api/") &&
          !shouldSkipUrl(url) &&
          response.status >= 400
        ) {
          const clone = response.clone();
          const responseText = await clone.text().catch(() => "");
          const key = `fetch:${method}:${url}:${response.status}:${responseText.slice(0, 120)}`;
          if (shouldReport(key)) {
            reportClientError({
              action: "api_request_failed",
              code: `HTTP_${response.status}`,
              message: `${method} ${url} failed with ${response.status}`,
              details: {
                method,
                url,
                status: response.status,
                durationMs: Date.now() - startedAt,
                responseText: responseText.slice(0, 1200),
                requestId: response.headers.get("x-knowlens-request-id") || response.headers.get("x-request-id") || "",
              },
            });
          }
        }
        return response;
      } catch (error) {
        if (url.startsWith("/api/") && !shouldSkipUrl(url)) {
          const message = error instanceof Error ? error.message : "API request threw before response.";
          const key = `fetch-throw:${method}:${url}:${message}`;
          if (shouldReport(key)) {
            reportClientError({
              action: "api_request_exception",
              code: "CLIENT_API_FETCH_EXCEPTION",
              message: `${method} ${url}: ${message}`,
              details: {
                method,
                url,
                durationMs: Date.now() - startedAt,
                stack: error instanceof Error ? clampText(error.stack, 1200) : "",
              },
            });
          }
        }
        throw error;
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
