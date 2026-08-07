import Link from "next/link";
import { X } from "lucide-react";

export type Chip = {
  key: string;
  label: string;
  /** URL with this filter removed. */
  removeHref: string;
};

/**
 * Applied filters, each removable. Links rather than client state so the URL
 * stays the single source of truth and the whole thing works without JS.
 */
export function FilterChips({ chips, clearHref }: { chips: Chip[]; clearHref: string }) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.removeHref}
          aria-label={`Remove filter: ${chip.label}`}
          className="border-accent/30 bg-accent-muted text-accent hover:border-accent flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {chip.label}
          <X size={13} strokeWidth={2.5} aria-hidden />
        </Link>
      ))}
      {chips.length > 1 ? (
        <Link href={clearHref} className="text-muted hover:text-foreground px-2 py-1.5 text-xs">
          Clear all
        </Link>
      ) : null}
    </div>
  );
}
