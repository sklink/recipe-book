import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-stocktoken.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
let patchMode = "normal"; // "normal" | "slow" | "fail"
let injected = 0; // 500s this test fakes on purpose
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
if (page.url().includes("/login")) {
  console.error("  sign-in failed — regenerate token");
  process.exit(2);
}

// --- ingredients page
await page.goto("http://localhost:3000/ingredients", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="ingredient-groups"]', { timeout: 15000 });
const boxes = page.locator('[data-testid="ingredient-groups"] input[type="checkbox"]');
// The checkbox is sr-only inside its label — click the label, as a user would.
const rows = page.locator('[data-testid="ingredient-groups"] label');
check("ingredients listed", (await boxes.count()) === 108, `${await boxes.count()}`);
check(
  "grouped by category",
  (await page.locator('[data-testid="ingredient-groups"] section').count()) >= 5,
);
check("starts with 0 in stock", (await page.textContent("body")).includes("0 of 108 in stock"));

// --- one route handler, mode switched per test, so handlers never overlap
await page.route("**/api/ingredients", async (route) => {
  if (route.request().method() !== "PATCH") return route.continue();
  if (patchMode === "slow") {
    await new Promise((r) => setTimeout(r, 1200));
    return route.continue();
  }
  if (patchMode === "fail") {
    injected++;
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"error":"nope"}',
    });
  }
  return route.continue();
});

const stockCount = async () =>
  Number(/(\d+) of 108 in stock/.exec(await page.textContent("body"))?.[1] ?? -1);

// --- single toggle is optimistic (paints before the request lands)
patchMode = "slow";
const t0 = Date.now();
await rows.first().click();
await page.waitForFunction(() => document.body.textContent.includes("1 of 108 in stock"), null, {
  timeout: 1000,
});
check(
  "toggle updates before the request lands",
  Date.now() - t0 < 1000,
  `${Date.now() - t0}ms (request delayed 1200ms)`,
);
await page.waitForFunction(() => document.body.textContent.includes("1 of 108 in stock"), null, {
  timeout: 8000,
});

// --- rollback on failure: must go 1 -> 2 optimistically, then back to 1
patchMode = "fail";
await rows.nth(1).click();
// Observe the whole cycle: optimistic bump to 2, then rollback to 1. Reading
// the count without waiting for both catches the in-flight frame and flakes.
await page.waitForFunction(() => document.body.textContent.includes("2 of 108 in stock"), null, {
  timeout: 5000,
});
await page.waitForFunction(() => document.body.textContent.includes("1 of 108 in stock"), null, {
  timeout: 10000,
});
const settled = await stockCount();
check("failed write rolls back", settled === 1, `2 optimistically, settled at ${settled}`);
patchMode = "normal";

// --- search + tabs
await page.fill("#ingredient-search", "olive");
await page.waitForFunction(
  () => document.querySelectorAll('[data-testid="ingredient-groups"] li').length < 10,
  null,
  { timeout: 5000 },
);
check(
  "search narrows the list",
  (await page.locator('[data-testid="ingredient-groups"] li').count()) < 10,
);
await page.fill("#ingredient-search", "");
await page.locator('button[role="tab"]:has-text("In stock")').click();
await page.waitForFunction(
  () => document.querySelectorAll('[data-testid="ingredient-groups"] li').length === 1,
  null,
  { timeout: 5000 },
);
check(
  "in-stock tab filters",
  (await page.locator('[data-testid="ingredient-groups"] li').count()) === 1,
);
await page.locator('button[role="tab"]:has-text("All")').click();

// --- bulk category toggle
const produceSection = page.locator("section").filter({ hasText: "Produce" }).first();
await produceSection.locator('button:has-text("Mark all in")').click();
await page.waitForFunction(
  () => /(\d+) of 108 in stock/.exec(document.body.textContent)?.[1] > 20,
  null,
  { timeout: 8000 },
);
const bulkCount = Number(/(\d+) of 108 in stock/.exec(await page.textContent("body"))[1]);
check("bulk category toggle works", bulkCount > 20, `${bulkCount} in stock`);

