"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

/**
 * Catches anything a page throws. Without this the user gets Next's default
 * screen, which says nothing useful and offers no way back.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="font-display text-2xl font-semibold">That didn&rsquo;t load.</h1>
      <p className="text-muted max-w-prose text-sm">
        Something went wrong rendering this page. Trying again often works — the usual cause is a
        dropped connection rather than the data being broken.
      </p>
      {error.digest ? (
        <p className="text-subtle font-mono text-xs">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors"
      >
        <RotateCcw size={15} strokeWidth={2} aria-hidden />
        Try again
      </button>
    </div>
  );
}
