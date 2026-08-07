import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Current user, or null. Use in Server Components that render differently
 * when signed out.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Current user, or redirect to login. Middleware already gates protected
 * routes; this is the defence-in-depth check for pages and route handlers
 * that must not run without a session.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
