import Link from "next/link";
import { Clock, GitBranch } from "lucide-react";

import { RecipeImage } from "@/components/recipe-image";
import { formatMinutes } from "@/lib/recipes/time-buckets";
import type { RecipeSummary } from "@/lib/recipes/types";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function RecipeCard({
  recipe,
  action,
}: {
  recipe: RecipeSummary;
  /** Slot for "New Variant" (T22) — kept outside the Link so it stays clickable. */
  action?: React.ReactNode;
}) {
  return (
    <article className="border-border bg-surface group flex flex-col overflow-hidden rounded-xl border">
      <Link href={`/recipes/${recipe.id}`} className="flex flex-1 flex-col">
        <div className="aspect-[4/3] w-full overflow-hidden">
          <RecipeImage
            title={recipe.title}
            imageUrl={recipe.imageUrl}
            imageStatus={recipe.imageStatus}
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-lg leading-snug font-semibold">{recipe.title}</h3>

          <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1">
              <Clock size={13} strokeWidth={2} aria-hidden />
              {formatMinutes(recipe.timeMinutes)}
            </span>
            <span>{recipe.mealTypes.map((m) => MEAL_LABELS[m] ?? m).join(" · ")}</span>
            {recipe.variantCount > 0 ? (
              <span className="text-accent flex items-center gap-1">
                <GitBranch size={13} strokeWidth={2} aria-hidden />
                {recipe.variantCount} variant{recipe.variantCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {recipe.description ? (
            <p className="text-muted line-clamp-2 text-sm">{recipe.description}</p>
          ) : null}

          {/* Pushed to the bottom so cards of differing text length still align. */}
          <div className="mt-auto pt-2">
            {recipe.missingCount > 0 ? (
              <span className="bg-warning-muted text-warning inline-flex rounded-full px-2 py-1 text-xs">
                {recipe.missingCount} missing
              </span>
            ) : (
              <span className="bg-success-muted text-success inline-flex rounded-full px-2 py-1 text-xs">
                Ready to cook
              </span>
            )}
          </div>
        </div>
      </Link>

      {action ? <div className="border-border border-t p-3">{action}</div> : null}
    </article>
  );
}
