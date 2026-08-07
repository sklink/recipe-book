import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { isAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing point. Handles both shapes Supabase can produce:
 *
 *   ?code=...                     PKCE — what the app's own login form starts,
 *                                 exchanged with exchangeCodeForSession.
 *   ?token_hash=...&type=...      Server-side verification — what admin-generated
 *                                 links and {{ .TokenHash }} email templates use.
 *
 * There is a third shape, the implicit flow (#access_token=... in the URL
 * fragment), which a server route can never see: fragments are not sent in the
 * HTTP request. That one is completed browser-side on /login instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only relative redirects — an absolute URL here would be an open redirect.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${reason}`);

  const supabase = await createClient();

  let email: string | null | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("exchange_failed");
    email = data.user?.email;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("exchange_failed");
    email = data.user?.email;
  } else {
    return fail("no_token");
  }

  // Belt and braces: the send path already gates on the allowlist, but a link
  // could have been issued for another address by some other route.
  if (!isAllowed(email)) {
    await supabase.auth.signOut();
    return fail("not_allowed");
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
