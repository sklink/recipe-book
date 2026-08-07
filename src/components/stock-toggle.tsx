"use client";

import { Check } from "lucide-react";

import { useSetStock } from "@/lib/ingredients/hooks";
import type { Ingredient } from "@/lib/ingredients/types";

/**
 * In/out of stock switch.
 *
 * A real checkbox rather than a styled div: it is a binary state control, so
 * keyboard operation, screen-reader semantics and form association all come for
 * free instead of being reimplemented with role and key handlers.
 */
export function StockToggle({
  ingredient,
  showCategory = false,
}: {
  ingredient: Ingredient;
  showCategory?: boolean;
}) {
  const setStock = useSetStock();

  return (
    <label
      className={`min-h-tap flex cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors ${
        ingredient.inStock ? "" : "opacity-70"
      } hover:bg-surface-muted`}
    >
      <input
        type="checkbox"
        checked={ingredient.inStock}
        onChange={(event) =>
          setStock.mutate({ ids: [ingredient.id], inStock: event.target.checked })
        }
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          ingredient.inStock
            ? "border-success bg-success text-white"
            : "border-border-strong bg-surface"
        }`}
      >
        {ingredient.inStock ? <Check size={13} strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1 text-sm">
        <span className={ingredient.inStock ? "" : "text-muted"}>{ingredient.name}</span>
        {ingredient.isStaple ? <span className="text-subtle text-xs"> · staple</span> : null}
        {showCategory ? (
          <span className="text-subtle text-xs"> · {ingredient.category}</span>
        ) : null}
      </span>
    </label>
  );
}
