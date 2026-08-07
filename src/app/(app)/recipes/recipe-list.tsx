"use client";

import Link from "next/link";

import { useRecipes } from "@/lib/recipes/hooks";
import { formatMinutes } from "@/lib/recipes/time-buckets";
import type { RecipeSummary } from "@/lib/recipes/types";

/**
 * Minimal list, deliberately. T7 turns this into the card grid with imagery;
 * this exists so the data and cache layer has a consumer to be verified through.
 */
function Row({ recipe }: { recipe: RecipeSummary }) {
  return (
    <li>
      <Link
        href={`/recipes/${recipe.id}`}
        className="border-border hover:bg-surface-muted min-h-tap flex flex-col gap-1 rounded-lg border p-4 transition-colors"
      >
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-lg font-semibold">{recipe.title}</span>
          <span className="text-subtle text-xs">{formatMinutes(recipe.timeMinutes)}</span>
          <span className="text-subtle text-xs">{recipe.mealTypes.join(" · ")}</span>
          {recipe.variantCount > 0 ? (
            <span className="text-accent text-xs">
              {recipe.variantCount} variant{recipe.variantCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
        {recipe.description ? (
          <span className="text-muted text-sm">{recipe.description}</span>
        ) : null}
        {recipe.missingCount > 0 ? (
          <span className="text-warning text-xs">
            {recipe.missingCount} ingredient{recipe.missingCount === 1 ? "" : "s"} missing
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function RecipeList() {
  const { data, isPending, isError, error, isFetching } = useRecipes();

  if (isPending) {
    return <p className="text-muted text-sm">Loading recipes…</p>;
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

  const recipes = data.recipes;

  if (recipes.length === 0) {
    return <p className="text-muted text-sm">No recipes match.</p>;
  }

  return (
    <>
      {/* Cached data renders immediately; this marks a background revalidation. */}
      {isFetching ? <p className="text-subtle pb-2 text-xs">Refreshing…</p> : null}
      <ul data-testid="recipe-list" className="flex flex-col gap-2">
        {recipes.map((recipe) => (
          <Row key={recipe.id} recipe={recipe} />
        ))}
      </ul>
    </>
  );
}
