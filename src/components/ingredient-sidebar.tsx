"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronUp } from "lucide-react";

import { SidebarIngredients, useVisibleIngredients } from "@/components/sidebar-ingredients";
import { showsSidebar } from "@/lib/nav";

/** Desktop: a persistent column beside the content. */
function DesktopSidebar() {
  return (
    <aside
      aria-label="Ingredients"
      className="border-border bg-surface-muted w-sidebar hidden shrink-0 border-l lg:block"
    >
      <div className="top-nav sticky max-h-[calc(100dvh-var(--nav-height))] overflow-y-auto p-4">
        <h2 className="pb-3 text-sm font-semibold">Ingredients</h2>
        <SidebarIngredients />
      </div>
    </aside>
  );
}

/**
 * Mobile: a drag-to-expand bottom sheet.
 *
 * Snap points rather than free dragging — a sheet that settles anywhere is
 * fiddly with one thumb. Peek shows the count so it's useful without opening;
 * half is enough to tick a few things off; full is the whole list.
 *
 * Dragging is pointer events rather than a library: it's one axis and three
 * stops, and a gesture library would be more code than the behaviour.
 */
function MobileSheet() {
  const [snap, setSnap] = useState<"peek" | "half" | "full">("peek");
  const [dragOffset, setDragOffset] = useState(0);
  // Dragging is state, not a ref, because the render reads it to suppress the
  // height transition — a ref read during render is not safe under React 19.
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  // A tap fires the pointer sequence AND a click. Without this, a tap moved the
  // sheet twice — open on pointerup, closed again on click — so it never opened.
  const dragHandled = useRef(false);
  const { ingredients, context } = useVisibleIngredients();

  if (context === "none") return null;

  const missing = ingredients.filter((i) => !i.inStock && !i.isStaple).length;
  const heights = { peek: "3.25rem", half: "45dvh", full: "85dvh" };

  const onPointerDown = (event: React.PointerEvent) => {
    startY.current = event.clientY;
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (startY.current === null) return;
    setDragOffset(event.clientY - startY.current);
  };

  /**
   * Drags are handled here; taps are left to onClick. Splitting them this way
   * keeps the keyboard and mouse path on a plain button rather than
   * reimplementing activation on top of pointer events.
   */
  const onPointerUp = () => {
    if (startY.current === null) return;
    const delta = dragOffset;
    const order = ["peek", "half", "full"] as const;
    const index = order.indexOf(snap);

    // 40px of travel before it counts as a drag.
    if (delta < -40) {
      setSnap(order[Math.min(index + 1, order.length - 1)]);
      dragHandled.current = true;
    } else if (delta > 40) {
      setSnap(order[Math.max(index - 1, 0)]);
      dragHandled.current = true;
    } else {
      dragHandled.current = false;
    }

    startY.current = null;
    setDragOffset(0);
    setDragging(false);
  };

  const onClick = () => {
    // Suppress the click the browser sends after a drag.
    if (dragHandled.current) {
      dragHandled.current = false;
      return;
    }
    setSnap(snap === "peek" ? "half" : "peek");
  };

  return (
    <div
      role="region"
      aria-label="Ingredients"
      data-snap={snap}
      // Read by globals.css to set --sheet-peek, so sticky footers clear it.
      data-ingredient-sheet=""
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t shadow-[0_-4px_24px_rgba(0,0,0,0.08)] lg:hidden"
      style={{
        height: heights[snap],
        transition: dragging ? "none" : "height 200ms ease",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <button
        type="button"
        aria-expanded={snap !== "peek"}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="min-h-tap flex w-full shrink-0 touch-none items-center justify-between gap-2 px-4"
      >
        <span className="flex items-center gap-2 text-sm">
          <span className="bg-border-strong absolute inset-x-0 top-2 mx-auto h-1 w-9 rounded-full" />
          <span className="font-medium">{ingredients.length} ingredients</span>
          {missing > 0 ? <span className="text-warning">· {missing} missing</span> : null}
        </span>
        <ChevronUp
          size={18}
          strokeWidth={2}
          aria-hidden
          className={`text-muted transition-transform ${snap === "peek" ? "" : "rotate-180"}`}
        />
      </button>

      {snap !== "peek" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <SidebarIngredients />
        </div>
      ) : null}
    </div>
  );
}

export function IngredientSidebar() {
  const pathname = usePathname();
  // The flow is deliberately chrome-free — a three-step decision shouldn't
  // have a competing panel next to it.
  if (!showsSidebar(pathname)) return null;

  return (
    <>
      <DesktopSidebar />
      {/*
       * Keyed on the path so React discards the sheet's state on navigation.
       * Resetting it in an effect would work too, but this expresses the intent
       * — "this is a different sheet now" — without a cascading render.
       */}
      <MobileSheet key={pathname} />
    </>
  );
}
