"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";

import { CookLogPrompt } from "@/app/(app)/recipes/[id]/cook-log-prompt";
import type { InstructionStep, RecipeIngredient } from "@/lib/recipes/types";

/**
 * Cook mode: one step per screen, sized to be read from a propped-up phone.
 *
 * Everything here is shaped by the fact that your hands are covered in food:
 * large type, whole-screen tap targets, an ingredients panel you can check
 * without losing your place, and a wake lock so the screen doesn't sleep
 * between steps.
 */
export function CookMode({
  recipeId,
  title,
  steps,
  ingredients,
  onClose,
}: {
  recipeId: string;
  title: string;
  steps: InstructionStep[];
  ingredients: RecipeIngredient[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [finished, setFinished] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const atEnd = index >= steps.length - 1;

  const next = useCallback(() => {
    setIndex((i) => (i < steps.length - 1 ? i + 1 : i));
  }, [steps.length]);

  const previous = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  /**
   * Screen wake lock — the whole point of cook mode is that you can stop
   * touching the phone. Not supported everywhere, and the request throws if the
   * page isn't visible, so failure is silent by design.
   */
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        if (!("wakeLock" in navigator)) return;
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Unsupported, denied, or the tab lost focus. Cooking still works.
      }
    };

    void acquire();

    // The lock is dropped when the tab is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Arrow keys for anyone cooking with a keyboard nearby.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") next();
      if (event.key === "ArrowLeft") previous();
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, onClose]);

  if (finished) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex flex-col">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6">
          <CookLogPrompt recipeId={recipeId} title={title} onDone={onClose} />
        </div>
      </div>
    );
  }

  const step = steps[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${title}`}
      className="bg-background fixed inset-0 z-50 flex flex-col"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="border-border min-h-tap flex shrink-0 items-center justify-between gap-3 border-b px-4">
        <span className="text-muted flex items-center gap-2 truncate text-sm">
          <ChefHat size={16} strokeWidth={2} aria-hidden />
          <span className="truncate">{title}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowIngredients((v) => !v)}
            aria-pressed={showIngredients}
            aria-label="Ingredients"
            className={`h-tap w-tap flex items-center justify-center rounded-lg ${
              showIngredients ? "text-accent bg-accent-muted" : "text-muted hover:text-foreground"
            }`}
          >
            <ListChecks size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Leave cook mode"
            className="text-muted hover:text-foreground h-tap w-tap flex items-center justify-center rounded-lg"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Progress: thin, always visible, no numbers to squint at. */}
      <div className="bg-surface-muted h-1 w-full shrink-0" aria-hidden>
        <div
          className="bg-accent h-full transition-[width] duration-300"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>

      {showIngredients ? (
        <div className="border-border bg-surface-muted max-h-[40dvh] shrink-0 overflow-y-auto border-b px-5 py-3">
          <ul className="mx-auto flex w-full max-w-2xl flex-col gap-1">
            {ingredients.map((i) => (
              <li key={i.ingredientId} className="flex items-baseline gap-3 text-sm">
                <span className="text-muted w-24 shrink-0 tabular-nums">
                  {i.amount === null ? (i.unit ?? "") : `${i.amount} ${i.unit ?? ""}`.trim()}
                </span>
                <span>
                  {i.name}
                  {i.prepNote ? <span className="text-subtle">, {i.prepNote}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
       * The step itself takes the whole remaining screen and advances on tap,
       * so a knuckle or the back of a hand works.
       */}
      <button
        type="button"
        onClick={next}
        disabled={atEnd}
        aria-label={atEnd ? "Last step" : "Next step"}
        className="flex flex-1 items-center justify-center px-6 py-8 text-left disabled:cursor-default"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <span className="text-subtle text-sm font-medium tabular-nums">
            Step {index + 1} of {steps.length}
          </span>
          <p
            data-testid="cook-step"
            className="text-2xl leading-relaxed font-medium sm:text-3xl sm:leading-relaxed"
          >
            {step?.text}
          </p>
        </div>
      </button>
      <div ref={sentinel} />

      <footer className="border-border flex shrink-0 items-center gap-2 border-t px-4 py-3">
        <button
          type="button"
          onClick={previous}
          disabled={index === 0}
          className="border-border-strong text-muted hover:bg-surface-muted min-h-tap flex flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40"
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden />
          Back
        </button>

        {atEnd ? (
          <button
            type="button"
            onClick={() => setFinished(true)}
            className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex flex-[2] items-center justify-center rounded-lg text-sm font-medium transition-colors"
          >
            Finished cooking
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex flex-[2] items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors"
          >
            Next
            <ChevronRight size={16} strokeWidth={2} aria-hidden />
          </button>
        )}
      </footer>
    </div>
  );
}
