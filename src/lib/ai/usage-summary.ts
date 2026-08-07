import { createClient } from "@/lib/supabase/server";
import { DAILY_GENERATION_CAP } from "@/lib/ai/usage";
import type { AiGenerationKind } from "@/lib/supabase/types";

export type UsageRow = {
  id: string;
  kind: AiGenerationKind;
  model: string;
  costMillicents: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
};

export type UsageSummary = {
  today: { count: number; costMillicents: number; cap: number };
  month: { count: number; costMillicents: number };
  allTime: { count: number; costMillicents: number; failures: number };
  byKind: { kind: AiGenerationKind; count: number; costMillicents: number }[];
  recent: UsageRow[];
  available: boolean;
};

export async function getUsageSummary(): Promise<UsageSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_generations")
    .select(
      "id, kind, model, cost_millicents, input_tokens, output_tokens, duration_ms, error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const empty: UsageSummary = {
    today: { count: 0, costMillicents: 0, cap: DAILY_GENERATION_CAP },
    month: { count: 0, costMillicents: 0 },
    allTime: { count: 0, costMillicents: 0, failures: 0 },
    byKind: [],
    recent: [],
    available: false,
  };

  if (error) return empty;

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    model: r.model,
    costMillicents: r.cost_millicents,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    durationMs: r.duration_ms,
    error: r.error,
    createdAt: r.created_at,
  }));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sum = (list: UsageRow[]) => list.reduce((n, r) => n + (r.costMillicents ?? 0), 0);
  const todayRows = rows.filter((r) => new Date(r.createdAt) >= startOfToday);
  const monthRows = rows.filter((r) => new Date(r.createdAt) >= startOfMonth);

  const kinds = new Map<AiGenerationKind, { count: number; costMillicents: number }>();
  for (const row of rows) {
    const entry = kinds.get(row.kind) ?? { count: 0, costMillicents: 0 };
    entry.count++;
    entry.costMillicents += row.costMillicents ?? 0;
    kinds.set(row.kind, entry);
  }

  return {
    today: { count: todayRows.length, costMillicents: sum(todayRows), cap: DAILY_GENERATION_CAP },
    month: { count: monthRows.length, costMillicents: sum(monthRows) },
    allTime: {
      count: rows.length,
      costMillicents: sum(rows),
      failures: rows.filter((r) => r.error).length,
    },
    byKind: [...kinds.entries()].map(([kind, v]) => ({ kind, ...v })),
    recent: rows.slice(0, 25),
    available: true,
  };
}
