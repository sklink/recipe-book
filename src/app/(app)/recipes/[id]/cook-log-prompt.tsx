"use client";

import { useState } from "react";

import { useLogCook } from "@/lib/recipes/cook-hooks";
import { OUTCOME_LABELS } from "@/lib/recipes/mastery";
import type { CookOutcome } from "@/lib/supabase/types";

const OUTCOMES: { value: CookOutcome; hint: string }[] = [
  { value: "flopped", hint: "Didn't work" },
  { value: "rough", hint: "Edible, not right" },
  { value: "good", hint: "Worked well" },
  { value: "nailed", hint: "Exactly right" },
];

/**
 * The one-tap log at the end of a cook.
 *
 * Four outcomes rather than a star rating: this feeds mastery, and "how did it
 * turn out" is a different question from "how much did you like it". Notes are
 * optional and secondary — a required field here would just get skipped.
 */
export function CookLogPrompt({
  recipeId,
  title,
  onDone,
}: {
  recipeId: string;
  title: string;
  onDone: () => void;
}) {
  const logCook = useLogCook();
  const [outcome, setOutcome] = useState<CookOutcome>();
  const [notes, setNotes] = useState("");

  if (logCook.isSuccess) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="font-display text-2xl font-semibold">Logged.</p>
        <p className="text-muted text-sm">
          Mastery updates from your last few cooks, so this one counts.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="bg-accent text-accent-fg min-h-tap rounded-lg px-5 text-sm font-medium"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="font-display text-2xl font-semibold">How did it go?</h2>
        <p className="text-muted text-sm">{title}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OUTCOMES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={outcome === option.value}
            onClick={() => setOutcome(option.value)}
            className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 transition-colors ${
              outcome === option.value
                ? "border-accent bg-accent-muted text-accent"
                : "border-border-strong hover:bg-surface-muted"
            }`}
          >
            <span className="text-sm font-semibold">{OUTCOME_LABELS[option.value]}</span>
            <span className="text-subtle text-xs">{option.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="cook-notes" className="text-muted text-sm">
          Anything to remember for next time? (optional)
        </label>
        <textarea
          id="cook-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Needed 5 more minutes; too much salt"
          className="border-border bg-surface rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      {logCook.isError ? (
        <p role="alert" className="text-danger text-sm">
          {logCook.error instanceof Error ? logCook.error.message : "Could not save."}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="border-border-strong text-muted hover:bg-surface-muted min-h-tap flex-1 rounded-lg border text-sm font-medium transition-colors"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={!outcome || logCook.isPending}
          onClick={() => outcome && logCook.mutate({ recipeId, outcome, notes })}
          className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex-[2] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {logCook.isPending ? "Saving…" : "Log it"}
        </button>
      </div>
    </div>
  );
}
