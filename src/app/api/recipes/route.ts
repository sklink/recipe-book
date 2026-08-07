import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { listRecipes } from "@/lib/recipes/queries";
import { createRecipe, validateRecipe, type RecipeInput } from "@/lib/recipes/mutations";
import { isTimeBucket } from "@/lib/recipes/time-buckets";
import type { MealType } from "@/lib/supabase/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

function isMealType(value: string | null): value is MealType {
  return value !== null && (MEAL_TYPES as readonly string[]).includes(value);
}

/**
 * GET /api/recipes
 *   ?mealType=breakfast|lunch|dinner|snack
 *   ?timeBucket=quick|average|commitment
 *   ?requireIngredients=true
 *   ?mastery=known|new
 *   ?includeVariants=true
 *   ?search=text
 *
 * Unknown values for mealType/timeBucket are ignored rather than rejected: a
 * stale bookmark should show more recipes, not an error page.
 */
export async function GET(request: NextRequest) {
  await requireUser();

  const params = request.nextUrl.searchParams;
  const mealType = params.get("mealType");
  const timeBucket = params.get("timeBucket");
  const search = params.get("search")?.trim();
  const mastery = params.get("mastery");

  try {
    const result = await listRecipes({
      mealType: isMealType(mealType) ? mealType : undefined,
      timeBucket: isTimeBucket(timeBucket) ? timeBucket : undefined,
      requireIngredients: params.get("requireIngredients") === "true",
      masteryGroup: mastery === "known" || mastery === "new" ? mastery : undefined,
      includeVariants: params.get("includeVariants") === "true",
      search: search || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/recipes", error);
    return NextResponse.json({ error: "Could not load recipes." }, { status: 500 });
  }
}

/** POST /api/recipes — create by hand (T25). */
export async function POST(request: NextRequest) {
  await requireUser();

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
    return NextResponse.json(await createRecipe(input));
  } catch (error) {
    console.error("POST /api/recipes", error);
    return NextResponse.json({ error: "Could not create the recipe." }, { status: 500 });
  }
}
