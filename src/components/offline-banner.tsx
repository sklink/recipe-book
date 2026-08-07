"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Tells you the connection dropped, and that the app still works.
 *
 * Worth saying explicitly: recipes are served from the persisted cache, so
 * being offline in a kitchen degrades rather than breaks — but a stale page with
 * no explanation reads as broken.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-warning-muted text-warning border-warning/30 flex items-center justify-center gap-2 border-b px-4 py-2 text-xs"
    >
      <WifiOff size={13} strokeWidth={2} aria-hidden />
      Offline — showing your saved cookbook. Changes will fail until you reconnect.
    </div>
  );
}
