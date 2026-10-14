import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { getBackendHealthy, subscribeBackendHealth } from '@/lib/queryClient';

/**
 * Read-only-mode notice (Line 3 of the resilience plan) — shown whenever a
 * query actually throws (see queryClient.ts's QueryCache onError/onSuccess),
 * which in this codebase means a real connectivity failure rather than a
 * normal "not found" response. Backed by the persisted query cache, so
 * whatever was last successfully loaded keeps rendering underneath instead
 * of a blank screen or crash — this banner is just the honest label on top
 * of it.
 */
export function OfflineBanner() {
  const [healthy, setHealthy] = useState(getBackendHealthy());

  useEffect(() => subscribeBackendHealth(setHealthy), []);

  if (healthy) return null;

  return (
    <div className="sticky top-0 z-100 flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium px-4 py-2 text-center">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      Prace konserwacyjne — widzisz ostatnio zapisane dane w trybie offline.
    </div>
  );
}
