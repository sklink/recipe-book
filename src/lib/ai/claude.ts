import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { GeneratedRecipeSchema, type GeneratedRecipe } from "@/lib/ai/schema";
import { assertWithinDailyCap, claudeCostMillicents, recordGeneration } from "@/lib/ai/usage";
import { BUCKET_DESCRIPTIONS, type TimeBucket } from "@/lib/recipes/time-buckets";
import type { MealType } from "@/lib/supabase/types";

const MODEL = "claude-opus-5";

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Add it to .env.local and the Vercel environment.");
  }
  return new Anthropic({ apiKey });
}

const SYSTEM = `You write recipes for one person's personal cookbook. They cook regularly and want to widen their repertoire, not be sold to.

Write like a cook talking to another cook. Each step should carry the detail that actually decides whether the dish works — the temperature, the visual cue, the mistake people make — and nothing that doesn't. Assume competence: don't explain what "dice" means.

Ingredient names must be bare and canonical, because they are matched against a shared ingredient list. Write "spring onion", not "2 spring onions, finely sliced" — the amount, unit and preparation belong in their own fields. Prefer the common name over a brand or a regional variant.

Times must be honest. If something needs 90 minutes, say 90.`;

function buildPrompt(params: {
  mealType?: MealType;
  timeBucket?: TimeBucket;
  avoidTitles: string[];
  previousAttempt?: string;
}): string {
  const lines: string[] = ["Invent one recipe."];

  if (params.mealType) lines.push(`It should suit ${params.mealType}.`);
  if (params.timeBucket) {
    lines.push(
      `It must take ${BUCKET_DESCRIPTIONS[params.timeBucket].toLowerCase()} — that is a hard constraint, not a target.`,
    );
  }

  if (params.avoidTitles.length > 0) {
    lines.push(
      "",
      "This cookbook already contains the following. Do not produce any of these, or a near-variation of one:",
      ...params.avoidTitles.map((t) => `- ${t}`),
    );
  }

  if (params.previousAttempt) {
    lines.push(
      "",
      `You just suggested "${params.previousAttempt}" and it was rejected. Go somewhere genuinely different — another cuisine, another technique, another main ingredient. Not a reworking of the same idea.`,
    );
  }

  return lines.join("\n");
}

export type GenerationResult = {
  recipe: GeneratedRecipe;
  usage: { inputTokens: number; outputTokens: number; costMillicents: number };
};

export async function generateRecipe(params: {
  mealType?: MealType;
  timeBucket?: TimeBucket;
  avoidTitles?: string[];
  previousAttempt?: string;
}): Promise<GenerationResult> {
  await assertWithinDailyCap();

  const started = Date.now();
  const anthropic = client();

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      // A well-scoped structured task, not a reasoning problem — medium effort
      // gives the same result as high for noticeably fewer tokens.
      output_config: {
        effort: "medium",
        format: zodOutputFormat(GeneratedRecipeSchema),
      },
      messages: [
        {
          role: "user",
          content: buildPrompt({
            mealType: params.mealType,
            timeBucket: params.timeBucket,
            avoidTitles: params.avoidTitles ?? [],
            previousAttempt: params.previousAttempt,
          }),
        },
      ],
    });

    // Safety classifiers return HTTP 200 with stop_reason "refusal" — reading
    // content without checking would throw somewhere far less informative.
    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to generate this recipe. Try different parameters.");
    }

    const recipe = response.parsed_output;
    if (!recipe) throw new Error("The model returned no usable recipe.");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costMillicents = claudeCostMillicents(inputTokens, outputTokens);

    await recordGeneration({
      kind: "recipe",
      model: MODEL,
      inputTokens,
      outputTokens,
      costMillicents,
      durationMs: Date.now() - started,
    });

    return { recipe, usage: { inputTokens, outputTokens, costMillicents } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordGeneration({
      kind: "recipe",
      model: MODEL,
      durationMs: Date.now() - started,
      error: message,
    });
    throw error;
  }
}

/**
 * A variant of an existing recipe: recognisably the same dish, meaningfully
 * different in execution. Anchoring on the parent's ingredients keeps it from
 * drifting into a different recipe entirely.
 */
export async function generateVariant(parent: {
  id: string;
  title: string;
  description: string | null;
  timeMinutes: number;
  mealTypes: MealType[];
  ingredients: { name: string; amount: number | null; unit: string | null }[];
  steps: string[];
}): Promise<GenerationResult> {
  await assertWithinDailyCap();

  const started = Date.now();
  const anthropic = client();

  const prompt = [
    `Here is a recipe from the cookbook:`,
    "",
    `Title: ${parent.title}`,
    parent.description ? `Description: ${parent.description}` : "",
    `Time: ${parent.timeMinutes} minutes`,
    `Meals: ${parent.mealTypes.join(", ")}`,
    "",
    "Ingredients:",
    ...parent.ingredients.map((i) => `- ${[i.amount, i.unit, i.name].filter(Boolean).join(" ")}`),
    "",
    "Method:",
    ...parent.steps.map((s, idx) => `${idx + 1}. ${s}`),
    "",
    "Produce a variant of it. It should still be recognisably this dish, but genuinely different to cook and to eat — a different cuisine's treatment, a change of technique, or a substitution that changes the character. Not a garnish swap.",
    "",
    `Title it so the relationship is obvious, e.g. "${parent.title}, <what changed>".`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(GeneratedRecipeSchema) },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to generate this variant.");
    }
    const recipe = response.parsed_output;
    if (!recipe) throw new Error("The model returned no usable variant.");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costMillicents = claudeCostMillicents(inputTokens, outputTokens);

    await recordGeneration({
      kind: "variant",
      model: MODEL,
      recipeId: parent.id,
      inputTokens,
      outputTokens,
      costMillicents,
      durationMs: Date.now() - started,
    });

    return { recipe, usage: { inputTokens, outputTokens, costMillicents } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordGeneration({
      kind: "variant",
      model: MODEL,
      recipeId: parent.id,
      durationMs: Date.now() - started,
      error: message,
    });
    throw error;
  }
}
