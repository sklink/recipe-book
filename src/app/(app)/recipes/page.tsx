import { RecipeList } from "@/app/(app)/recipes/recipe-list";
import { FilterChips, type Chip } from "@/components/filter-chips";
import { PageHeader } from "@/components/page-header";
import { MEAL_LABELS, isMealType } from "@/lib/recipes/meal-types";
import { BUCKET_LABELS, isTimeBucket } from "@/lib/recipes/time-buckets";
import type { RecipeFilters } from "@/lib/recipes/types";

/**
 * Filters live in the URL so the flow can hand them over directly, and so a
 * filtered view is shareable and survives a refresh.
 */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ mealType?: string; timeBucket?: string; search?: string }>;
}) {
  const params = await searchParams;

  const mealType = isMealType(params.mealType) ? params.mealType : undefined;
  const timeBucket = isTimeBucket(params.timeBucket) ? params.timeBucket : undefined;
  const search = params.search?.trim() || undefined;

  const filters: RecipeFilters = { mealType, timeBucket, search };

  /** Rebuild the URL without one filter, for that chip's remove link. */
  const hrefWithout = (drop: "mealType" | "timeBucket" | "search") => {
    const next = new URLSearchParams();
    if (mealType && drop !== "mealType") next.set("mealType", mealType);
    if (timeBucket && drop !== "timeBucket") next.set("timeBucket", timeBucket);
    if (search && drop !== "search") next.set("search", search);
    const qs = next.toString();
    return qs ? `/recipes?${qs}` : "/recipes";
  };

  const chips: Chip[] = [];
  if (mealType) {
    chips.push({
      key: "mealType",
      label: MEAL_LABELS[mealType],
      removeHref: hrefWithout("mealType"),
    });
  }
  if (timeBucket) {
    chips.push({
      key: "timeBucket",
      label: BUCKET_LABELS[timeBucket],
      removeHref: hrefWithout("timeBucket"),
    });
  }
  if (search) {
    chips.push({ key: "search", label: `“${search}”`, removeHref: hrefWithout("search") });
  }

  const filtered = chips.length > 0;

  return (
    <>
      <PageHeader
        title={filtered ? "Matching recipes" : "Recipes"}
        description={
          filtered
            ? "Narrowed by what you picked. Remove a filter to widen the search."
            : "Everything in the cookbook."
        }
      />

      {filtered ? (
        <div className="pb-5">
          <FilterChips chips={chips} clearHref="/recipes" />
        </div>
      ) : null}

      <RecipeList filters={filters} />
    </>
  );
}
