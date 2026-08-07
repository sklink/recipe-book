import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const token = readFileSync("/tmp/rb-polishtoken.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
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
  console.error("  sign-in failed");
  process.exit(2);
}

// --- T28 usage dashboard
await page.goto("http://localhost:3000/usage", { waitUntil: "networkidle" });
const body = await page.textContent("body");
check("usage page renders", body.includes("AI usage"));
check("shows today's spend", /Today/.test(body));
check(
  "shows the daily cap",
  /of 50 calls/.test(body),
  (body.match(/\d+ of 50 calls \(\d+%\)/) ?? [])[0],
);
check(
  "lists recent calls",
  (await page.locator("table tbody tr").count()) > 0,
  `${await page.locator("table tbody tr").count()} rows`,
);
const costs = await page.locator("table tbody tr td:last-child").allTextContents();
const zeroCosts = costs.filter((c) => c.trim() === "0.0¢").length;
check("no call is reported as costing nothing", zeroCosts === 0, costs.join(" "));
await page.screenshot({ path: "/tmp/shot-usage.png" });

// --- T27 PWA
const manifest = await page.evaluate(async () => {
  const r = await fetch("/manifest.webmanifest");
  return { status: r.status, body: await r.json().catch(() => null) };
});
check("manifest served", manifest.status === 200 && manifest.body?.name === "Recipe Book");
check("manifest is standalone", manifest.body?.display === "standalone");
check("icons declared", (manifest.body?.icons ?? []).length >= 2);
check(
  "maskable icon present",
  (manifest.body?.icons ?? []).some((i) => i.purpose === "maskable"),
);
for (const icon of ["/icon-192.png", "/icon-512.png", "/apple-icon.png"]) {
  const r = await page.evaluate(async (u) => (await fetch(u)).status, icon);
  check(`${icon} served`, r === 200);
}
check("manifest linked from the page", (await page.locator('link[rel="manifest"]').count()) === 1);

// --- T26 error and offline states
await page.goto("http://localhost:3000/recipes/00000000-0000-0000-0000-000000000000", {
  waitUntil: "domcontentloaded",
});
check(
  "not-found page shown for a missing recipe",
  (await page.textContent("body")).includes("doesn't exist") ||
    (await page.textContent("body")).includes("Not found"),
);

await page.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="recipe-grid"]');
await ctx.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event("offline")));
await page.waitForFunction(() => /Offline/.test(document.body.textContent), null, {
  timeout: 5000,
});
check("offline banner appears", (await page.textContent("body")).includes("saved cookbook"));
await ctx.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForFunction(() => !/Offline —/.test(document.body.textContent), null, {
  timeout: 5000,
});
check("banner clears when back online", !(await page.textContent("body")).includes("Offline —"));

// --- nav still fits with a sixth item
const mob = await browser.newContext({
  viewport: { width: 375, height: 800 },
  storageState: await ctx.storageState(),
});
const mp = await mob.newPage();
await mp.goto("http://localhost:3000/recipes", { waitUntil: "networkidle" });
const m = await mp.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check("no overflow at 375 with 6 nav items", m.sw <= m.cw, `${m.sw}/${m.cw}`);
await mp.screenshot({ path: "/tmp/shot-nav6.png" });

await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
