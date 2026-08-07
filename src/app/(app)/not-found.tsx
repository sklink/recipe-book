import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="font-display text-2xl font-semibold">Not found.</h1>
      <p className="text-muted max-w-prose text-sm">
        That recipe doesn&rsquo;t exist, or it was deleted.
      </p>
      <Link
        href="/recipes"
        className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex items-center rounded-lg px-5 text-sm font-medium transition-colors"
      >
        Back to the cookbook
      </Link>
    </div>
  );
}
