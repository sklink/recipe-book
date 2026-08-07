import { Carrot, ChefHat, Receipt, ShoppingCart, Sparkles, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the 375px nav, where five items must fit. */
  shortLabel: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/flow", label: "Start", shortLabel: "Start", icon: ChefHat },
  { href: "/recipes", label: "Recipes", shortLabel: "Recipes", icon: UtensilsCrossed },
  { href: "/generate", label: "Generate", shortLabel: "New", icon: Sparkles },
  { href: "/ingredients", label: "Ingredients", shortLabel: "Stock", icon: Carrot },
  { href: "/cart", label: "Cart", shortLabel: "Cart", icon: ShoppingCart },
  { href: "/usage", label: "Usage", shortLabel: "Usage", icon: Receipt },
];

/**
 * The flow is deliberately chrome-free: the sidebar would compete with a
 * three-step decision that is supposed to be the only thing on screen.
 */
export function showsSidebar(pathname: string): boolean {
  return !pathname.startsWith("/flow");
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
