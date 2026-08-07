import { RecipeList } from "@/app/(app)/recipes/recipe-list";
import { PageHeader } from "@/components/page-header";

export default function RecipesPage() {
  return (
    <>
      <PageHeader title="Recipes" description="Everything in the cookbook, filterable." />
      <RecipeList />
    </>
  );
}
