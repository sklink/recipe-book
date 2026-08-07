import { PageHeader } from "@/components/page-header";
import { TicketStub } from "@/components/ticket-stub";
import { MEAL_LABELS, isMealType } from "@/lib/recipes/meal-types";
import { BUCKET_DESCRIPTIONS, BUCKET_LABELS, isTimeBucket } from "@/lib/recipes/time-buckets";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ mealType?: string; timeBucket?: string }>;
}) {
  const params = await searchParams;
  const mealType = isMealType(params.mealType) ? params.mealType : undefined;
  const timeBucket = isTimeBucket(params.timeBucket) ? params.timeBucket : undefined;

  // The flow carries its answers here. Echoing them back confirms the handover
  // worked, rather than dropping the user onto a context-free page.
  const context =
    mealType && timeBucket
      ? `${MEAL_LABELS[mealType]} · ${BUCKET_LABELS[timeBucket]} — ${BUCKET_DESCRIPTIONS[
          timeBucket
        ].toLowerCase()}`
      : undefined;

  return (
    <>
      <PageHeader
        title="Generate"
        description="Have Claude invent something you haven't cooked before."
      />
      {context ? (
        <p
          data-testid="generate-context"
          className="border-border bg-surface-muted mb-4 rounded-lg border px-4 py-3 text-sm"
        >
          Generating for: <span className="font-medium">{context}</span>
        </p>
      ) : null}
      <TicketStub ticket="T20" what="Full-screen generated recipe card, with Keep and Try Again." />
    </>
  );
}
