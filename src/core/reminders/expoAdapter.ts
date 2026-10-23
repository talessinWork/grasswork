/**
 * expo-notifications implementation of NotificationAdapter.
 * The only file in src/core allowed to import 'expo-notifications' (excluded from tsc core + tests).
 */
import * as Notifications from 'expo-notifications';
import type { ScheduledReminder } from '../types';
import type { NotificationAdapter } from './scheduler';

const ANDROID_CHANNEL_ID = 'gus-reminders';

/** Show reminders as banners/alerts even while the app is in the foreground. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  // No-op on iOS (resolves null), so no Platform check / react-native import is needed.
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Gus reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Ask for permission if not yet decided. Resolves true when notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export function createExpoNotificationAdapter(): NotificationAdapter {
  let channelReady: Promise<void> | null = null;
  return {
    async scheduledIds(): Promise<string[]> {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all.map((n) => n.identifier);
    },
    async schedule(r: ScheduledReminder): Promise<void> {
      if (!channelReady) channelReady = ensureAndroidChannel();
      await channelReady;
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
          data: { url: r.url, reminderId: r.id, step: r.step },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(r.fireAt),
          channelId: ANDROID_CHANNEL_ID, // ignored on iOS
        },
      });
    },
    async cancel(id: string): Promise<void> {
      await Notifications.cancelScheduledNotificationAsync(id);
    },
  };
}
