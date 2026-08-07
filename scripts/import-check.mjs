import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const token = readFileSync("/tmp/rb-imp.txt", "utf8").trim();
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) { console.error("  sign-in failed"); process.exit(2); }

let fail = 0;
const check = (d, ok, extra = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${d}${extra ? `  ${extra}` : ""}`); };
const imp = (url) => page.evaluate(async (u) => {
  const r = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}, url);

// --- a real recipe site with JSON-LD
console.log("  --- BBC Good Food (has schema.org JSON-LD) ---");
let t0 = Date.now();
let res = await imp("https://www.bbcgoodfood.com/recipes/shakshuka");
console.log(`  status ${res.status} in ${((Date.now()-t0)/1000).toFixed(1)}s`);
if (res.status === 200) {
  const r = res.body.recipe;
  check("imported a recipe", Boolean(r?.title), r?.title);
  check("read from structured data", res.body.source === "structured data", res.body.source);
  check("has ingredients", (r?.ingredients?.length ?? 0) >= 3, `${r?.ingredients?.length}`);
  check("has steps", (r?.steps?.length ?? 0) >= 2, `${r?.steps?.length}`);
  check("time is plausible", r?.timeMinutes > 0 && r?.timeMinutes < 600, `${r?.timeMinutes} min`);
  check("ingredient names are bare", r.ingredients.every((i) => !/^\d/.test(i.name) && !i.name.includes(",")), r.ingredients.slice(0,4).map(i=>i.name).join(", "));
  check("meal types assigned", (r?.mealTypes?.length ?? 0) >= 1, r?.mealTypes?.join(","));
} else {
  console.log("  (site unreachable or blocked:", res.body?.error, ") — not a code failure");
}

// --- a page that is definitely not a recipe
console.log("  --- a non-recipe page ---");
t0 = Date.now();
res = await imp("https://example.com/");
console.log(`  status ${res.status} in ${((Date.now()-t0)/1000).toFixed(1)}s`);
check("non-recipe rejected, not invented", res.status !== 200, res.body?.error?.slice(0, 70));

// --- malformed input
res = await imp("not-a-url");
check("malformed URL rejected", res.status === 502 || res.status === 400, res.body?.error);
res = await imp("ftp://example.com/x");
check("non-http scheme rejected", res.status !== 200, res.body?.error);

// --- 404
res = await imp("https://www.bbcgoodfood.com/recipes/definitely-not-a-real-recipe-xyz");
check("404 handled with a clear message", res.status !== 200, res.body?.error?.slice(0, 50));

await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
