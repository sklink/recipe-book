import { CookingPot, ImageOff } from "lucide-react";

/**
 * Recipe imagery, with a placeholder that looks deliberate rather than broken.
 *
 * Every seeded recipe is image_status="pending" until T21 generates artwork, so
 * the placeholder is the normal case right now, not an edge case. The tint is
 * derived from the title, so a recipe always gets the same colour and a grid
 * reads as varied — see the .tint-* classes in globals.css, which carry dark
 * counterparts an inline colour could not.
 */

const TINT_COUNT = 8;

/** djb2 — distributes short strings across buckets far better than a rolling sum. */
function tintFor(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TINT_COUNT;
}

export function RecipeImage({
  title,
  imageUrl,
  imageStatus,
  className = "",
  sizes = "(min-width: 640px) 20rem, 100vw",
}: {
  title: string;
  imageUrl: string | null;
  imageStatus: "pending" | "ready" | "failed";
  className?: string;
  sizes?: string;
}) {
  if (imageUrl && imageStatus === "ready") {
    return (
      // Plain img rather than next/image: these are remote URLs from an image
      // model at unknown dimensions, and the optimiser needs configured hosts.
      // Revisit in T21 once the storage bucket is a known origin.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={title}
        sizes={sizes}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const failed = imageStatus === "failed";
  const Icon = failed ? ImageOff : CookingPot;

  return (
    <div
      role="img"
      aria-label={failed ? `No image for ${title}` : `Image for ${title} not yet generated`}
      className={`tint-${tintFor(title)} flex h-full w-full items-center justify-center ${className}`}
      style={{ backgroundColor: "var(--tint-bg)" }}
    >
      <Icon size={28} strokeWidth={1.5} style={{ color: "var(--tint-fg)" }} aria-hidden />
    </div>
  );
}
