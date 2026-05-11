import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TedtErfassung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [tedtErfassung, setTedtErfassung] = useState<TedtErfassung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [tedtErfassungData] = await Promise.all([
        LivingAppsService.getTedtErfassung(),
      ]);
      setTedtErfassung(tedtErfassungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [tedtErfassungData] = await Promise.all([
          LivingAppsService.getTedtErfassung(),
        ]);
        setTedtErfassung(tedtErfassungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  return { tedtErfassung, setTedtErfassung, loading, error, fetchAll };
}