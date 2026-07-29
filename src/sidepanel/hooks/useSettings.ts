import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../lib/storage/settingsStore';
import { Settings } from '../../lib/storage/schema';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const save = useCallback(async (next: Settings) => {
    await saveSettings(next);
    setSettings(next);
  }, []);

  return { settings, loading, save };
}
