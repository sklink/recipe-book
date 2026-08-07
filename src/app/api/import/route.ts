import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { importRecipeFromUrl } from "@/lib/ai/import";

/**
 * POST /api/import — { url }
 *
 * Extracts only; nothing is written. Saving goes through the same PUT
 * /api/generate path as a generated recipe, so the ingredient resolver runs
 * either way and imported recipes join the same canonical ingredient list.
 */
export async function POST(request: NextRequest) {
  await requireUser();

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }

  try {
    const result = await importRecipeFromUrl(body.url.trim());

    if (!result.isRecipe || !result.recipe) {
      return NextResponse.json(
        { error: result.problem ?? "That page doesn't appear to contain a recipe." },
        { status: 422 },
      );
    }

    return NextResponse.json({ recipe: result.recipe, source: result.source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    console.error("POST /api/import", error);
    const capped = message.includes("Daily generation limit");
    return NextResponse.json({ error: message }, { status: capped ? 429 : 502 });
  }
}
