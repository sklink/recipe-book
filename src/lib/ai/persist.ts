import { resolveIngredients } from "@/lib/ingredients/resolver";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedRecipe } from "@/lib/ai/schema";

/**
 * Turns a generated recipe into database rows.
 *
 * Ingredient names go through the resolver first, so a generated "cilantro"
 * attaches to the existing coriander rather than starting a parallel one.
 */
export async function persistGeneratedRecipe(
  recipe: GeneratedRecipe,
  options: { parentRecipeId?: string | null; variantNote?: string | null } = {},
): Promise<{ id: string; resolutions: Awaited<ReturnType<typeof resolveIngredients>> }> {
  const supabase = await createClient();

  const resolutions = await resolveIngredients(recipe.ingredients.map((i) => i.name));

  const { data: created, error } = await supabase
    .from("recipes")
    .insert({
      title: recipe.title,
      description: recipe.description,
      meal_types: recipe.mealTypes,
      time_minutes: recipe.timeMinutes,
      servings: recipe.servings,
      instructions: recipe.steps.map((text, idx) => ({ step: idx + 1, text })),
      source: "ai",
      image_status: "pending",
      parent_recipe_id: options.parentRecipeId ?? null,
      variant_note: options.variantNote ?? null,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`Saving recipe: ${error?.message}`);

  // A model can name the same ingredient twice ("lemon" for juice and zest);
  // the unique constraint on (recipe_id, ingredient_id) would reject the batch.
  const seen = new Set<string>();
  const links = recipe.ingredients
    .map((ingredient, index) => ({ ingredient, resolution: resolutions[index] }))
    .filter(({ resolution }) => {
      if (seen.has(resolution.ingredientId)) return false;
      seen.add(resolution.ingredientId);
      return true;
    })
    .map(({ ingredient, resolution }, sortOrder) => ({
      recipe_id: created.id,
      ingredient_id: resolution.ingredientId,
      amount: ingredient.amount,
      unit: ingredient.unit,
      prep_note: ingredient.prepNote,
      is_optional: ingredient.isOptional,
      sort_order: sortOrder,
    }));

  const { error: linkError } = await supabase.from("recipe_ingredients").insert(links);
  if (linkError) {
    // Don't leave a recipe with no ingredients behind.
    await supabase.from("recipes").delete().eq("id", created.id);
    throw new Error(`Linking ingredients: ${linkError.message}`);
  }

  return { id: created.id, resolutions };
}

/**
 * Near-duplicate check (T20b).
 *
 * Titles alone are too weak — "Chicken Curry" and "Thai Green Curry" differ by
 * title but a re-worded duplicate wouldn't. Ingredient overlap catches the
 * second case; either signal on its own is enough to warn.
 */
export async function findSimilarRecipe(
  recipe: GeneratedRecipe,
): Promise<{ id: string; title: string; reason: string } | null> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("recipes")
    .select("id, title, recipe_ingredients ( ingredients ( name ) )")
    .is("parent_recipe_id", null);

  if (!existing?.length) return null;

  const normalise = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\b(with|and|the|a|of|in|on)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const candidateTitle = normalise(recipe.title);
  const candidateIngredients = new Set(recipe.ingredients.map((i) => i.name.toLowerCase()));

  for (const row of existing as unknown as {
    id: string;
    title: string;
    recipe_ingredients: { ingredients: { name: string } | null }[];
  }[]) {
    const title = normalise(row.title);

    if (title === candidateTitle) {
      return { id: row.id, title: row.title, reason: "same title" };
    }

    const names = row.recipe_ingredients
      .map((ri) => ri.ingredients?.name.toLowerCase())
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) continue;

    const shared = names.filter((n) => candidateIngredients.has(n)).length;
    const overlap = shared / Math.max(names.length, candidateIngredients.size);

    // 70% of ingredients in common is a different recipe in name only.
    if (overlap >= 0.7) {
      return {
        id: row.id,
        title: row.title,
        reason: `${Math.round(overlap * 100)}% of the same ingredients`,
      };
    }
  }

  return null;
}
