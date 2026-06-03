"use client";

import { useEffect, useState } from "react";
import { Crown, LoaderCircle, X } from "lucide-react";
import { PromoCountdownBanner } from "@/components/billing/PromoCountdownBanner";

type PaywallDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmHref?: string;
  showPromoBanner?: boolean;
  compact?: boolean;
  source?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function PaywallDialog({
  open,
  title,
  description,
  confirmLabel = "Upgrade Now",
  cancelLabel = "Not now",
  confirmHref,
  showPromoBanner = false,
  compact = false,
  source = "workspace-paywall",
  onClose,
  onConfirm,
}: PaywallDialogProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    void fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "billing",
        action: "paywall_exposed",
        status: "info",
        source,
        message: title,
      }),
    }).catch(() => undefined);
  }, [open, source, title]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-5">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
        >
          <X size={14} />
        </button>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Crown size={16} />
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
        {showPromoBanner && !compact ? <PromoCountdownBanner variant="inline" className="mt-3" /> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={confirming}
            onClick={() => {
              if (confirming) {
                return;
              }
              setConfirming(true);
              void fetch("/api/telemetry/event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  category: "billing",
                  action: "paywall_closed",
                  status: "info",
                  source,
                }),
              }).catch(() => undefined);
              onClose();
            }}
            className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              void fetch("/api/telemetry/event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  category: "billing",
                  action: "paywall_confirm_clicked",
                  status: "info",
                  source,
                }),
              }).catch(() => undefined);
              onConfirm();
              if (confirmHref && typeof window !== "undefined") {
                window.location.href = confirmHref;
              }
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {confirming ? <LoaderCircle size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
