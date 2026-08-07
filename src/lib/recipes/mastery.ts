import type { CookOutcome, MasteryLevel } from "@/lib/supabase/types";

/**
 * Mastery is derived from the cook log, never stored.
 *
 * Storing a level would drift the first time a log entry was edited or deleted.
 * Computing it on read costs nothing at this scale and can't go stale.
 *
 *   Untried    no logs
 *   Attempted  logs exist, none good yet
 *   Learning   at least one good, but not consecutively
 *   Reliable   last 2 consecutive good
 *   Mastered   last 3+ consecutive good
 */

export const MASTERY_LEVELS: MasteryLevel[] = [
  "untried",
  "attempted",
  "learning",
  "reliable",
  "mastered",
];

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  untried: "Untried",
  attempted: "Attempted",
  learning: "Learning",
  reliable: "Reliable",
  mastered: "Mastered",
};

export const OUTCOME_LABELS: Record<CookOutcome, string> = {
  flopped: "Flopped",
  rough: "Rough",
  good: "Good",
  nailed: "Nailed it",
};

/** What counts as a success for the purposes of a streak. */
export function isGood(outcome: CookOutcome): boolean {
  return outcome === "good" || outcome === "nailed";
}

/** Logs must arrive most-recent-first. */
export function deriveMastery(outcomes: CookOutcome[]): MasteryLevel {
  if (outcomes.length === 0) return "untried";

  let streak = 0;
  for (const outcome of outcomes) {
    if (!isGood(outcome)) break;
    streak++;
  }

  if (streak >= 3) return "mastered";
  if (streak >= 2) return "reliable";
  if (outcomes.some(isGood)) return "learning";
  return "attempted";
}

export function masteryRank(level: MasteryLevel): number {
  return MASTERY_LEVELS.indexOf(level);
}

/**
 * A variant with no cooks of its own inherits from its parent, one level down
 * and floored at Learning.
 *
 * You've proven the technique but not this particular twist — claiming Mastered
 * on a dish never actually cooked would undermine the whole signal. One
 * constant, so flipping to straight inheritance is a one-line change.
 */
export const VARIANT_INHERITANCE_DISCOUNT = 1;

export function inheritedMastery(parentLevel: MasteryLevel): MasteryLevel {
  if (parentLevel === "untried" || parentLevel === "attempted") return parentLevel;
  const discounted = masteryRank(parentLevel) - VARIANT_INHERITANCE_DISCOUNT;
  const floor = masteryRank("learning");
  return MASTERY_LEVELS[Math.max(discounted, floor)];
}

export type MasteryState = {
  level: MasteryLevel;
  /** True when the level came from the parent rather than this recipe's own log. */
  inherited: boolean;
  /** True when a manual override is in force. */
  manual: boolean;
  cookCount: number;
  lastCookedAt: string | null;
};

export function resolveMastery(params: {
  outcomes: CookOutcome[];
  lastCookedAt: string | null;
  override: MasteryLevel | null;
  parentLevel?: MasteryLevel | null;
}): MasteryState {
  const cookCount = params.outcomes.length;

  // A manual override wins: you know whether you can make a thing better than a
  // rule counting rows does.
  if (params.override) {
    return {
      level: params.override,
      inherited: false,
      manual: true,
      cookCount,
      lastCookedAt: params.lastCookedAt,
    };
  }

  if (cookCount > 0) {
    return {
      level: deriveMastery(params.outcomes),
      inherited: false,
      manual: false,
      cookCount,
      lastCookedAt: params.lastCookedAt,
    };
  }

  if (params.parentLevel) {
    return {
      level: inheritedMastery(params.parentLevel),
      inherited: true,
      manual: false,
      cookCount: 0,
      lastCookedAt: null,
    };
  }

  return { level: "untried", inherited: false, manual: false, cookCount: 0, lastCookedAt: null };
}

/** Chip groupings used by the results filter (T31). */
export const MASTERY_GROUPS = {
  known: ["reliable", "mastered"] as MasteryLevel[],
  new: ["untried", "attempted"] as MasteryLevel[],
};
