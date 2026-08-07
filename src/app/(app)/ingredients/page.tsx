import { PageHeader } from "@/components/page-header";
import { TicketStub } from "@/components/ticket-stub";

export default function IngredientsPage() {
  return (
    <>
      <PageHeader
        title="Ingredients"
        description="What's in the kitchen. Toggle anything in or out of stock."
      />
      <TicketStub
        ticket="T12 and T12b"
        what="Ingredient list grouped by category, with stock toggles and staple marking."
      />
    </>
  );
}
