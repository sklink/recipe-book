import { createClient } from "@/lib/supabase/server";

/**
 * Maps a free-text ingredient name onto a canonical ingredient row.
 *
 * Without this, every generated recipe quietly fragments the ingredient list —
 * "cilantro" alongside "coriander", "scallions" alongside "spring onion" — and
 * the stock system stops working, because ticking one doesn't satisfy the other.
 *
 * Four passes, cheapest and most certain first:
 *   1. exact canonical name (citext, so case is already handled)
 *   2. known alias
 *   3. normalised form — plurals, articles, parenthetical asides
 *   4. trigram similarity above a threshold
 * and only then creates a new canonical ingredient.
 */

export type ResolutionMethod = "exact" | "alias" | "normalised" | "fuzzy" | "created";

export type Resolution = {
  ingredientId: string;
  canonicalName: string;
  method: ResolutionMethod;
  /** 0-1 for fuzzy matches; 1 for certain ones. Low scores are worth reviewing. */
  confidence: number;
  input: string;
};

/** Similarity below this creates a new ingredient rather than guessing. */
const FUZZY_THRESHOLD = 0.55;

let fuzzyUnavailableWarned = false;

/**
 * True when `input` names a narrower thing than `candidate` — every word of the
 * candidate appears in the input, and the input has more words besides.
 */
export function isMoreSpecificThan(input: string, candidate: string): boolean {
  const inputWords = normalise(input).split(" ").filter(Boolean);
  const candidateWords = normalise(candidate).split(" ").filter(Boolean);
  if (inputWords.length <= candidateWords.length) return false;
  return candidateWords.every((word) => inputWords.includes(word));
}

/**
 * Strips the noise models add: quantities that leaked into the name, trailing
 * prep notes, parentheticals, and simple plurals.
 */
/** Units that can arrive fused to a quantity, as in "400g" or "2tbsp". */
const UNIT = "g|kg|mg|ml|l|oz|lb|lbs|tbsp|tsp|cup|cups|clove|cloves|slice|slices|pinch";

