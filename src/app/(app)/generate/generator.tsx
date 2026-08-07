"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

import { GeneratedRecipeCard } from "@/components/generated-recipe-card";
import { useGenerateRecipe, useKeepRecipe } from "@/lib/ai/hooks";
import { formatCost } from "@/lib/ai/format";
import { BUCKET_DESCRIPTIONS, BUCKET_LABELS, type TimeBucket } from "@/lib/recipes/time-buckets";
import { MEAL_LABELS } from "@/lib/recipes/meal-types";
import type { MealType } from "@/lib/supabase/types";

export function Generator({
  mealType,
  timeBucket,
}: {
  mealType?: MealType;
  timeBucket?: TimeBucket;
}) {
  const router = useRouter();
  const generate = useGenerateRecipe();
  const keep = useKeepRecipe();
  // Remembered so "Try Again" can tell the model what it just rejected.
  const [lastTitle, setLastTitle] = useState<string>();

  const run = (previousAttempt?: string) => {
    keep.reset();
    generate.mutate(
      { mealType, timeBucket, previousAttempt },
      { onSuccess: (data) => setLastTitle(data.recipe.title) },
    );
  };

  const context =
    mealType && timeBucket
      ? `${MEAL_LABELS[mealType]} · ${BUCKET_LABELS[timeBucket]} — ${BUCKET_DESCRIPTIONS[timeBucket].toLowerCase()}`
      : mealType
        ? MEAL_LABELS[mealType]
        : timeBucket
          ? BUCKET_LABELS[timeBucket]
          : undefined;

  if (keep.isSuccess) {
    const renamed = keep.data.resolutions.filter((r) => r.method !== "created");
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-success text-sm">
          Saved to your cookbook. The image is being generated now.
        </p>
        {renamed.length > 0 ? (
          <div className="border-border bg-surface-muted rounded-lg border px-4 py-3">
            <p className="text-muted text-sm">
              Matched onto ingredients you already had, so your stock still works:
            </p>
            <ul className="text-subtle mt-1 flex flex-col text-xs">
              {renamed.map((r) => (
                <li key={r.input}>
                  {r.input} → {r.canonicalName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push(`/recipes/${keep.data.id}`)}
            className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap rounded-lg px-4 text-sm font-medium transition-colors"
          >
            Open it
          </button>
          <button
            type="button"
            onClick={() => run()}
            className="border-border-strong hover:bg-surface-muted min-h-tap rounded-lg border px-4 text-sm font-medium transition-colors"
          >
            Generate another
          </button>
        </div>
      </div>
    );
  }

  if (generate.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted flex items-center gap-2 text-sm">
          <Sparkles size={16} strokeWidth={2} aria-hidden className="animate-pulse" />
          Thinking of something{context ? ` for ${context.toLowerCase()}` : ""}…
        </p>
        <div className="flex flex-col gap-2">
          <div className="bg-surface-muted h-8 w-2/3 animate-pulse rounded" />
          <div className="bg-surface-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-surface-muted h-4 w-5/6 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (generate.isError) {
    return (
      <div className="flex flex-col gap-3">
        <p
          role="alert"
          className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
        >
          {generate.error instanceof Error ? generate.error.message : "Generation failed."}
        </p>
        <button
          type="button"
          onClick={() => run(lastTitle)}
          className="border-border-strong hover:bg-surface-muted min-h-tap w-fit rounded-lg border px-4 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (generate.isSuccess) {
    const { recipe, similar, usage } = generate.data;
    return (
      <div className="flex flex-col gap-4">
        <GeneratedRecipeCard
          recipe={recipe}
          similar={similar}
          actions={
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => keep.mutate({ recipe })}
                  disabled={keep.isPending}
                  className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {keep.isPending ? "Saving…" : "Keep"}
                </button>
                <button
                  type="button"
                  onClick={() => run(recipe.title)}
                  disabled={keep.isPending}
                  className="border-border-strong hover:bg-surface-muted min-h-tap flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={15} strokeWidth={2} aria-hidden />
                  Try again
                </button>
              </div>
              {keep.isError ? (
                <p role="alert" className="text-danger text-sm">
                  {keep.error instanceof Error ? keep.error.message : "Could not save."}
                </p>
              ) : null}
              <p className="text-subtle text-xs">
                Nothing is saved until you keep it. This one cost about{" "}
                {formatCost(usage.costMillicents)}.
              </p>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {context ? (
        <p
          data-testid="generate-context"
          className="border-border bg-surface-muted rounded-lg border px-4 py-3 text-sm"
        >
          Generating for: <span className="font-medium">{context}</span>
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => run()}
        className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex w-fit items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors"
      >
        <Sparkles size={16} strokeWidth={2} aria-hidden />
        Generate a recipe
      </button>
    </div>
  );
}
