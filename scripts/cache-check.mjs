import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-cachetoken.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

let fail = 0;
const check = (d, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${d}${extra ? `  ${extra}` : ""}`);
};

const serverErrors = [];
page.on("response", (r) => {
  if (r.status() >= 500) serverErrors.push(`${r.status()} ${new URL(r.url()).pathname}`);
});

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});

// First visit — data comes from the network.
await page.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="recipe-list"]', { timeout: 15000 });
const first = await page.locator('[data-testid="recipe-list"] li').count();
check("first load renders recipes", first === 23, `${first} rows`);

// The persister throttles writes (1s by default), so poll rather than assume.
let cached = null;
for (let i = 0; i < 20 && !cached; i++) {
  cached = await page.evaluate(() => window.localStorage.getItem("recipe-book-cache"));
  if (!cached) await page.waitForTimeout(250);
}
check(
  "cache written to localStorage",
  Boolean(cached),
  cached ? `${(cached.length / 1024).toFixed(1)} KB` : "",
);
check("cache contains recipe data", (cached ?? "").includes("Shakshuka"));

// Reload with the API blocked. Anything that renders came from the cache.
await page.route("**/api/recipes**", (route) => route.abort());
await page.goto("http://localhost:3000/recipes", { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="recipe-list"] li', { timeout: 15000 }).catch(() => {});
const offline = await page.locator('[data-testid="recipe-list"] li').count();
check("renders from cache with the API unreachable", offline === 23, `${offline} rows`);

check("no 5xx from the server", serverErrors.length === 0, serverErrors.join(", "));

await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
