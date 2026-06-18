"use client";

import type { ReactNode } from "react";

type InsuranceScrollLinkProps = {
  children: ReactNode;
  className: string;
};

export function InsuranceScrollLink({ children, className }: InsuranceScrollLinkProps) {
  return (
    <a
      href="#templates"
      className={className}
      onClick={(event) => {
        event.preventDefault();
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
