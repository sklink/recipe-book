import { createClient } from "@/lib/supabase/server";
import type { Ingredient } from "@/lib/ingredients/types";

type StockEmbed = { in_stock: boolean } | { in_stock: boolean }[] | null;

/** A 1:1 embed can arrive as an object or a single-element array. */
function stockOf(embed: StockEmbed): boolean {
  if (!embed) return false;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return Boolean(row?.in_stock);
}

export async function listIngredients(): Promise<Ingredient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, category, is_staple, ingredient_stock ( in_stock )")
    .order("name");

  if (error) throw new Error(`Listing ingredients: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    isStaple: row.is_staple,
    inStock: stockOf(row.ingredient_stock as StockEmbed),
  }));
}

export async function setStock(ingredientIds: string[], inStock: boolean): Promise<void> {
  if (ingredientIds.length === 0) return;
  const supabase = await createClient();

  // upsert rather than update: the trigger creates a stock row per ingredient,
  // but an ingredient inserted before that trigger existed would have none.
  const { error } = await supabase.from("ingredient_stock").upsert(
    ingredientIds.map((id) => ({ ingredient_id: id, in_stock: inStock })),
    { onConflict: "ingredient_id" },
  );

  if (error) throw new Error(`Updating stock: ${error.message}`);
}

export async function setStaple(ingredientId: string, isStaple: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ingredients")
    .update({ is_staple: isStaple })
    .eq("id", ingredientId);

  if (error) throw new Error(`Updating staple flag: ${error.message}`);
}
