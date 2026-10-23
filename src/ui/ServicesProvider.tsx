import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Settings } from '../core/types';
import type { AppServices } from '../services/contract';

interface Ctx {
  services: AppServices;
  /** null until loaded */
  settings: Settings | null;
  /** persist + reschedule reminders + update context */
  updateSettings(next: Settings): Promise<void>;
  reloadSettings(): Promise<Settings>;
}

const ServicesContext = createContext<Ctx | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  const reloadSettings = useCallback(async () => {
    const s = await services.getSettings();
    setSettings(s);
    return s;
  }, [services]);

  const updateSettings = useCallback(
    async (next: Settings) => {
      setSettings(next);
      await services.saveSettings(next);
      await services.syncReminders(Date.now());
    },
    [services],
  );

  useEffect(() => {
    reloadSettings().catch((e) => console.warn('[grasswork] settings load failed', e));
  }, [reloadSettings]);

  const value = useMemo(() => ({ services, settings, updateSettings, reloadSettings }), [services, settings, updateSettings, reloadSettings]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

function useCtx(): Ctx {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used inside <ServicesProvider>');
  return ctx;
}

export function useServices(): AppServices {
  return useCtx().services;
}

export function useSettings() {
  const { settings, updateSettings, reloadSettings } = useCtx();
  return { settings, updateSettings, reloadSettings };
}
