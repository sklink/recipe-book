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

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});
if (page.url().includes("/login")) {
  console.error("  sign-in failed — token already used or expired. Regenerate it.");
  process.exit(2);
}

// --- controls render, unseeded
await page.goto("http://localhost:3000/generate", { waitUntil: "networkidle" });
const selects = page.locator("fieldset select");
check("nine selects render", (await selects.count()) === 9, `got ${await selects.count()}`);

// The whole point of the split: the button sits above the finer detail, so it
// isn't stranded below nine stacked selects on a phone.
const order = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) =>
    b.textContent.includes("Generate a recipe"),
  );
  const diet = document.querySelector("#gen-diet");
  const protein = document.querySelector("#gen-protein");
  return {
    afterProtein: protein.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    beforeDiet: diet.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_PRECEDING,
  };
});
check("Generate sits below the main parameters", Boolean(order.afterProtein));
check("Generate sits above the finer detail", Boolean(order.beforeDiet));

const labels = await page.locator("fieldset label").allTextContents();
for (const expected of [
  "Meal",
  "Time",
  "Cuisine",
  "Base",
  "Protein",
  "Goes with",
  "Diet",
  "Method",
  "Ambition",
]) {
  check(`"${expected}" is offered`, labels.includes(expected));
}

const allLeadWithAny = await selects.evaluateAll((els) =>
  els.every((el) => el.options[0].value === "any" && el.value === "any"),
);
check("every axis leads with Any and defaults to it", allLeadWithAny);

check(
  "stock question defaults to No",
  (await page.locator('[role="radio"][aria-checked="true"]').textContent()) === "No",
);
check("no reset button while nothing is chosen", (await page.getByText(/^Reset /).count()) === 0);
await page.waitForTimeout(300); // let colour transitions settle before shooting
await page.screenshot({ path: "/tmp/shot-gen-blank.png", fullPage: true });

// --- the flow still seeds meal and time
await page.goto("http://localhost:3000/generate?mealType=lunch&timeBucket=quick", {
  waitUntil: "networkidle",
});
check("flow seeds Meal", (await page.locator("#gen-meal").inputValue()) === "lunch");
check("flow seeds Time", (await page.locator("#gen-time").inputValue()) === "quick");
check("seeded choices are counted", (await page.getByText("Reset 2 choices").count()) === 1);

// --- choices are editable and resettable
await page.locator("#gen-cuisine").selectOption("thai");
await page.locator("#gen-protein").selectOption("tofu");
check("choices accumulate", (await page.getByText("Reset 4 choices").count()) === 1);
await page.locator('[role="radio"]:has-text("Yes")').click();
check(
  "stock answer explains itself",
  (await page.textContent("body")).includes("ingredients you have in stock"),
);
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/shot-gen-filled.png", fullPage: true });

await page.getByText("Reset 4 choices").click();
check("reset clears the axes", (await page.locator("#gen-cuisine").inputValue()) === "any");
check(
  "reset keeps the stock answer",
  (await page.locator('[role="radio"][aria-checked="true"]').textContent()) === "Yes",
);

// --- one real generation, constrained
await page.locator('[role="radio"]:has-text("No")').click();
await page.locator("#gen-cuisine").selectOption("japanese");
await page.locator("#gen-base").selectOption("rice");
await page.locator("#gen-protein").selectOption("none");
await page.locator("#gen-meal").selectOption("dinner");
await page.locator("#gen-diet").selectOption("vegan");

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
check(
  "both control groups disable while thinking",
  (await page.locator("fieldset[disabled]").count()) === 2,
);

await page.getByRole("button", { name: "Keep" }).waitFor({ timeout: 180_000 });
const summary = await page.getByTestId("generate-summary").textContent();
check(
  "the result says what was asked for",
  summary.includes("Japanese") && summary.includes("Vegan") && summary.includes("Dinner"),
  summary,
);
const card = await page.locator("article, [data-testid=generated-card]").first().textContent();
console.log(`\n  generated: ${(await page.locator("h2, h3").first().textContent()).trim()}`);
check("the recipe is on screen with ingredients", card.length > 200);
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
const tooShort = await page
  .locator("fieldset select, fieldset [role=radio]")
  .evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height < 44).length);
check("every control meets the 44px tap target", tooShort === 0, `${tooShort} too short`);
await page.screenshot({ path: "/tmp/shot-gen-mobile.png", fullPage: true });

check("no 5xx responses", server5xx.length === 0, server5xx.join(", "));

await browser.close();
console.log(fail === 0 ? "\nall good" : `\n${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
