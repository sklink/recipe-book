"use client";

import { usePathname } from "next/navigation";

import { showsSidebar } from "@/lib/nav";

/**
 * Placeholder for the persistent ingredient panel.
 *
 * T13 fills this with the union of ingredients across the visible recipes and
 * their stock toggles; T14 turns the mobile branch into a drag-to-expand bottom
 * sheet. For now it only has to hold its layout slot and disappear on the flow.
 */
export function IngredientSidebar() {
  const pathname = usePathname();
  if (!showsSidebar(pathname)) return null;

  return (
    <aside
      aria-label="Ingredients"
      className="border-border bg-surface-muted w-sidebar hidden shrink-0 border-l lg:block"
    >
      <div className="top-nav sticky flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">Ingredients</h2>
        <p className="text-subtle text-sm">
          Ingredients for whatever is on screen will appear here, with stock toggles.
        </p>
        <p className="text-subtle text-xs">Built in T13.</p>
      </div>
    </aside>
  );
}
