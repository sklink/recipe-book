"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, RotateCcw, Sparkles } from "lucide-react";

import { GenerationControls, type Controls } from "@/app/(app)/generate/generation-controls";
import { GeneratedRecipeCard } from "@/components/generated-recipe-card";
import { useGenerateRecipe, useKeepRecipe } from "@/lib/ai/hooks";
import { formatCost } from "@/lib/ai/format";
import { OPTION_SETS, labelFor } from "@/lib/ai/generation-options";
import { MEAL_LABELS } from "@/lib/recipes/meal-types";
import { BUCKET_LABELS, type TimeBucket } from "@/lib/recipes/time-buckets";
import type { MealType } from "@/lib/supabase/types";

/** A short human summary of what was asked for, shown alongside the result. */
function describe(controls: Controls): string[] {
  const parts: string[] = [];
  if (controls.mealType) parts.push(MEAL_LABELS[controls.mealType]);
  if (controls.timeBucket) parts.push(BUCKET_LABELS[controls.timeBucket]);
  for (const set of OPTION_SETS) {
    const label = labelFor(set.options, controls[set.key]);
    if (label) parts.push(label);
  }
  if (controls.useAvailable) parts.push("in stock only");
  return parts;
}

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

  // Seeded from the flow when it sends you here; freely editable afterwards.
  const initial: Controls = { mealType, timeBucket };
  const [controls, setControls] = useState<Controls>(initial);
  const [lastTitle, setLastTitle] = useState<string>();
  // What produced the result on screen, so the summary can't drift from it
  // while the controls are being changed for the next attempt.
  const [usedControls, setUsedControls] = useState<Controls>(initial);

  const run = (previousAttempt?: string) => {
    keep.reset();
    setUsedControls(controls);
    generate.mutate(
      {
        mealType: controls.mealType,
        timeBucket: controls.timeBucket,
        previousAttempt,
        options: {
          cuisine: controls.cuisine,
          base: controls.base,
          protein: controls.protein,
          side: controls.side,
          diet: controls.diet,
          method: controls.method,
          ambition: controls.ambition,
          useAvailable: controls.useAvailable,
        },
      },
      { onSuccess: (data) => setLastTitle(data.recipe.title) },
    );
  };

  const reset = () => setControls({ useAvailable: controls.useAvailable });

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
            onClick={() => {
              keep.reset();
              generate.reset();
            }}
            className="border-border-strong hover:bg-surface-muted min-h-tap rounded-lg border px-4 text-sm font-medium transition-colors"
          >
            Generate another
          </button>
        </div>
      </div>
    );
  }

  const summary = describe(usedControls);
  // What's selected right now, which is not the same thing while you retune.
  const chosen = describe(controls);

  return (
    <div className="flex flex-col gap-6">
      <GenerationControls
        value={controls}
        onChange={setControls}
        disabled={generate.isPending || keep.isPending}
      />

      {/*
       * Sticky rather than placed: chips make this page around three screens
       * tall, so any fixed position for the button is the wrong one for
       * somebody. Pinned to the bottom edge it's in reach from everywhere, and
       * it carries the running summary so you can see what you've picked
       * without scrolling back up.
       *
       * --sheet-peek clears the mobile ingredient sheet, which is fixed above
       * this in the stack. It's 0 whenever the sheet isn't showing, so this
       * doesn't reserve space for something that isn't there.
       */}
      <div
        data-testid="generate-actions"
        style={{ bottom: "var(--sheet-peek)" }}
        className="border-border bg-background/95 sticky z-30 -mx-4 flex flex-wrap items-center gap-3 border-t px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6"
      >
        <button
          type="button"
          onClick={() => run()}
          disabled={generate.isPending}
          className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
        >
          <Sparkles
            size={16}
            strokeWidth={2}
            aria-hidden
            className={generate.isPending ? "animate-pulse" : ""}
          />
          {generate.isPending
            ? "Thinking…"
            : generate.isSuccess
              ? "Generate again"
              : "Generate a recipe"}
        </button>
        {generate.isSuccess ? (
          <button
            type="button"
            onClick={() => run(lastTitle)}
            disabled={generate.isPending}
            className="border-border-strong hover:bg-surface-muted min-h-tap flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw size={15} strokeWidth={2} aria-hidden />
            Something different
          </button>
        ) : null}

        <p className="text-subtle min-w-0 flex-1 truncate text-xs" data-testid="generate-choices">
          {chosen.length > 0 ? chosen.join(" · ") : "Anything at all"}
        </p>

        {chosen.length > 0 ? (
          <button
            type="button"
            onClick={reset}
            disabled={generate.isPending}
            className="text-muted hover:text-foreground min-h-tap flex shrink-0 items-center gap-1.5 text-xs"
          >
            <RotateCcw size={13} strokeWidth={2} aria-hidden />
            Reset
          </button>
        ) : null}
      </div>

      {generate.isPending ? (
        <div className="flex flex-col gap-2">
          <div className="bg-surface-muted h-8 w-2/3 animate-pulse rounded" />
          <div className="bg-surface-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-surface-muted h-4 w-5/6 animate-pulse rounded" />
        </div>
      ) : null}

      {generate.isError ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
        >
          {generate.error instanceof Error ? generate.error.message : "Generation failed."}
        </p>
      ) : null}

      {generate.isSuccess && !generate.isPending ? (
        <>
          {summary.length > 0 ? (
            <p data-testid="generate-summary" className="text-subtle text-xs">
              Asked for: {summary.join(" · ")}
            </p>
          ) : null}
          <GeneratedRecipeCard
            recipe={generate.data.recipe}
            similar={generate.data.similar}
            actions={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => keep.mutate({ recipe: generate.data.recipe })}
                    disabled={keep.isPending}
                    className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {keep.isPending ? "Saving…" : "Keep"}
                  </button>
                  <button
                    type="button"
                    onClick={() => run(generate.data.recipe.title)}
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
                  {formatCost(generate.data.usage.costMillicents)}.
                </p>
              </div>
            }
          />
        </>
      ) : null}
    </div>
  );
}
