"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ingredientKeys } from "@/lib/ingredients/hooks";
import { recipeKeys } from "@/lib/recipes/hooks";
import type { RecipeFormValues } from "@/components/recipe-form";
import type { RecipeDetail } from "@/lib/recipes/types";

/** Form strings -> the API's typed shape. Empty strings become null, not 0. */
export function toRecipeInput(values: RecipeFormValues) {
  const number = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    title: values.title,
    description: values.description || null,
    mealTypes: values.mealTypes,
    timeMinutes: number(values.timeMinutes) ?? 0,
    servings: number(values.servings),
    ingredients: values.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name,
        amount: number(i.amount),
        unit: i.unit || null,
        prepNote: i.prepNote || null,
        isOptional: i.isOptional,
      })),
    steps: values.steps.filter((s) => s.trim()),
  };
}

/** A loaded recipe -> the form's string-based shape. */
export function toFormValues(recipe: RecipeDetail): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    mealTypes: recipe.mealTypes,
    timeMinutes: String(recipe.timeMinutes),
    servings: recipe.servings === null ? "" : String(recipe.servings),
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount === null ? "" : String(i.amount),
      unit: i.unit ?? "",
      prepNote: i.prepNote ?? "",
      isOptional: i.isOptional,
    })),
    steps: recipe.instructions.map((s) => s.text),
  };
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/** Editing can change ingredients, so both caches are invalidated. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
  void queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: RecipeFormValues) =>
      send("/api/recipes", "POST", toRecipeInput(values)) as Promise<{ id: string }>,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: RecipeFormValues) =>
      send(`/api/recipes/${id}`, "PUT", toRecipeInput(values)),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      send(`/api/recipes/${id}`, "DELETE") as Promise<{ deletedVariants: number }>,
    onSuccess: () => invalidateAll(queryClient),
  });
}
