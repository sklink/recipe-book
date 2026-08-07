import { RecipeList } from "@/app/(app)/recipes/recipe-list";
import { FilterChips, type Chip } from "@/components/filter-chips";
import { PageHeader } from "@/components/page-header";
import { RequireIngredientsToggle } from "@/components/require-ingredients-toggle";
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
  searchParams: Promise<{
    mealType?: string;
    timeBucket?: string;
    search?: string;
    requireIngredients?: string;
  }>;
}) {
  const params = await searchParams;

  const mealType = isMealType(params.mealType) ? params.mealType : undefined;
  const timeBucket = isTimeBucket(params.timeBucket) ? params.timeBucket : undefined;
  const search = params.search?.trim() || undefined;
  const requireIngredients = params.requireIngredients === "true";

  const filters: RecipeFilters = { mealType, timeBucket, search, requireIngredients };

  const buildHref = (
    overrides: Partial<
      Record<"mealType" | "timeBucket" | "search" | "requireIngredients", string | undefined>
    >,
  ) => {
    const next = new URLSearchParams();
    const values = {
      mealType,
      timeBucket,
      search,
      requireIngredients: requireIngredients ? "true" : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/recipes?${qs}` : "/recipes";
  };

  const chips: Chip[] = [];
  if (mealType) {
    chips.push({
      key: "mealType",
      label: MEAL_LABELS[mealType],
      removeHref: buildHref({ mealType: undefined }),
    });
  }
  if (timeBucket) {
    chips.push({
      key: "timeBucket",
      label: BUCKET_LABELS[timeBucket],
      removeHref: buildHref({ timeBucket: undefined }),
    });
  }
  if (search) {
    chips.push({
      key: "search",
      label: `“${search}”`,
      removeHref: buildHref({ search: undefined }),
    });
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

      <div className="flex flex-col gap-3 pb-5">
        <RequireIngredientsToggle
          enabled={requireIngredients}
          href={buildHref({ requireIngredients: requireIngredients ? undefined : "true" })}
        />
        {filtered ? (
          <FilterChips
            chips={chips}
            clearHref={requireIngredients ? "/recipes?requireIngredients=true" : "/recipes"}
          />
        ) : null}
      </div>

      <RecipeList filters={filters} />
    </>
  );
}
