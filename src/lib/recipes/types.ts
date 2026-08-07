import type { ImageStatus, MealType, RecipeSource } from "@/lib/supabase/types";
import type { TimeBucket } from "@/lib/recipes/time-buckets";

/** One ordered instruction step, as stored in recipes.instructions. */
export type InstructionStep = { step: number; text: string };

export type RecipeIngredient = {
  ingredientId: string;
  name: string;
  category: string;
  amount: number | null;
  unit: string | null;
  prepNote: string | null;
  isOptional: boolean;
  isStaple: boolean;
  inStock: boolean;
  sortOrder: number;
};

/** Card-level shape: everything a list needs, nothing it doesn't. */
export type RecipeSummary = {
  id: string;
  title: string;
  description: string | null;
  mealTypes: MealType[];
  timeMinutes: number;
  timeBucket: TimeBucket;
  servings: number | null;
  imageUrl: string | null;
  imageStatus: ImageStatus;
  source: RecipeSource;
  parentRecipeId: string | null;
  variantCount: number;
  isFavourite: boolean;
  /** Non-optional, non-staple ingredients currently out of stock. */
  missingCount: number;
};

export type RecipeDetail = RecipeSummary & {
  instructions: InstructionStep[];
  ingredients: RecipeIngredient[];
  variantNote: string | null;
  sourceUrl: string | null;
  variants: RecipeSummary[];
};

export type RecipeFilters = {
  mealType?: MealType;
  timeBucket?: TimeBucket;
  /** Only recipes whose non-optional, non-staple ingredients are all in stock. */
  requireIngredients?: boolean;
  /** Exclude variants from the list; they surface on their parent's page. */
  includeVariants?: boolean;
  search?: string;
};

export type RecipeListResponse = {
  recipes: RecipeSummary[];
  /**
   * Populated only when requireIngredients filtered everything out — the
   * closest matches, fewest missing first, so the UI never dead-ends.
   */
  nearMisses?: RecipeSummary[];
};
