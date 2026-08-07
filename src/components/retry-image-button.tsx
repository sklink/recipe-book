"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, RefreshCw } from "lucide-react";

import { recipeKeys } from "@/lib/recipes/hooks";
import type { ImageStatus } from "@/lib/supabase/types";

/**
 * Generates imagery for a recipe that has none.
 *
 * Shown only when there's something to fix — a recipe with a ready image
 * doesn't need a button offering to replace it.
 */
export function RetryImageButton({
  recipeId,
  imageStatus,
}: {
  recipeId: string;
  imageStatus: ImageStatus;
}) {
  const queryClient = useQueryClient();

  const retry = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/recipes/${recipeId}/image`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Image generation failed.");
      return body as { ok: boolean; url?: string };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
  });

  if (imageStatus === "ready") return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => retry.mutate()}
        disabled={retry.isPending}
        className="border-border-strong hover:bg-surface-muted min-h-tap flex w-fit items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {retry.isPending ? (
          <>
            <RefreshCw size={15} strokeWidth={2} aria-hidden className="animate-spin" />
            Generating image…
          </>
        ) : (
          <>
            <ImagePlus size={15} strokeWidth={2} aria-hidden />
            {imageStatus === "failed" ? "Try the image again" : "Generate an image"}
          </>
        )}
      </button>
      {retry.isError ? (
        <p role="alert" className="text-danger text-sm">
          {(retry.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}
