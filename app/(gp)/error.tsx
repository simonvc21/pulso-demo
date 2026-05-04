"use client";

// Error boundary for every GP route. Production usually omits the message
// behind a digest; this surfaces enough to debug without exposing stack
// traces to users — the digest stays the canonical id, but we also render
// the error message when present so we can see what blew up.

import { useEffect } from "react";

export default function GpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server logs pick this up; visible in Vercel runtime logs.
    console.error("[gp-error]", error.digest, error.message, error.stack);
  }, [error]);

  return (
    <div className="px-8 py-12">
      <div className="max-w-xl mx-auto bg-white border border-coral/30 rounded-xl p-6">
        <div className="text-[11px] uppercase tracking-wide text-coral font-semibold mb-2">
          Application error
        </div>
        <div className="text-sm font-mono text-ink whitespace-pre-wrap break-words">
          {error.message || "Unknown error"}
        </div>
        {error.digest && (
          <div className="mt-2 text-[11px] text-muted">Digest: {error.digest}</div>
        )}
        <div className="mt-4 flex gap-2">
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
