"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { StockToggle } from "@/components/stock-toggle";
import { useIngredients } from "@/lib/ingredients/hooks";
import { CATEGORY_LABELS, groupByCategory, type Ingredient } from "@/lib/ingredients/types";
import { useRecipe, useRecipes } from "@/lib/recipes/hooks";
import { isMealType } from "@/lib/recipes/meal-types";
import { isTimeBucket } from "@/lib/recipes/time-buckets";

const RECIPE_DETAIL = /^\/recipes\/([0-9a-f-]{36})$/i;

/**
 * The ingredients relevant to whatever is currently on screen.
 *
 * Rather than plumbing the visible recipes down through context, this re-runs
 * the same queries the page already made. TanStack dedupes by key, so it reads
 * from cache and costs nothing — and the sidebar stays correct automatically
 * when filters change, with no wiring to keep in sync.
 */
export function useVisibleIngredients(): {
  ingredients: Ingredient[];
  context: "detail" | "list" | "none";
  isPending: boolean;
} {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const detailMatch = pathname.match(RECIPE_DETAIL);
  const recipeId = detailMatch?.[1];
  const onList = pathname === "/recipes";

  const mealType = searchParams.get("mealType");
  const timeBucket = searchParams.get("timeBucket");
  const search = searchParams.get("search")?.trim();

  // Must match the key the page builds, or this fetches instead of reading cache.
  const listFilters = useMemo(
    () => ({
      mealType: isMealType(mealType) ? mealType : undefined,
      timeBucket: isTimeBucket(timeBucket) ? timeBucket : undefined,
      search: search || undefined,
    }),
    [mealType, timeBucket, search],
  );

  const all = useIngredients();
  const detail = useRecipe(recipeId);
  const list = useRecipes(listFilters);

  return useMemo(() => {
    const byId = new Map((all.data?.ingredients ?? []).map((i) => [i.id, i]));

    if (recipeId) {
      // Detail already carries full ingredient rows, but the sidebar renders
      // from the ingredients query so its stock state stays consistent with
      // optimistic toggles happening elsewhere on the page.
      const ids = detail.data?.ingredients.map((i) => i.ingredientId) ?? [];
      return {
        ingredients: ids.map((id) => byId.get(id)).filter((i): i is Ingredient => Boolean(i)),
        context: "detail",
        isPending: detail.isPending || all.isPending,
      };
    }

    if (onList) {
      const shown = list.data?.recipes.length ? list.data.recipes : (list.data?.nearMisses ?? []);
      const ids = new Set(shown.flatMap((r) => r.ingredientIds));
      return {
        ingredients: [...ids].map((id) => byId.get(id)).filter((i): i is Ingredient => Boolean(i)),
        context: "list",
        isPending: list.isPending || all.isPending,
      };
    }

    return { ingredients: [], context: "none", isPending: false };
  }, [
    all.data,
    all.isPending,
    detail.data,
    detail.isPending,
    list.data,
    list.isPending,
    onList,
    recipeId,
  ]);
}

export function SidebarIngredients() {
  const { ingredients, context, isPending } = useVisibleIngredients();

  if (context === "none") {
    return (
      <p className="text-subtle text-sm">
        Ingredients appear here for whatever recipes are on screen.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-border/40 h-8 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (ingredients.length === 0) {
    return <p className="text-subtle text-sm">Nothing to show for these recipes.</p>;
  }

  // Missing first: the sidebar's job is to tell you what stands between you and
  // cooking, not to be a tidy alphabetical inventory.
  const missing = ingredients.filter((i) => !i.inStock && !i.isStaple);
  const rest = ingredients.filter((i) => i.inStock || i.isStaple);

  return (
    <div data-testid="sidebar-ingredients" className="flex flex-col gap-5">
      {missing.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-warning text-xs font-semibold tracking-wide uppercase">
            {missing.length} missing
          </h3>
          <ul className="flex flex-col">
            {missing.map((ingredient) => (
              <li key={ingredient.id}>
                <StockToggle ingredient={ingredient} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-success text-sm">Everything on screen is in stock.</p>
      )}

      {groupByCategory(rest).map(([category, items]) => (
        <section key={category} className="flex flex-col gap-1">
          <h3 className="text-subtle text-xs font-semibold tracking-wide uppercase">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <ul className="flex flex-col">
            {items.map((ingredient) => (
              <li key={ingredient.id}>
                <StockToggle ingredient={ingredient} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