export function normalise(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " "); // "(optional)", "(about 2)"
  // Leading quantity, with or without a unit fused to it: "400g", "2 tbsp", "1/2".
  s = s.replace(new RegExp(`^[\\d\\s./-]+\\s*(?:${UNIT})?\\b`), " ");
  s = s.replace(
    /\b(fresh|dried|chopped|minced|sliced|diced|ground|whole|large|small|medium)\b/g,
    " ",
  );
  s = s.replace(/,.*$/, " "); // ", finely chopped"
  s = s.replace(/[^a-z\s-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Naive de-pluralisation. The guards matter more than the rule: "hummus",
  // "molasses", "watercress" and "couscous" are singular words ending in s, and
  // stripping it would split them from their canonical entry.
  if (s.endsWith("ies") && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("oes") && s.length > 4) s = s.slice(0, -2);
  else if (
    s.endsWith("s") &&
    !s.endsWith("ss") &&
    !s.endsWith("sses") &&
    !s.endsWith("us") &&
    s.length > 3
  ) {
    s = s.slice(0, -1);
  }

  return s;
}

type CandidateRow = { id: string; name: string };

/**
 * Resolves many names at once. Batched deliberately: a generated recipe has a
 * dozen ingredients, and doing this per-name would be a dozen round trips.
 */
export async function resolveIngredients(names: string[]): Promise<Resolution[]> {
  const supabase = await createClient();

  const [{ data: ingredients, error: ingErr }, { data: aliases, error: aliasErr }] =
    await Promise.all([
      supabase.from("ingredients").select("id, name"),
      supabase.from("ingredient_aliases").select("ingredient_id, alias"),
    ]);

  if (ingErr) throw new Error(`Loading ingredients: ${ingErr.message}`);
  if (aliasErr) throw new Error(`Loading aliases: ${aliasErr.message}`);

  const byExact = new Map<string, CandidateRow>();
  const byNormalised = new Map<string, CandidateRow>();
  for (const row of ingredients ?? []) {
    byExact.set(row.name.toLowerCase(), row);
    // First writer wins, so a canonical name beats a collision from normalising.
    const key = normalise(row.name);
    if (!byNormalised.has(key)) byNormalised.set(key, row);
  }

  const byAlias = new Map<string, string>();
  for (const row of aliases ?? []) {
    byAlias.set(row.alias.toLowerCase(), row.ingredient_id);
    byAlias.set(normalise(row.alias), row.ingredient_id);
  }

  const idToName = new Map((ingredients ?? []).map((r) => [r.id, r.name]));
  const results: Resolution[] = [];

  for (const input of names) {
    const lower = input.toLowerCase().trim();
    const norm = normalise(input);

    const exact = byExact.get(lower);
    if (exact) {
      results.push({
        ingredientId: exact.id,
        canonicalName: exact.name,
        method: "exact",
        confidence: 1,
        input,
      });
      continue;
    }

    const aliasId = byAlias.get(lower) ?? byAlias.get(norm);
    if (aliasId) {
      results.push({
        ingredientId: aliasId,
        canonicalName: idToName.get(aliasId) ?? input,
        method: "alias",
        confidence: 1,
        input,
      });
      continue;
    }

    const normalised = byNormalised.get(norm);
    if (normalised) {
      results.push({
        ingredientId: normalised.id,
        canonicalName: normalised.name,
        method: "normalised",
        confidence: 0.95,
        input,
      });
      continue;
    }

    // Trigram similarity, computed in Postgres against the index built in the
    // initial migration. The function is a soft dependency: without it the
    // resolver still works via the passes above, it just creates a new
    // ingredient where it would otherwise have found a near match.
    const { data: fuzzy, error: rpcError } = await supabase.rpc("match_ingredient", {
      query: norm || lower,
      threshold: FUZZY_THRESHOLD,
    });

    if (rpcError && !fuzzyUnavailableWarned) {
      console.warn(
        `[resolver] match_ingredient unavailable (${rpcError.message}). ` +
          "Apply supabase/migrations/20260807120100_match_ingredient.sql to enable fuzzy matching.",
      );
      fuzzyUnavailableWarned = true;
    }

    const best = Array.isArray(fuzzy) ? fuzzy[0] : null;

    // A longer name that fully contains a shorter one is a *different*
    // ingredient, not a typo of it: "white wine vinegar" is not "white wine",
    // "coconut milk" is not "coconut", "spring onion" is not "onion". Trigram
    // similarity rates these highly, so the guard has to be explicit.
    const moreSpecific = best?.name ? isMoreSpecificThan(norm || lower, best.name) : false;

    if (best?.id && !moreSpecific) {
      results.push({
        ingredientId: best.id,
        canonicalName: best.name,
        method: "fuzzy",
        confidence: Number(best.score ?? FUZZY_THRESHOLD),
        input,
      });
      continue;
    }

    // Nothing matched — this is a genuinely new ingredient. Created out of
    // stock, because the model inventing it doesn't put it in the kitchen.
    const canonical = norm || lower;
    const { data: created, error: createErr } = await supabase
      .from("ingredients")
      .insert({ name: canonical, category: "other" })
      .select("id, name")
      .single();

    if (createErr || !created) {
      // Almost certainly a unique-violation race with a concurrent insert.
      const { data: existing } = await supabase
        .from("ingredients")
        .select("id, name")
        .ilike("name", canonical)
        .maybeSingle();
      if (existing) {
        results.push({
          ingredientId: existing.id,
          canonicalName: existing.name,
          method: "exact",
          confidence: 1,
          input,
        });
        continue;
      }
      throw new Error(`Could not resolve ingredient "${input}": ${createErr?.message}`);
    }

    byExact.set(created.name.toLowerCase(), created);
    byNormalised.set(normalise(created.name), created);
    idToName.set(created.id, created.name);

    results.push({
      ingredientId: created.id,
      canonicalName: created.name,
      method: "created",
      confidence: 1,
      input,
    });
  }

  return results;
}
