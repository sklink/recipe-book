import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getRecipe } from "@/lib/recipes/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  // Postgres rejects a malformed uuid with a 500-shaped error; catch it here
  // and answer 404, which is what a bad id in a URL actually means.
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  }

  try {
    const recipe = await getRecipe(id);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (error) {
    console.error(`GET /api/recipes/${id}`, error);
    return NextResponse.json({ error: "Could not load recipe." }, { status: 500 });
  }
}
