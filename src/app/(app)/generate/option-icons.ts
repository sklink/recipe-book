import {
  Bean,
  Beef,
  Box,
  Carrot,
  ChefHat,
  Clock,
  Cookie,
  CookingPot,
  Croissant,
  Drumstick,
  Egg,
  Feather,
  Fish,
  Flame,
  FlameKindling,
  GraduationCap,
  Ham,
  Hourglass,
  Layers,
  Leaf,
  Microwave,
  Milk,
  MilkOff,
  Moon,
  PiggyBank,
  Salad,
  Sandwich,
  Shrimp,
  Shuffle,
  Snowflake,
  Sun,
  Sunrise,
  Trophy,
  Utensils,
  Vegan,
  Wheat,
  WheatOff,
  Zap,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

import { Chop, Jar, Noodles, Pasta, Potato, Rice, Taco } from "@/components/food-icons";
import type { OptionSetKey } from "@/lib/ai/generation-options";

export type OptionIcon = ComponentType<LucideProps>;

/**
 * Icons for the chips, keyed `${set}:${value}`.
 *
 * Cuisine is deliberately absent. There is no honest icon for "Greek" that
 * isn't also the icon for "Middle Eastern", and half a group of meaningful
 * icons next to half a group of decorative ones is worse than none — the name
 * of a cuisine is already the clearest possible label for it. A group with no
 * entries here renders as text chips, which keeps each group internally
 * consistent.
 */
export const OPTION_ICONS: Record<string, OptionIcon> = {
  // Meal and time aren't option sets — the flow owns them — but they're chips too.
  "meal:any": Shuffle,
  "meal:breakfast": Sunrise,
  "meal:lunch": Sun,
  "meal:dinner": Moon,
  "meal:snack": Cookie,

  "time:any": Shuffle,
  "time:quick": Zap,
  "time:average": Clock,
  "time:commitment": Hourglass,

  "base:any": Shuffle,
  "base:rice": Rice,
  "base:pasta": Pasta,
  "base:noodles": Noodles,
  "base:potato": Potato,
  "base:bread": Sandwich,
  "base:grains": Wheat,
  "base:pulses": Bean,
  "base:tortilla": Taco,
  "base:pastry": Croissant,
  "base:eggs": Egg,
  "base:none": WheatOff,

  "protein:any": Shuffle,
  "protein:chicken": Drumstick,
  "protein:beef": Beef,
  "protein:pork": Ham,
  "protein:lamb": Chop,
  "protein:fish": Fish,
  "protein:shellfish": Shrimp,
  "protein:eggs": Egg,
  "protein:tofu": Box,
  "protein:pulses": Bean,
  "protein:cheese": Milk,
  "protein:none": Leaf,

  "side:any": Shuffle,
  "side:salad": Salad,
  "side:veg-side": Carrot,
  "side:bread": Sandwich,
  "side:rice": Rice,
  "side:potatoes": Potato,
  "side:pickles": Jar,
  "side:standalone": Utensils,

  "diet:any": Shuffle,
  "diet:vegetarian": Leaf,
  "diet:vegan": Vegan,
  "diet:pescatarian": Fish,
  "diet:gluten-free": WheatOff,
  "diet:dairy-free": MilkOff,
  "diet:low-carb": Salad,

  "method:any": Shuffle,
  "method:one-pan": CookingPot,
  "method:no-cook": Snowflake,
  "method:stovetop": Flame,
  "method:oven": Microwave,
  "method:grill": FlameKindling,
  "method:slow": Hourglass,
  "method:batch": Layers,

  "ambition:any": Shuffle,
  "ambition:simple": Feather,
  "ambition:technique": GraduationCap,
  "ambition:impressive": Trophy,
  "ambition:frugal": PiggyBank,
};

export function iconFor(
  set: OptionSetKey | "meal" | "time",
  value: string,
): OptionIcon | undefined {
  return OPTION_ICONS[`${set}:${value}`];
}

export { ChefHat };
