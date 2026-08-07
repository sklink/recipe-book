"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";

const ONE_DAY = 1000 * 60 * 60 * 24;

/**
 * Query client with localStorage persistence.
 *
 * The cookbook is read far more often than it changes, and a kitchen is exactly
 * where the connection is worst — so cached data is rendered immediately on
 * load and revalidated behind it, rather than showing a spinner.
 *
 * localStorage rather than IndexedDB: the whole cookbook is a few hundred KB of
 * JSON, well inside the 5MB budget, and the synchronous persister avoids an
 * async hydration step before first paint. Revisit if recipes ever carry
 * anything bulky.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // a minute of trusting the cache before refetch
        gcTime: ONE_DAY,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState, not a module-level singleton: a shared client would leak one
  // user's cache into the next render pass on the server.
  const [queryClient] = useState(makeQueryClient);

  // The provider must render on the server too. Skipping it there leaves child
  // components calling useQuery with no client, which throws and turns every
  // server render into a 500 — invisible in the browser, because the client
  // render then recovers and paints the page anyway.
  //
  // `storage: undefined` makes the persister a no-op rather than a crash, which
  // is exactly right on the server: nothing to restore, nothing to write.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: "recipe-book-cache",
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: ONE_DAY }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
