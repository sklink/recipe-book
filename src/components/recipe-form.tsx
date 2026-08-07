"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { useIngredients } from "@/lib/ingredients/hooks";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/recipes/meal-types";
import type { MealType } from "@/lib/supabase/types";

export type RecipeFormValues = {
  title: string;
  description: string;
  mealTypes: MealType[];
  timeMinutes: string;
  servings: string;
  ingredients: {
    name: string;
    amount: string;
    unit: string;
    prepNote: string;
    isOptional: boolean;
  }[];
  steps: string[];
};

export const EMPTY_RECIPE: RecipeFormValues = {
  title: "",
  description: "",
  mealTypes: [],
  timeMinutes: "",
  servings: "",
  ingredients: [{ name: "", amount: "", unit: "", prepNote: "", isOptional: false }],
  steps: [""],
};

/** Moves an item within a list, returning a new array. */
function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * No width here on purpose. Tailwind emits `w-full` after `w-20`, so a caller
 * appending a narrower width to a base class that already says `w-full` loses
 * — same specificity, later rule wins. Width is the caller's job.
 */
const inputClass = "border-border bg-surface min-h-tap rounded-lg border px-3 text-sm";
const fieldClass = `${inputClass} w-full`;
/** Inside a flex row: min-w-0 lets it shrink instead of forcing the row wider. */
const flexFieldClass = `${inputClass} min-w-0 flex-1`;

/**
 * One form for both editing and creating.
 *
 * Ingredient names autocomplete against the canonical list via a datalist:
 * native, works on touch, and doesn't stop you typing something new — the
 * resolver handles an unrecognised name on save, so the field never blocks you.
 */
export function RecipeForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
  isSaving,
  error,
}: {
  initial: RecipeFormValues;
  submitLabel: string;
  onSubmit: (values: RecipeFormValues) => void;
  onDelete?: () => void;
  isSaving?: boolean;
  error?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const { data: ingredientData } = useIngredients();
  const listId = useId();

  const set = <K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const setIngredient = (index: number, patch: Partial<RecipeFormValues["ingredients"][number]>) =>
    setValues((v) => ({
      ...v,
      ingredients: v.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    }));

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      {/* Canonical names, offered but not enforced. */}
      <datalist id={listId}>
        {(ingredientData?.ingredients ?? []).map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="The thing a cook would want to know before starting."
            className="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-sm font-medium">Meal types</legend>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => {
              const active = values.mealTypes.includes(meal);
              return (
                <button
                  key={meal}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    set(
                      "mealTypes",
                      active
                        ? values.mealTypes.filter((m) => m !== meal)
                        : [...values.mealTypes, meal],
                    )
                  }
                  className={`min-h-tap rounded-full border px-4 text-sm font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border-strong text-muted hover:bg-surface-muted"
                  }`}
                >
                  {MEAL_LABELS[meal]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="time" className="text-sm font-medium">
              Total minutes
            </label>
            <input
              id="time"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.timeMinutes}
              onChange={(e) => set("timeMinutes", e.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="servings" className="text-sm font-medium">
              Serves
            </label>
            <input
              id="servings"
              type="number"
              inputMode="numeric"
              min={1}
              value={values.servings}
              onChange={(e) => set("servings", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Ingredients</h2>
        <ul data-testid="ingredient-fields" className="flex flex-col gap-3">
          {values.ingredients.map((ingredient, index) => (
            <li key={index} className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex gap-2">
                <input
                  aria-label={`Amount for ingredient ${index + 1}`}
                  value={ingredient.amount}
                  onChange={(e) => setIngredient(index, { amount: e.target.value })}
                  placeholder="200"
                  inputMode="decimal"
                  className={`${inputClass} w-20 shrink-0`}
                />
                <input
                  aria-label={`Unit for ingredient ${index + 1}`}
                  value={ingredient.unit}
                  onChange={(e) => setIngredient(index, { unit: e.target.value })}
                  placeholder="g"
                  // Wider than the amount: units run to "cloves", "to taste", "few sprigs".
                  className={`${inputClass} w-24 shrink-0`}
                />
                <input
                  aria-label={`Name for ingredient ${index + 1}`}
                  list={listId}
                  value={ingredient.name}
                  onChange={(e) => setIngredient(index, { name: e.target.value })}
                  placeholder="ingredient"
                  className={flexFieldClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Preparation note for ingredient ${index + 1}`}
                  value={ingredient.prepNote}
                  onChange={(e) => setIngredient(index, { prepNote: e.target.value })}
                  placeholder="finely chopped"
                  className={flexFieldClass}
                />
                <label className="text-muted min-h-tap flex shrink-0 items-center gap-1.5 px-1 text-xs">
                  <input
                    type="checkbox"
                    checked={ingredient.isOptional}
                    onChange={(e) => setIngredient(index, { isOptional: e.target.checked })}
                  />
                  optional
                </label>
                <button
                  type="button"
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() =>
                    set(
                      "ingredients",
                      values.ingredients.filter((_, i) => i !== index),
                    )
                  }
                  className="text-subtle hover:text-danger h-tap w-tap flex shrink-0 items-center justify-center rounded-lg"
                >
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            set("ingredients", [
              ...values.ingredients,
              { name: "", amount: "", unit: "", prepNote: "", isOptional: false },
            ])
          }
          className="border-border-strong hover:bg-surface-muted min-h-tap flex w-fit items-center gap-2 rounded-lg border px-4 text-sm font-medium"
        >
          <Plus size={15} strokeWidth={2} aria-hidden />
          Add ingredient
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Method</h2>
        <ol data-testid="step-fields" className="flex flex-col gap-3">
          {values.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="bg-surface-muted text-muted mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums">
                {index + 1}
              </span>
              <textarea
                aria-label={`Step ${index + 1}`}
                value={step}
                onChange={(e) =>
                  set(
                    "steps",
                    values.steps.map((s, i) => (i === index ? e.target.value : s)),
                  )
                }
                rows={2}
                className="border-border bg-surface min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
              />
              {/* Reorder buttons rather than drag: reliable on touch, and keyboard-operable. */}
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={`Move step ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => set("steps", move(values.steps, index, index - 1))}
                  className="text-subtle hover:text-foreground flex h-6 w-8 items-center justify-center disabled:opacity-30"
                >
                  <ChevronUp size={15} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label={`Move step ${index + 1} down`}
                  disabled={index === values.steps.length - 1}
                  onClick={() => set("steps", move(values.steps, index, index + 1))}
                  className="text-subtle hover:text-foreground flex h-6 w-8 items-center justify-center disabled:opacity-30"
                >
                  <ChevronDown size={15} strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                aria-label={`Remove step ${index + 1}`}
                onClick={() =>
                  set(
                    "steps",
                    values.steps.filter((_, i) => i !== index),
                  )
                }
                className="text-subtle hover:text-danger h-tap w-tap flex shrink-0 items-center justify-center rounded-lg"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => set("steps", [...values.steps, ""])}
          className="border-border-strong hover:bg-surface-muted min-h-tap flex w-fit items-center gap-2 rounded-lg border px-4 text-sm font-medium"
        >
          <Plus size={15} strokeWidth={2} aria-hidden />
          Add step
        </button>
      </section>

      {error ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="border-border bg-background sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap rounded-lg px-5 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {isSaving ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border-border-strong hover:bg-surface-muted min-h-tap rounded-lg border px-4 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-muted hover:text-danger min-h-tap ml-auto flex items-center gap-2 px-3 text-sm transition-colors"
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden />
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
