/**
 * Temporary marker for a route whose shell exists but whose feature has not
 * been built yet. Every use of this should disappear as its ticket lands.
 */
export function TicketStub({ ticket, what }: { ticket: string; what: string }) {
  return (
    <div className="border-border bg-surface-muted flex flex-col gap-1 rounded-lg border border-dashed p-6">
      <p className="text-muted text-sm">{what}</p>
      <p className="text-subtle font-mono text-xs">Built in {ticket}.</p>
    </div>
  );
}
