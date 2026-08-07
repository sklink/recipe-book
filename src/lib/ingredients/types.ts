export type Ingredient = {
  id: string;
  name: string;
  category: string;
  isStaple: boolean;
  inStock: boolean;
};

/**
 * Display order for categories — roughly supermarket aisle order, so the cart
 * (T17) reads as a shopping route rather than an alphabetical jumble. Anything
 * unrecognised sorts last under "other".
 */
export const CATEGORY_ORDER = [
  "produce",
  "protein",
  "dairy",
  "grain",
  "pantry",
  "spice",
  "other",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Meat & fish",
  dairy: "Dairy",
  grain: "Grains & bread",
  pantry: "Pantry",
  spice: "Herbs & spices",
  other: "Other",
};

export function categoryRank(category: string): number {
  const index = (CATEGORY_ORDER as readonly string[]).indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function groupByCategory(ingredients: Ingredient[]): [string, Ingredient[]][] {
  const groups = new Map<string, Ingredient[]>();
  for (const ingredient of ingredients) {
    const key = ingredient.category || "other";
    const list = groups.get(key);
    if (list) list.push(ingredient);
    else groups.set(key, [ingredient]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
    .map(([key, list]) => [key, [...list].sort((x, y) => x.name.localeCompare(y.name))]);
}
