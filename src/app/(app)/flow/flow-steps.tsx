import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MEAL_ICONS, MEAL_LABELS, MEAL_TYPES } from "@/lib/recipes/meal-types";
import {
  BUCKET_DESCRIPTIONS,
  BUCKET_LABELS,
  TIME_BUCKETS,
  type TimeBucket,
} from "@/lib/recipes/time-buckets";
import type { MealType } from "@/lib/supabase/types";

const STEPS = ["Meal", "Time", "Source"] as const;

/**
 * The whole flow is links over URL state — no client component, no local state.
 * Refresh, back button, and a shared link all behave correctly for free, and
 * step 3 can hand its parameters straight to the results page.
 */
export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-accent text-accent-fg"
                  : done
                    ? "bg-success-muted text-success"
                    : "bg-surface-muted text-subtle"
              }`}
            >
              {done ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
              {label}
            </span>
            {step < STEPS.length ? <span className="text-subtle text-xs">›</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ChoiceButton({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="border-border-strong hover:border-accent hover:bg-accent-muted flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center transition-colors"
    >
      <Icon size={26} strokeWidth={1.75} aria-hidden className="text-accent" />
      <span className="font-display text-lg font-semibold">{label}</span>
      {hint ? <span className="text-subtle text-xs">{hint}</span> : null}
    </Link>
  );
}

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted hover:text-foreground min-h-tap flex w-fit items-center gap-1 text-sm"
    >
      <ArrowLeft size={16} strokeWidth={2} aria-hidden />
      {children}
    </Link>
  );
}

export function StepMealType() {
  return (
    <div className="flex flex-col gap-6">
      <StepIndicator current={1} />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          What meal is this?
        </h1>
        <p className="text-muted text-sm">Pick where in the day you are.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MEAL_TYPES.map((meal) => (
          <ChoiceButton
            key={meal}
            href={`/flow?meal=${meal}`}
            icon={MEAL_ICONS[meal]}
            label={MEAL_LABELS[meal]}
          />
        ))}
      </div>
    </div>
  );
}

export function StepTime({ meal }: { meal: MealType }) {
  return (
    <div className="flex flex-col gap-6">
      <StepIndicator current={2} />
      <BackLink href="/flow">Change meal</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          How much time have you got?
        </h1>
        <p className="text-muted text-sm">{MEAL_LABELS[meal]} — how long can you spend?</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIME_BUCKETS.map((bucket) => (
          <ChoiceButton
            key={bucket}
            href={`/flow?meal=${meal}&time=${bucket}`}
            icon={MEAL_ICONS[meal]}
            label={BUCKET_LABELS[bucket]}
            hint={BUCKET_DESCRIPTIONS[bucket]}
          />
        ))}
      </div>
    </div>
  );
}

export function StepSource({ meal, time }: { meal: MealType; time: TimeBucket }) {
  const query = `mealType=${meal}&timeBucket=${time}`;

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator current={3} />
      <BackLink href={`/flow?meal=${meal}`}>Change time</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Something you know, or something new?
        </h1>
        <p className="text-muted text-sm">
          {MEAL_LABELS[meal]} · {BUCKET_LABELS[time]} — {BUCKET_DESCRIPTIONS[time].toLowerCase()}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChoiceButton
          href={`/recipes?${query}`}
          icon={BookOpen}
          label="Cookbook"
          hint="Recipes you already have"
        />
        <ChoiceButton
          href={`/generate?${query}`}
          icon={Sparkles}
          label="Generate new"
          hint="Something you haven't cooked"
        />
      </div>
    </div>
  );
}
