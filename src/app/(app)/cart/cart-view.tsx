"use client";

import Link from "next/link";
import { Check, ShoppingBasket, Trash2 } from "lucide-react";

import {
  useCart,
  useCheckCartItem,
  useClearCart,
  useCompleteShopping,
  useRemoveCartItem,
} from "@/lib/cart/hooks";
import { CATEGORY_LABELS, categoryRank } from "@/lib/ingredients/types";
import type { CartItem } from "@/lib/cart/types";

function Row({ item }: { item: CartItem }) {
  const check = useCheckCartItem();
  const remove = useRemoveCartItem();

  return (
    <li className="border-border flex items-center gap-2 border-b py-1 last:border-b-0">
      <label className="min-h-tap flex flex-1 cursor-pointer items-center gap-3 rounded-lg px-2">
        <input
          type="checkbox"
          checked={item.isChecked}
          onChange={(event) => check.mutate({ id: item.id, isChecked: event.target.checked })}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
            item.isChecked ? "border-success bg-success text-white" : "border-border-strong"
          }`}
        >
          {item.isChecked ? <Check size={13} strokeWidth={3} /> : null}
        </span>

        <span
          className={`min-w-0 flex-1 text-sm ${item.isChecked ? "text-subtle line-through" : ""}`}
        >
          <span className="font-medium">{item.name}</span>
          {item.amountNote ? <span className="text-muted"> — {item.amountNote}</span> : null}
          {item.sources.length > 0 ? (
            <span className="text-subtle block text-xs">for {item.sources.join(", ")}</span>
          ) : null}
        </span>
      </label>

      <button
        type="button"
        aria-label={`Remove ${item.name} from cart`}
        onClick={() => remove.mutate(item.id)}
        className="text-subtle hover:text-danger h-tap w-tap flex shrink-0 items-center justify-center rounded-lg transition-colors"
      >
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </li>
  );
}

export function CartView() {
  const { data, isPending, isError, error } = useCart();
  const complete = useCompleteShopping();
  const clear = useClearCart();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
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
        {error instanceof Error ? error.message : "Could not load the cart."}
      </p>
    );
  }

  const items = data.items;

  if (items.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
        <ShoppingBasket size={24} strokeWidth={1.5} aria-hidden className="text-subtle" />
        <p className="text-muted text-sm">
          {complete.isSuccess && complete.data.stocked > 0
            ? `${complete.data.stocked} ingredient${complete.data.stocked === 1 ? "" : "s"} moved into your kitchen.`
            : "Nothing in the cart."}
        </p>
        <Link
          href="/recipes"
          className="text-accent min-h-tap flex items-center text-sm font-medium"
        >
          Find something to cook
        </Link>
      </div>
    );
  }

  // Aisle order, so the list reads as a route round a shop.
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const list = groups.get(item.category);
    if (list) list.push(item);
    else groups.set(item.category, [item]);
  }
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b),
  );

  const checked = items.filter((i) => i.isChecked).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm" aria-live="polite">
          {items.length} item{items.length === 1 ? "" : "s"}
          {checked > 0 ? ` · ${checked} ticked` : ""}
        </p>
        <button
          type="button"
          onClick={() => clear.mutate()}
          className="text-muted hover:text-danger min-h-tap px-2 text-xs"
        >
          Clear cart
        </button>
      </div>

      <div data-testid="cart-groups" className="flex flex-col gap-5">
        {ordered.map(([category, list]) => (
          <section key={category} className="flex flex-col gap-1">
            <h2 className="text-subtle text-xs font-semibold tracking-wide uppercase">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <ul className="flex flex-col">
              {list.map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/*
       * The point of the cart: ticked items become kitchen stock. Unticked ones
       * stay, because not finding something is a normal outcome of a shop.
       */}
      <div className="border-border bg-background sticky bottom-0 flex flex-col gap-2 border-t py-3">
        <button
          type="button"
          onClick={() => complete.mutate()}
          disabled={checked === 0 || complete.isPending}
          className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {complete.isPending
            ? "Updating your kitchen…"
            : checked === 0
              ? "Tick what you bought"
              : `Done shopping — add ${checked} to my kitchen`}
        </button>
        {complete.isError ? (
          <p role="alert" className="text-danger text-sm">
            {complete.error instanceof Error ? complete.error.message : "Could not finish."}
          </p>
        ) : null}
        {complete.isSuccess && complete.data.stocked > 0 ? (
          <p role="status" className="text-success text-sm">
            {complete.data.stocked} now in stock
            {complete.data.remaining > 0 ? `, ${complete.data.remaining} still to buy` : ""}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
