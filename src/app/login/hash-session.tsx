"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Parsed =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string };

function parseHash(): Parsed {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return { kind: "none" };

  const params = new URLSearchParams(hash.slice(1));

  // Supabase reports its own failures in the fragment too.
  const error = params.get("error_description") ?? params.get("error");
  if (error) return { kind: "error", message: error.replace(/\+/g, " ") };

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return { kind: "none" };

  return { kind: "tokens", accessToken, refreshToken };
}

/**
 * Completes an implicit-flow sign-in.
 *
 * Supabase's `/auth/v1/verify` endpoint returns tokens in the URL fragment
 * (#access_token=...&refresh_token=...). Fragments never reach the server, so
 * the callback route cannot handle these — without this component the user
 * lands on /login holding a full set of valid tokens in the address bar and
 * nothing happens at all, which is the worst possible failure mode.
 *
 * State is set inside the async continuation rather than in the effect body:
 * React flags synchronous setState during an effect, and there is no need for
 * it here.
 */
export function HashSession() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const parsed = parseHash();
    if (parsed.kind === "none") return;

    let cancelled = false;

    void (async () => {
      if (cancelled) return;

      if (parsed.kind === "error") {
        setState("error");
        setMessage(parsed.message);
        return;
      }

      setState("working");

      const supabase = createClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (cancelled) return;

      if (error) {
        setState("error");
        setMessage(error.message);
        return;
      }
      if (!data.user?.email) {
        setState("error");
        setMessage("Signed in, but no account was returned.");
        return;
      }

      // Strip the tokens from the address bar before navigating, so they don't
      // linger in history or get pasted somewhere.
      window.history.replaceState(null, "", window.location.pathname);

      router.replace("/");
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "idle") return null;

  if (state === "error") {
    return (
      <p
        role="alert"
        className="border-danger/30 bg-danger-muted rounded-md border px-3 py-2 text-sm"
      >
        {message ?? "That sign-in link could not be completed."}
      </p>
    );
  }

  return (
    <p role="status" className="text-muted text-sm">
      Signing you in…
    </p>
  );
}
