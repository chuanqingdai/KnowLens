"use client";

import { Crown, X } from "lucide-react";

type PaywallDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function PaywallDialog({
  open,
  title,
  description,
  confirmLabel = "Upgrade Now",
  cancelLabel = "Not now",
  onClose,
  onConfirm,
}: PaywallDialogProps) {
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
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
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
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
