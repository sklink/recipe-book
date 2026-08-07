import { createClient } from "@/lib/supabase/server";
import { bucketFor, bucketRange } from "@/lib/recipes/time-buckets";
import type {
  InstructionStep,
  RecipeDetail,
  RecipeFilters,
  RecipeIngredient,
  RecipeListResponse,
  RecipeSummary,
} from "@/lib/recipes/types";
import type { ImageStatus, MealType, RecipeSource } from "@/lib/supabase/types";

/**
 * Ingredients are embedded rather than counted in SQL because "missing" is a
 * three-way rule — not optional, not a staple, not in stock — and expressing it
 * as a PostgREST filter would push that definition into a query string where
 * nothing can test it. A personal cookbook is small enough that the cost of
 * embedding is irrelevant; if this ever holds thousands of recipes, the fix is
 * a database view, not a cleverer filter.
 */
const RECIPE_SELECT = `
  id, title, description, meal_types, time_minutes, servings,
  image_url, image_status, source, source_url,
  parent_recipe_id, variant_note, is_favourite, instructions,
  recipe_ingredients (
    amount, unit, prep_note, is_optional, sort_order,
    ingredients ( id, name, category, is_staple, ingredient_stock ( in_stock ) )
  )
`;

type StockEmbed = { in_stock: boolean } | { in_stock: boolean }[] | null;

type RawIngredient = {
  amount: number | null;
  unit: string | null;
  prep_note: string | null;
  is_optional: boolean;
  sort_order: number;
  ingredients: {
    id: string;
    name: string;
    category: string;
    is_staple: boolean;
    ingredient_stock: StockEmbed;
  } | null;
};

type RawRecipe = {
  id: string;
  title: string;
  description: string | null;
  meal_types: MealType[];
  time_minutes: number;
  servings: number | null;
  image_url: string | null;
  image_status: ImageStatus;
  source: RecipeSource;
  source_url: string | null;
  parent_recipe_id: string | null;
  variant_note: string | null;
  is_favourite: boolean;
  instructions: unknown;
  recipe_ingredients: RawIngredient[];
};

/** A 1:1 embed can arrive as an object or a single-element array. */
function stockOf(embed: StockEmbed): boolean {
  if (!embed) return false;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return Boolean(row?.in_stock);
}

function toIngredient(raw: RawIngredient): RecipeIngredient | null {
  if (!raw.ingredients) return null;
  const i = raw.ingredients;
  return {
    ingredientId: i.id,
    name: i.name,
    category: i.category,
    amount: raw.amount,
    unit: raw.unit,
    prepNote: raw.prep_note,
    isOptional: raw.is_optional,
    isStaple: i.is_staple,
    inStock: stockOf(i.ingredient_stock),
    sortOrder: raw.sort_order,
  };
}

/**
 * Missing = required to cook this and not in the kitchen. Optional extras don't
 * block a recipe, and staples are assumed present by definition — counting
 * either would make the require-ingredients filter useless.
 */
export function missingIngredients(ingredients: RecipeIngredient[]): RecipeIngredient[] {
  return ingredients.filter((i) => !i.isOptional && !i.isStaple && !i.inStock);
}

function parseInstructions(value: unknown): InstructionStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is InstructionStep => Boolean(s) && typeof s === "object" && "text" in s)
    .sort((a, b) => a.step - b.step);
}

function toSummary(raw: RawRecipe, variantCounts: Map<string, number>): RecipeSummary {
  const ingredients = raw.recipe_ingredients
    .map(toIngredient)
    .filter((i): i is RecipeIngredient => i !== null);

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    mealTypes: raw.meal_types,
    timeMinutes: raw.time_minutes,
    timeBucket: bucketFor(raw.time_minutes),
    servings: raw.servings,
    imageUrl: raw.image_url,
    imageStatus: raw.image_status,
    source: raw.source,
    parentRecipeId: raw.parent_recipe_id,
    variantCount: variantCounts.get(raw.id) ?? 0,
    isFavourite: raw.is_favourite,
    missingCount: missingIngredients(ingredients).length,
    ingredientIds: ingredients.map((i) => i.ingredientId),
  };
}

/** id -> number of variants hanging off it. One cheap query, no N+1. */
async function loadVariantCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("parent_recipe_id")
    .not("parent_recipe_id", "is", null);

  if (error) throw new Error(`Loading variant counts: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const parent = row.parent_recipe_id;
    if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }
  return counts;
}

export async function listRecipes(filters: RecipeFilters = {}): Promise<RecipeListResponse> {
  const supabase = await createClient();

  let query = supabase.from("recipes").select(RECIPE_SELECT);

  if (filters.mealType) {
    query = query.contains("meal_types", [filters.mealType]);
  }
  if (filters.timeBucket) {
    const { min, max } = bucketRange(filters.timeBucket);
    query = query.gte("time_minutes", min);
    if (max !== null) query = query.lte("time_minutes", max);
  }
  if (!filters.includeVariants) {
    query = query.is("parent_recipe_id", null);
  }
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  const [{ data, error }, variantCounts] = await Promise.all([
    query.order("title"),
    loadVariantCounts(),
  ]);
  if (error) throw new Error(`Listing recipes: ${error.message}`);

  const all = (data as unknown as RawRecipe[]).map((r) => toSummary(r, variantCounts));

  if (!filters.requireIngredients) {
    return { recipes: all };
  }

  const cookable = all.filter((r) => r.missingCount === 0);
  if (cookable.length > 0) {
    return { recipes: cookable };
  }

  // Nothing is fully cookable. Returning an empty list would be a dead end, so
  // hand back the closest matches instead and let the UI say what's missing.
  const nearMisses = [...all].sort((a, b) => a.missingCount - b.missingCount).slice(0, 6);
  return { recipes: [], nearMisses };
}

export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  const supabase = await createClient();

  const [{ data, error }, variantCounts] = await Promise.all([
    supabase.from("recipes").select(RECIPE_SELECT).eq("id", id).maybeSingle(),
    loadVariantCounts(),
  ]);

  if (error) throw new Error(`Loading recipe: ${error.message}`);
  if (!data) return null;

  const raw = data as unknown as RawRecipe;
  const ingredients = raw.recipe_ingredients
    .map(toIngredient)
    .filter((i): i is RecipeIngredient => i !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { data: variantRows, error: variantError } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("parent_recipe_id", id)
    .order("created_at");
  if (variantError) throw new Error(`Loading variants: ${variantError.message}`);

  return {
    ...toSummary(raw, variantCounts),
    instructions: parseInstructions(raw.instructions),
    ingredients,
    variantNote: raw.variant_note,
    sourceUrl: raw.source_url,
    variants: (variantRows as unknown as RawRecipe[]).map((v) => toSummary(v, variantCounts)),
  };
}
