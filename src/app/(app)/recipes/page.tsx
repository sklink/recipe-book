import Link from "next/link";
import { Link2, Plus } from "lucide-react";

import { RecipeList } from "@/app/(app)/recipes/recipe-list";
import { FilterChips, type Chip } from "@/components/filter-chips";
import { PageHeader } from "@/components/page-header";
import { MasteryFilter } from "@/components/mastery-filter";
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
    mastery?: string;
  }>;
}) {
  const params = await searchParams;

  const mealType = isMealType(params.mealType) ? params.mealType : undefined;
  const timeBucket = isTimeBucket(params.timeBucket) ? params.timeBucket : undefined;
  const search = params.search?.trim() || undefined;
  const requireIngredients = params.requireIngredients === "true";
  const masteryGroup =
    params.mastery === "known" || params.mastery === "new" ? params.mastery : undefined;

  const filters: RecipeFilters = {
    mealType,
    timeBucket,
    search,
    requireIngredients,
    masteryGroup,
  };

  const buildHref = (
    overrides: Partial<
      Record<
        "mealType" | "timeBucket" | "search" | "requireIngredients" | "mastery",
        string | undefined
      >
    >,
  ) => {
    const next = new URLSearchParams();
    const values = {
      mealType,
      timeBucket,
      search,
      requireIngredients: requireIngredients ? "true" : undefined,
      mastery: masteryGroup,
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
  if (masteryGroup) {
    chips.push({
      key: "mastery",
      label: masteryGroup === "known" ? "Know it" : "New to me",
      removeHref: buildHref({ mastery: undefined }),
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
      >
        <Link
          href="/recipes/import"
          className="border-border-strong hover:bg-surface-muted min-h-tap flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
        >
          <Link2 size={15} strokeWidth={2} aria-hidden />
          Import
        </Link>
        <Link
          href="/recipes/new"
          className="border-border-strong hover:bg-surface-muted min-h-tap flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
        >
          <Plus size={15} strokeWidth={2} aria-hidden />
          New recipe
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <RequireIngredientsToggle
            enabled={requireIngredients}
            href={buildHref({ requireIngredients: requireIngredients ? undefined : "true" })}
          />
          {/*
           * Mastery lives here rather than as a fourth flow step: it's something
           * you reach for on the results screen, not a question worth asking
           * before you've seen anything.
           */}
          <MasteryFilter current={masteryGroup} buildHref={buildHref} />
        </div>
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
