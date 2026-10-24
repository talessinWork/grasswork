/** Spoken cues via expo-speech, plus the two haptic moments of a hold. */
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

export function say(text: string, opts?: { interrupt?: boolean }) {
  if (opts?.interrupt !== false) Speech.stop();
  Speech.speak(text, { rate: 0.95, pitch: 1.0 });
}

export function hush() {
  Speech.stop();
}

export function hapticHoldStart() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticHoldDone() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticTap() {
  Haptics.selectionAsync().catch(() => {});
}
