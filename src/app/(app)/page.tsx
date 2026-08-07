import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getUser();

  return (
    <>
      <PageHeader
        title="What are you cooking?"
        description="Answer two questions and get something worth making — or generate an idea you've never tried."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/flow"
          className="bg-accent text-accent-fg hover:bg-accent-hover min-h-tap flex items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors"
        >
          Start the flow
        </Link>
        <Link
          href="/recipes"
          className="border-border-strong hover:bg-surface-muted min-h-tap flex items-center justify-center rounded-lg border px-6 text-sm font-medium transition-colors"
        >
          Browse all recipes
        </Link>
      </div>

      <p className="text-subtle mt-8 text-xs">Signed in as {user?.email}</p>
    </>
  );
}
