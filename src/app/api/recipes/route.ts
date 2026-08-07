import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { listRecipes } from "@/lib/recipes/queries";
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
