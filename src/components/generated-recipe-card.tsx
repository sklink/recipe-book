"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Users } from "lucide-react";

import { formatMinutes } from "@/lib/recipes/time-buckets";
import type { GeneratedRecipe } from "@/lib/ai/schema";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function amountText(i: GeneratedRecipe["ingredients"][number]): string {
  if (i.amount === null) return i.unit ?? "";
  return i.unit ? `${i.amount} ${i.unit}` : String(i.amount);
}

/**
 * A generated recipe, shown in full before anything is written.
 *
 * Deliberately the whole thing rather than a summary: deciding whether to keep
 * a recipe means reading the method, not just the title.
 */
export function GeneratedRecipeCard({
  recipe,
  similar,
  actions,
}: {
  recipe: GeneratedRecipe;
  similar?: { id: string; title: string; reason: string } | null;
  actions?: React.ReactNode;
}) {
  return (
    <article data-testid="generated-recipe" className="flex flex-col gap-6">
      {similar ? (
        <div className="border-warning/30 bg-warning-muted flex flex-col gap-1 rounded-lg border px-4 py-3">
          <p className="text-warning flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden />
            You may already have this
          </p>
          <p className="text-muted text-sm">
            Similar to{" "}
            <Link href={`/recipes/${similar.id}`} className="text-accent underline">
              {similar.title}
            </Link>{" "}
            ({similar.reason}).
          </p>
        </div>
      ) : null}

      <header className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {recipe.title}
        </h2>
        <p className="text-muted">{recipe.description}</p>
        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Clock size={15} strokeWidth={2} aria-hidden />
            {formatMinutes(recipe.timeMinutes)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={15} strokeWidth={2} aria-hidden />
            Serves {recipe.servings}
          </span>
          <span>{recipe.mealTypes.map((m) => MEAL_LABELS[m] ?? m).join(" · ")}</span>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-lg font-semibold">Ingredients</h3>
        <ul className="flex flex-col">
          {recipe.ingredients.map((ingredient, index) => (
            <li
              key={`${ingredient.name}-${index}`}
              className="border-border flex items-baseline gap-3 border-b py-2 last:border-b-0"
            >
              <span className="text-muted w-24 shrink-0 text-sm tabular-nums">
                {amountText(ingredient)}
              </span>
              <span className="flex-1 text-sm">
                {ingredient.name}
                {ingredient.prepNote ? (
                  <span className="text-subtle">, {ingredient.prepNote}</span>
                ) : null}
                {ingredient.isOptional ? (
                  <span className="text-subtle text-xs"> (optional)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-semibold">Method</h3>
        <ol className="flex flex-col gap-4">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="bg-surface-muted text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums">
                {index + 1}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {actions ? <div className="border-border border-t pt-4">{actions}</div> : null}
    </article>
  );
}
