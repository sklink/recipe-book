"use client";

import Link from "next/link";
import { ArrowLeft, Clock, GitBranch, Users } from "lucide-react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { NewVariantButton } from "@/components/new-variant-button";
import { RecipeImage } from "@/components/recipe-image";
import { useRecipe } from "@/lib/recipes/hooks";
import { formatMinutes } from "@/lib/recipes/time-buckets";
import type { RecipeIngredient } from "@/lib/recipes/types";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** "2 tbsp", "3 cloves", "to taste" — unit alone is valid when there's no number. */
function formatAmount(ingredient: RecipeIngredient): string {
  const { amount, unit } = ingredient;
  if (amount === null) return unit ?? "";
  const n = Number.isInteger(amount) ? String(amount) : String(amount);
  return unit ? `${n} ${unit}` : n;
}

function IngredientRow({ ingredient }: { ingredient: RecipeIngredient }) {
  // Staples are assumed present, so flagging them as missing would be noise.
  const missing = !ingredient.isOptional && !ingredient.isStaple && !ingredient.inStock;

  return (
    <li className="border-border flex items-baseline gap-3 border-b py-2 last:border-b-0">
      <span className="text-muted w-24 shrink-0 text-sm tabular-nums">
        {formatAmount(ingredient)}
      </span>
      <span className="flex-1 text-sm">
        {ingredient.name}
        {ingredient.prepNote ? <span className="text-subtle">, {ingredient.prepNote}</span> : null}
        {ingredient.isOptional ? <span className="text-subtle text-xs"> (optional)</span> : null}
      </span>
      {missing ? (
        <span className="bg-warning-muted text-warning shrink-0 rounded-full px-2 py-0.5 text-xs">
          missing
        </span>
      ) : ingredient.isStaple ? (
        <span className="text-subtle shrink-0 text-xs">staple</span>
      ) : null}
    </li>
  );
}

export function RecipeDetailView({ id }: { id: string }) {
  const { data: recipe, isPending, isError, error } = useRecipe(id);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-surface-muted aspect-[16/9] w-full animate-pulse rounded-xl" />
        <div className="bg-surface-muted h-8 w-1/2 animate-pulse rounded" />
        <div className="bg-surface-muted h-4 w-full animate-pulse rounded" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="alert"
          className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
        >
          {error instanceof Error ? error.message : "Could not load this recipe."}
        </p>
        <Link href="/recipes" className="text-accent text-sm">
          Back to recipes
        </Link>
      </div>
    );
  }

  const missing = recipe.ingredients.filter(
    (i) => !i.isOptional && !i.isStaple && !i.inStock,
  ).length;

  return (
    <article className="flex flex-col gap-6">
      <Link
        href="/recipes"
        className="text-muted hover:text-foreground min-h-tap flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        All recipes
      </Link>

      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl">
        <RecipeImage
          title={recipe.title}
          imageUrl={recipe.imageUrl}
          imageStatus={recipe.imageStatus}
          sizes="(min-width: 1024px) 48rem, 100vw"
        />
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{recipe.title}</h1>
        {recipe.description ? <p className="text-muted">{recipe.description}</p> : null}

        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Clock size={15} strokeWidth={2} aria-hidden />
            {formatMinutes(recipe.timeMinutes)}
          </span>
          {recipe.servings ? (
            <span className="flex items-center gap-1.5">
              <Users size={15} strokeWidth={2} aria-hidden />
              Serves {recipe.servings}
            </span>
          ) : null}
          <span>{recipe.mealTypes.map((m) => MEAL_LABELS[m] ?? m).join(" · ")}</span>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Ingredients</h2>
          {missing > 0 ? (
            <span className="bg-warning-muted text-warning rounded-full px-2.5 py-1 text-xs">
              {missing} missing
            </span>
          ) : (
            <span className="bg-success-muted text-success rounded-full px-2.5 py-1 text-xs">
              All in stock
            </span>
          )}
        </div>
        <ul data-testid="ingredient-list" className="flex flex-col">
          {recipe.ingredients.map((ingredient) => (
            <IngredientRow key={ingredient.ingredientId} ingredient={ingredient} />
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <AddToCartButton recipeId={recipe.id} missingCount={missing} />
          <NewVariantButton recipeId={recipe.id} recipeTitle={recipe.title} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">Method</h2>
        <ol data-testid="instruction-list" className="flex flex-col gap-4">
          {recipe.instructions.map((step) => (
            <li key={step.step} className="flex gap-3">
              <span className="bg-surface-muted text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums">
                {step.step}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.variants.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display flex items-center gap-2 text-xl font-semibold">
            <GitBranch size={18} strokeWidth={2} aria-hidden />
            Variants
          </h2>
          <ul className="flex flex-col gap-2">
            {recipe.variants.map((variant) => (
              <li key={variant.id}>
                <Link
                  href={`/recipes/${variant.id}`}
                  className="border-border hover:bg-surface-muted min-h-tap flex flex-col justify-center rounded-lg border px-4 py-3 transition-colors"
                >
                  <span className="text-sm font-medium">{variant.title}</span>
                  <span className="text-subtle text-xs">{formatMinutes(variant.timeMinutes)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
