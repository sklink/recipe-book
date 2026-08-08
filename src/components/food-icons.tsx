import type { LucideProps } from "lucide-react";

/**
 * The icons lucide doesn't have.
 *
 * A cookbook needs rice, pasta, noodles, potatoes, tacos, lamb and pickles, and
 * lucide has none of them. These are drawn to its conventions — 24-unit grid,
 * 2px round-capped strokes, currentColor, no fill — so they inherit chip colour
 * on selection and sit beside the real ones without looking bolted on.
 *
 * Deliberately simple silhouettes: at the 14px these render at, detail turns to
 * mud. Each one is distinguishable from its neighbours in the same group, which
 * matters more than being a good drawing — rice and noodles are both bowls, so
 * one gets a mound and the other gets chopsticks.
 */
function glyph(name: string, children: React.ReactNode) {
  function Icon({ size = 24, strokeWidth = 2, ...props }: LucideProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {children}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

/** A bowl with a mound heaped in it. */
export const Rice = glyph(
  "Rice",
  <>
    <path d="M3 12h18a9 9 0 0 1-18 0Z" />
    <path d="M6.5 12a5.5 5.5 0 0 1 11 0" />
  </>,
);

/** Loose strands — spaghetti rather than a bowl, to stay clear of Noodles. */
export const Pasta = glyph(
  "Pasta",
  <>
    <path d="M7 3c-1.4 3 1.4 4 0 7s1.4 4 0 7 1.4 4 0 4" />
    <path d="M12 3c-1.4 3 1.4 4 0 7s1.4 4 0 7 1.4 4 0 4" />
    <path d="M17 3c-1.4 3 1.4 4 0 7s1.4 4 0 7 1.4 4 0 4" />
  </>,
);

/** The same bowl as Rice, with chopsticks instead of a mound. */
export const Noodles = glyph(
  "Noodles",
  <>
    <path d="M3 12h18a9 9 0 0 1-18 0Z" />
    <path d="m14 9 7-6" />
    <path d="m16.5 10.5 6-5" />
  </>,
);

/** A lumpy oval with eyes. */
export const Potato = glyph(
  "Potato",
  <>
    <ellipse cx="12" cy="12" rx="9.5" ry="6.5" transform="rotate(-20 12 12)" />
    <path d="M9.5 10.5h.01" />
    <path d="M13.5 13h.01" />
    <path d="M14.5 9h.01" />
  </>,
);

/** A folded shell with a line of filling. */
export const Taco = glyph(
  "Taco",
  <>
    <path d="M3 18a9 9 0 0 1 18 0Z" />
    <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
  </>,
);

/** A cutlet with the bone still in. */
export const Chop = glyph(
  "Chop",
  <>
    <path d="M13 21a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
    <path d="m17.6 8.4 2.6-2.6" />
    <path d="M19.4 3.6a1.8 1.8 0 1 1 1 3.1" />
  </>,
);

/** A lidded jar with something standing in it. */
export const Jar = glyph(
  "Jar",
  <>
    <path d="M9 2.5h6" />
    <path d="M9.5 5.5h5" />
    <path d="M7 9.5a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 17 9.5v9a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.5Z" />
    <path d="M10.5 11.5v6" />
    <path d="M13.5 11.5v6" />
  </>,
);
