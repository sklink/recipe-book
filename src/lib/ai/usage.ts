import { createClient } from "@/lib/supabase/server";

/**
 * AI usage accounting and the daily spend guard.
 *
 * The ai_generations table is a *soft* dependency: if the migration hasn't been
 * applied, generation still works and falls back to an in-process counter. A
 * missing table should not take a feature offline, but it also shouldn't
 * silently remove the cost ceiling — hence the fallback rather than fail-open.
 */

export const DAILY_GENERATION_CAP = 50;

export type GenerationKind = "recipe" | "variant" | "image" | "import";

/** Weak backstop when the table is absent — per process, so it resets on deploy. */
const memoryCounter = { day: "", count: 0 };
let tableMissingWarned = false;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function noteTableMissing(context: string, message: string) {
  if (!tableMissingWarned) {
    console.warn(
      `[ai] ${context}: ${message}\n` +
        "[ai] Falling back to an in-process counter. Apply " +
        "supabase/migrations/20260807120000_ai_generations.sql to enable durable usage tracking.",
    );
    tableMissingWarned = true;
  }
}

export async function generationsToday(): Promise<number> {
  const supabase = await createClient();
  const start = `${today()}T00:00:00Z`;

  const { count, error } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start);

  if (error) {
    noteTableMissing("counting usage", error.message);
    return memoryCounter.day === today() ? memoryCounter.count : 0;
  }
  return count ?? 0;
}

export async function assertWithinDailyCap(): Promise<void> {
  const used = await generationsToday();
  if (used >= DAILY_GENERATION_CAP) {
    throw new Error(
      `Daily generation limit reached (${used}/${DAILY_GENERATION_CAP}). Try again tomorrow.`,
    );
  }
}

export async function recordGeneration(entry: {
  kind: GenerationKind;
  model: string;
  recipeId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costMillicents?: number | null;
  durationMs?: number | null;
  error?: string | null;
}): Promise<void> {
  // Count locally first, so the fallback stays accurate even when the insert works.
  if (memoryCounter.day !== today()) {
    memoryCounter.day = today();
    memoryCounter.count = 0;
  }
  memoryCounter.count++;

  const supabase = await createClient();
  const { error } = await supabase.from("ai_generations").insert({
    kind: entry.kind,
    model: entry.model,
    recipe_id: entry.recipeId ?? null,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    cost_millicents: entry.costMillicents ?? null,
    duration_ms: entry.durationMs ?? null,
    error: entry.error ?? null,
  });

  if (error) noteTableMissing("recording usage", error.message);
}

/**
 * Claude Opus 5: $5 per MTok in, $25 per MTok out.
 *
 * Returned in millicents — thousandths of a cent — so divide by 1000 to display
 * cents. The earlier version returned tenths of a cent despite the name, which
 * made every reported cost 100x too low.
 */
export function claudeCostMillicents(inputTokens: number, outputTokens: number): number {
  const dollars = (inputTokens / 1_000_000) * 5 + (outputTokens / 1_000_000) * 25;
  return Math.round(dollars * 100_000);
}
