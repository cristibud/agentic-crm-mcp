import { useCallback, useState } from 'react';
import { getSettings, updateSettings, type Settings } from '@/lib/api';

export function useSettings(autoLoad = true) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSettings();
      setSettings(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (updates: Partial<Settings>) => {
      try {
        setIsLoading(true);
        setError(null);
        const updated = await updateSettings(updates);
        setSettings(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save settings';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    settings,
    isLoading,
    error,
    loadSettings,
    saveSettings,
  };
}
