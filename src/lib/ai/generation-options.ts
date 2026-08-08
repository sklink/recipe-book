/**
 * Guiding parameters for recipe generation.
 *
 * Every axis leads with "any", which is both the default and a real instruction:
 * an unset axis is left to the model rather than silently constrained. Values
 * are lowercase keys; labels are what the chip shows and what the summary line
 * says, so adding an option is a one-line change here.
 *
 * Labels are short because they sit inside chips — anything longer than two
 * words wraps and breaks the row. Where a label needs qualifying, `hint` does
 * it on hover rather than making every chip wider.
 *
 * Pure data on purpose: this is imported by the server route and the prompt
 * builder, so it must not pull React or icons in with it. Icons live in
 * `src/app/(app)/generate/option-icons.ts`.
 */

export type Option = { value: string; label: string; hint?: string };
export type OptionSet = Option[];

export const ANY = "any";

const any = (hint?: string): Option => ({ value: ANY, label: "Any", hint });

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
  { value: "bread", label: "Bread", hint: "Bread or flatbread" },
  { value: "grains", label: "Grains", hint: "Couscous, bulgur, farro" },
  { value: "pulses", label: "Beans", hint: "Beans or lentils" },
  { value: "tortilla", label: "Tortilla", hint: "Tortilla or wrap" },
  { value: "pastry", label: "Pastry", hint: "Pastry or dough" },
  { value: "eggs", label: "Eggs" },
  { value: "none", label: "No starch", hint: "Protein and veg only" },
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
  { value: "tofu", label: "Tofu", hint: "Tofu or tempeh" },
  { value: "pulses", label: "Beans", hint: "Beans or lentils" },
  { value: "cheese", label: "Cheese" },
  { value: "none", label: "No protein", hint: "No main protein" },
];

/** What you'd put next to it — shapes the recipe without becoming the recipe. */
export const SIDES: OptionSet = [
  any("Nothing in particular"),
  { value: "salad", label: "Salad" },
  { value: "veg-side", label: "Veg side" },
  { value: "bread", label: "Bread" },
  { value: "rice", label: "Rice" },
  { value: "potatoes", label: "Potatoes" },
  { value: "pickles", label: "Pickles", hint: "Pickles or something sharp" },
  { value: "standalone", label: "Stands alone", hint: "It shouldn't need a side" },
];

/**
 * Dietary constraint. A hard rule rather than a preference, so it's phrased
 * that way in the prompt — a "mostly vegetarian" recipe is a failed one.
 */
export const DIETS: OptionSet = [
  any(),
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
  { value: "one-pan", label: "One pan", hint: "One pan or tray" },
  { value: "no-cook", label: "No cooking" },
  { value: "stovetop", label: "Stovetop" },
  { value: "oven", label: "Oven", hint: "Mostly oven" },
  { value: "grill", label: "Grill", hint: "Grill or barbecue" },
  { value: "slow", label: "Slow", hint: "Slow and mostly unattended" },
  { value: "batch", label: "Batch", hint: "Batch cook for leftovers" },
];

/** Where the effort should go — the "learn something" axis from the brief. */
export const AMBITIONS: OptionSet = [
  any(),
  { value: "simple", label: "Straightforward", hint: "No new skills" },
  { value: "technique", label: "Technique", hint: "Teach me something" },
  { value: "impressive", label: "Impressive", hint: "Worth serving to guests" },
  { value: "frugal", label: "Frugal", hint: "Cheap ingredients" },
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

export type OptionSetKey = keyof Omit<GenerationOptions, "useAvailable">;

export type OptionSetEntry = {
  key: OptionSetKey;
  label: string;
  options: OptionSet;
};

/** Render order on the page: broadest strokes first, seasoning last. */
export const OPTION_SETS: OptionSetEntry[] = [
  { key: "cuisine", label: "Cuisine", options: CUISINES },
  { key: "base", label: "Base", options: BASES },
  { key: "protein", label: "Protein", options: PROTEINS },
  { key: "side", label: "Goes with", options: SIDES },
  { key: "diet", label: "Diet", options: DIETS },
  { key: "method", label: "Method", options: METHODS },
  { key: "ambition", label: "Ambition", options: AMBITIONS },
];

/** "any" and unset mean the same thing; normalise so callers only handle one. */
export function meaningful(value: string | undefined): string | undefined {
  return value && value !== ANY ? value : undefined;
}

export function labelFor(options: OptionSet, value: string | undefined): string | undefined {
  const found = options.find((o) => o.value === value);
  return found && found.value !== ANY ? found.label : undefined;
}
