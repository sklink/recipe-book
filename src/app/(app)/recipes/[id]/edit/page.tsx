import { notFound } from "next/navigation";

import { EditRecipe } from "@/app/(app)/recipes/[id]/edit/edit-form";
import { getRecipe } from "@/lib/recipes/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const exists = await getRecipe(id).catch(() => null);
  if (!exists) notFound();

  return <EditRecipe id={id} />;
}
