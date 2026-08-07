"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ingredientKeys } from "@/lib/ingredients/hooks";
import { recipeKeys } from "@/lib/recipes/hooks";
import type { CartResponse } from "@/lib/cart/types";

export const cartKeys = {
  all: ["cart"] as const,
  list: () => ["cart", "list"] as const,
};

async function request<T>(init: RequestInit & { url?: string } = {}): Promise<T> {
  const { url = "/api/cart", ...rest } = init;
  const res = await fetch(url, {
    headers: rest.body ? { "Content-Type": "application/json" } : undefined,
    ...rest,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useCart() {
  return useQuery({
    queryKey: cartKeys.list(),
    queryFn: () => request<CartResponse>(),
  });
}

export function useAddRecipeToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) =>
      request<{ added: number; already: number }>({
        method: "POST",
        body: JSON.stringify({ recipeId }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  });
}

/** Ticking items off while walking round a shop has to feel instant. */
export function useCheckCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      request({ method: "PATCH", body: JSON.stringify({ id, isChecked }) }),

    onMutate: async ({ id, isChecked }) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.list() });
      const previous = queryClient.getQueryData<CartResponse>(cartKeys.list());
      queryClient.setQueryData<CartResponse>(cartKeys.list(), (old) =>
        old ? { items: old.items.map((i) => (i.id === id ? { ...i, isChecked } : i)) } : old,
      );
      return { previous };
    },

    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(cartKeys.list(), context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cartKeys.list() }),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request({ url: `/api/cart?id=${encodeURIComponent(id)}`, method: "DELETE" }),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.list() });
      const previous = queryClient.getQueryData<CartResponse>(cartKeys.list());
      queryClient.setQueryData<CartResponse>(cartKeys.list(), (old) =>
        old ? { items: old.items.filter((i) => i.id !== id) } : old,
      );
      return { previous };
    },

    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(cartKeys.list(), context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cartKeys.list() }),
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => request({ method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  });
}

/**
 * Finishing a shop changes stock, which changes every missing count and the
 * require-ingredients filter — so recipes and ingredients both refresh.
 */
export function useCompleteShopping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ stocked: number; remaining: number }>({
        method: "POST",
        body: JSON.stringify({ action: "done" }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });
      void queryClient.invalidateQueries({ queryKey: ingredientKeys.all });
      void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
    },
  });
}
