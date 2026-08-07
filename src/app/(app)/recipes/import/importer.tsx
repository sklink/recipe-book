"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link2 } from "lucide-react";

import { GeneratedRecipeCard } from "@/components/generated-recipe-card";
import { useKeepRecipe } from "@/lib/ai/hooks";
import type { GeneratedRecipe } from "@/lib/ai/schema";

export function Importer() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const keep = useKeepRecipe();

  const load = useMutation({
    mutationFn: async (target: string) => {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Import failed.");
      return body as { recipe: GeneratedRecipe; source: string };
    },
  });

  if (keep.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-success text-sm">
          Imported into your cookbook.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push(`/recipes/${keep.data.id}`)}
            className="bg-accent text-accent-fg min-h-tap rounded-lg px-4 text-sm font-medium"
          >
            Open it
          </button>
          <button
            type="button"
            onClick={() => {
              keep.reset();
              load.reset();
              setUrl("");
            }}
            className="border-border-strong min-h-tap rounded-lg border px-4 text-sm font-medium"
          >
            Import another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          keep.reset();
          load.mutate(url);
        }}
      >
        <div className="relative flex-1">
          <Link2
            size={16}
            strokeWidth={2}
            aria-hidden
            className="text-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <label htmlFor="import-url" className="sr-only">
            Recipe URL
          </label>
          <input
            id="import-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://example.com/recipes/shakshuka"
            className="border-border bg-surface min-h-tap w-full rounded-lg border pr-3 pl-9 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={load.isPending}
          className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap shrink-0 rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {load.isPending ? "Reading…" : "Import"}
        </button>
      </form>

      {load.isError ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
        >
          {(load.error as Error).message}
        </p>
      ) : null}

      {load.isSuccess ? (
        <>
          <p className="text-subtle text-xs">
            Read from {load.data.source}. Check it against the original before keeping — nothing is
            saved yet, and you can edit it afterwards.
          </p>
          <GeneratedRecipeCard
            recipe={load.data.recipe}
            actions={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => keep.mutate({ recipe: load.data.recipe })}
                    disabled={keep.isPending}
                    className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {keep.isPending ? "Saving…" : "Keep"}
                  </button>
                  <button
                    type="button"
                    onClick={() => load.reset()}
                    className="border-border-strong hover:bg-surface-muted min-h-tap rounded-lg border px-4 text-sm font-medium transition-colors"
                  >
                    Discard
                  </button>
                </div>
                {keep.isError ? (
                  <p role="alert" className="text-danger text-sm">
                    {(keep.error as Error).message}
                  </p>
                ) : null}
              </div>
            }
          />
        </>
      ) : null}
    </div>
  );
}
