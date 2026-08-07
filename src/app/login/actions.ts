"use server";

import { headers } from "next/headers";

import { isAllowed } from "@/lib/auth/allowlist";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  if (!email) {
    return { status: "error", message: "Enter an email address." };
  }

  // Reject non-allowlisted addresses before touching Supabase, so an
  // unauthorised address never triggers a signup or an email send.
  if (!isAllowed(email)) {
    return { status: "error", message: "That address isn't allowed to sign in." };
  }

  const origin = (await headers()).get("origin");
  const callback = new URL("/auth/callback", origin ?? "http://localhost:3000");
  if (next) callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "sent", message: `Check ${email} for a sign-in link.` };
}