// --- staple flag
const staple = page.locator('button[aria-label^="Mark"][aria-label*="staple"]').first();
await staple.click();
await page.waitForTimeout(600);
check(
  "staple can be set",
  (await page.locator('button[aria-pressed="true"]').count()) >= 8,
  `${await page.locator('button[aria-pressed="true"]').count()} staples`,
);

// --- sidebar reflects visible recipes
await page.goto("http://localhost:3000/recipes?mealType=dinner&timeBucket=quick", {
  waitUntil: "networkidle",
});
await page.waitForSelector('[data-testid="sidebar-ingredients"]', { timeout: 15000 });
const sidebarItems = await page.locator('[data-testid="sidebar-ingredients"] li').count();
const cards = await page.locator('[data-testid="recipe-grid"] article').count();
check(
  "sidebar populated from visible recipes",
  sidebarItems > 0 && sidebarItems < 108,
  `${sidebarItems} items for ${cards} recipes`,
);

// Narrowing the recipe set must narrow the sidebar.
await page.goto(
  "http://localhost:3000/recipes/" +
    (await page.locator('[data-testid="recipe-grid"] article a').first().getAttribute("href"))
      .split("/")
      .pop(),
  { waitUntil: "networkidle" },
);
await page.waitForSelector('[data-testid="sidebar-ingredients"]');
const detailItems = await page.locator('[data-testid="sidebar-ingredients"] li').count();
check(
  "sidebar narrows on a single recipe",
  detailItems < sidebarItems,
  `${detailItems} vs ${sidebarItems}`,
);

// --- toggling in the sidebar updates the recipe's missing count
const missingBefore = await page
  .locator('[data-testid="ingredient-list"] :text("missing")')
  .count();
await page.locator('[data-testid="sidebar-ingredients"] label').first().click();
await page.waitForFunction(
  (n) =>
    document.querySelectorAll('[data-testid="ingredient-list"] span').length > 0 &&
    [...document.querySelectorAll('[data-testid="ingredient-list"] span')].filter(
      (e) => e.textContent === "missing",
    ).length < n,
  missingBefore,
  { timeout: 8000 },
);
const missingAfter = await page.locator('[data-testid="ingredient-list"] :text("missing")').count();
check(
  "sidebar toggle updates the recipe view",
  missingAfter < missingBefore,
  `${missingBefore} -> ${missingAfter}`,
);

// --- require-ingredients filter
await page.goto("http://localhost:3000/recipes?requireIngredients=true", {
  waitUntil: "networkidle",
});
await page.waitForSelector('[data-testid="recipe-grid"]', { timeout: 15000 });
const body = await page.textContent("body");
check(
  "require-ingredients toggle reflects state",
  (await page.locator('[role="switch"][aria-checked="true"]').count()) === 1,
);
check(
  "no dead end when nothing is cookable",
  body.includes("closest") ||
    (await page.locator('[data-testid="recipe-grid"] article').count()) > 0,
);

// --- mobile sheet
const mob = await browser.newContext({
  viewport: { width: 375, height: 800 },
  deviceScaleFactor: 2,
  storageState: await ctx.storageState(),
  hasTouch: true,
});
const mp = await mob.newPage();
await mp.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
await mp.waitForSelector('[role="region"][aria-label="Ingredients"]', { timeout: 15000 });
const sheet = mp.locator('[role="region"][aria-label="Ingredients"]');
check("sheet starts collapsed", (await sheet.getAttribute("data-snap")) === "peek");
check("peek shows a count", /\d+ ingredients/.test(await sheet.textContent()));
check(
  "desktop sidebar hidden on mobile",
  (await mp.locator('aside[aria-label="Ingredients"]').isVisible()) === false,
);
await sheet.locator("button").first().click();
await mp.waitForFunction(
  () =>
    document
      .querySelector('[role="region"][aria-label="Ingredients"]')
      ?.getAttribute("data-snap") === "half",
  null,
  { timeout: 3000 },
);
check("tap expands the sheet", (await sheet.getAttribute("data-snap")) === "half");
const m = await mp.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check("no overflow at 375", m.sw <= m.cw, `${m.sw}/${m.cw}`);
await mp.screenshot({ path: "/tmp/shot-sheet.png" });

check(
  "no unexpected 5xx",
  server5xx.length === injected,
  `${server5xx.length} seen, ${injected} injected on purpose`,
);
await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
