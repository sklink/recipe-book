import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { generateRecipeImage, getImageGenerator } from "@/lib/ai/images";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/recipes/:id/image — generate or regenerate the image.
 *
 * Awaited rather than fired and forgotten, unlike the path taken when a recipe
 * is first kept: this is an explicit "try again", so the user is waiting on the
 * answer and deserves to be told whether it worked.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  if (!getImageGenerator()) {
    return NextResponse.json(
      { error: "No image provider is configured. Set OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  const result = await generateRecipeImage(id);
  if (!result.ok) {
    // The reason is logged server-side; pass it on rather than making the user
    // guess between a provider failure and a missing storage policy.
    return NextResponse.json(
      { error: result.reason ?? "Image generation failed. Try again." },
      { status: 502 },
    );
  }
  return NextResponse.json(result);
}
