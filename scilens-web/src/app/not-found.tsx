import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-12 text-zinc-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Case not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          The featured case link may be outdated or this item is no longer available.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
