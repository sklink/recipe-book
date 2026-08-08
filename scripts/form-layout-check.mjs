import { chromium } from "playwright";
import { readFileSync } from "node:fs";

/**
 * The edit form is the densest layout in the app — three inputs on one row,
 * next to a sidebar, inside a max-width column. It broke once because a shared
 * input class carried `w-full`, which silently beat the narrower widths the
 * amount and unit fields asked for. This measures the row rather than trusting
 * the class names.
 */
const token = readFileSync("/tmp/rb-formtoken.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

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

// Any recipe with ingredients will do; take the first in the cookbook.
await page.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
const hrefs = await page
  .locator('a[href^="/recipes/"]')
  .evaluateAll((els) =>
    els
      .map((el) => el.getAttribute("href"))
      .filter((h) => !["/recipes/new", "/recipes/import"].includes(h)),
  );
const href = hrefs[0];
if (!href) {
  console.error("  no recipes in the cookbook to edit.");
  process.exit(2);
}
await page.goto(`http://localhost:3000${href}/edit`, { waitUntil: "networkidle" });
await page.locator('[data-testid="ingredient-fields"] li').first().waitFor();
console.log(`  editing ${href}`);

for (const width of [1440, 768, 375]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(200);
  console.log(`\n  ${width}px`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("page doesn't scroll sideways", overflow <= 0, `${overflow}px`);

  // Every field must sit inside its own row, and every row inside the form.
  const escapes = await page.evaluate(() => {
    const form = document.querySelector("form");
    const formBox = form.getBoundingClientRect();
    const out = [];
    for (const row of form.querySelectorAll("li > div, li")) {
      const rowBox = row.getBoundingClientRect();
      if (rowBox.right > formBox.right + 1)
        out.push(`row overflows the form by ${Math.round(rowBox.right - formBox.right)}px`);
      for (const control of row.querySelectorAll(":scope > input, :scope > textarea")) {
        const box = control.getBoundingClientRect();
        if (box.right > rowBox.right + 1)
          out.push(
            `${control.getAttribute("aria-label") ?? control.id} overflows its row by ${Math.round(box.right - rowBox.right)}px`,
          );
        if (box.width < 40)
          out.push(
            `${control.getAttribute("aria-label") ?? control.id} is only ${Math.round(box.width)}px wide`,
          );
      }
    }
    return [...new Set(out)];
  });
  check("no field escapes its row", escapes.length === 0, escapes.slice(0, 3).join("; "));

  // The amount and unit fields exist to be narrow; the name should take the rest.
  const row = await page.evaluate(() => {
    const box = (label) =>
      document.querySelector(`[aria-label="${label} for ingredient 1"]`).getBoundingClientRect();
    return {
      amount: box("Amount").width,
      unit: box("Unit").width,
      name: box("Name").width,
    };
  });
  check(
    "amount and unit stay narrow",
    row.amount < 120 && row.unit < 120,
    `amount ${Math.round(row.amount)} unit ${Math.round(row.unit)}`,
  );
  check(
    "the name field takes the remaining width",
    row.name > row.amount,
    `name ${Math.round(row.name)}`,
  );

  // The save bar sticks to the bottom edge, where the mobile ingredient sheet
  // is fixed over it. It must clear the sheet without reserving space when the
  // sheet isn't there.
  const bar = await page.evaluate(() => {
    const el = [...document.querySelectorAll("form > div")].find((d) =>
      getComputedStyle(d).position.includes("sticky"),
    );
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const sheet = document.querySelector("[data-ingredient-sheet]");
    return {
      sheetPresent: Boolean(sheet),
      gap: Math.round(window.innerHeight - box.bottom),
      clearsSheet: sheet ? box.bottom <= sheet.getBoundingClientRect().top + 1 : true,
    };
  });
  check("the save bar clears the ingredient sheet", bar !== null && bar.clearsSheet);
  check(
    "the save bar reserves no space it doesn't need",
    bar !== null && bar.gap === (bar.sheetPresent ? 52 : 0),
    `sheet ${bar?.sheetPresent ? "shown" : "absent"}, ${bar?.gap}px below`,
  );

  await page.screenshot({ path: `/tmp/shot-form-${width}.png`, fullPage: true });
}

await browser.close();
console.log(fail === 0 ? "\nall good" : `\n${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
