import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-gentoken.txt", "utf8").trim();
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

const chip = (group, label) =>
  page.locator(`[role="radiogroup"][aria-label="${group}"] [role="radio"]`, { hasText: label });
const chosen = (group) =>
  page
    .locator(`[role="radiogroup"][aria-label="${group}"] [role="radio"][aria-checked="true"]`)
    .textContent();

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});
if (page.url().includes("/login")) {
  console.error("  sign-in failed — token already used or expired. Regenerate it.");
  process.exit(2);
}

// --- every group is a chip group, unseeded
await page.goto("http://localhost:3000/generate", { waitUntil: "networkidle" });

const GROUPS = [
  "Meal",
  "Time",
  "Cuisine",
  "Base",
  "Protein",
  "Goes with",
  "Diet",
  "Method",
  "Ambition",
];
const groupNames = await page
  .locator("fieldset [role=radiogroup]")
  .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
for (const group of GROUPS) check(`"${group}" is a chip group`, groupNames.includes(group));

check("no dropdowns left", (await page.locator("fieldset select").count()) === 0);

const chips = page.locator("fieldset [role=radiogroup] [role=radio]");
console.log(`  ${await chips.count()} chips total`);

// Every group leads with Any, and Any is what's selected before you touch it.
const leads = await page.locator("fieldset [role=radiogroup]").evaluateAll((els) =>
  els
    .filter((el) => el.getAttribute("aria-label") !== "Use only ingredients in stock")
    .map((el) => {
      const first = el.querySelector('[role="radio"]');
      const on = el.querySelector('[role="radio"][aria-checked="true"]');
      return {
        group: el.getAttribute("aria-label"),
        leadsWithAny: first.textContent.trim() === "Any",
        anySelected: on === first,
      };
    }),
);
check(
  "every group leads with Any",
  leads.every((g) => g.leadsWithAny),
  leads
    .filter((g) => !g.leadsWithAny)
    .map((g) => g.group)
    .join(", "),
);
check(
  "Any is selected until you choose",
  leads.every((g) => g.anySelected),
  leads
    .filter((g) => !g.anySelected)
    .map((g) => g.group)
    .join(", "),
);

// Icons: present where they mean something, absent where they'd be decoration.
const icons = await page.evaluate(() => {
  const out = {};
  for (const g of document.querySelectorAll("fieldset [role=radiogroup]")) {
    const name = g.getAttribute("aria-label");
    const radios = [...g.querySelectorAll('[role="radio"]')];
    out[name] = radios.filter((r) => r.querySelector("svg")).length / radios.length;
  }
  return out;
});
for (const group of GROUPS.filter((g) => g !== "Cuisine")) {
  check(
    `${group} chips all carry an icon`,
    icons[group] === 1,
    `${Math.round(icons[group] * 100)}%`,
  );
}
check("Cuisine is text-only", icons.Cuisine === 0, `${Math.round(icons.Cuisine * 100)}%`);

check(
  "no reset until something is chosen",
  (await page.getByRole("button", { name: "Reset" }).count()) === 0,
);
check(
  "the bar says nothing is chosen",
  (await page.getByTestId("generate-choices").textContent()) === "Anything at all",
);
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-gen-blank.png", fullPage: true });

// --- the Generate button is reachable without scrolling, from the top and the bottom
for (const where of ["top", "bottom"]) {
  await page.evaluate(
    (w) => window.scrollTo(0, w === "top" ? 0 : document.body.scrollHeight),
    where,
  );
  await page.waitForTimeout(350);
  const visible = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="generate-actions"]');
    const box = bar.getBoundingClientRect();
    return box.bottom <= window.innerHeight + 1 && box.top >= 0;
  });
  check(`Generate is on screen at the ${where} of the page`, visible);
}
await page.evaluate(() => window.scrollTo(0, 0));

// --- the flow still seeds meal and time
await page.goto("http://localhost:3000/generate?mealType=lunch&timeBucket=quick", {
  waitUntil: "networkidle",
});
check("flow seeds Meal", (await chosen("Meal")) === "Lunch");
check("flow seeds Time", (await chosen("Time")) === "Quick");
check(
  "the bar reflects the seed",
  (await page.getByTestId("generate-choices").textContent()) === "Lunch · Quick",
);

