"use client";

import { useQuery } from "@tanstack/react-query";

import type { RecipeDetail, RecipeFilters, RecipeListResponse } from "@/lib/recipes/types";

/**
 * Query keys. Filters are normalised into a stable, sorted shape so that two
 * equivalent filter objects share a cache entry regardless of key order.
 */
export const recipeKeys = {
  all: ["recipes"] as const,
  list: (filters: RecipeFilters) =>
    ["recipes", "list", Object.entries(filters).sort(([a], [b]) => a.localeCompare(b))] as const,
  detail: (id: string) => ["recipes", "detail", id] as const,
};

function toSearchParams(filters: RecipeFilters): string {
  const params = new URLSearchParams();
  if (filters.mealType) params.set("mealType", filters.mealType);
  if (filters.timeBucket) params.set("timeBucket", filters.timeBucket);
  if (filters.requireIngredients) params.set("requireIngredients", "true");
  if (filters.includeVariants) params.set("includeVariants", "true");
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useRecipes(filters: RecipeFilters = {}) {
  return useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: () => fetchJson<RecipeListResponse>(`/api/recipes${toSearchParams(filters)}`),
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: recipeKeys.detail(id ?? ""),
    queryFn: () => fetchJson<RecipeDetail>(`/api/recipes/${id}`),
    enabled: Boolean(id),
  });
}
