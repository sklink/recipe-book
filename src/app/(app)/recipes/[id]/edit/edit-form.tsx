"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { RecipeForm, type RecipeFormValues } from "@/components/recipe-form";
import { toFormValues, useDeleteRecipe, useUpdateRecipe } from "@/lib/recipes/edit-hooks";
import { useRecipe } from "@/lib/recipes/hooks";

export function EditRecipe({ id }: { id: string }) {
  const router = useRouter();
  const { data: recipe, isPending, isError } = useRecipe(id);
  const update = useUpdateRecipe(id);
  const remove = useDeleteRecipe();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-surface-muted h-11 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <p
        role="alert"
        className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
      >
        Could not load this recipe.
      </p>
    );
  }

  const save = (values: RecipeFormValues) =>
    update.mutate(values, { onSuccess: () => router.push(`/recipes/${id}`) });

  return (
    <>
      <PageHeader title="Edit recipe" description={recipe.title} />

      {confirmingDelete ? (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          className="border-danger/30 bg-danger-muted mb-6 flex flex-col gap-3 rounded-lg border px-4 py-3"
        >
          <p className="text-sm font-medium">Delete “{recipe.title}”?</p>
          <p className="text-muted text-sm">
            {recipe.variantCount > 0
              ? `This also deletes ${recipe.variantCount} variant${recipe.variantCount === 1 ? "" : "s"} and ${recipe.cookLogs.length > 0 ? "the cook history" : "any cook history"}. It can't be undone.`
              : recipe.cookLogs.length > 0
                ? `This also deletes ${recipe.cookLogs.length} logged cook${recipe.cookLogs.length === 1 ? "" : "s"}. It can't be undone.`
                : "This can't be undone."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => remove.mutate(id, { onSuccess: () => router.push("/recipes") })}
              disabled={remove.isPending}
              className="bg-danger min-h-tap rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {remove.isPending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="border-border-strong min-h-tap rounded-lg border px-4 text-sm font-medium"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      <RecipeForm
        initial={toFormValues(recipe)}
        submitLabel="Save changes"
        onSubmit={save}
        onDelete={() => setConfirmingDelete(true)}
        isSaving={update.isPending}
        error={update.isError ? (update.error as Error).message : undefined}
      />
    </>
  );
}
