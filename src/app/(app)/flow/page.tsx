import { StepMealType, StepSource, StepTime } from "@/app/(app)/flow/flow-steps";
import { isMealType } from "@/lib/recipes/meal-types";
import { isTimeBucket } from "@/lib/recipes/time-buckets";

/**
 * Which step renders is derived from the URL, not from component state, so
 * refresh, the back button and a shared link all behave correctly.
 *
 * Invalid values fall back to the earliest step they invalidate rather than
 * erroring — a mangled link should drop you into the flow, not a dead end.
 */
export default async function FlowPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string; time?: string }>;
}) {
  const { meal, time } = await searchParams;

  if (!isMealType(meal)) return <StepMealType />;
  if (!isTimeBucket(time)) return <StepTime meal={meal} />;
  return <StepSource meal={meal} time={time} />;
}
