"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { sendMagicLink, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-foreground text-background min-h-11 rounded-md px-4 text-sm font-medium disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send sign-in link"}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-md border border-black/10 px-3 py-3 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="min-h-11 rounded-md border border-black/15 px-3 text-base dark:border-white/20"
      />
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
