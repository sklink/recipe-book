import Link from "next/link";
import { Check } from "lucide-react";

/**
 * Server-rendered as a link, not a client checkbox: the value lives in the URL
 * alongside every other filter, so it survives refresh and is shareable.
 */
export function RequireIngredientsToggle({ enabled, href }: { enabled: boolean; href: string }) {
  return (
    <Link
      href={href}
      role="switch"
      aria-checked={enabled}
      className={`min-h-tap flex w-fit items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors ${
        enabled
          ? "border-success/40 bg-success-muted text-success"
          : "border-border-strong text-muted hover:bg-surface-muted"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          enabled ? "border-success bg-success text-white" : "border-border-strong"
        }`}
      >
        {enabled ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      Only what I can cook now
    </Link>
  );
}
