import { PageHeader } from "@/components/page-header";
import { TicketStub } from "@/components/ticket-stub";

export default function RecipesPage() {
  return (
    <>
      <PageHeader title="Recipes" description="Everything in the cookbook, filterable." />
      <TicketStub
        ticket="T6 and T7"
        what="Recipe cards with image, title, time, meal type, and variant count."
      />
    </>
  );
}
