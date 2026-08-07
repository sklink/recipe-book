import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CookOutcome, MasteryLevel } from "@/lib/supabase/types";

const OUTCOMES: CookOutcome[] = ["flopped", "rough", "good", "nailed"];
const LEVELS: MasteryLevel[] = ["untried", "attempted", "learning", "reliable", "mastered"];

/** POST /api/cook-logs — { recipeId, outcome, notes? } */
export async function POST(request: NextRequest) {
  await requireUser();

  let body: { recipeId?: unknown; outcome?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.recipeId !== "string" || !OUTCOMES.includes(body.outcome as CookOutcome)) {
    return NextResponse.json(
      { error: "recipeId and a valid outcome are required." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("cook_logs").insert({
      recipe_id: body.recipeId,
      outcome: body.outcome as CookOutcome,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/cook-logs", error);
    return NextResponse.json({ error: "Could not record that cook." }, { status: 500 });
  }
}

/**
 * PATCH /api/cook-logs — { recipeId, masteryOverride }
 *
 * Sets or clears the manual override. Null returns the recipe to the derived
 * level rather than freezing it at whatever it currently shows.
 */
export async function PATCH(request: NextRequest) {
  await requireUser();

  let body: { recipeId?: unknown; masteryOverride?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.recipeId !== "string") {
    return NextResponse.json({ error: "recipeId is required." }, { status: 400 });
  }

  const override = body.masteryOverride;
  if (override !== null && !LEVELS.includes(override as MasteryLevel)) {
    return NextResponse.json({ error: "Invalid mastery level." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("recipes")
      .update({ mastery_override: override as MasteryLevel | null })
      .eq("id", body.recipeId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/cook-logs", error);
    return NextResponse.json({ error: "Could not update mastery." }, { status: 500 });
  }
}

/** DELETE /api/cook-logs?id=... — remove a logged cook. */
export async function DELETE(request: NextRequest) {
  await requireUser();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("cook_logs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/cook-logs", error);
    return NextResponse.json({ error: "Could not remove that entry." }, { status: 500 });
  }
}
