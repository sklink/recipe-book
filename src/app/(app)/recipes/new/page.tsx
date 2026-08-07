import { NewRecipe } from "@/app/(app)/recipes/new/new-form";
import { PageHeader } from "@/components/page-header";

export default function NewRecipePage() {
  return (
    <>
      <PageHeader
        title="New recipe"
        description="Add something you already cook. Ingredient names match your existing list as you type."
      />
      <NewRecipe />
    </>
  );
}
