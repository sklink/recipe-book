import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { listIngredients, setStaple, setStock } from "@/lib/ingredients/queries";

export async function GET() {
  await requireUser();
  try {
    return NextResponse.json({ ingredients: await listIngredients() });
  } catch (error) {
    console.error("GET /api/ingredients", error);
    return NextResponse.json({ error: "Could not load ingredients." }, { status: 500 });
  }
}

/**
 * PATCH /api/ingredients
 *   { ids: string[], inStock: boolean }   — one or many, same call
 *   { id: string, isStaple: boolean }
 *
 * Stock takes a list so a category-level "mark all in stock" is one request
 * rather than thirty, which matters on a phone in a kitchen.
 */
export async function PATCH(request: NextRequest) {
  await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload = body as { ids?: unknown; inStock?: unknown; id?: unknown; isStaple?: unknown };

  try {
    if (typeof payload.isStaple === "boolean") {
      if (typeof payload.id !== "string") {
        return NextResponse.json({ error: "isStaple requires an id." }, { status: 400 });
      }
      await setStaple(payload.id, payload.isStaple);
      return NextResponse.json({ ok: true });
    }

    if (typeof payload.inStock === "boolean") {
      const ids = Array.isArray(payload.ids)
        ? payload.ids.filter((v): v is string => typeof v === "string")
        : typeof payload.id === "string"
          ? [payload.id]
          : [];

      if (ids.length === 0) {
        return NextResponse.json({ error: "inStock requires id or ids." }, { status: 400 });
      }
      await setStock(ids, payload.inStock);
      return NextResponse.json({ ok: true, updated: ids.length });
    }

    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/ingredients", error);
    return NextResponse.json({ error: "Could not update ingredient." }, { status: 500 });
  }
}
