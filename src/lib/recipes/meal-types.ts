import { Cookie, Moon, Sandwich, Sunrise } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MealType } from "@/lib/supabase/types";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const MEAL_ICONS: Record<MealType, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sandwich,
  dinner: Moon,
  snack: Cookie,
};

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as string[]).includes(value);
}
