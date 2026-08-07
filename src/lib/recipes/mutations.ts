import { resolveIngredients } from "@/lib/ingredients/resolver";
import { createClient } from "@/lib/supabase/server";
import type { MealType } from "@/lib/supabase/types";

/**
 * The editable shape of a recipe. Deliberately close to what the form holds
 * rather than to the database rows, so the form doesn't have to know about
 * ingredient ids or join tables.
 */
export type RecipeInput = {
  title: string;
  description: string | null;
  mealTypes: MealType[];
  timeMinutes: number;
  servings: number | null;
  ingredients: {
    name: string;
    amount: number | null;
    unit: string | null;
    prepNote: string | null;
    isOptional: boolean;
  }[];
  steps: string[];
};

export type ValidationError = { field: string; message: string };

/**
 * Validated here rather than only in the browser: these routes are reachable
 * directly, and the database constraints would otherwise surface as a 500.
 */
export function validateRecipe(input: RecipeInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.title.trim()) errors.push({ field: "title", message: "A title is required." });
  if (input.mealTypes.length === 0) {
    errors.push({ field: "mealTypes", message: "Pick at least one meal type." });
  }
  if (!Number.isFinite(input.timeMinutes) || input.timeMinutes <= 0) {
    errors.push({ field: "timeMinutes", message: "Time must be a positive number of minutes." });
  }
  if (input.servings !== null && (!Number.isInteger(input.servings) || input.servings <= 0)) {
    errors.push({ field: "servings", message: "Servings must be a whole number above zero." });
  }

  const named = input.ingredients.filter((i) => i.name.trim());
  if (named.length === 0) {
    errors.push({ field: "ingredients", message: "Add at least one ingredient." });
  }

  const steps = input.steps.filter((s) => s.trim());
  if (steps.length === 0) errors.push({ field: "steps", message: "Add at least one step." });

  return errors;
}

/**
 * Replaces a recipe's ingredient links.
 *
 * Delete-then-insert rather than a diff: the set is small, the ordering is
 * positional, and reconciling adds/removes/reorders in place would be more code
 * with more ways to go wrong than simply rewriting the list.
 */
async function writeIngredients(recipeId: string, input: RecipeInput) {
  const supabase = await createClient();
  const named = input.ingredients.filter((i) => i.name.trim());

  const resolutions = await resolveIngredients(named.map((i) => i.name.trim()));

  await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);

  // The same ingredient can legitimately be typed twice ("lemon" for juice and
  // zest); the unique constraint would reject the batch, so keep the first.
  const seen = new Set<string>();
  const rows = named
    .map((ingredient, index) => ({ ingredient, resolution: resolutions[index] }))
    .filter(({ resolution }) => {
      if (seen.has(resolution.ingredientId)) return false;
      seen.add(resolution.ingredientId);
      return true;
    })
    .map(({ ingredient, resolution }, sortOrder) => ({
      recipe_id: recipeId,
      ingredient_id: resolution.ingredientId,
      amount: ingredient.amount,
      unit: ingredient.unit?.trim() || null,
      prep_note: ingredient.prepNote?.trim() || null,
      is_optional: ingredient.isOptional,
      sort_order: sortOrder,
    }));

  const { error } = await supabase.from("recipe_ingredients").insert(rows);
  if (error) throw new Error(`Saving ingredients: ${error.message}`);

  return resolutions;
}

function recipeRow(input: RecipeInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    meal_types: input.mealTypes,
    time_minutes: Math.round(input.timeMinutes),
    servings: input.servings,
    instructions: input.steps
      .filter((s) => s.trim())
      .map((text, idx) => ({ step: idx + 1, text: text.trim() })),
  };
}

export async function createRecipe(input: RecipeInput): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...recipeRow(input), source: "manual", image_status: "pending" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Creating recipe: ${error?.message}`);

  try {
    await writeIngredients(data.id, input);
  } catch (e) {
    // Don't leave a recipe with no ingredients behind.
    await supabase.from("recipes").delete().eq("id", data.id);
    throw e;
  }

  return { id: data.id };
}

export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("recipes").update(recipeRow(input)).eq("id", id);
  if (error) throw new Error(`Updating recipe: ${error.message}`);

  await writeIngredients(id, input);
}

/**
 * Deleting a parent cascades to its variants — they have no meaning without it.
 * The caller is told the count first so the confirmation can say so rather than
 * quietly taking several recipes with it.
 */
export async function countVariants(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("parent_recipe_id", id);
  return count ?? 0;
}

export async function deleteRecipe(id: string): Promise<{ deletedVariants: number }> {
  const supabase = await createClient();
  const deletedVariants = await countVariants(id);

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(`Deleting recipe: ${error.message}`);

  return { deletedVariants };
}
