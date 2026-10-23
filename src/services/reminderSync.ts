/**
 * Content-aware notification sync.
 * core syncNotifications diffs by id only, so a queued reminder kept stale text after a tone or streak change.
 * Here every scheduled reminder has a fingerprint (hash of title + body + fireAt + url). Ids whose desired
 * content differs from what we scheduled, or whose content we never saw (e.g. queued by a previous app launch),
 * are cancelled first; core syncNotifications then adds them back with the new content and drops stale ids.
 */
import type { ScheduledReminder } from '../core/types';
import { syncNotifications, type NotificationAdapter } from '../core/reminders/scheduler';
import { hashString } from './helpers';

export function fingerprint(r: ScheduledReminder): string {
  return hashString(`${r.title}\u0000${r.body}\u0000${r.fireAt}\u0000${r.url}`).toString(36);
}

export interface ReminderSyncer {
  sync(desired: ScheduledReminder[]): Promise<{ scheduled: number; cancelled: number; refreshed: number }>;
}

export function createReminderSyncer(adapter: NotificationAdapter): ReminderSyncer {
  /** id -> fingerprint of the content we last scheduled under that id */
  const known = new Map<string, string>();

  const tracking: NotificationAdapter = {
    scheduledIds: () => adapter.scheduledIds(),
    async schedule(r) {
      await adapter.schedule(r);
      known.set(r.id, fingerprint(r));
    },
    async cancel(id) {
      await adapter.cancel(id);
      known.delete(id);
    },
  };

  return {
    async sync(desired) {
      const existing = new Set(await adapter.scheduledIds());
      let refreshed = 0;
      for (const r of desired) {
        if (existing.has(r.id) && known.get(r.id) !== fingerprint(r)) {
          await tracking.cancel(r.id);
          refreshed++;
        }
      }
      for (const id of [...known.keys()]) if (!existing.has(id)) known.delete(id);
      const res = await syncNotifications(tracking, desired);
      return { scheduled: res.scheduled, cancelled: res.cancelled + refreshed, refreshed };
    },
  };
}
