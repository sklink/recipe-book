"use client";

import { Check, PackageOpen } from "lucide-react";

import { iconFor } from "@/app/(app)/generate/option-icons";
import { useIngredients } from "@/lib/ingredients/hooks";
import {
  ANY,
  OPTION_SETS,
  type GenerationOptions,
  type Option,
  type OptionSetKey,
} from "@/lib/ai/generation-options";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/recipes/meal-types";
import { BUCKET_DESCRIPTIONS, BUCKET_LABELS, TIME_BUCKETS } from "@/lib/recipes/time-buckets";
import type { TimeBucket } from "@/lib/recipes/time-buckets";
import type { MealType } from "@/lib/supabase/types";

export type Controls = GenerationOptions & {
  mealType?: MealType;
  timeBucket?: TimeBucket;
};

/**
 * Chips rather than selects.
 *
 * A select hides its options until you open it, which is exactly wrong here —
 * the whole point of this page is to see what you could ask for. It's a much
 * taller page in exchange, so the Generate button sticks to the bottom of the
 * viewport instead of sitting at the end of it.
 */
function Chip({
  option,
  active,
  onClick,
  Icon,
}: {
  option: Option;
  active: boolean;
  onClick: () => void;
  Icon?: ReturnType<typeof iconFor>;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={option.hint}
      onClick={onClick}
      className={`min-h-tap flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
        active
          ? "border-accent/40 bg-accent-muted text-accent"
          : "border-border-strong text-muted hover:bg-surface-muted"
      }`}
    >
      {Icon ? <Icon size={14} strokeWidth={2} aria-hidden /> : null}
      {option.label}
    </button>
  );
}

function ChipGroup({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: OptionSetKey | "meal" | "time";
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-xs font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            option={option}
            active={value === option.value}
            onClick={() => onChange(option.value)}
            Icon={iconFor(name, option.value)}
          />
        ))}
      </div>
    </div>
  );
}

const MEAL_OPTIONS: Option[] = [
  { value: ANY, label: "Any" },
  ...MEAL_TYPES.map((meal) => ({ value: meal, label: MEAL_LABELS[meal] })),
];

const TIME_OPTIONS: Option[] = [
  { value: ANY, label: "Any" },
  ...TIME_BUCKETS.map((bucket) => ({
    value: bucket,
    label: BUCKET_LABELS[bucket],
    hint: BUCKET_DESCRIPTIONS[bucket],
  })),
];

export function GenerationControls({
  value,
  onChange,
  disabled,
}: {
  value: Controls;
  onChange: (next: Controls) => void;
  disabled?: boolean;
}) {
  const { data } = useIngredients();
  const ingredients = data?.ingredients ?? [];
  const usable = ingredients.filter((i) => i.inStock || i.isStaple).length;

  const set = (patch: Partial<Controls>) => onChange({ ...value, ...patch });

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-6">
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

      <ChipGroup
        name="meal"
        label="Meal"
        options={MEAL_OPTIONS}
        value={value.mealType ?? ANY}
        onChange={(v) => set({ mealType: v === ANY ? undefined : (v as MealType) })}
      />

      <ChipGroup
        name="time"
        label="Time"
        options={TIME_OPTIONS}
        value={value.timeBucket ?? ANY}
        onChange={(v) => set({ timeBucket: v === ANY ? undefined : (v as TimeBucket) })}
      />

      {OPTION_SETS.map((entry) => (
        <ChipGroup
          key={entry.key}
          name={entry.key}
          label={entry.label}
          options={entry.options}
          value={value[entry.key] ?? ANY}
          onChange={(v) => set({ [entry.key]: v } as Partial<Controls>)}
        />
      ))}
    </fieldset>
  );
}
