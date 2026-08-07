import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-cbtoken.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const server5xx = [];
page.on("response", (r) => {
  if (r.status() >= 500) server5xx.push(`${r.status()} ${new URL(r.url()).pathname}`);
});

let fail = 0;
const check = (d, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${d}${extra ? `  ${extra}` : ""}`);
};

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});

// --- card grid
await page.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="recipe-grid"] article', { timeout: 15000 });
const cards = await page.locator('[data-testid="recipe-grid"] article').count();
check("grid renders all recipes", cards === 23, `${cards} cards`);
check("cards show time", (await page.locator('article:has-text("30 min")').count()) > 0);
check("cards show meal types", (await page.locator('article:has-text("Breakfast")').count()) > 0);
check(
  "placeholder images have accessible labels",
  (await page.locator('[role="img"][aria-label*="not yet generated"]').count()) === 23,
);
check("stock badge present", (await page.locator('article:has-text("missing")').count()) > 0);
const tints = await page.evaluate(() =>
  new Set([...document.querySelectorAll('[role="img"]')].map((e) => [...e.classList].find((c) => c.startsWith("tint-")))).size);
check("placeholder tints varied", tints >= 6, `${tints} distinct`);
await page.screenshot({ path: "/tmp/shot-cards-desktop.png" });

// Dark mode must not glare — placeholders need dark counterparts.
const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", storageState: await ctx.storageState() });
const dp = await dark.newPage();
await dp.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
await dp.waitForSelector('[data-testid="recipe-grid"] article');
const bg = await dp.evaluate(() => getComputedStyle(document.querySelector('[role="img"]')).backgroundColor);
const lum = (bg.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
check("dark-mode placeholder is dark", lum < 90, `mean channel ${lum.toFixed(0)}`);
await dp.screenshot({ path: "/tmp/shot-cards-dark.png" });
await dark.close();

// --- detail
await page.locator('[data-testid="recipe-grid"] article a').first().click();
await page.waitForSelector('[data-testid="ingredient-list"]', { timeout: 15000 });
check(
  "detail URL is a recipe id",
  /\/recipes\/[0-9a-f-]{36}$/.test(page.url()),
  page.url().split("/").pop(),
);
const ing = await page.locator('[data-testid="ingredient-list"] li').count();
const steps = await page.locator('[data-testid="instruction-list"] li').count();
check("ingredients listed", ing > 0, `${ing}`);
check("instructions listed", steps > 0, `${steps}`);
check(
  "steps numbered from 1",
  (await page.locator('[data-testid="instruction-list"] li').first().textContent())
    .trim()
    .startsWith("1"),
);
check(
  "missing ingredients flagged",
  (await page.locator('[data-testid="ingredient-list"] :text("missing")').count()) > 0,
);
check(
  "staples flagged",
  (await page.locator('[data-testid="ingredient-list"] :text("staple")').count()) > 0,
);
check(
  "page title set server-side",
  (await page.title()).includes("Recipe Book"),
  await page.title(),
);
await page.screenshot({ path: "/tmp/shot-detail-desktop.png", fullPage: false });

// --- back navigation
await page.locator('a:has-text("All recipes")').click();
await page.waitForSelector('[data-testid="recipe-grid"]');
check("back link returns to grid", page.url().endsWith("/recipes"));

// --- 404
const res = await page.goto("http://localhost:3000/recipes/00000000-0000-0000-0000-000000000000", {
  waitUntil: "domcontentloaded",
});
check("unknown recipe -> 404", res.status() === 404, `${res.status()}`);

// --- mobile
const mob = await browser.newContext({
  viewport: { width: 375, height: 800 },
  deviceScaleFactor: 2,
  storageState: await ctx.storageState(),
});
const mp = await mob.newPage();
await mp.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
await mp.waitForSelector('[data-testid="recipe-grid"] article');
const m = await mp.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check("no horizontal overflow at 375", m.sw <= m.cw, `${m.sw}/${m.cw}`);
await mp.screenshot({ path: "/tmp/shot-cards-mobile.png" });

check("no 5xx anywhere", server5xx.length === 0, server5xx.join(", "));
await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
