type InsuranceAnalyticsDetails = Record<string, unknown>;

type InsuranceAnalyticsInput = {
  action: string;
  message?: string;
  details?: InsuranceAnalyticsDetails;
};

export function trackInsuranceEvent({ action, message, details = {} }: InsuranceAnalyticsInput) {
  if (typeof window === "undefined") {
    return;
  }

  const eventName = `insurance_${action}`;
  const normalizedDetails = {
    page: "insurance",
    path: window.location.pathname,
    ...details,
  };

  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", eventName, normalizedDetails);
    }
  } catch {
    // Analytics should never interrupt product flow.
  }

  const payload = JSON.stringify({
    category: "insurance",
    action: eventName,
    status: "info",
    source: "insurance",
    message,
    details: normalizedDetails,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry/event", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Best-effort telemetry only.
  }
}
