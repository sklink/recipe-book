import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const WIDTHS = [
  { name: "375 (iPhone SE)", width: 375, height: 812 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "1440 (desktop)", width: 1440, height: 900 },
];
const ROUTES = ["/", "/flow", "/recipes", "/generate", "/ingredients", "/cart", "/login"];

const browser = await chromium.launch();
let failures = 0;

for (const vp of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();
  console.log(`\n=== ${vp.name} ===`);

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });

    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      navCount: document.querySelectorAll('nav[aria-label="Main"] a').length,
      sidebar: !!document.querySelector('aside[aria-label="Ingredients"]'),
      sidebarVisible: (() => {
        const el = document.querySelector('aside[aria-label="Ingredients"]');
        if (!el) return false;
        return el.getBoundingClientRect().width > 0;
      })(),
      // Any interactive element under 44px on a touch target is a fail.
      smallTargets: [...document.querySelectorAll("a, button")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || "").trim().slice(0, 20)}`),
    }));

    const overflow = m.scrollW > m.clientW;
    const status = overflow ? "OVERFLOW" : "ok";
    if (overflow) failures++;
    if (m.smallTargets.length) failures++;

    console.log(
      `  ${route.padEnd(13)} ${status.padEnd(9)} ` +
        `scroll=${m.scrollW}/${m.clientW} nav=${m.navCount} ` +
        `sidebar=${m.sidebarVisible ? "visible" : m.sidebar ? "hidden" : "absent"}` +
        (m.smallTargets.length ? `\n      SMALL TARGETS: ${m.smallTargets.join(", ")}` : ""),
    );
  }
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
