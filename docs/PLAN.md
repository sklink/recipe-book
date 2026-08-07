# Recipe Book — Implementation Plan

A cookbook that answers "what should I cook right now?" based on meal type, time available, and what's in the kitchen — extended into lightweight kitchen stock management.

---

## Progress

| Ticket               | Status   | Notes                                                                                                                     |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| T1 Scaffold + deploy | **Done** | Next.js 16 / React 19 / Tailwind 4 / TS 5, Prettier, live on Vercel with push-to-deploy                                   |
| T2 Supabase schema   | **Done** | 7 tables live; constraints, triggers and RLS verified against the real project.                                           |
| T3 Auth              | **Done** | Magic link verified end to end in a browser. Household allowlist (2 addresses). Public signups still enabled in Supabase. |
| T4 App shell         | **Done** | Tokens, nav, shell, five stub routes. Verified at 375/768/1440 with Playwright.                                           |
| T5 Seed data         | **Done** | 23 recipes, 108 ingredients, 31 aliases live. `npm run seed` (`-- --force` to replace).                                   |
| T6 Recipes API       | **Done** | Filters, near-miss fallback, persisted cache. 26 assertions against live data.                                            |
| T7 Recipe cards      | Next     |                                                                                                                           |

Everything from T19 onward is unstarted.

`npm run layout:check` measures overflow, nav, sidebar visibility and tap-target
size across the three breakpoints — run it against a dev server after UI tickets.

---

## 1. Decisions locked in

| Area           | Decision                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Stack          | Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Storage)                           |
| Hosting        | Vercel (client + API routes), Supabase cloud                                                    |
| Auth           | Single user behind a login (Supabase magic link)                                                |
| Data model     | Canonical ingredient list, binary in/out of stock                                               |
| Recipe images  | AI-generated at creation time, stored in Supabase Storage                                       |
| Variants       | Child records shown on the parent recipe's page                                                 |
| Cart           | Check items off while shopping → "Done shopping" flips them to in-stock and clears              |
| Mobile sidebar | Drag-to-expand bottom sheet                                                                     |
| Intent axis    | Handled implicitly: Generate New = learn, Cookbook = existing, "New Variant" button = variation |

### AI providers

