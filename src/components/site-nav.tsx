"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive, NAV_ITEMS } from "@/lib/nav";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="bg-surface/90 border-border sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 sm:px-6">
        <Link
          href="/"
          className="font-display min-h-tap hidden shrink-0 items-center pr-2 text-lg font-semibold tracking-tight sm:flex"
        >
          Recipe Book
        </Link>

        <nav aria-label="Main" className="min-w-0 flex-1">
          <ul className="no-scrollbar flex items-stretch gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`min-h-tap flex flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:text-sm ${
                      active
                        ? "text-accent bg-accent-muted"
                        : "text-muted hover:text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2} aria-hidden />
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <form action="/auth/signout" method="post" className="shrink-0">
          <button
            type="submit"
            className="text-muted hover:text-foreground min-h-tap hidden items-center px-3 text-sm sm:flex"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
