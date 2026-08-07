"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Ingredient } from "@/lib/ingredients/types";
import { recipeKeys } from "@/lib/recipes/hooks";

export const ingredientKeys = {
  all: ["ingredients"] as const,
  list: () => ["ingredients", "list"] as const,
};

type IngredientsResponse = { ingredients: Ingredient[] };

async function patch(body: unknown) {
  const res = await fetch("/api/ingredients", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useIngredients() {
  return useQuery({
    queryKey: ingredientKeys.list(),
    queryFn: async (): Promise<IngredientsResponse> => {
      const res = await fetch("/api/ingredients");
      if (!res.ok) throw new Error("Could not load ingredients.");
      return res.json();
    },
  });
}

/**
 * Stock toggle with an optimistic update.
 *
 * Toggling stock is the single most repeated action in the app — you stand at a
 * cupboard tapping through a list — so it has to register instantly and roll
 * back visibly if the write fails, rather than waiting on a round trip.
 *
 * Recipe queries are invalidated on settle because missingCount is derived
 * server-side from exactly this data.
 */
export function useSetStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, inStock }: { ids: string[]; inStock: boolean }) => patch({ ids, inStock }),

    onMutate: async ({ ids, inStock }) => {
      await queryClient.cancelQueries({ queryKey: ingredientKeys.list() });
      const previous = queryClient.getQueryData<IngredientsResponse>(ingredientKeys.list());

      const target = new Set(ids);
      queryClient.setQueryData<IngredientsResponse>(ingredientKeys.list(), (old) =>
        old
          ? {
              ingredients: old.ingredients.map((i) => (target.has(i.id) ? { ...i, inStock } : i)),
            }
          : old,
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ingredientKeys.list(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ingredientKeys.list() });
      // missingCount and the require-ingredients filter both derive from stock.
      void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}

/** Marking a staple changes what counts as missing, so recipes refresh too. */
export function useSetStaple() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isStaple }: { id: string; isStaple: boolean }) => patch({ id, isStaple }),

    onMutate: async ({ id, isStaple }) => {
      await queryClient.cancelQueries({ queryKey: ingredientKeys.list() });
      const previous = queryClient.getQueryData<IngredientsResponse>(ingredientKeys.list());

      queryClient.setQueryData<IngredientsResponse>(ingredientKeys.list(), (old) =>
        old
          ? { ingredients: old.ingredients.map((i) => (i.id === id ? { ...i, isStaple } : i)) }
          : old,
      );

      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ingredientKeys.list(), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ingredientKeys.list() });
      void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}
