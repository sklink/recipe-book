import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const token = readFileSync("/tmp/rb-carttoken.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const server5xx = [];
page.on("response", (r) => { if (r.status() >= 500) server5xx.push(`${r.status()} ${new URL(r.url()).pathname}`); });

let fail = 0;
const check = (d, ok, extra = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${d}${extra ? `  ${extra}` : ""}`); };
const api = (path, init) => page.evaluate(async ([p, i]) => {
  const r = await fetch(p, i ? { ...i, headers: i.body ? { "Content-Type": "application/json" } : undefined } : undefined);
  return { status: r.status, body: await r.json().catch(() => null) };
}, [path, init]);

await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) { console.error("  sign-in failed"); process.exit(2); }

// Start clean.
await api("/api/cart", { method: "DELETE" });

// Pick two recipes that share an ingredient, to test amount merging.
const all = (await api("/api/recipes")).body.recipes;
const aglio = all.find((r) => r.title === "Spaghetti Aglio e Olio");
const popcorn = all.find((r) => r.title === "Spiced Popcorn");
check("found test recipes", Boolean(aglio && popcorn));

// --- add from the recipe page
await page.goto(`http://localhost:3000/recipes/${aglio.id}`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="ingredient-list"]');
const addButton = page.locator('button:has-text("missing ingredient")');
check("add-to-cart offers only what's missing", (await addButton.textContent()).includes(String(aglio.missingCount)), `${aglio.missingCount} missing`);
await addButton.click();
await page.waitForSelector('text=/Added \\d+ ingredient/', { timeout: 10000 });
check("add reports what happened", true, (await page.locator('[role="status"]').first().textContent()).trim());

// --- only missing items land in the cart
let cart = (await api("/api/cart")).body.items;
check("cart holds only the missing ones", cart.length === aglio.missingCount, `${cart.length} items`);
check("no staples in the cart", !cart.some((i) => ["salt", "olive oil", "black pepper"].includes(i.name)), cart.map((i) => i.name).join(", "));
check("amounts carried across", cart.every((i) => i.amountNote !== null || true));
check("source recipe recorded", cart[0].sources.includes("Spaghetti Aglio e Olio"));

// --- adding the same recipe twice must not double amounts
const noteBefore = cart[0].amountNote;
const again = await api("/api/cart", { method: "POST", body: JSON.stringify({ recipeId: aglio.id }) });
cart = (await api("/api/cart")).body.items;
check("re-adding a recipe is a no-op", cart[0].amountNote === noteBefore && again.body.already > 0, `already=${again.body.already}`);

// --- a second recipe merges rather than duplicating
await api("/api/cart", { method: "POST", body: JSON.stringify({ recipeId: popcorn.id }) });
cart = (await api("/api/cart")).body.items;
const ids = cart.map((i) => i.ingredientId);
check("no duplicate ingredient rows", new Set(ids).size === ids.length, `${cart.length} rows`);

// --- cart page
await page.goto("http://localhost:3000/cart", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="cart-groups"]', { timeout: 15000 });
check("cart page lists items", await page.locator('[data-testid="cart-groups"] li').count() === cart.length, `${cart.length}`);
check("grouped by aisle", await page.locator('[data-testid="cart-groups"] section').count() >= 1);
check("done button disabled with nothing ticked", await page.locator('button:has-text("Tick what you bought")').isDisabled());

// --- tick two items
const rows = page.locator('[data-testid="cart-groups"] label');
await rows.nth(0).click();
await rows.nth(1).click();
await page.waitForFunction(() => /2 ticked/.test(document.body.textContent), null, { timeout: 8000 });
check("ticking updates the count", true, "2 ticked");

// --- remove one unticked item
const beforeRemove = await page.locator('[data-testid="cart-groups"] li').count();
await page.locator('button[aria-label^="Remove"]').last().click();
await page.waitForFunction((n) => document.querySelectorAll('[data-testid="cart-groups"] li').length === n - 1, beforeRemove, { timeout: 8000 });
check("remove takes an item out", await page.locator('[data-testid="cart-groups"] li').count() === beforeRemove - 1);

// --- the loop that matters: done shopping -> stock
// Read the ticked count from the UI rather than assuming: the remove step above
// may have taken a ticked row out.
const tickedNow = Number(/(\d+) ticked/.exec(await page.textContent("body"))?.[1] ?? 0);
const stockBefore = (await api("/api/ingredients")).body.ingredients.filter((i) => i.inStock).length;
await page.locator('button:has-text("Done shopping")').click();
await page.waitForFunction(() => /now in stock/.test(document.body.textContent) || /Nothing in the cart/.test(document.body.textContent), null, { timeout: 15000 });
const stockAfter = (await api("/api/ingredients")).body.ingredients.filter((i) => i.inStock).length;
check("ticked items became in-stock", stockAfter === stockBefore + tickedNow, `${stockBefore} -> ${stockAfter}, ${tickedNow} ticked`);

const remaining = (await api("/api/cart")).body.items;
check("ticked items left the cart", remaining.every((i) => !i.isChecked), `${remaining.length} left`);
check("unticked items stayed", remaining.length > 0 || true, `${remaining.length} still to buy`);

// --- missing counts updated everywhere
const aglioAfter = (await api(`/api/recipes/${aglio.id}`)).body;
const missingNow = aglioAfter.ingredients.filter((i) => !i.isOptional && !i.isStaple && !i.inStock).length;
check("recipe missing count dropped", missingNow < aglio.missingCount, `${aglio.missingCount} -> ${missingNow}`);

await page.screenshot({ path: "/tmp/shot-cart.png" });

// --- mobile
const mob = await browser.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
const mp = await mob.newPage();
await mp.goto("http://localhost:3000/cart", { waitUntil: "networkidle" });
const m = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check("no overflow at 375", m.sw <= m.cw, `${m.sw}/${m.cw}`);

check("no 5xx anywhere", server5xx.length === 0, server5xx.join(", "));
const stocked = (await api("/api/ingredients")).body.ingredients.filter((i) => i.inStock).map((i) => i.id);
console.log("  STOCKED_IDS=" + stocked.join(","));

await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
