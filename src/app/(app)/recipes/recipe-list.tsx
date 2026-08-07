"use client";

import { NewVariantButton } from "@/components/new-variant-button";
import { RecipeCard } from "@/components/recipe-card";
import { useRecipes } from "@/lib/recipes/hooks";
import type { RecipeFilters } from "@/lib/recipes/types";

function CardSkeleton() {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="bg-surface-muted aspect-[4/3] w-full animate-pulse" />
      <div className="flex flex-col gap-2 p-4">
        <div className="bg-surface-muted h-5 w-2/3 animate-pulse rounded" />
        <div className="bg-surface-muted h-3 w-1/2 animate-pulse rounded" />
        <div className="bg-surface-muted h-3 w-full animate-pulse rounded" />
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="recipe-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export function RecipeList({ filters = {} }: { filters?: RecipeFilters }) {
  const { data, isPending, isError, error, isFetching } = useRecipes(filters);

  if (isPending) {
    return (
      <Grid>
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </Grid>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
      >
        {error instanceof Error ? error.message : "Could not load recipes."}
      </p>
    );
  }

  const { recipes, nearMisses } = data;

  // requireIngredients matched nothing. Showing an empty page would be a dead
  // end, so offer the closest things and say what each one needs.
  if (recipes.length === 0 && nearMisses?.length) {
    return (
      <div className="flex flex-col gap-4">
        <p className="border-border bg-surface-muted rounded-lg border px-4 py-3 text-sm">
          Nothing is fully cookable with what&rsquo;s in stock. These are the closest — each needs
          only a few things.
        </p>
        <Grid>
          {nearMisses.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </Grid>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <p className="border-border text-muted rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        No recipes match these filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-subtle flex items-center gap-2 text-xs" aria-live="polite">
        <span>
          {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
        </span>
        {/* Cached data paints first; this marks the background revalidation. */}
        {isFetching ? <span>· refreshing</span> : null}
      </div>
      <Grid>
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            action={<NewVariantButton recipeId={recipe.id} recipeTitle={recipe.title} compact />}
          />
        ))}
      </Grid>
    </div>
  );
}
