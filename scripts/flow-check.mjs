import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-flowtoken.txt", "utf8").trim();
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
if (page.url().includes("/login")) {
  console.error("  sign-in failed — token already used or expired. Regenerate it.");
  process.exit(2);
}

// --- step 1
await page.goto("http://localhost:3000/flow", { waitUntil: "networkidle" });
check("step 1 offers 4 meal types", (await page.locator('a[href^="/flow?meal="]').count()) === 4);
check(
  "sidebar hidden during the flow",
  (await page.locator('aside[aria-label="Ingredients"]').count()) === 0,
);
await page.screenshot({ path: "/tmp/shot-flow-1.png" });

// --- step 2
await page.locator('a[href="/flow?meal=dinner"]').click();
await page.waitForURL((u) => u.search === "?meal=dinner");
check(
  "step 2 offers 3 time buckets",
  (await page.locator('a[href^="/flow?meal=dinner&time="]').count()) === 3,
);
check("step 2 names the chosen meal", (await page.textContent("body")).includes("Dinner —"));
await page.screenshot({ path: "/tmp/shot-flow-2.png" });

// --- step 3
await page.locator('a[href="/flow?meal=dinner&time=commitment"]').click();
await page.waitForURL((u) => u.searchParams.get("time") === "commitment");
check(
  "step 3 offers cookbook and generate",
  (await page.locator('a[href*="/recipes?"], a[href*="/generate?"]').count()) === 2,
);
await page.screenshot({ path: "/tmp/shot-flow-3.png" });

// --- back navigation preserves earlier answers
await page.locator('a:has-text("Change time")').click();
await page.waitForURL((u) => u.pathname === "/flow" && u.search === "?meal=dinner");
check("back returns to step 2 with meal kept", page.url().endsWith("meal=dinner"));
await page.goBack();
await page.waitForURL((u) => u.searchParams.get("time") === "commitment");

// --- cookbook branch
await page.locator('a[href*="/recipes?"]').click();
await page.waitForSelector('[data-testid="recipe-grid"] article', { timeout: 15000 });
const cards = await page.locator('[data-testid="recipe-grid"] article').count();
check(
  "cookbook branch lands on filtered results",
  cards === 3,
  `${cards} cards (dinner + commitment)`,
);
check(
  "filters shown as chips",
  (await page.locator('a[aria-label^="Remove filter"]').count()) === 2,
);
const titles = await page.locator("article h3").allTextContents();
check("results genuinely match", titles.length === 3, titles.join(", "));
await page.screenshot({ path: "/tmp/shot-flow-results.png" });

// --- removing a chip widens
await page.locator('a[aria-label="Remove filter: Commitment"]').click();
await page.waitForFunction(
  () => document.querySelectorAll('[data-testid="recipe-grid"] article').length > 3,
  null,
  { timeout: 15000 },
);
const widened = await page.locator('[data-testid="recipe-grid"] article').count();
check("removing a chip widens results", widened === 10, `${widened} cards (dinner, any time)`);
check(
  "remaining chip persists",
  (await page.locator('a[aria-label^="Remove filter"]').count()) === 1,
);

// --- clear all
await page.goto("http://localhost:3000/recipes?mealType=dinner&timeBucket=quick", {
  waitUntil: "networkidle",
});
await page.waitForSelector('[data-testid="recipe-grid"]');
await page.locator('a:has-text("Clear all")').click();
await page.waitForURL((u) => u.pathname === "/recipes" && u.search === "");
await page.waitForFunction(
  () => document.querySelectorAll('[data-testid="recipe-grid"] article').length === 23,
  null,
  { timeout: 15000 },
);
check("clear all restores the full cookbook", true, "23 cards");

// --- generate branch carries context
await page.goto("http://localhost:3000/flow?meal=breakfast&time=quick", {
  waitUntil: "networkidle",
});
await page.locator('a[href*="/generate?"]').click();
await page.waitForURL((u) => u.pathname === "/generate");
check(
  "generate branch carries the flow's answers",
  (await page.textContent('[data-testid="generate-context"]')).includes("Breakfast"),
);

// --- deep link and garbage handling
await page.goto("http://localhost:3000/flow?meal=lunch&time=average", { waitUntil: "networkidle" });
check(
  "deep link resumes at step 3",
  (await page.textContent("body")).includes("Something you know"),
);
await page.goto("http://localhost:3000/flow?meal=brunch&time=eternal", {
  waitUntil: "networkidle",
});
check(
  "garbage params fall back to step 1",
  (await page.textContent("body")).includes("What meal is this"),
);

// --- mobile
const mob = await browser.newContext({
  viewport: { width: 375, height: 800 },
  deviceScaleFactor: 2,
  storageState: await ctx.storageState(),
});
const mp = await mob.newPage();
await mp.goto("http://localhost:3000/flow", { waitUntil: "networkidle" });
const m = await mp.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check("no overflow at 375", m.sw <= m.cw, `${m.sw}/${m.cw}`);
const small = await mp.evaluate(
  () =>
    [...document.querySelectorAll("a")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.height > 0 && r.height < 44;
    }).length,
);
check("all tap targets >= 44px", small === 0, `${small} too small`);
await mp.screenshot({ path: "/tmp/shot-flow-mobile.png" });

check("no 5xx anywhere", server5xx.length === 0, server5xx.join(", "));
await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
