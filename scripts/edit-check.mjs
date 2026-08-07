import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-edittoken.txt", "utf8").trim();
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

const ingredientsBefore = (await api("/api/ingredients")).body.ingredients.length;
// Relative, not absolute: the cookbook is a live database with real recipes in it.
const recipesBefore = (await api("/api/recipes")).body.recipes.length;

// --- create by hand
await page.goto("http://localhost:3000/recipes/new", { waitUntil: "networkidle" });
await page.fill("#title", "Test Kitchen Scratch Dish");
await page.fill("#description", "Created by the edit test.");
await page.locator('button:has-text("Dinner")').first().click();
await page.fill("#time", "22");
await page.fill("#servings", "3");
await page.fill('input[aria-label="Amount for ingredient 1"]', "2");
await page.fill('input[aria-label="Unit for ingredient 1"]', "tbsp");
// An existing canonical name, to prove the resolver reuses rather than duplicates.
await page.fill('input[aria-label="Name for ingredient 1"]', "olive oil");
await page.locator('button:has-text("Add ingredient")').click();
await page.fill('input[aria-label="Name for ingredient 2"]', "garlic");
await page.fill('textarea[aria-label="Step 1"]', "Heat the oil gently.");
await page.locator('button:has-text("Add step")').click();
await page.fill('textarea[aria-label="Step 2"]', "Add the garlic and cook one minute.");
await page.locator('button:has-text("Create recipe")').click();
await page.waitForURL((u) => /\/recipes\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 20000 });
const createdId = page.url().split("/").pop();
check("created and redirected to the recipe", Boolean(createdId));

let detail = (await api(`/api/recipes/${createdId}`)).body;
check("title saved", detail.title === "Test Kitchen Scratch Dish");
check("time and servings saved", detail.timeMinutes === 22 && detail.servings === 3);
check("meal type saved", detail.mealTypes.includes("dinner"));
check(
  "two ingredients linked",
  detail.ingredients.length === 2,
  detail.ingredients.map((i) => i.name).join(", "),
);
check("two steps saved", detail.instructions.length === 2);
check(
  "amount and unit saved",
  detail.ingredients[0].amount === 2 && detail.ingredients[0].unit === "tbsp",
);

const ingredientsAfter = (await api("/api/ingredients")).body.ingredients.length;
check(
  "existing ingredients reused, not duplicated",
  ingredientsAfter === ingredientsBefore,
  `${ingredientsBefore} -> ${ingredientsAfter}`,
);
check(
  "olive oil kept its staple flag",
  detail.ingredients.find((i) => i.name === "olive oil")?.isStaple === true,
);

// --- edit
await page.goto(`http://localhost:3000/recipes/${createdId}/edit`, { waitUntil: "networkidle" });
await page.waitForSelector("#title", { timeout: 15000 });
check(
  "form pre-filled from the recipe",
  (await page.inputValue("#title")) === "Test Kitchen Scratch Dish",
);
check(
  "ingredients pre-filled",
  (await page.inputValue('input[aria-label="Name for ingredient 1"]')) === "olive oil",
);

await page.fill("#title", "Test Kitchen Scratch Dish (edited)");
await page.fill("#time", "35");
// Reorder the steps.
await page.locator('button[aria-label="Move step 2 up"]').click();
await page.locator('button:has-text("Save changes")').click();
await page.waitForURL((u) => u.pathname === `/recipes/${createdId}`, { timeout: 20000 });

detail = (await api(`/api/recipes/${createdId}`)).body;
check("title updated", detail.title === "Test Kitchen Scratch Dish (edited)");
check("time updated", detail.timeMinutes === 35, `${detail.timeMinutes} min`);
check(
  "steps reordered",
  detail.instructions[0].text.startsWith("Add the garlic"),
  detail.instructions[0].text.slice(0, 30),
);
check("step numbers renumbered", detail.instructions.map((s) => s.step).join(",") === "1,2");

// --- removing an ingredient
await page.goto(`http://localhost:3000/recipes/${createdId}/edit`, { waitUntil: "networkidle" });
await page.waitForSelector("#title");
await page.locator('button[aria-label="Remove ingredient 2"]').click();
await page.locator('button:has-text("Save changes")').click();
await page.waitForURL((u) => u.pathname === `/recipes/${createdId}`, { timeout: 20000 });
detail = (await api(`/api/recipes/${createdId}`)).body;
check(
  "ingredient removed",
  detail.ingredients.length === 1,
  detail.ingredients.map((i) => i.name).join(", "),
);

// --- validation is enforced server-side too
const bad = await api("/api/recipes", {
  method: "POST",
  body: JSON.stringify({
    title: "",
    mealTypes: [],
    timeMinutes: 0,
    servings: null,
    ingredients: [],
    steps: [],
  }),
});
check("server rejects an invalid recipe", bad.status === 400, bad.body?.error);

// --- delete, with confirmation
await page.goto(`http://localhost:3000/recipes/${createdId}/edit`, { waitUntil: "networkidle" });
await page.waitForSelector("#title");
await page.locator('button:has-text("Delete")').first().click();
await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
check(
  "delete asks first",
  (await page.textContent('[role="alertdialog"]')).includes("can't be undone"),
);
await page.locator('button:has-text("Keep it")').click();
check("cancelling keeps the recipe", (await api(`/api/recipes/${createdId}`)).status === 200);

await page.locator('button:has-text("Delete")').first().click();
await page.waitForSelector('[role="alertdialog"]');
await page.locator('button:has-text("Delete permanently")').click();
await page.waitForURL((u) => u.pathname === "/recipes", { timeout: 20000 });
check("deleted", (await api(`/api/recipes/${createdId}`)).status === 404);

const finalCount = (await api("/api/recipes")).body.recipes.length;
check(
  "cookbook back to its original size",
  finalCount === recipesBefore,
  `${finalCount} recipes, started at ${recipesBefore}`,
);

check("no 5xx anywhere", server5xx.length === 0, server5xx.join(", "));
await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
