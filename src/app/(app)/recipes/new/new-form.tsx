"use client";

import { useRouter } from "next/navigation";

import { RecipeForm, EMPTY_RECIPE, type RecipeFormValues } from "@/components/recipe-form";
import { useCreateRecipe } from "@/lib/recipes/edit-hooks";

export function NewRecipe() {
  const router = useRouter();
  const create = useCreateRecipe();

  const save = (values: RecipeFormValues) =>
    create.mutate(values, { onSuccess: (data) => router.push(`/recipes/${data.id}`) });

  return (
    <RecipeForm
      initial={EMPTY_RECIPE}
      submitLabel="Create recipe"
      onSubmit={save}
      isSaving={create.isPending}
      error={create.isError ? (create.error as Error).message : undefined}
    />
  );
}
