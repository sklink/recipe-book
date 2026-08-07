import { chromium } from "playwright";
import { readFileSync } from "node:fs";

/**
 * The "only what I have in" path, end to end: the API must hand the model the
 * kitchen's contents and the model must stay inside it. Verified against the
 * live stock list rather than a fixture, because the constraint is only useful
 * if it tracks what's actually in the cupboard.
 */
const token = readFileSync("/tmp/rb-stockedtoken.txt", "utf8").trim();
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

let fail = 0;
const check = (d, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${d}${extra ? `  ${extra}` : ""}`);
};

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});
if (page.url().includes("/login")) {
  console.error("  sign-in failed — token already used or expired. Regenerate it.");
  process.exit(2);
}

const stock = await page.evaluate(async () => {
  const res = await fetch("/api/ingredients");
  return res.json();
});
const available = stock.ingredients.filter((i) => i.inStock || i.isStaple).map((i) => i.name);
console.log(`  ${available.length} ingredients available (in stock or staple)`);

const result = await page.evaluate(async () => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: { useAvailable: true } }),
  });
  return { status: res.status, body: await res.json() };
});

check(
  "the request succeeded",
  result.status === 200,
  `${result.status} ${result.body.error ?? ""}`,
);
if (result.status !== 200) {
  await browser.close();
  process.exit(1);
}

const recipe = result.body.recipe;
console.log(`  generated: ${recipe.title}`);

// Loose containment: the model is told to use the canonical names, but "spring
// onions" against "spring onion" shouldn't read as a shopping trip.
const norm = (s) => s.toLowerCase().replace(/s$/, "").trim();
const pool = new Set(available.map(norm));
const missing = recipe.ingredients
  .map((i) => i.name)
  .filter((name) => !pool.has(norm(name)) && ![...pool].some((p) => norm(name).includes(p)));

check(
  "every ingredient is one you already have",
  missing.length === 0,
  missing.length ? `missing: ${missing.join(", ")}` : "",
);
check("the recipe is cookable", recipe.steps.length >= 3 && recipe.timeMinutes > 0);

await browser.close();
console.log(fail === 0 ? "\nall good" : `\n${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
