import { PageHeader } from "@/components/page-header";
import { TicketStub } from "@/components/ticket-stub";

export default function FlowPage() {
  return (
    <>
      <PageHeader
        title="Start"
        description="Meal type, then time available, then cookbook or something new."
      />
      <TicketStub ticket="T9 and T10" what="The three-step flow, and the results it leads to." />
    </>
  );
}
