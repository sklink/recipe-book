import { Award, CircleDashed, Sparkle, Star, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MASTERY_LABELS } from "@/lib/recipes/mastery";
import type { MasteryState } from "@/lib/recipes/mastery";
import type { MasteryLevel } from "@/lib/supabase/types";

const ICONS: Record<MasteryLevel, LucideIcon> = {
  untried: CircleDashed,
  attempted: Sparkle,
  learning: TrendingUp,
  reliable: Star,
  mastered: Award,
};

const STYLES: Record<MasteryLevel, string> = {
  untried: "text-subtle bg-surface-muted",
  attempted: "text-muted bg-surface-muted",
  learning: "text-warning bg-warning-muted",
  reliable: "text-success bg-success-muted",
  mastered: "text-accent bg-accent-muted",
};

/**
 * Untried is deliberately not rendered on cards: with a fresh cookbook every
 * card would carry the same badge, which is noise rather than information.
 */
export function MasteryBadge({
  mastery,
  showUntried = false,
}: {
  mastery: MasteryState;
  showUntried?: boolean;
}) {
  if (mastery.level === "untried" && !showUntried) return null;

  const Icon = ICONS[mastery.level];
  const suffix = mastery.manual ? " · set by you" : mastery.inherited ? " · inherited" : "";

  return (
    <span
      title={
        mastery.inherited
          ? "Inherited from the recipe this varies, one level down — you've proven the technique but not this twist."
          : mastery.manual
            ? "You set this by hand; it overrides the derived level."
            : `Derived from ${mastery.cookCount} logged cook${mastery.cookCount === 1 ? "" : "s"}.`
      }
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${STYLES[mastery.level]}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {MASTERY_LABELS[mastery.level]}
      {suffix ? <span className="opacity-70">{suffix}</span> : null}
    </span>
  );
}
