import { NextResponse, type NextRequest } from "next/server";

import { isAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing point. Exchanges the one-time code for a session,
 * then re-checks the allowlist before letting the session stand.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Belt and braces: the send path already gates on the allowlist, but a code
  // could have been issued for another address by some other route.
  if (!isAllowed(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  // Only allow relative redirects — an absolute URL here would be an open redirect.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${destination}`);
}
