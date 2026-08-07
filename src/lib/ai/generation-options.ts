/**
 * Guiding parameters for recipe generation.
 *
 * Every axis leads with "any", which is both the default and a real instruction:
 * an unset axis is left to the model rather than silently constrained. Values
 * are lowercase keys; labels are what the UI shows and what the prompt says, so
 * adding an option is a one-line change here.
 */

export type OptionSet = { value: string; label: string }[];

export const ANY = "any";

const any = (label = "Any"): { value: string; label: string } => ({ value: ANY, label });

export const CUISINES: OptionSet = [
  any(),
  { value: "italian", label: "Italian" },
  { value: "french", label: "French" },
  { value: "spanish", label: "Spanish" },
  { value: "greek", label: "Greek" },
  { value: "middle-eastern", label: "Middle Eastern" },
  { value: "north-african", label: "North African" },
  { value: "indian", label: "Indian" },
  { value: "thai", label: "Thai" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "chinese", label: "Chinese" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "mexican", label: "Mexican" },
  { value: "british", label: "British" },
  { value: "american", label: "American" },
  { value: "caribbean", label: "Caribbean" },
];

/** What the dish is built on — the carbohydrate or its absence. */
export const BASES: OptionSet = [
  any(),
  { value: "rice", label: "Rice" },
  { value: "pasta", label: "Pasta" },
  { value: "noodles", label: "Noodles" },
  { value: "potato", label: "Potato" },
  { value: "bread", label: "Bread or flatbread" },
  { value: "grains", label: "Grains (couscous, bulgur, farro)" },
  { value: "pulses", label: "Beans or lentils" },
  { value: "tortilla", label: "Tortilla or wrap" },
  { value: "pastry", label: "Pastry or dough" },
  { value: "eggs", label: "Eggs" },
  { value: "none", label: "No starch — protein and veg" },
];

export const PROTEINS: OptionSet = [
  any(),
  { value: "chicken", label: "Chicken" },
  { value: "beef", label: "Beef" },
  { value: "pork", label: "Pork" },
  { value: "lamb", label: "Lamb" },
  { value: "fish", label: "Fish" },
  { value: "shellfish", label: "Shellfish" },
  { value: "eggs", label: "Eggs" },
  { value: "tofu", label: "Tofu or tempeh" },
  { value: "pulses", label: "Beans or lentils" },
  { value: "cheese", label: "Cheese" },
  { value: "none", label: "No main protein" },
];

/** What you'd put next to it — shapes the recipe without becoming the recipe. */
export const SIDES: OptionSet = [
  any("Any / nothing in particular"),
  { value: "salad", label: "A salad" },
  { value: "veg-side", label: "A vegetable side" },
  { value: "bread", label: "Bread" },
  { value: "rice", label: "Rice" },
  { value: "potatoes", label: "Potatoes" },
  { value: "pickles", label: "Pickles or something sharp" },
  { value: "standalone", label: "Nothing — it should stand alone" },
];

/**
 * Dietary constraint. A hard rule rather than a preference, so it's phrased
 * that way in the prompt — a "mostly vegetarian" recipe is a failed one.
 */
export const DIETS: OptionSet = [
  any("Any"),
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "gluten-free", label: "Gluten free" },
  { value: "dairy-free", label: "Dairy free" },
  { value: "low-carb", label: "Low carb" },
];

/**
 * Method matters independently of time: a 40-minute braise and 40 minutes of
 * standing over a pan are different evenings.
 */
export const METHODS: OptionSet = [
  any(),
  { value: "one-pan", label: "One pan or tray" },
  { value: "no-cook", label: "No cooking" },
  { value: "stovetop", label: "Stovetop only" },
  { value: "oven", label: "Mostly oven" },
  { value: "grill", label: "Grill or barbecue" },
  { value: "slow", label: "Slow, mostly unattended" },
  { value: "batch", label: "Batch cook / leftovers" },
];

/** Where the effort should go — the "learn something" axis from the brief. */
export const AMBITIONS: OptionSet = [
  any("Any"),
  { value: "simple", label: "Straightforward — no new skills" },
  { value: "technique", label: "Teach me a technique" },
  { value: "impressive", label: "Something worth serving to guests" },
  { value: "frugal", label: "Cheap ingredients" },
];

export type GenerationOptions = {
  cuisine?: string;
  base?: string;
  protein?: string;
  side?: string;
  diet?: string;
  method?: string;
  ambition?: string;
  /** Restrict to what's currently in stock. */
  useAvailable?: boolean;
};

/**
 * `group` decides what's on screen without asking. Nine stacked selects is a
 * long scroll on a phone before you reach the button, and the second group is
 * the one you rarely touch — so it starts folded away.
 */
export type OptionSetEntry = {
  key: keyof Omit<GenerationOptions, "useAvailable">;
  label: string;
  options: OptionSet;
  group: "primary" | "more";
};

export const OPTION_SETS: OptionSetEntry[] = [
  { key: "cuisine", label: "Cuisine", options: CUISINES, group: "primary" },
  { key: "base", label: "Base", options: BASES, group: "primary" },
  { key: "protein", label: "Protein", options: PROTEINS, group: "primary" },
  { key: "side", label: "Goes with", options: SIDES, group: "primary" },
  { key: "diet", label: "Diet", options: DIETS, group: "more" },
  { key: "method", label: "Method", options: METHODS, group: "more" },
  { key: "ambition", label: "Ambition", options: AMBITIONS, group: "more" },
];

/** "any" and unset mean the same thing; normalise so callers only handle one. */
export function meaningful(value: string | undefined): string | undefined {
  return value && value !== ANY ? value : undefined;
}

export function labelFor(options: OptionSet, value: string | undefined): string | undefined {
  const found = options.find((o) => o.value === value);
  return found && found.value !== ANY ? found.label : undefined;
}
