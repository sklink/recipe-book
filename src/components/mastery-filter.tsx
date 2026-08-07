import Link from "next/link";
import { Award, Sparkle } from "lucide-react";

/**
 * Two chips rather than five levels: "something I can already make" and
 * "something I haven't tried" are the two questions actually worth asking of a
 * results list. The individual levels show on each card.
 */
export function MasteryFilter({
  current,
  buildHref,
}: {
  current?: "known" | "new";
  buildHref: (overrides: { mastery?: string | undefined }) => string;
}) {
  const options = [
    { key: "known" as const, label: "Know it", Icon: Award },
    { key: "new" as const, label: "New to me", Icon: Sparkle },
  ];

  return (
    <>
      {options.map(({ key, label, Icon }) => {
        const active = current === key;
        return (
          <Link
            key={key}
            href={buildHref({ mastery: active ? undefined : key })}
            role="switch"
            aria-checked={active}
            className={`min-h-tap flex w-fit items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors ${
              active
                ? "border-accent/40 bg-accent-muted text-accent"
                : "border-border-strong text-muted hover:bg-surface-muted"
            }`}
          >
            <Icon size={13} strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </>
  );
}
