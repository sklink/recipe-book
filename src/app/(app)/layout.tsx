import { IngredientSidebar } from "@/components/ingredient-sidebar";
import { SiteNav } from "@/components/site-nav";
import { requireUser } from "@/lib/auth/session";

/**
 * Shell for every signed-in page. Login sits outside this group so it renders
 * without nav or sidebar.
 *
 * min-h-dvh rather than min-h-full: a percentage min-height resolved against a
 * parent whose own height is only a min-height doesn't compute, which left the
 * sidebar column collapsed to its content instead of running the full page.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav />
      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <IngredientSidebar />
      </div>
    </div>
  );
}
