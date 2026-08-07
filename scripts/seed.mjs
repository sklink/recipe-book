/**
 * Seeds the cookbook. Re-runnable.
 *
 *   npm run seed            upsert ingredients and aliases; skip recipes that exist
 *   npm run seed -- --force replace seeded recipes (and their ingredient links)
 *
 * Ingredients are never deleted — cart items and other recipes may reference
 * them, and the stock state on them is yours, not the seed's.
 *
 * Talks to PostgREST over fetch rather than through @supabase/supabase-js: that
 * client constructs a realtime connection on import, which needs a native
 * WebSocket and therefore Node 22+. The seed needs neither.
 *
 * Uses the service role key — this writes reference data outside any user
 * session, so RLS would otherwise block it.
 */

import { readFileSync } from "node:fs";

import { ALIASES, INGREDIENT_CATEGORIES, RECIPES, STAPLES } from "./seed-data.mjs";

// --- env -------------------------------------------------------------------

try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // Fall through to whatever is already in the environment.
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const force = process.argv.includes("--force");
const REST = `${URL_BASE}/rest/v1`;

// --- PostgREST helpers -----------------------------------------------------

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`\n${method} ${path} -> ${res.status}\n${text}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

const select = (path) => rest(path);
const insert = (table, rows, returning = false) =>
  rest(`/${table}`, {
    method: "POST",
    body: rows,
    prefer: returning ? "return=representation" : "return=minimal",
  });
const upsert = (table, rows, conflict) =>
  rest(`/${table}?on_conflict=${conflict}`, {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
const remove = (path) => rest(path, { method: "DELETE" });

// --- ingredients -----------------------------------------------------------

function collectIngredientNames() {
  const names = new Set(Object.keys(INGREDIENT_CATEGORIES));
  for (const s of STAPLES) names.add(s);
  for (const r of RECIPES) for (const [name] of r.i) names.add(name);
  return [...names].sort();
}

async function seedIngredients() {
  const names = collectIngredientNames();
  const rows = names.map((name) => ({
    name,
    category: INGREDIENT_CATEGORIES[name] ?? "other",
    is_staple: STAPLES.includes(name),
  }));

  await upsert("ingredients", rows, "name");

  const all = await select("/ingredients?select=id,name");
  // citext matched case-insensitively in the DB; key the map the same way.
  const byName = new Map(all.map((r) => [r.name.toLowerCase(), r.id]));

  const uncategorised = rows.filter((r) => r.category === "other").map((r) => r.name);
  console.log(`  ingredients: ${rows.length} upserted (${STAPLES.length} staples)`);
  if (uncategorised.length) {
    console.log(`    ! uncategorised: ${uncategorised.join(", ")}`);
  }
  return byName;
}

async function seedAliases(byName) {
  const rows = [];
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const id = byName.get(canonical.toLowerCase());
    if (!id) {
      console.warn(`    ! alias target "${canonical}" is not a seeded ingredient — skipped`);
      continue;
    }
    for (const alias of aliases) rows.push({ ingredient_id: id, alias });
  }
  await upsert("ingredient_aliases", rows, "alias");
  console.log(`  aliases: ${rows.length} upserted`);
}

// --- recipes ---------------------------------------------------------------

async function seedRecipes(byName) {
  const existing = await select("/recipes?select=id,title");
  const existingByTitle = new Map(existing.map((r) => [r.title, r.id]));

  let inserted = 0;
  let replaced = 0;
  let skipped = 0;

  for (const recipe of RECIPES) {
    const priorId = existingByTitle.get(recipe.title);

    if (priorId && !force) {
      skipped++;
      continue;
    }
    if (priorId) {
      // Cascades to recipe_ingredients — and cook_logs, hence --force only.
      await remove(`/recipes?id=eq.${priorId}`);
      replaced++;
    } else {
      inserted++;
    }

    const [created] = await insert(
      "recipes",
      [
        {
          title: recipe.title,
          description: recipe.description,
          meal_types: recipe.meal_types,
          time_minutes: recipe.time_minutes,
          servings: recipe.servings,
          instructions: recipe.steps.map((text, idx) => ({ step: idx + 1, text })),
          source: "manual",
          image_status: "pending",
        },
      ],
      true,
    );

    const links = recipe.i.map(([name, amount, unit, prep, optional], idx) => {
      const ingredientId = byName.get(name.toLowerCase());
      if (!ingredientId) {
        console.error(`\nUnknown ingredient "${name}" in "${recipe.title}"`);
        process.exit(1);
      }
      return {
        recipe_id: created.id,
        ingredient_id: ingredientId,
        amount: amount ?? null,
        unit: unit || null,
        prep_note: prep ?? null,
        is_optional: Boolean(optional),
        sort_order: idx,
      };
    });

    await insert("recipe_ingredients", links);
  }

  console.log(
    `  recipes: ${inserted} inserted, ${replaced} replaced, ${skipped} skipped` +
      (skipped && !force ? " (use --force to replace)" : ""),
  );
}

// --- coverage report -------------------------------------------------------

function bucket(minutes) {
  if (minutes <= 15) return "quick";
  if (minutes <= 40) return "average";
  return "commitment";
}

function reportCoverage() {
  const grid = {};
  for (const r of RECIPES) {
    for (const meal of r.meal_types) {
      grid[meal] ??= { quick: 0, average: 0, commitment: 0 };
      grid[meal][bucket(r.time_minutes)]++;
    }
  }
  console.log("\n  coverage (meal type x time bucket)");
  console.log("               quick  average  commitment");
  for (const meal of ["breakfast", "lunch", "dinner", "snack"]) {
    const g = grid[meal] ?? { quick: 0, average: 0, commitment: 0 };
    const empty = g.quick + g.average + g.commitment === 0 ? "   <- EMPTY" : "";
    console.log(
      `    ${meal.padEnd(11)}${String(g.quick).padEnd(7)}${String(g.average).padEnd(9)}${g.commitment}${empty}`,
    );
  }
}

// --- run -------------------------------------------------------------------

console.log(`Seeding ${URL_BASE}${force ? "  (--force: replacing existing recipes)" : ""}\n`);
const byName = await seedIngredients();
await seedAliases(byName);
await seedRecipes(byName);
reportCoverage();
console.log("\nDone.");
