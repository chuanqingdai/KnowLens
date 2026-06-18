"use client";

import type { ReactNode } from "react";

type InsuranceScrollLinkProps = {
  children: ReactNode;
  className: string;
  onClick?: () => void;
};

export function InsuranceScrollLink({ children, className, onClick }: InsuranceScrollLinkProps) {
  return (
    <a
      href="#templates"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
        document.getElementById("templates")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        window.history.replaceState(null, "", "#templates");
      }}
    >
      {children}
    </a>
  );
}
