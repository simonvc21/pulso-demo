"use client";

// Error boundary for every GP route. Production usually omits the message
// behind a digest; we render whatever React did expose plus the digest, and
// log to console so Vercel runtime logs capture it. The page-side fix that
// matters is wrapping the actual server-component fetches in try/catch with
// inline rendering of the error — this boundary is the LAST resort.

import { useEffect } from "react";

export default function GpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[gp-error]", error.digest, error.message, error.name, error.stack);
  }, [error]);

  return (
    <div className="px-8 py-12">
      <div className="max-w-2xl mx-auto bg-white border border-coral/30 rounded-xl p-6 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-coral font-semibold">
          Application error
        </div>
        <div className="text-sm font-mono text-ink whitespace-pre-wrap break-words">
          {error.name && <div className="font-semibold">{error.name}</div>}
          <div>{error.message || "(no message — production digest only)"}</div>
        </div>
        {error.digest && (
          <div className="text-[11px] text-muted">Digest: {error.digest}</div>
        )}
        {error.stack && (
          <details className="text-[10px] text-muted">
            <summary className="cursor-pointer">Stack</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words bg-paper2 p-2 rounded">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={reset}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-navy text-white hover:bg-navy-700"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-line text-ink hover:bg-paper2"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
