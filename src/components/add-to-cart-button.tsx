"use client";

import Link from "next/link";
import { Check, ShoppingCart } from "lucide-react";

import { useAddRecipeToCart } from "@/lib/cart/hooks";

export function AddToCartButton({
  recipeId,
  missingCount,
}: {
  recipeId: string;
  missingCount: number;
}) {
  const addToCart = useAddRecipeToCart();

  if (missingCount === 0) {
    return (
      <p className="text-success flex items-center gap-2 text-sm">
        <Check size={16} strokeWidth={2.5} aria-hidden />
        You have everything for this.
      </p>
    );
  }

  if (addToCart.isSuccess) {
    const { added, already } = addToCart.data;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-success text-sm">
          {added > 0
            ? `Added ${added} ingredient${added === 1 ? "" : "s"} to the cart.`
            : already > 0
              ? "Already in the cart."
              : "Nothing to add."}
        </p>
        <Link href="/cart" className="text-accent min-h-tap flex items-center text-sm font-medium">
          View cart
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => addToCart.mutate(recipeId)}
        disabled={addToCart.isPending}
        className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex w-fit items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-60"
      >
        <ShoppingCart size={16} strokeWidth={2} aria-hidden />
        {addToCart.isPending
          ? "Adding…"
          : `Add ${missingCount} missing ingredient${missingCount === 1 ? "" : "s"} to cart`}
      </button>
      {addToCart.isError ? (
        <p role="alert" className="text-danger text-sm">
          {addToCart.error instanceof Error ? addToCart.error.message : "Could not add to cart."}
        </p>
      ) : null}
    </div>
  );
}
