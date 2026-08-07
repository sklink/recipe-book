import { Generator } from "@/app/(app)/generate/generator";
import { PageHeader } from "@/components/page-header";
import { isMealType } from "@/lib/recipes/meal-types";
import { isTimeBucket } from "@/lib/recipes/time-buckets";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ mealType?: string; timeBucket?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Generate"
        description="Something you haven't cooked before, built around what you asked for."
      />
      <Generator
        mealType={isMealType(params.mealType) ? params.mealType : undefined}
        timeBucket={isTimeBucket(params.timeBucket) ? params.timeBucket : undefined}
      />
    </>
  );
}
