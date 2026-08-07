"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ingredientKeys } from "@/lib/ingredients/hooks";
import { recipeKeys } from "@/lib/recipes/hooks";
import type { GeneratedRecipe } from "@/lib/ai/schema";
import type { MealType } from "@/lib/supabase/types";
import type { TimeBucket } from "@/lib/recipes/time-buckets";

export type Resolution = {
  input: string;
  canonicalName: string;
  method: "exact" | "alias" | "normalised" | "fuzzy" | "created";
  confidence: number;
};

export type GenerateResponse = {
  recipe: GeneratedRecipe;
  usage: { inputTokens: number; outputTokens: number; costMillicents: number };
  similar?: { id: string; title: string; reason: string } | null;
  parentRecipeId?: string;
};

async function post<T>(body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> {
  const res = await fetch("/api/generate", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? `Generation failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useGenerateRecipe() {
  return useMutation({
    mutationFn: (params: {
      mealType?: MealType;
      timeBucket?: TimeBucket;
      previousAttempt?: string;
    }) => post<GenerateResponse>(params),
  });
}

export function useGenerateVariant() {
  return useMutation({
    mutationFn: (parentRecipeId: string) => post<GenerateResponse>({ parentRecipeId }),
  });
}

/** Keeping a recipe is the first thing that writes — everything before is a proposal. */
export function useKeepRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      recipe: GeneratedRecipe;
      parentRecipeId?: string | null;
      variantNote?: string | null;
    }) => post<{ id: string; resolutions: Resolution[] }>(params, "PUT"),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      // A generated recipe can introduce new ingredients.
      void queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
    },
  });
}
