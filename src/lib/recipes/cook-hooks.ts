"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { recipeKeys } from "@/lib/recipes/hooks";
import type { CookOutcome, MasteryLevel } from "@/lib/supabase/types";

async function request(body: unknown, method: "POST" | "PATCH" = "POST") {
  const res = await fetch("/api/cook-logs", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/** Logging a cook changes derived mastery, so every recipe view refreshes. */
export function useLogCook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { recipeId: string; outcome: CookOutcome; notes?: string }) =>
      request(params),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
  });
}

export function useSetMasteryOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { recipeId: string; masteryOverride: MasteryLevel | null }) =>
      request(params, "PATCH"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
  });
}

export function useDeleteCookLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cook-logs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove that entry.");
      return res.json();
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
  });
}
