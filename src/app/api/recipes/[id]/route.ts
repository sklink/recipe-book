import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { getRecipe } from "@/lib/recipes/queries";
import {
  deleteRecipe,
  updateRecipe,
  validateRecipe,
  type RecipeInput,
} from "@/lib/recipes/mutations";

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

/** PUT /api/recipes/:id — save edits (T24). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  let input: RecipeInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const errors = validateRecipe(input);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 });
  }

  try {
    await updateRecipe(id, input);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error(`PUT /api/recipes/${id}`, error);
    return NextResponse.json({ error: "Could not save the recipe." }, { status: 500 });
  }
}

/** DELETE /api/recipes/:id — cascades to variants. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  try {
    return NextResponse.json(await deleteRecipe(id));
  } catch (error) {
    console.error(`DELETE /api/recipes/${id}`, error);
    return NextResponse.json({ error: "Could not delete the recipe." }, { status: 500 });
  }
}
