import { notFound } from "next/navigation";

import { RecipeDetailView } from "@/app/(app)/recipes/[id]/recipe-detail";
import { getRecipe } from "@/lib/recipes/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The title is resolved server-side so tab names and shared links are right
 * even though the body renders from the client cache.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Recipe not found" };

  const recipe = await getRecipe(id).catch(() => null);
  return { title: recipe ? `${recipe.title} · Recipe Book` : "Recipe not found" };
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Existence is checked here so a bad link renders the 404 page rather than an
  // error inside the detail view.
  const exists = await getRecipe(id).catch(() => null);
  if (!exists) notFound();

  return <RecipeDetailView id={id} />;
}
