import { z } from "zod";

/**
 * The shape a generated recipe must take.
 *
 * Enforced through structured outputs rather than parsed out of prose, so the
 * model cannot return something almost-right that fails three layers down. Every
 * field the database needs is required here; nothing optional is invented.
 */
export const GeneratedRecipeSchema = z.object({
  title: z.string().describe("Short, specific dish name. No adjectives like 'delicious'."),
  description: z
    .string()
    .describe(
      "One sentence. Say the thing a cook would want to know — the technique that matters, " +
        "or what makes it worth making. Not marketing copy.",
    ),
  mealTypes: z
    .array(z.enum(["breakfast", "lunch", "dinner", "snack"]))
    .min(1)
    .describe("Every meal this genuinely suits, not just the obvious one."),
  timeMinutes: z
    .number()
    .int()
    .positive()
    .describe("Realistic total time from starting to eating, including prep."),
  servings: z.number().int().positive(),
  ingredients: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "The ingredient alone, singular and unadorned: 'spring onion', not " +
              "'2 spring onions, finely sliced'.",
          ),
        amount: z
          .number()
          .nullable()
          .describe("Numeric quantity, or null for things measured to taste."),
        unit: z
          .string()
          .nullable()
          .describe("g, ml, tbsp, tsp, cloves, slices — or null when the amount stands alone."),
        prepNote: z
          .string()
          .nullable()
          .describe("How it should arrive: 'finely chopped', 'at room temperature'."),
        isOptional: z.boolean(),
      }),
    )
    .min(2),
  steps: z
    .array(z.string())
    .min(2)
    .describe(
      "Ordered instructions. Each one an action a cook takes, with the detail that decides " +
        "whether it works — temperatures, visual cues, what to avoid.",
    ),
});

export type GeneratedRecipe = z.infer<typeof GeneratedRecipeSchema>;