**Text (recipe + variant generation): Claude Opus 5** — `claude-opus-5`, $5/MTok in, $25/MTok out. Use `client.messages.parse()` with a Zod schema via `zodOutputFormat` so generated recipes come back as validated JSON, not prose to be parsed. Adaptive thinking is on by default on this model; set `output_config: { effort: "medium" }` for recipe generation (it's a well-scoped structured task, not a reasoning problem). Estimated cost per generated recipe: well under a cent.

**Images: OpenAI `gpt-image-1`.** Anthropic does not offer image generation, so this is the one second provider in the stack. Chosen for prompt adherence — food photography where the image actually matches the dish is worth the cost, and at roughly $0.04–0.10/image a thousand-recipe cookbook lands around $40–100 one-off. Ticket T21 still isolates it behind an `ImageGenerator` interface so it's swappable, and the app ships a graceful placeholder if no image provider is configured.

---

## 2. Data model

```
recipes
  id, title, description, meal_types[] (breakfast|lunch|dinner|snack),
  time_minutes, servings, instructions (jsonb: ordered steps),
  image_url, image_status (pending|ready|failed),
  source (manual|ai|imported), source_url, parent_recipe_id (null = base recipe),
  variant_note, is_favourite, mastery_override, created_at, updated_at

recipe_ingredients
  recipe_id, ingredient_id, amount (numeric, nullable),
  unit (text, nullable), prep_note, is_optional, sort_order

ingredients
  id, name (canonical, unique), category, is_staple, created_at

ingredient_aliases
  ingredient_id, alias (unique)   -- "spring onion" → "scallion"

ingredient_stock
  ingredient_id (pk), in_stock (bool), updated_at

cart_items
  id, ingredient_id, amount_note (text, e.g. "2 tbsp + 1 cup"),
  source_recipe_ids (uuid[]), is_checked, created_at

cook_logs
  id, recipe_id, cooked_at, outcome (flopped|rough|good|nailed),
  notes, created_at
```

Notes on deliberate choices:

- **`meal_types` is an array.** A frittata is breakfast _and_ lunch. A single enum would force duplicate recipes.
- **`time_minutes` is stored, buckets are derived.** Quick ≤ 15, Average 16–40, Commitment > 40. Thresholds live in one constants file so they're trivially tunable.
- **Cart amounts are text, not numeric.** Aggregating "2 tbsp olive oil" and "1 cup olive oil" into a single number requires a unit-conversion engine that isn't worth building for v1. The cart shows `olive oil — 2 tbsp + 1 cup (Shakshuka, Focaccia)` and lets you read it. Flagged as a v2 improvement.
- **Variants are recipes with a `parent_recipe_id`.** Same table, so a variant has full ingredient/instruction records and can later be promoted by nulling the parent.
- **`is_staple` is a manual flag, not a heuristic.** Where the staple line falls is personal — olive oil probably, coconut oil maybe not, depending on how you cook. No frequency threshold will get that right, so it's one tap per ingredient.
- **Mastery is derived from `cook_logs`, not stored.** Computed on read from outcome history (rules in T30), with `recipes.mastery_override` as a manual escape hatch. Storing a level would drift from the log the first time you edited one.

---

## 3. Tickets

Each ticket is independently buildable and testable. Phases are sequential; tickets within a phase are mostly parallel.

### Phase 0 — Foundation

**T1 · Project scaffold and deploy pipeline**
Next.js App Router + TypeScript + Tailwind. ESLint/Prettier. Deploy a "hello" page to Vercel.
_Done when:_ pushing to `main` deploys automatically and the live URL renders.

**T2 · Supabase project and schema**
Create the project. Write migrations for all tables above, with indexes on `recipes(meal_types, time_minutes)` and `recipe_ingredients(recipe_id)`. Generate typed Supabase client. Enable RLS with a single-user policy.
_Done when:_ `supabase db push` applies cleanly, types generate, and a smoke query from a Next.js route returns rows.

**T3 · Auth**
Supabase magic-link auth. Middleware protecting every route except `/login`. Session in server components. Sign-out.
_Done when:_ hitting any page logged out redirects to login; a magic link signs you in and persists across refresh.

**T4 · App shell and design tokens**
Top nav (Start Flow · Recipes · Generate · Ingredients · Cart), responsive layout with a right sidebar slot on desktop, content-only on mobile. Colour/spacing/typography tokens. 44px minimum touch targets throughout.
_Done when:_ every nav destination renders a stub page; layout holds at 375px, 768px, and 1440px with no horizontal scroll.

### Phase 1 — Cookbook (read path)

**T5 · Seed data**
~20 hand-written recipes across all four meal types and all three time buckets, plus their canonical ingredients and a starter alias list. Seed script, re-runnable.
_Done when:_ `npm run seed` populates a clean database and every downstream feature has realistic data to work against.

**T6 · Recipes API + client cache**
`GET /api/recipes` with `mealType`, `timeBucket`, `requireIngredients` filters. `GET /api/recipes/:id`. TanStack Query with a localStorage/IndexedDB persister for offline reads and instant re-renders.
_Done when:_ filters return correct sets; reloading the page renders cached recipes before the network responds.

**T7 · Recipe card list**
`/recipes` — responsive card grid. Each card: image (or placeholder), title, time, meal type chips, variant count badge.
_Done when:_ cards render for seeded data, degrade gracefully with no image, and the grid reflows cleanly on mobile.

**T8 · Recipe detail page**
Image, title, time, meal types, servings, ingredient list (amount + unit + prep note, missing ones visually marked), numbered instructions.
_Done when:_ opening any seeded recipe shows complete, correctly formatted data.

### Phase 2 — The flow

**T9 · Three-step flow UI**
`/flow` — Step 1 meal type, Step 2 time available, Step 3 Generate New / Cookbook. Large touch targets, back navigation, state in the URL so steps are shareable and refresh-safe.
_Done when:_ all three steps navigate forward and back, and a deep link like `/flow?meal=dinner&time=quick` resumes mid-flow.

**T10 · Flow → results**
Cookbook → filtered `/recipes` view with the flow's filters applied and shown as removable chips. Generate → the generation screen (T20) pre-seeded with the same parameters.
_Done when:_ completing the flow lands on correctly filtered results; clearing a chip widens the result set live.

### Phase 3 — Ingredients and stock

**T11 · Ingredients API + stock toggle**
`GET /api/ingredients` (with stock state), `PATCH /api/ingredients/:id/stock`. Optimistic updates through TanStack Query with rollback on failure.
_Done when:_ toggling stock updates instantly, persists across reload, and reverts visibly if the request fails.

**T12 · Ingredients page**
`/ingredients` — grouped by category, search filter, in-stock/out-of-stock/all tabs, bulk "mark all in stock" per category.
_Done when:_ a full ingredient list is searchable and toggleable, and changes reflect on the recipes list immediately.

**T12b · Pantry staples**
`is_staple` boolean on `ingredients`, toggled from the ingredients page (per row, and bulk from a category). Staples are assumed in stock, excluded from missing-ingredient counts, and collapsed into a "+ 6 staples" line in the sidebar rather than listed individually. Seed a starter set (salt, pepper, olive oil, flour, sugar, butter) — everything else is your call, made one tap at a time as recipes introduce ingredients.
_Done when:_ marking coconut oil a staple removes it from every missing count and sidebar list immediately, and unmarking it puts it back.

**T13 · Persistent ingredient sidebar (desktop)**
Right-hand panel showing the union of ingredients across whatever recipes are currently visible. Toggleable. Missing ingredients grouped first with a count.
_Done when:_ the sidebar contents change as the visible recipe set changes, and toggling there matches the ingredients page.

**T14 · Mobile bottom sheet**
The same panel as a drag-to-expand bottom sheet. Collapsed handle reads `12 ingredients · 3 missing`. Snap points at peek/half/full.
_Done when:_ the sheet drags smoothly on a real phone, doesn't block scrolling of the content behind it, and respects safe-area insets.

**T15 · "Require ingredients" filter**
Toggle on the recipes list. When on, show only recipes where every non-optional ingredient is in stock. When the filtered result is empty, fall back to a "closest matches" list sorted by fewest missing ingredients, each showing what's missing.
_Done when:_ the toggle filters correctly and an empty result never shows a dead-end empty state.

### Phase 4 — Cart

**T16 · Cart API + add-to-cart**
`GET/POST/DELETE /api/cart`. "Add to cart" on recipe detail adds only ingredients currently out of stock, carrying amount and source recipe. Adding the same ingredient from a second recipe appends its amount rather than duplicating the row.
_Done when:_ adding two recipes sharing an ingredient produces one cart row listing both amounts and both recipe names.

**T17 · Cart page**
`/cart` — grouped by ingredient category (shopping-aisle order), checkbox per item, remove per item, clear all, and "Done shopping" which flips every checked item to in-stock and removes it from the cart.
_Done when:_ the full shop→stock loop works end to end and the ingredients page reflects the new stock state.

### Phase 5 — AI

**T18 · AI service layer**
Anthropic SDK client. Zod schema for a recipe. `generateRecipe(params)` and `generateVariant(recipe)` using `client.messages.parse()` with `zodOutputFormat`. Per-day request cap and structured logging of prompt/response/token usage for cost visibility.
_Done when:_ a unit test calls the service with fixed parameters and receives a schema-valid recipe object; exceeding the daily cap returns a clear error rather than a bill.

**T19 · Ingredient resolver**
Maps AI-produced ingredient strings onto canonical ingredients: exact match → alias match → trigram fuzzy match above a threshold → create new canonical ingredient (default out of stock). Records low-confidence matches for review.
_Done when:_ a test fixture of 50 messy ingredient strings resolves with no duplicate canonical entries for the same real ingredient.

**T20 · Generate new recipe**
Full-screen recipe card, streamed as it generates. Seeded with the flow's meal type and time bucket. "Keep" persists it (and triggers image generation); "Try Again" regenerates with a nudge to differ from the previous attempt.
_Done when:_ generating from the flow produces a coherent recipe matching the requested meal type and time bucket, and Keep makes it appear in the cookbook.

**T20b · Generation dedupe**
Before presenting a generated recipe, check it against the existing cookbook (normalised title match plus ingredient-set overlap above a threshold). On a near-match, show "You already have something like this — _Shakshuka_" with options to view the existing one or generate a different idea. The check also feeds back into the prompt so retries steer away from what you already own.
_Done when:_ generating a dish you already have surfaces the existing recipe instead of silently duplicating it.

**T21 · Image generation**
`ImageGenerator` interface with a Replicate/FLUX implementation. Triggered on recipe save, runs async, writes to Supabase Storage, updates `image_url` and `image_status`. Cards show a category-coloured placeholder while pending or on failure, with retry.
_Done when:_ a newly kept recipe shows a placeholder immediately and an image within ~30s, and the app remains fully functional with the provider disabled.

**T22 · New Variant**
"New Variant" button on cards and detail pages. Generates a variation of the parent (different technique, cuisine twist, or dietary swap) shown side by side with the original. "Keep" saves it with `parent_recipe_id` set; "Discard" throws it away.
_Done when:_ keeping a variant attaches it to the parent and the parent's card shows an incremented variant badge.

**T23 · Variants on the parent page**
Variants section on recipe detail — collapsed cards, expandable to full detail, each independently deletable and cartable.
_Done when:_ a recipe with three variants shows all three and each opens correctly.

**T23b · Recipe import from URL**
Paste a recipe URL → fetch the page → Claude extracts a structured recipe against the same Zod schema as T18 → runs through the T19 ingredient resolver → preview screen with everything editable before saving. Handles the common failure cases explicitly: paywalled pages, JS-rendered content, and pages that aren't recipes at all. Imported recipes are marked `source: 'imported'` with the original URL retained.
_Done when:_ pasting a URL from three different recipe sites produces three correctly structured, ingredient-resolved recipes, and a non-recipe URL fails with a clear message rather than hallucinating a dish.

### Phase 6 — Editing and polish

**T24 · Recipe editing**
Edit form for title, description, meal types, time, servings, instructions (add/remove/reorder steps), and ingredients (autocomplete against canonical list, with inline create). Optimistic save with local cache write-through.
_Done when:_ editing any field persists, survives reload, and an edit made offline syncs on reconnect.

**T25 · Manual create and delete**
"New recipe" using the same form as T24, starting empty. Delete with confirmation; deleting a parent prompts about its variants.
_Done when:_ a recipe can be created by hand end to end, and deletion cleans up ingredients and cart references.

**T26 · States and error handling**
Skeleton loaders, empty states for every list, error boundaries, offline banner, retry affordances.
_Done when:_ every screen has a defined loading, empty, and error state, and killing the network shows the offline banner rather than a crash.

**T27 · Touch and PWA polish**
Web app manifest, icons, installable to home screen. No hover-only affordances. Swipe gestures where they help. Correct viewport and safe-area handling.
_Done when:_ the app installs to an iOS home screen, launches standalone, and every action is reachable by thumb.

**T28 · Observability and cost control**
Vercel Analytics, error tracking (Sentry free tier), an AI usage dashboard route showing generations and estimated spend per day, and a hard monthly cap.
_Done when:_ a generation appears in the usage log within seconds and hitting the cap disables generation with an explanatory message.

### Phase 7 — Cooking and mastery

**T29 · Cook mode**
Full-screen step-by-step view launched from recipe detail. One instruction per screen at large type, swipe or tap to advance, progress indicator, ingredients accessible without losing your place, screen wake-lock so it doesn't sleep mid-step. Ends on the cook log prompt (T30).
_Done when:_ you can cook a full recipe from a propped-up phone without touching it with clean hands more than once per step, and the screen never sleeps.

**T30 · Cook log and mastery**
New table:

```
cook_logs
  id, recipe_id, cooked_at, outcome, notes, created_at
```

`outcome` is one of `flopped | rough | good | nailed`. Logging is a single tap at the end of cook mode (and available from recipe detail for meals cooked without it).

Mastery is **derived** from the log, most-recent-first, and displayed as a badge on cards and detail:

| Level     | Rule                                                |
| --------- | --------------------------------------------------- |
| Untried   | no logs                                             |
| Attempted | logs exist, none yet `good` or `nailed`             |
| Learning  | at least one `good`/`nailed`, but not consecutively |
| Reliable  | last 2 consecutive logs `good` or `nailed`          |
| Mastered  | last 3+ consecutive logs `good` or `nailed`         |

A `mastery_override` column lets you set the level by hand — you know whether you can actually make a thing better than a rule counting rows does. Override wins and is visually marked as manual.

**Variants inherit from their parent.** A variant with no logs of its own shows the parent's level, one step down and floored at Learning, marked as inherited (e.g. a variant of a Mastered recipe reads _Reliable · inherited_). The discount is because you've proven the technique but not this particular twist — claiming Mastered on a dish you've literally never cooked would undermine the whole signal. As soon as the variant has one log of its own, it derives independently and the inheritance drops away. The discount is a single constant, so flipping to straight one-for-one inheritance is a one-line change if it reads wrong in practice.

_Done when:_ logging three consecutive good cooks promotes a recipe to Mastered, a flop after that demotes it to Learning, a manual override survives further logging, and a fresh variant of a Mastered recipe shows Reliable · inherited until you cook it once.

**T31 · Mastery on the results list**
Mastery filter chips on the recipes list, alongside the existing meal-type and time chips — so the flow stays three steps and mastery is something you reach for on the results screen when you want it. Chips group into `Know it` (Reliable + Mastered) and `New to me` (Untried + Attempted), with the individual levels available too. Recipe detail shows cook count, last cooked date, and outcome history.

This is where the original "staple vs variation vs learn new" framing gets real data behind it instead of being a guess — a staple is a recipe you've demonstrably nailed repeatedly, not one you tagged as such optimistically.

_Done when:_ filtering results to `Know it` returns only Reliable-and-above, the chips compose correctly with the meal-type and time filters already applied by the flow, and clearing them widens the set live.

---

## 4. Build order

```
T1 → T2 → T3 → T4               Foundation (nothing works without these)
T5 → T6 → T7 → T8               A usable read-only cookbook
T9 → T10                        The flow — the product's core interaction
T11 → T12 → T12b → T13 → T15    Stock management; T14 can follow later
T16 → T17                       Cart closes the stock loop
T18 → T19 → T20 → T20b → T21    AI generation
T23b                            URL import (needs only T18+T19 — pull earlier if you want
                                the cookbook full fast)
T22 → T23                       Variants
T24 → T25                       Editing
T26 → T27 → T28                 Polish
T29 → T30 → T31                 Cook mode, cook log, mastery
```

**First genuinely useful milestone: end of T10.** At that point you can open the app, answer two questions, and get a filtered list of things to cook. Everything after that is depth.

---

## 5. Decisions on the open questions

All resolved 2026-08-07. Recorded here so the reasoning survives.

| Question              | Decision                                                                                                                                                                                                                         | Lands in        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Image provider        | **OpenAI `gpt-image-1`.** Prompt adherence matters more than per-image price; ~$40–100 for a thousand recipes is acceptable one-off. Still swappable behind the `ImageGenerator` interface.                                      | T21             |
| Cart unit aggregation | **No conversion.** Amounts stay as text side by side. Revisit only if it becomes annoying in practice.                                                                                                                           | T16 (unchanged) |
| Pantry staples        | **Yes, user-maintained.** The threshold for what counts as a staple is genuinely personal (olive oil probably; coconut oil maybe not), so it's a manual per-ingredient toggle with a small seeded starter set — not a heuristic. | T12b            |
| Cook mode             | **Yes.**                                                                                                                                                                                                                         | T29             |
| "Made this" tracking  | **Yes, with mastery levels** derived from per-cook outcomes, manually overridable.                                                                                                                                               | T30, T31        |
| AI dedupe             | **Yes.**                                                                                                                                                                                                                         | T20b            |
| Recipe import         | **Yes**, from a pasted URL.                                                                                                                                                                                                      | T23b            |
| Mastery in the flow   | **Filter chips on the results list**, not a fourth step. The flow stays three steps; mastery is there when you reach for it.                                                                                                     | T31             |
| Variant mastery       | **Variants inherit** from the parent — one level down, floored at Learning, marked inherited, replaced by the variant's own logs as soon as it has any.                                                                          | T30             |

**No open questions remain.** Anything new gets appended here with its reasoning.
