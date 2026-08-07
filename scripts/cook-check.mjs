import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-cooktoken.txt", "utf8").trim();
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
const api = (path, init) =>
  page.evaluate(
    async ([p, i]) => {
      const r = await fetch(
        p,
        i
          ? { ...i, headers: i.body ? { "Content-Type": "application/json" } : undefined }
          : undefined,
      );
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    [path, init],
  );

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});
if (page.url().includes("/login")) {
  console.error("  sign-in failed");
  process.exit(2);
}

const all = (await api("/api/recipes")).body.recipes;
const target = all.find((r) => r.title === "Shakshuka");

// This test writes cook logs, so it has to start from a clean slate — otherwise
// a second run begins part-way up the mastery ladder.
const before = (await api(`/api/recipes/${target.id}`)).body;
for (const log of before.cookLogs) {
  await page.evaluate((id) => fetch(`/api/cook-logs?id=${id}`, { method: "DELETE" }), log.id);
}
await api("/api/cook-logs", {
  method: "PATCH",
  body: JSON.stringify({ recipeId: target.id, masteryOverride: null }),
});
if (before.cookLogs.length)
  console.log(`  (cleared ${before.cookLogs.length} log entries from a previous run)`);
const fresh = (await api("/api/recipes")).body.recipes.find((r) => r.title === "Shakshuka");
Object.assign(target, fresh);
check("recipes carry mastery", Boolean(target?.mastery), JSON.stringify(target?.mastery?.level));
check("untried before any cook", target.mastery.level === "untried", target.mastery.level);

// --- derived mastery climbs with logged cooks
const log = (outcome) =>
  api("/api/cook-logs", { method: "POST", body: JSON.stringify({ recipeId: target.id, outcome }) });
const levelNow = async () => (await api(`/api/recipes/${target.id}`)).body.mastery.level;

await log("rough");
check("one rough -> attempted", (await levelNow()) === "attempted");
await log("good");
check("then good -> learning", (await levelNow()) === "learning");
await log("good");
check("two consecutive good -> reliable", (await levelNow()) === "reliable");
await log("nailed");
check("three consecutive -> mastered", (await levelNow()) === "mastered");
await log("flopped");
check("a flop demotes -> learning", (await levelNow()) === "learning", "streak broken");

// --- override wins
await api("/api/cook-logs", {
  method: "PATCH",
  body: JSON.stringify({ recipeId: target.id, masteryOverride: "mastered" }),
});
let detail = (await api(`/api/recipes/${target.id}`)).body;
check(
  "manual override wins over derived",
  detail.mastery.level === "mastered" && detail.mastery.manual === true,
);
await api("/api/cook-logs", {
  method: "PATCH",
  body: JSON.stringify({ recipeId: target.id, masteryOverride: null }),
});
check("clearing override returns to derived", (await levelNow()) === "learning");

// --- history surfaces on the detail page
await page.goto(`http://localhost:3000/recipes/${target.id}`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="cook-log"]', { timeout: 15000 });
check(
  "cook history listed",
  (await page.locator('[data-testid="cook-log"] li').count()) === 5,
  `${await page.locator('[data-testid="cook-log"] li').count()} entries`,
);
check("mastery badge shown", (await page.locator("text=/Learning/").count()) > 0);

// --- cook mode
await page.locator('button:has-text("Cook this")').click();
await page.waitForSelector('[data-testid="cook-step"]', { timeout: 10000 });
check("cook mode opens on step 1", (await page.textContent("body")).includes("Step 1 of 5"));
const firstStep = await page.textContent('[data-testid="cook-step"]');
await page.locator('button:has-text("Next")').click();
await page.waitForFunction(() => document.body.textContent.includes("Step 2 of"), null, {
  timeout: 5000,
});
check("advances a step", (await page.textContent('[data-testid="cook-step"]')) !== firstStep);
await page.keyboard.press("ArrowLeft");
await page.waitForFunction(() => document.body.textContent.includes("Step 1 of"), null, {
  timeout: 5000,
});
check("arrow keys navigate", (await page.textContent("body")).includes("Step 1 of"));
await page.locator('button[aria-label="Ingredients"]').click();
check(
  "ingredients visible without leaving the step",
  (await page.textContent("body")).includes("cumin"),
);

// step through to the end
for (let i = 0; i < 5; i++) {
  const nextBtn = page.locator('button:has-text("Next")');
  if ((await nextBtn.count()) === 0) break;
  await nextBtn.click();
  await page.waitForTimeout(120);
}
check(
  "reaches the last step",
  (await page.locator('button:has-text("Finished cooking")').count()) === 1,
);
await page.locator('button:has-text("Finished cooking")').click();
await page.waitForSelector("text=/How did it go/", { timeout: 5000 });
check("finishing prompts for an outcome", true);
await page.locator('button:has-text("Nailed it")').click();
await page.locator('button:has-text("Log it")').click();
await page.waitForSelector("text=/Logged/", { timeout: 10000 });
check(
  "logging from cook mode works",
  (await levelNow()) === "learning",
  "good after flop = learning",
);

// --- T31 filter chips
await page.goto("http://localhost:3000/recipes?mastery=new", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="recipe-grid"]', { timeout: 15000 });
const newCount = await page.locator('[data-testid="recipe-grid"] article').count();
check(
  "'New to me' excludes the cooked one",
  newCount === all.length - 1,
  `${newCount} of ${all.length}`,
);
await page.goto("http://localhost:3000/recipes?mastery=known", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const knownCount = await page.locator('[data-testid="recipe-grid"] article').count();
check(
  "'Know it' filters to reliable+",
  knownCount === 0,
  `${knownCount} (Shakshuka is only Learning)`,
);

check("no 5xx anywhere", server5xx.length === 0, server5xx.join(", "));
console.log("  CLEANUP_RECIPE=" + target.id);
await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
