/** Wires the real services: SQLite repo + expo-notifications adapter. */
import { createSqliteRepo } from '../core/db/sqliteRepo';
import { configureNotificationHandler, createExpoNotificationAdapter } from '../core/reminders/expoAdapter';
import { createAppServices } from '../services/app';
import type { AppServices } from '../services/contract';

let pending: Promise<AppServices> | null = null;

/** Idempotent: fast refresh / remounts reuse the same instance. */
export function bootstrapServices(): Promise<AppServices> {
  if (!pending) {
    pending = (async () => {
      configureNotificationHandler();
      const repo = await createSqliteRepo();
      const services = createAppServices(repo, createExpoNotificationAdapter());
      await services.init();
      return services;
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

export { ensureNotificationPermission } from '../core/reminders/expoAdapter';
