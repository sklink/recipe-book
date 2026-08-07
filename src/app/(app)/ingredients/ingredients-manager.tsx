"use client";

import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";

import { StockToggle } from "@/components/stock-toggle";
import { useIngredients, useSetStaple, useSetStock } from "@/lib/ingredients/hooks";
import { CATEGORY_LABELS, groupByCategory, type Ingredient } from "@/lib/ingredients/types";

type Tab = "all" | "in" | "out";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in", label: "In stock" },
  { key: "out", label: "Out of stock" },
];

function StapleButton({ ingredient }: { ingredient: Ingredient }) {
  const setStaple = useSetStaple();

  return (
    <button
      type="button"
      aria-pressed={ingredient.isStaple}
      aria-label={
        ingredient.isStaple
          ? `${ingredient.name} is a staple. Unmark it.`
          : `Mark ${ingredient.name} as a staple`
      }
      title="Staples are assumed in stock and never counted as missing"
      onClick={() => setStaple.mutate({ id: ingredient.id, isStaple: !ingredient.isStaple })}
      className={`h-tap w-tap flex shrink-0 items-center justify-center rounded-lg transition-colors ${
        ingredient.isStaple
          ? "text-accent hover:bg-accent-muted"
          : "text-subtle hover:text-foreground hover:bg-surface-muted"
      }`}
    >
      <Star size={16} strokeWidth={2} fill={ingredient.isStaple ? "currentColor" : "none"} />
    </button>
  );
}

export function IngredientsManager() {
  const { data, isPending, isError, error } = useIngredients();
  const setStock = useSetStock();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const all = useMemo(() => data?.ingredients ?? [], [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((i) => {
      if (tab === "in" && !i.inStock) return false;
      if (tab === "out" && i.inStock) return false;
      if (term && !i.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [all, tab, search]);

  const groups = useMemo(() => groupByCategory(visible), [visible]);
  const inStockCount = all.filter((i) => i.inStock).length;

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-surface-muted h-11 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
      >
        {error instanceof Error ? error.message : "Could not load ingredients."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm" aria-live="polite">
        {inStockCount} of {all.length} in stock
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={2}
            aria-hidden
            className="text-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <label htmlFor="ingredient-search" className="sr-only">
            Search ingredients
          </label>
          <input
            id="ingredient-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ingredients"
            className="border-border bg-surface min-h-tap w-full rounded-lg border pr-3 pl-9 text-sm"
          />
        </div>

        <div role="tablist" aria-label="Stock filter" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`min-h-tap rounded-lg px-3 text-sm transition-colors ${
                tab === t.key
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="border-border text-muted rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          No ingredients match.
        </p>
      ) : (
        <div data-testid="ingredient-groups" className="flex flex-col gap-6">
          {groups.map(([category, items]) => {
            const allIn = items.every((i) => i.inStock);
            return (
              <section key={category} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-subtle text-xs font-semibold tracking-wide uppercase">
                    {CATEGORY_LABELS[category] ?? category}
                  </h2>
                  {/* One request for the whole category — thirty taps otherwise. */}
                  <button
                    type="button"
                    onClick={() =>
                      setStock.mutate({ ids: items.map((i) => i.id), inStock: !allIn })
                    }
                    className="text-muted hover:text-foreground min-h-tap px-2 text-xs"
                  >
                    {allIn ? "Mark all out" : "Mark all in"}
                  </button>
                </div>
                <ul className="flex flex-col">
                  {items.map((ingredient) => (
                    <li key={ingredient.id} className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <StockToggle ingredient={ingredient} />
                      </div>
                      <StapleButton ingredient={ingredient} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
