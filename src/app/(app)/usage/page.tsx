import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { formatCost } from "@/lib/ai/format";
import { getUsageSummary } from "@/lib/ai/usage-summary";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  recipe: "Generated recipes",
  variant: "Variants",
  image: "Images",
  import: "Imports",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="font-display text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-subtle text-xs">{hint}</span> : null}
    </div>
  );
}

export default async function UsagePage() {
  const usage = await getUsageSummary();

  if (!usage.available) {
    return (
      <>
        <PageHeader title="AI usage" />
        <p className="border-warning/30 bg-warning-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          The ai_generations table isn&rsquo;t available, so nothing is being recorded durably.
        </p>
      </>
    );
  }

  const capPercent = Math.round((usage.today.count / usage.today.cap) * 100);

  return (
    <>
      <PageHeader
        title="AI usage"
        description="What generation has cost. Prices are list rates, computed per call from token counts."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Today"
          value={formatCost(usage.today.costMillicents)}
          hint={`${usage.today.count} of ${usage.today.cap} calls (${capPercent}%)`}
        />
        <Stat
          label="This month"
          value={formatCost(usage.month.costMillicents)}
          hint={`${usage.month.count} calls`}
        />
        <Stat
          label="All time"
          value={formatCost(usage.allTime.costMillicents)}
          hint={`${usage.allTime.count} calls`}
        />
        <Stat
          label="Failures"
          value={String(usage.allTime.failures)}
          hint={usage.allTime.failures > 0 ? "still billed if tokens were spent" : "none"}
        />
      </div>

      {usage.byKind.length > 0 ? (
        <section className="flex flex-col gap-2 pt-8">
          <h2 className="font-display text-lg font-semibold">By kind</h2>
          <ul className="flex flex-col">
            {usage.byKind
              .sort((a, b) => b.costMillicents - a.costMillicents)
              .map((k) => (
                <li
                  key={k.kind}
                  className="border-border flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0"
                >
                  <span className="text-sm">{KIND_LABELS[k.kind] ?? k.kind}</span>
                  <span className="text-muted text-sm tabular-nums">
                    {k.count} · {formatCost(k.costMillicents)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 pt-8">
        <h2 className="font-display text-lg font-semibold">Recent calls</h2>
        {usage.recent.length === 0 ? (
          <p className="text-muted text-sm">Nothing generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-subtle border-border border-b text-left text-xs uppercase">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Kind</th>
                  <th className="py-2 pr-3 font-medium">Tokens</th>
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((row) => (
                  <tr key={row.id} className="border-border border-b last:border-b-0">
                    <td className="text-muted py-2 pr-3 whitespace-nowrap tabular-nums">
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 pr-3">
                      {KIND_LABELS[row.kind] ?? row.kind}
                      {row.error ? (
                        <span className="text-danger block text-xs">{row.error.slice(0, 60)}</span>
                      ) : null}
                    </td>
                    <td className="text-muted py-2 pr-3 tabular-nums">
                      {row.inputTokens === null
                        ? "—"
                        : `${row.inputTokens} / ${row.outputTokens ?? 0}`}
                    </td>
                    <td className="text-muted py-2 pr-3 tabular-nums">
                      {row.durationMs === null ? "—" : `${(row.durationMs / 1000).toFixed(1)}s`}
                    </td>
                    <td className="py-2 tabular-nums">
                      {row.costMillicents === null ? "—" : formatCost(row.costMillicents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
