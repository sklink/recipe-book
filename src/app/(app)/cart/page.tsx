import { PageHeader } from "@/components/page-header";
import { TicketStub } from "@/components/ticket-stub";

export default function CartPage() {
  return (
    <>
      <PageHeader title="Cart" description="What to buy, and how much of it." />
      <TicketStub
        ticket="T16 and T17"
        what="Shopping list grouped by aisle, with check-off and Done shopping."
      />
    </>
  );
}
