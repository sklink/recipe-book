import { Importer } from "@/app/(app)/recipes/import/importer";
import { PageHeader } from "@/components/page-header";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import a recipe"
        description="Paste a URL. Ingredient names are matched onto your existing list, so stock and the cart keep working."
      />
      <Importer />
    </>
  );
}
