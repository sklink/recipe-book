import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import {
  addRecipeToCart,
  clearCart,
  completeShopping,
  listCart,
  removeCartItem,
  setCartItemChecked,
} from "@/lib/cart/queries";

export async function GET() {
  await requireUser();
  try {
    return NextResponse.json({ items: await listCart() });
  } catch (error) {
    console.error("GET /api/cart", error);
    return NextResponse.json({ error: "Could not load the cart." }, { status: 500 });
  }
}

/**
 * POST /api/cart
 *   { recipeId }        add a recipe's missing ingredients
 *   { action: "done" }  finish shopping — ticked items become in-stock
 */
export async function POST(request: NextRequest) {
  await requireUser();

  let body: { recipeId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    if (body.action === "done") {
      return NextResponse.json(await completeShopping());
    }
    if (typeof body.recipeId === "string") {
      return NextResponse.json(await addRecipeToCart(body.recipeId));
    }
    return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/cart", error);
    const message = error instanceof Error ? error.message : "Could not update the cart.";
    const notFound = message.includes("not found");
    return NextResponse.json({ error: message }, { status: notFound ? 404 : 500 });
  }
}

/** PATCH /api/cart — { id, isChecked } */
export async function PATCH(request: NextRequest) {
  await requireUser();

  let body: { id?: unknown; isChecked?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.id !== "string" || typeof body.isChecked !== "boolean") {
    return NextResponse.json({ error: "id and isChecked are required." }, { status: 400 });
  }

  try {
    await setCartItemChecked(body.id, body.isChecked);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/cart", error);
    return NextResponse.json({ error: "Could not update the item." }, { status: 500 });
  }
}

/** DELETE /api/cart?id=... removes one; without an id, clears the cart. */
export async function DELETE(request: NextRequest) {
  await requireUser();
  const id = request.nextUrl.searchParams.get("id");

  try {
    if (id) await removeCartItem(id);
    else await clearCart();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/cart", error);
    return NextResponse.json({ error: "Could not remove the item." }, { status: 500 });
  }
}
