export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Recipe Book</h1>
      <p className="text-base opacity-70">
        Figure out what to cook, based on the time you have, the ingredients in the kitchen, and
        whether you want something familiar or something new.
      </p>
      <p className="text-sm opacity-50">
        Scaffold deployed. See <code className="font-mono">docs/PLAN.md</code> for what comes next.
      </p>
    </main>
  );
}
