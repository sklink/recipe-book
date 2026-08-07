"use client";

import { Check, PackageOpen, RotateCcw } from "lucide-react";

import { useIngredients } from "@/lib/ingredients/hooks";
import {
  ANY,
  OPTION_SETS,
  type GenerationOptions,
  type OptionSetEntry,
} from "@/lib/ai/generation-options";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/recipes/meal-types";
import { BUCKET_DESCRIPTIONS, BUCKET_LABELS, TIME_BUCKETS } from "@/lib/recipes/time-buckets";
import type { TimeBucket } from "@/lib/recipes/time-buckets";
import type { MealType } from "@/lib/supabase/types";

export type Controls = GenerationOptions & {
  mealType?: MealType;
  timeBucket?: TimeBucket;
};

const PRIMARY = OPTION_SETS.filter((s) => s.group === "primary");
const MORE = OPTION_SETS.filter((s) => s.group === "more");

const gridClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

const selectClass =
  "border-border bg-surface min-h-tap w-full rounded-lg border px-3 text-sm appearance-none";

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = `gen-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-muted text-xs font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        {children}
      </select>
    </div>
  );
}

type PartProps = {
  value: Controls;
  onChange: (next: Controls) => void;
  disabled?: boolean;
};

function fieldsFor({ value, onChange }: Pick<PartProps, "value" | "onChange">) {
  const set = (patch: Partial<Controls>) => onChange({ ...value, ...patch });
  const field = (entry: OptionSetEntry) => (
    <Field
      key={entry.key}
      label={entry.label}
      value={value[entry.key] ?? ANY}
      onChange={(v) => set({ [entry.key]: v } as Partial<Controls>)}
    >
      {entry.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Field>
  );
  return { set, field };
}

/**
 * The parameters you'll reach for most, above the Generate button.
 *
 * Native selects rather than custom dropdowns: on a phone they open the OS
 * picker, which is faster to use one-handed than anything rebuilt in the page,
 * and they're keyboard- and screen-reader-correct for free.
 */
export function GenerationControls({ value, onChange, disabled }: PartProps) {
  const { data } = useIngredients();
  const ingredients = data?.ingredients ?? [];
  const usable = ingredients.filter((i) => i.inStock || i.isStaple).length;
  const { set, field } = fieldsFor({ value, onChange });

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      <legend className="sr-only">Recipe parameters</legend>

      {/*
       * Stock constraint first: it changes what every other answer can be, and
       * it's the one that most often decides whether you can cook tonight.
       */}
      <div className="border-border bg-surface-muted flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PackageOpen size={16} strokeWidth={2} aria-hidden className="text-accent" />
            <span className="text-sm font-medium">Only what I have in</span>
          </div>
          <div role="radiogroup" aria-label="Use only ingredients in stock" className="flex gap-1">
            {[
              { on: true, label: "Yes" },
              { on: false, label: "No" },
            ].map((option) => {
              const active = Boolean(value.useAvailable) === option.on;
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set({ useAvailable: option.on })}
                  className={`min-h-tap flex items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {active ? <Check size={13} strokeWidth={3} aria-hidden /> : null}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-subtle text-xs">
          {value.useAvailable
            ? `Restricted to the ${usable} ingredients you have in stock, staples included. Nothing to buy.`
            : "The recipe may call for things you'll need to shop for."}
        </p>
      </div>

      <div className={gridClass}>
        <Field
          label="Meal"
          value={value.mealType ?? ANY}
          onChange={(v) => set({ mealType: v === ANY ? undefined : (v as MealType) })}
        >
          <option value={ANY}>Any</option>
          {MEAL_TYPES.map((meal) => (
            <option key={meal} value={meal}>
              {MEAL_LABELS[meal]}
            </option>
          ))}
        </Field>

        <Field
          label="Time"
          value={value.timeBucket ?? ANY}
          onChange={(v) => set({ timeBucket: v === ANY ? undefined : (v as TimeBucket) })}
        >
          <option value={ANY}>Any</option>
          {TIME_BUCKETS.map((bucket) => (
            <option key={bucket} value={bucket}>
              {BUCKET_LABELS[bucket]} — {BUCKET_DESCRIPTIONS[bucket].toLowerCase()}
            </option>
          ))}
        </Field>

        {PRIMARY.map(field)}
      </div>
    </fieldset>
  );
}

/**
 * The rest, below the Generate button.
 *
 * Not hidden — just out of the way. Nine stacked selects would put the button
 * a long scroll down a phone screen, and these are the three you'd usually
 * leave alone. Below the fold in the ordinary sense, still one tap away.
 */
export function SecondaryControls({
  value,
  onChange,
  onReset,
  disabled,
}: PartProps & { onReset: () => void }) {
  const { field } = fieldsFor({ value, onChange });

  const chosen = [value.mealType, value.timeBucket, ...OPTION_SETS.map((s) => value[s.key])].filter(
    (v) => v && v !== ANY,
  ).length;

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-3">
      {/* A legend sits outside the fieldset's flex flow, so its gap is its own. */}
      <legend className="text-muted mb-3 text-xs font-medium">Finer detail</legend>

      <div className={gridClass}>{MORE.map(field)}</div>

      {chosen > 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="text-muted hover:text-foreground min-h-tap flex w-fit items-center gap-2 text-xs"
        >
          <RotateCcw size={13} strokeWidth={2} aria-hidden />
          Reset {chosen} choice{chosen === 1 ? "" : "s"}
        </button>
      ) : null}
    </fieldset>
  );
}
