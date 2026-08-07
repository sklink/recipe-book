import { IngredientsManager } from "@/app/(app)/ingredients/ingredients-manager";
import { PageHeader } from "@/components/page-header";

export default function IngredientsPage() {
  return (
    <>
      <PageHeader
        title="Ingredients"
        description="What's in the kitchen. Tick anything you have; star the things you always keep, so they stop counting as missing."
      />
      <IngredientsManager />
    </>
  );
}