// --- chips are selectable and resettable
await chip("Cuisine", "Thai").click();
await chip("Protein", "Tofu").click();
check("selection lands on the chip", (await chosen("Cuisine")) === "Thai");
check(
  "the bar tracks every choice",
  (await page.getByTestId("generate-choices").textContent()) === "Lunch · Quick · Thai · Tofu",
);
await page.locator('[role="radio"]:has-text("Yes")').first().click();
check(
  "stock answer explains itself",
  (await page.textContent("body")).includes("ingredients you have in stock"),
);
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-gen-filled.png", fullPage: true });

await page.getByRole("button", { name: "Reset" }).click();
check("reset returns every group to Any", (await chosen("Cuisine")) === "Any");
check(
  "reset keeps the stock answer",
  (await page
    .locator(
      '[role="radiogroup"][aria-label="Use only ingredients in stock"] [aria-checked="true"]',
    )
    .textContent()) === "Yes",
);

// --- one real generation, constrained
await page.locator('[role="radio"]:has-text("No")').first().click();
await chip("Cuisine", "Japanese").click();
await chip("Base", "Rice").click();
await chip("Protein", "No protein").click();
await chip("Meal", "Dinner").click();
await chip("Diet", "Vegan").click();

const request = page.waitForRequest((r) => r.url().includes("/api/generate"));
await page.getByRole("button", { name: "Generate a recipe" }).click();
const body = JSON.parse((await request).postData() ?? "{}");
check(
  "the chosen options are sent to the API",
  body.options?.cuisine === "japanese" &&
    body.options?.base === "rice" &&
    body.options?.protein === "none" &&
    body.options?.diet === "vegan" &&
    body.mealType === "dinner",
  JSON.stringify(body.options),
);
check("the chips disable while thinking", (await page.locator("fieldset[disabled]").count()) === 1);

await page.getByRole("button", { name: "Keep" }).waitFor({ timeout: 180_000 });
const summary = await page.getByTestId("generate-summary").textContent();
check(
  "the result says what was asked for",
  summary.includes("Japanese") && summary.includes("Vegan") && summary.includes("Dinner"),
  summary,
);
console.log(`\n  generated: ${(await page.locator("h2, h3").first().textContent()).trim()}`);
check(
  "try again is offered",
  (await page.getByRole("button", { name: "Try again" }).count()) === 1,
);
await page.screenshot({ path: "/tmp/shot-gen-result.png", fullPage: true });

// --- mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.goto("http://localhost:3000/generate", { waitUntil: "networkidle" });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("no horizontal overflow at 375px", overflow <= 0, `${overflow}px`);

const tooShort = await chips.evaluateAll(
  (els) => els.filter((el) => el.getBoundingClientRect().height < 44).length,
);
check("every chip meets the 44px tap target", tooShort === 0, `${tooShort} too short`);

// The bar must clear the sheet when it's there, and not reserve space when it
// isn't — a gap under the button reads as a layout bug.
const bottomEdge = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="generate-actions"]').getBoundingClientRect();
  const sheet = document.querySelector("[data-ingredient-sheet]");
  return {
    sheetPresent: Boolean(sheet),
    gap: Math.round(window.innerHeight - bar.bottom),
    clearsSheet: sheet ? bar.bottom <= sheet.getBoundingClientRect().top + 1 : true,
  };
});
check("the action bar clears the ingredient sheet", bottomEdge.clearsSheet);
check(
  bottomEdge.sheetPresent
    ? "the bar sits exactly on the sheet, no dead space"
    : "no sheet, so the bar sits on the bottom edge",
  bottomEdge.sheetPresent ? bottomEdge.gap === 52 : bottomEdge.gap === 0,
  `${bottomEdge.gap}px below the bar`,
);
await page.screenshot({ path: "/tmp/shot-gen-mobile.png", fullPage: true });

check("no 5xx responses", server5xx.length === 0, server5xx.join(", "));

await browser.close();
console.log(fail === 0 ? "\nall good" : `\n${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
