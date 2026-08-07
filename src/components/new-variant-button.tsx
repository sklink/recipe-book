"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GitBranch, X } from "lucide-react";

import { GeneratedRecipeCard } from "@/components/generated-recipe-card";
import { useGenerateVariant, useKeepRecipe } from "@/lib/ai/hooks";

/**
 * "New Variant" — generates a variation and shows it for a keep/discard
 * decision. Discard writes nothing; keep attaches it to the parent.
 */
export function NewVariantButton({
  recipeId,
  recipeTitle,
  compact = false,
}: {
  recipeId: string;
  recipeTitle: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const generate = useGenerateVariant();
  const keep = useKeepRecipe();
  const [open, setOpen] = useState(false);

  const start = () => {
    setOpen(true);
    keep.reset();
    generate.mutate(recipeId);
  };

  const close = () => {
    setOpen(false);
    generate.reset();
    keep.reset();
  };

  const trigger = (
    <button
      type="button"
      onClick={start}
      className={
        compact
          ? "text-muted hover:text-accent min-h-tap flex w-full items-center justify-center gap-2 text-xs font-medium transition-colors"
          : "border-border-strong hover:bg-surface-muted min-h-tap flex w-fit items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
      }
    >
      <GitBranch size={15} strokeWidth={2} aria-hidden />
      New variant
    </button>
  );

  if (!open) return trigger;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Variant of ${recipeTitle}`}
      className="bg-background fixed inset-0 z-50 flex flex-col"
    >
      <div className="border-border min-h-tap flex shrink-0 items-center justify-between gap-3 border-b px-4">
        <p className="text-muted truncate text-sm">Variant of {recipeTitle}</p>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="text-muted hover:text-foreground h-tap w-tap flex shrink-0 items-center justify-center"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
        {generate.isPending ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted text-sm">Working out a variation…</p>
            <div className="bg-surface-muted h-8 w-2/3 animate-pulse rounded" />
            <div className="bg-surface-muted h-4 w-full animate-pulse rounded" />
          </div>
        ) : generate.isError ? (
          <p
            role="alert"
            className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
          >
            {generate.error instanceof Error ? generate.error.message : "Could not generate."}
          </p>
        ) : keep.isSuccess ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-success text-sm">
              Variant saved and attached to {recipeTitle}.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  close();
                  router.push(`/recipes/${keep.data.id}`);
                }}
                className="bg-accent text-accent-fg min-h-tap rounded-lg px-4 text-sm font-medium"
              >
                Open it
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  router.refresh();
                }}
                className="border-border-strong min-h-tap rounded-lg border px-4 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        ) : generate.isSuccess ? (
          <GeneratedRecipeCard
            recipe={generate.data.recipe}
            actions={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      keep.mutate({
                        recipe: generate.data.recipe,
                        parentRecipeId: recipeId,
                        variantNote: `Variant of ${recipeTitle}`,
                      })
                    }
                    disabled={keep.isPending}
                    className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {keep.isPending ? "Saving…" : "Keep"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    disabled={keep.isPending}
                    className="border-border-strong hover:bg-surface-muted min-h-tap rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    Discard
                  </button>
                </div>
                {keep.isError ? (
                  <p role="alert" className="text-danger text-sm">
                    {keep.error instanceof Error ? keep.error.message : "Could not save."}
                  </p>
                ) : null}
                <p className="text-subtle text-xs">Discarding writes nothing.</p>
              </div>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
