/**
 * Time buckets.
 *
 * Recipes store `time_minutes`; buckets are derived. These thresholds are the
 * single place they're defined — the flow, the filters and the seed coverage
 * report all read from here, so changing "quick" to 20 minutes is a one-line
 * edit rather than a hunt.
 */

export const TIME_BUCKETS = ["quick", "average", "commitment"] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

/** Upper bound in minutes, inclusive. `null` means no upper bound. */
export const BUCKET_MAX: Record<TimeBucket, number | null> = {
  quick: 15,
  average: 40,
  commitment: null,
};

export const BUCKET_LABELS: Record<TimeBucket, string> = {
  quick: "Quick",
  average: "Average",
  commitment: "Commitment",
};

export const BUCKET_DESCRIPTIONS: Record<TimeBucket, string> = {
  quick: "15 minutes or less",
  average: "16 to 40 minutes",
  commitment: "More than 40 minutes",
};

export function bucketFor(minutes: number): TimeBucket {
  if (minutes <= BUCKET_MAX.quick!) return "quick";
  if (minutes <= BUCKET_MAX.average!) return "average";
  return "commitment";
}

/** Inclusive minute range for a bucket, for building database filters. */
export function bucketRange(bucket: TimeBucket): { min: number; max: number | null } {
  switch (bucket) {
    case "quick":
      return { min: 1, max: BUCKET_MAX.quick };
    case "average":
      return { min: BUCKET_MAX.quick! + 1, max: BUCKET_MAX.average };
    case "commitment":
      return { min: BUCKET_MAX.average! + 1, max: null };
  }
}

export function isTimeBucket(value: unknown): value is TimeBucket {
  return typeof value === "string" && (TIME_BUCKETS as readonly string[]).includes(value);
}

/** "1 hr 30 min", "25 min" — for cards and detail headers. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
