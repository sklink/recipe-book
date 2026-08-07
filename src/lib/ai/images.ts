import OpenAI from "openai";
import sharp from "sharp";

import { recordGeneration } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";

/**
 * Recipe imagery.
 *
 * Behind an interface because the provider is the most likely thing in this
 * stack to change — and because the app has to work without one at all. If no
 * key is configured, recipes keep their placeholder rather than breaking.
 */
export interface ImageGenerator {
  readonly name: string;
  generate(prompt: string): Promise<{ base64: string; costMillicents: number }>;
}

const BUCKET = "recipe-images";

class OpenAIImageGenerator implements ImageGenerator {
  readonly name = "gpt-image-1";
  constructor(private readonly apiKey: string) {}

  async generate(prompt: string) {
    const openai = new OpenAI({ apiKey: this.apiKey });
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image provider returned no image.");

    // Roughly $0.04 at medium quality — recorded so the usage log stays honest
    // even though the provider doesn't itemise per call.
    return { base64, costMillicents: 40 };
  }
}

export function getImageGenerator(): ImageGenerator | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAIImageGenerator(apiKey);
}

function buildPrompt(title: string, description: string | null): string {
  return [
    `A photograph of ${title}, plated and ready to eat.`,
    description ? `Context: ${description}` : "",
    "Natural daylight from one side, shallow depth of field, shot slightly above the plate.",
    "Home cooking on a simple ceramic plate, warm neutral surface. Appetising but not styled like an advert:",
    "no garnish that wouldn't be eaten, no props, no text, no hands, no cutlery arrangements.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generates and stores an image, then points the recipe at it.
 *
 * Failure is non-fatal by design: image_status becomes "failed", the card falls
 * back to its placeholder, and the recipe is otherwise untouched. Nobody should
 * lose a recipe because an image provider had a bad minute.
 */
export async function generateRecipeImage(
  recipeId: string,
): Promise<{ ok: boolean; url?: string }> {
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, description")
    .eq("id", recipeId)
    .maybeSingle();

  if (!recipe) return { ok: false };

  const generator = getImageGenerator();
  if (!generator) {
    console.warn("[images] No OPENAI_API_KEY configured — leaving the placeholder in place.");
    return { ok: false };
  }

  const started = Date.now();

  try {
    const { base64, costMillicents } = await generator.generate(
      buildPrompt(recipe.title, recipe.description),
    );

    // The provider returns ~1.6MB of PNG. WebP at quality 80 is ~100KB for the
    // same 1024px image with no visible difference — 16x more recipes per GB of
    // storage, and a page that loads far faster on a phone.
    const bytes = await sharp(Buffer.from(base64, "base64")).webp({ quality: 80 }).toBuffer();

    const path = `${recipeId}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/webp", upsert: true });

    if (uploadError) throw new Error(`Storing image: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    await supabase
      .from("recipes")
      .update({ image_url: publicUrl, image_status: "ready" })
      .eq("id", recipeId);

    await recordGeneration({
      kind: "image",
      model: generator.name,
      recipeId,
      costMillicents,
      durationMs: Date.now() - started,
    });

    return { ok: true, url: publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[images] ${recipeId}: ${message}`);

    await supabase.from("recipes").update({ image_status: "failed" }).eq("id", recipeId);
    await recordGeneration({
      kind: "image",
      model: generator.name,
      recipeId,
      durationMs: Date.now() - started,
      error: message,
    });

    return { ok: false };
  }
}
