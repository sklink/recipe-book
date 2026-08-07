import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { GeneratedRecipeSchema } from "@/lib/ai/schema";
import { assertWithinDailyCap, claudeCostMillicents, recordGeneration } from "@/lib/ai/usage";

const MODEL = "claude-opus-5";

/**
 * Import wraps the recipe in a verdict rather than always returning one.
 *
 * Structured outputs guarantee a *shape*, not that the page was a recipe — the
 * model would otherwise invent something plausible from a blog post about a
 * holiday. Making "this isn't a recipe" a first-class answer is what stops that.
 */
const ImportResultSchema = z.object({
  isRecipe: z
    .boolean()
    .describe("True only if the page genuinely contains a cookable recipe with ingredients."),
  problem: z
    .string()
    .nullable()
    .describe("When isRecipe is false, one short sentence saying what the page was instead."),
  recipe: GeneratedRecipeSchema.nullable(),
});

export type ImportResult = z.infer<typeof ImportResultSchema>;

/** ISO 8601 duration ("PT1H30M") to minutes. */
function parseDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes > 0 ? minutes : null;
}

function collectNodes(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out);
  } else if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    out.push(node);
    if (node["@graph"]) collectNodes(node["@graph"], out);
  }
  return out;
}

function isRecipeNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type === "Recipe";
  if (Array.isArray(type)) return type.includes("Recipe");
  return false;
}

/**
 * Pulls a schema.org Recipe out of the page's JSON-LD.
 *
 * Most recipe sites publish this, and it's both exact and free — using it means
 * the model sees a clean 500-token summary instead of 50,000 tokens of nav,
 * comments and advertising, which is cheaper and markedly more accurate.
 */
export function extractJsonLd(html: string): string | null {
  const blocks = [
    ...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ];

  for (const [, raw] of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      continue; // Malformed JSON-LD is common; just try the next block.
    }

    const recipe = collectNodes(parsed).find(isRecipeNode);
    if (!recipe) continue;

    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient.filter((i): i is string => typeof i === "string")
      : [];

    const steps: string[] = [];
    const walkInstructions = (value: unknown) => {
      if (typeof value === "string") steps.push(value);
      else if (Array.isArray(value)) value.forEach(walkInstructions);
      else if (value && typeof value === "object") {
        const node = value as Record<string, unknown>;
        if (typeof node.text === "string") steps.push(node.text);
        else if (node.itemListElement) walkInstructions(node.itemListElement);
      }
    };
    walkInstructions(recipe.recipeInstructions);

    if (ingredients.length === 0 || steps.length === 0) continue;

    const time =
      parseDuration(recipe.totalTime) ??
      (parseDuration(recipe.prepTime) ?? 0) + (parseDuration(recipe.cookTime) ?? 0);

    return [
      `Title: ${recipe.name ?? "Unknown"}`,
      recipe.description ? `Description: ${recipe.description}` : "",
      time ? `Total time: ${time} minutes` : "",
      recipe.recipeYield ? `Yield: ${JSON.stringify(recipe.recipeYield)}` : "",
      recipe.recipeCategory ? `Category: ${JSON.stringify(recipe.recipeCategory)}` : "",
      "",
      "Ingredients:",
      ...ingredients.map((i) => `- ${i}`),
      "",
      "Instructions:",
      ...steps.map((s, idx) => `${idx + 1}. ${s}`),
    ]
      .filter(Boolean)
      .join("\n");
  }

  return null;
}

/** Crude but adequate: strip scripts, styles and tags, collapse whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPage(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs can be imported.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      // Some sites serve a stub to unknown agents; a normal UA gets the article.
      "User-Agent": "Mozilla/5.0 (compatible; RecipeBook/1.0; +personal use)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 401
        ? "That site refused the request — it may be paywalled."
        : `The page returned ${response.status}.`,
    );
  }

  return response.text();
}

export async function importRecipeFromUrl(url: string): Promise<ImportResult & { source: string }> {
  await assertWithinDailyCap();

  const html = await fetchPage(url);

  // Structured data first; fall back to the page text.
  const jsonLd = extractJsonLd(html);
  const text = jsonLd ?? htmlToText(html).slice(0, 24_000);
  const source = jsonLd ? "structured data" : "page text";

  if (text.length < 200) {
    throw new Error(
      "There wasn't enough readable content on that page. It may be paywalled, or built entirely in JavaScript.",
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY.");

  const started = Date.now();
  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system:
        "You extract recipes from web pages into a structured cookbook. Report what the page " +
        "actually says — do not improve, substitute, or invent quantities. If a value genuinely " +
        "isn't stated, infer the most reasonable one rather than leaving the recipe unusable, " +
        "and prefer the page's own wording for the method.\n\n" +
        "Ingredient names must be bare and canonical, because they are matched against a shared " +
        'ingredient list: "spring onion", not "2 spring onions, finely sliced". The amount, unit ' +
        "and preparation belong in their own fields.\n\n" +
        "If the page is not a recipe — a blog post, a listing, an error page, a paywall — set " +
        "isRecipe to false and say what it was. Do not invent a recipe to fill the gap.",
      output_config: { effort: "medium", format: zodOutputFormat(ImportResultSchema) },
      messages: [
        {
          role: "user",
          content: `Extract the recipe from this page (${url}).\n\n${text}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to process that page.");
    }
    const result = response.parsed_output;
    if (!result) throw new Error("Nothing usable came back.");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    await recordGeneration({
      kind: "import",
      model: MODEL,
      inputTokens,
      outputTokens,
      costMillicents: claudeCostMillicents(inputTokens, outputTokens),
      durationMs: Date.now() - started,
      error: result.isRecipe ? null : (result.problem ?? "not a recipe"),
    });

    return { ...result, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordGeneration({
      kind: "import",
      model: MODEL,
      durationMs: Date.now() - started,
      error: message,
    });
    throw error;
  }
}
