/**
 * Single-user access control.
 *
 * The RLS policies grant every authenticated session full read/write access
 * (see the initial migration). That is only safe because exactly one identity
 * is ever allowed to authenticate — this allowlist is what enforces it.
 *
 * Also turn off public signups in the Supabase dashboard
 * (Authentication -> Providers -> Email -> "Allow new users to sign up").
 * This check is the application-level belt to that server-side braces.
 */

export function allowedEmail(): string {
  const value = process.env.AUTH_ALLOWED_EMAIL;
  if (!value) {
    throw new Error(
      "Missing environment variable: AUTH_ALLOWED_EMAIL. " +
        "Set it to the one email address permitted to sign in.",
    );
  }
  return value.trim().toLowerCase();
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === allowedEmail();
}
