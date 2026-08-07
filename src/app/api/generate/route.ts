import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { generateRecipe, generateVariant } from "@/lib/ai/claude";
import { generateRecipeImage } from "@/lib/ai/images";
import { findSimilarRecipe, persistGeneratedRecipe } from "@/lib/ai/persist";
import { getRecipe } from "@/lib/recipes/queries";
import { isMealType } from "@/lib/recipes/meal-types";
import { isTimeBucket } from "@/lib/recipes/time-buckets";
import { createClient } from "@/lib/supabase/server";
import type { GenerationOptions } from "@/lib/ai/generation-options";

/**
 * POST /api/generate
 *   { mealType?, timeBucket?, previousAttempt? }  a new recipe
 *   { parentRecipeId }                            a variant of an existing one
 *
 * Generation only proposes — nothing is written until the user keeps it. That
 * keeps "Try Again" free of cleanup and stops rejected ideas polluting the
 * cookbook or the ingredient list.
 */
export async function POST(request: NextRequest) {
  await requireUser();

  let body: {
    mealType?: string;
    timeBucket?: string;
    previousAttempt?: string;
    parentRecipeId?: string;
    options?: GenerationOptions;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    if (body.parentRecipeId) {
      const parent = await getRecipe(body.parentRecipeId);
      if (!parent) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

      const { recipe, usage } = await generateVariant({
        id: parent.id,
        title: parent.title,
        description: parent.description,
        timeMinutes: parent.timeMinutes,
        mealTypes: parent.mealTypes,
        ingredients: parent.ingredients.map((i) => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
        })),
        steps: parent.instructions.map((s) => s.text),
      });

      return NextResponse.json({ recipe, usage, parentRecipeId: parent.id });
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("recipes")
      .select("title")
      .is("parent_recipe_id", null);

    // Only fetched when asked for: sending the pantry on every request would
    // cost tokens on a constraint the user didn't choose.
    let availableIngredients: string[] | undefined;
    if (body.options?.useAvailable) {
      const { data: stocked } = await supabase
        .from("ingredients")
        .select("name, is_staple, ingredient_stock ( in_stock )")
        .order("name");

      const usable = (stocked ?? []).filter((row) => {
        const stock = row.ingredient_stock as
          { in_stock: boolean } | { in_stock: boolean }[] | null;
        const inStock = Array.isArray(stock)
          ? Boolean(stock[0]?.in_stock)
          : Boolean(stock?.in_stock);
        // Staples count as available by definition — that's what the flag means.
        return row.is_staple || inStock;
      });

      if (usable.length < 5) {
        return NextResponse.json(
          {
            error:
              "Not enough ingredients are marked in stock to build a recipe from. Add some on the Ingredients page, or turn that option off.",
          },
          { status: 400 },
        );
      }
      availableIngredients = usable.map((row) => row.name);
    }

    const { recipe, usage } = await generateRecipe({
      mealType: isMealType(body.mealType) ? body.mealType : undefined,
      timeBucket: isTimeBucket(body.timeBucket) ? body.timeBucket : undefined,
      avoidTitles: (existing ?? []).map((r) => r.title),
      previousAttempt: body.previousAttempt,
      options: body.options,
      availableIngredients,
    });

    // T20b — warn rather than block: the user decides whether it's a duplicate.
    const similar = await findSimilarRecipe(recipe);

    return NextResponse.json({ recipe, usage, similar });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    console.error("POST /api/generate", error);
    const capped = message.includes("Daily generation limit");
    return NextResponse.json({ error: message }, { status: capped ? 429 : 500 });
  }
}

/**
 * PUT /api/generate — keep a generated recipe.
 *
 * Image generation is fired without awaiting: it takes ~15s and the user
 * shouldn't wait on it to see their recipe. The card shows a placeholder until
 * image_status flips.
 */
export async function PUT(request: NextRequest) {
  await requireUser();

  let body: { recipe?: unknown; parentRecipeId?: string | null; variantNote?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { GeneratedRecipeSchema } = await import("@/lib/ai/schema");
  const parsed = GeneratedRecipeSchema.safeParse(body.recipe);
  if (!parsed.success) {
    return NextResponse.json({ error: "That isn't a valid recipe." }, { status: 400 });
  }

  try {
    const { id, resolutions } = await persistGeneratedRecipe(parsed.data, {
      parentRecipeId: body.parentRecipeId ?? null,
      variantNote: body.variantNote ?? null,
    });

    void generateRecipeImage(id).catch((error) => {
      console.error(`[generate] background image for ${id}`, error);
    });

    return NextResponse.json({
      id,
      // Surfaced so the UI can say when a generated name was mapped onto an
      // existing ingredient, rather than doing it invisibly.
      resolutions: resolutions.filter((r) => r.method !== "exact"),
    });
  } catch (error) {
    console.error("PUT /api/generate", error);
    const message = error instanceof Error ? error.message : "Could not save the recipe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
