import { createClient } from "@/lib/supabase/server";
import { getRecipe } from "@/lib/recipes/queries";
import type { CartItem } from "@/lib/cart/types";
import type { RecipeIngredient } from "@/lib/recipes/types";

/** "2 tbsp", "3 cloves", "to taste" — unit alone is valid with no number. */
function amountText(ingredient: RecipeIngredient): string | null {
  if (ingredient.amount === null) return ingredient.unit ?? null;
  return ingredient.unit ? `${ingredient.amount} ${ingredient.unit}` : String(ingredient.amount);
}

export async function listCart(): Promise<CartItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "id, ingredient_id, amount_note, source_recipe_ids, is_checked, ingredients ( name, category )",
    )
    .order("created_at");

  if (error) throw new Error(`Listing cart: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    id: string;
    ingredient_id: string;
    amount_note: string | null;
    source_recipe_ids: string[];
    is_checked: boolean;
    ingredients: { name: string; category: string } | null;
  }[];

  // Resolve source recipe titles in one query rather than per row.
  const recipeIds = [...new Set(rows.flatMap((r) => r.source_recipe_ids))];
  const titles = new Map<string, string>();
  if (recipeIds.length > 0) {
    const { data: recipes } = await supabase
      .from("recipes")
      .select("id, title")
      .in("id", recipeIds);
    for (const r of recipes ?? []) titles.set(r.id, r.title);
  }

  return rows.map((row) => ({
    id: row.id,
    ingredientId: row.ingredient_id,
    name: row.ingredients?.name ?? "Unknown ingredient",
    category: row.ingredients?.category ?? "other",
    amountNote: row.amount_note,
    sources: row.source_recipe_ids
      .map((id) => titles.get(id))
      .filter((t): t is string => Boolean(t)),
    isChecked: row.is_checked,
  }));
}

/**
 * Adds a recipe's missing ingredients to the cart.
 *
 * Only what you actually need: optional extras and staples are skipped, as is
 * anything already in stock. Adding the same recipe twice is a no-op for the
 * amounts — the recipe id is recorded, so a second add doesn't double them.
 *
 * Returns the number of ingredients added or updated, so the UI can say what
 * happened rather than silently succeeding.
 */
export async function addRecipeToCart(
  recipeId: string,
): Promise<{ added: number; already: number }> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) throw new Error("Recipe not found.");

  const needed = recipe.ingredients.filter((i) => !i.isOptional && !i.isStaple && !i.inStock);
  if (needed.length === 0) return { added: 0, already: 0 };

  const supabase = await createClient();
  const { data: existingRows, error: readError } = await supabase
    .from("cart_items")
    .select("id, ingredient_id, amount_note, source_recipe_ids")
    .in(
      "ingredient_id",
      needed.map((i) => i.ingredientId),
    );
  if (readError) throw new Error(`Reading cart: ${readError.message}`);

  const existing = new Map((existingRows ?? []).map((r) => [r.ingredient_id, r]));

  let added = 0;
  let already = 0;

  for (const ingredient of needed) {
    const amount = amountText(ingredient);
    const prior = existing.get(ingredient.ingredientId);

    if (!prior) {
      const { error } = await supabase.from("cart_items").insert({
        ingredient_id: ingredient.ingredientId,
        amount_note: amount,
        source_recipe_ids: [recipeId],
      });
      if (error) throw new Error(`Adding to cart: ${error.message}`);
      added++;
      continue;
    }

    if (prior.source_recipe_ids.includes(recipeId)) {
      already++;
      continue;
    }

    const notes = [prior.amount_note, amount].filter(Boolean).join(" + ");
    const { error } = await supabase
      .from("cart_items")
      .update({
        amount_note: notes || null,
        source_recipe_ids: [...prior.source_recipe_ids, recipeId],
      })
      .eq("id", prior.id);
    if (error) throw new Error(`Updating cart: ${error.message}`);
    added++;
  }

  return { added, already };
}

export async function setCartItemChecked(id: string, isChecked: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ is_checked: isChecked })
    .eq("id", id);
  if (error) throw new Error(`Updating cart item: ${error.message}`);
}

export async function removeCartItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", id);
  if (error) throw new Error(`Removing cart item: ${error.message}`);
}

export async function clearCart(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().not("id", "is", null);
  if (error) throw new Error(`Clearing cart: ${error.message}`);
}

/**
 * Finish shopping: everything ticked becomes in-stock and leaves the cart.
 *
 * This is the join between the shopping list and the kitchen inventory — the
 * whole reason the cart exists rather than being a notes app. Unchecked items
 * stay put, because not finding something is a normal outcome of a shop.
 */
export async function completeShopping(): Promise<{ stocked: number; remaining: number }> {
  const supabase = await createClient();

  const { data: checked, error: readError } = await supabase
    .from("cart_items")
    .select("id, ingredient_id")
    .eq("is_checked", true);
  if (readError) throw new Error(`Reading cart: ${readError.message}`);

  if (!checked || checked.length === 0) {
    const { count } = await supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true });
    return { stocked: 0, remaining: count ?? 0 };
  }

  const { error: stockError } = await supabase.from("ingredient_stock").upsert(
    checked.map((row) => ({ ingredient_id: row.ingredient_id, in_stock: true })),
    { onConflict: "ingredient_id" },
  );
  if (stockError) throw new Error(`Updating stock: ${stockError.message}`);

  const { error: deleteError } = await supabase
    .from("cart_items")
    .delete()
    .in(
      "id",
      checked.map((row) => row.id),
    );
  if (deleteError) throw new Error(`Clearing purchased items: ${deleteError.message}`);

  const { count } = await supabase.from("cart_items").select("id", { count: "exact", head: true });
  return { stocked: checked.length, remaining: count ?? 0 };
}
