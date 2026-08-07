import { HashSession } from "@/app/login/hash-session";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  const errorMessage =
    error === "not_allowed"
      ? "That account isn't allowed to sign in."
      : error === "exchange_failed"
        ? "That sign-in link was invalid or has expired. Request a new one."
        : error === "no_token"
          ? "That link didn't carry a sign-in token. Request a new one."
          : undefined;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Recipe Book</h1>
        <p className="text-sm opacity-60">Sign in with a link sent to your email.</p>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm"
        >
          {errorMessage}
        </p>
      ) : null}

      <HashSession />
      <LoginForm next={next} />
    </main>
  );
}
