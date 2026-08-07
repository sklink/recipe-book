/**
 * Cost formatting, deliberately in its own module with no imports.
 *
 * It's needed by both the server-rendered usage page and the client-side
 * generate screen. Living alongside the query helpers pulled the Supabase
 * server client into the browser bundle.
 */

/** Costs are stored in millicents — thousandths of a cent. */
export function formatCost(millicents: number): string {
  const cents = millicents / 1000;
  return cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents.toFixed(1)}¢`;
}
