"use client";

import { type ReactNode } from "react";

export const INSURANCE_CUSTOM_POSTER_EVENT = "knowlens:insurance-custom-poster";

type InsuranceCustomPosterButtonProps = {
  children: ReactNode;
  className?: string;
};

export function InsuranceCustomPosterButton({ children, className }: InsuranceCustomPosterButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(INSURANCE_CUSTOM_POSTER_EVENT));
      }}
    >
      {children}
    </button>
  );
}
