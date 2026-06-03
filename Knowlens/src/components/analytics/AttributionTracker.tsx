"use client";

import { useEffect } from "react";
import {
  captureAttributionFromLocation,
  readAttributionPayload,
  shouldLogAttributionTouch,
} from "@/lib/attribution";

export function AttributionTracker() {
  useEffect(() => {
    const touch = captureAttributionFromLocation();
    if (!touch || !shouldLogAttributionTouch(touch)) {
      return;
    }

    try {
      void fetch("/api/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "attribution",
          action: "touch_captured",
          status: "ok",
          source: touch.source,
          message: touch.landingPath,
          details: readAttributionPayload(),
        }),
      });
    } catch {
      // Best-effort attribution logging only.
    }
  }, []);

  return null;
}
