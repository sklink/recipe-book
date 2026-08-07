import { chromium } from "playwright";
import { readFileSync } from "node:fs";

// Sign in first — every API route requires a session.
const token = readFileSync("/tmp/rb-apitoken.txt", "utf8").trim();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:3000/auth/callback?token_hash=${token}&type=magiclink`, {
  waitUntil: "networkidle",
});
if (page.url().includes("/login")) {
  console.error("  sign-in failed:", page.url());
  process.exit(1);
}

let fail = 0;
const get = (path) =>
  page.evaluate(async (p) => {
    const r = await fetch(p);
    return { status: r.status, body: await r.json().catch(() => null) };
  }, path);

const check = (desc, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${desc}${extra ? `  ${extra}` : ""}`);
};

// --- unfiltered list
let r = await get("/api/recipes");
check("GET /api/recipes -> 200", r.status === 200);
const all = r.body.recipes;
check("returns 23 base recipes", all.length === 23, `got ${all.length}`);
check(
  "every recipe has a derived bucket",
  all.every((x) => x.timeBucket),
);
check(
  "variants excluded by default",
  all.every((x) => x.parentRecipeId === null),
);

// --- meal type filter
r = await get("/api/recipes?mealType=breakfast");
const bf = r.body.recipes;
check(
  "mealType=breakfast filters",
  bf.length > 0 && bf.every((x) => x.mealTypes.includes("breakfast")),
  `${bf.length} recipes`,
);

// --- time bucket boundaries
for (const [bucket, test] of [
  ["quick", (m) => m <= 15],
  ["average", (m) => m > 15 && m <= 40],
  ["commitment", (m) => m > 40],
]) {
  const res = await get(`/api/recipes?timeBucket=${bucket}`);
  const list = res.body.recipes;
  check(
    `timeBucket=${bucket} respects boundaries`,
    list.length > 0 && list.every((x) => test(x.timeMinutes)),
    `${list.length} recipes`,
  );
}

// --- combined
r = await get("/api/recipes?mealType=dinner&timeBucket=commitment");
check(
  "combined filters compose",
  r.body.recipes.every((x) => x.mealTypes.includes("dinner") && x.timeMinutes > 40),
  `${r.body.recipes.length} recipes`,
);

// --- search
r = await get("/api/recipes?search=shak");
check(
  "search matches case-insensitively",
  r.body.recipes.some((x) => x.title === "Shakshuka"),
);

// --- unknown values ignored, not rejected
r = await get("/api/recipes?mealType=brunch&timeBucket=eternal");
check(
  "unknown filter values ignored",
  r.status === 200 && r.body.recipes.length === 23,
  `got ${r.body.recipes.length}`,
);

// --- requireIngredients with an empty kitchen
r = await get("/api/recipes?requireIngredients=true");
check("requireIngredients returns none (empty kitchen)", r.body.recipes.length === 0);
check(
  "...but offers near misses instead of a dead end",
  (r.body.nearMisses ?? []).length > 0,
  `${(r.body.nearMisses ?? []).length} shown`,
);
const nm = r.body.nearMisses ?? [];
check(
  "near misses sorted by fewest missing",
  nm.every((x, i) => i === 0 || nm[i - 1].missingCount <= x.missingCount),
  nm.map((x) => x.missingCount).join(","),
);

// --- detail
const target = all.find((x) => x.title === "Shakshuka");
r = await get(`/api/recipes/${target.id}`);
check("GET /api/recipes/:id -> 200", r.status === 200);
check(
  "detail carries ordered instructions",
  r.body.instructions.length === 5 && r.body.instructions[0].step === 1,
);
check(
  "detail carries ingredients in sort order",
  r.body.ingredients.length === 14 &&
    r.body.ingredients.every(
      (x, i) => i === 0 || r.body.ingredients[i - 1].sortOrder <= x.sortOrder,
    ),
  `${r.body.ingredients.length} ingredients`,
);
check(
  "staples flagged on ingredients",
  r.body.ingredients.some((x) => x.isStaple),
);
check(
  "optional flagged on ingredients",
  r.body.ingredients.some((x) => x.isOptional),
);

// --- 404s
r = await get("/api/recipes/not-a-uuid");
check("malformed id -> 404", r.status === 404);
r = await get("/api/recipes/00000000-0000-0000-0000-000000000000");
check("unknown uuid -> 404", r.status === 404);

await browser.close();
console.log(fail === 0 ? "\nAll passed." : `\n${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
