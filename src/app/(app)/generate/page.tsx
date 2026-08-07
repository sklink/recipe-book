import { PageHeader } from "@/components/page-header";
import { TicketStub } from "@/components/ticket-stub";

export default function GeneratePage() {
  return (
    <>
      <PageHeader
        title="Generate"
        description="Have Claude invent something you haven't cooked before."
      />
      <TicketStub ticket="T20" what="Full-screen generated recipe card, with Keep and Try Again." />
    </>
  );
}
