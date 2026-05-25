"use client";

import Link from "next/link";
import { CaseDetailPage } from "@/components/featured/CaseDetailPage";
import {
  type FeaturedCaseKind,
  getFeaturedCaseBySlug,
} from "@/lib/featured-cases";

type CaseDetailRouteProps = {
  slug: string;
  kind: FeaturedCaseKind;
};

export function CaseDetailRoute({ slug, kind }: CaseDetailRouteProps) {
  const item = getFeaturedCaseBySlug(kind, slug);

  if (!item) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Not Found</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
            Case not found
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            The featured case link may be outdated, or this case has been removed.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return <CaseDetailPage item={item} />;
}
