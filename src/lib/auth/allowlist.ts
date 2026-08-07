/**
 * Household access control.
 *
 * The RLS policies grant every authenticated session full read/write access
 * (see the initial migration) — one shared cookbook, stock list and cart, which
 * is the intended model for a shared kitchen. That is only safe because the set
 * of identities that can authenticate is fixed and small: this allowlist is
 * what enforces it.
 *
 * Adding an address here grants full access to everything. There is no
 * per-user separation to fall back on.
 *
 * Also turn off public signups in the Supabase dashboard
 * (Authentication -> Sign In / Providers -> Email -> "Allow new users to sign
 * up"). This check is the application-level belt to that server-side braces.
 */

/** Comma-separated in AUTH_ALLOWED_EMAIL; whitespace around entries is ignored. */
export function allowedEmails(): string[] {
  const raw = process.env.AUTH_ALLOWED_EMAIL;
  if (!raw) {
    throw new Error(
      "Missing environment variable: AUTH_ALLOWED_EMAIL. " +
        "Set it to a comma-separated list of email addresses permitted to sign in.",
    );
  }

  const list = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (list.length === 0) {
    throw new Error("AUTH_ALLOWED_EMAIL is set but contains no addresses.");
  }
  return list;
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}
