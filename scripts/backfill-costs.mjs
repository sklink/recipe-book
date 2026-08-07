/**
 * Recomputes cost_millicents from token counts.
 *
 * Rows written before the unit fix stored tenths of a cent while the column
 * means thousandths, so historical totals were 100x too low. Recomputing from
 * tokens is exact, rather than guessing which rows predate the fix.
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const cost = (i, o) => Math.round(((i / 1e6) * 5 + (o / 1e6) * 25) * 100_000);

const rows = await (
  await fetch(
    `${URL_BASE}/rest/v1/ai_generations?select=id,kind,input_tokens,output_tokens,cost_millicents`,
    { headers: H },
  )
).json();

let fixed = 0;
for (const row of rows) {
  if (row.input_tokens === null || row.output_tokens === null) continue;
  const correct = cost(row.input_tokens, row.output_tokens);
  if (row.cost_millicents === correct) continue;
  await fetch(`${URL_BASE}/rest/v1/ai_generations?id=eq.${row.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ cost_millicents: correct }),
  });
  console.log(
    `  ${row.kind}: ${row.cost_millicents} -> ${correct} millicents (${(correct / 1000).toFixed(1)}c)`,
  );
  fixed++;
}
console.log(fixed ? `  ${fixed} row(s) corrected` : "  nothing to correct");
