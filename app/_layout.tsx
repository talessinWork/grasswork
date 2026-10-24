/**
 * Root: fonts, splash, gesture + safe-area roots, real services, onboarding gate,
 * reminder sync on start / foreground, and notification taps → session.
 */
import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { SessionKind } from '../src/core/types';
import type { AppServices } from '../src/services/contract';
import { bootstrapServices } from '../src/ui/bootstrap';
import { sessionKindFromUrl } from '../src/ui/links';
import { ServicesProvider, useServices, useSettings } from '../src/ui/ServicesProvider';
import { isSessionActive } from '../src/ui/sessionActive';
import { Txt } from '../src/ui/Txt';
import { color } from '../src/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 700, fade: true });

/**
 * Replaces the handler bootstrapServices() installed via configureNotificationHandler(): same behaviour,
 * except that while a session screen is mounted reminders are delivered silently (no banner, list entry
 * or sound over the camera). Must run after bootstrapServices() so it wins.
 */
function installSessionAwareNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const show = !isSessionActive();
      return {
        shouldShowAlert: show,
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
  });
  const [services, setServices] = useState<AppServices | null>(null);
  const [bootError, setBootError] = useState<Error | null>(null);

  useEffect(() => {
    bootstrapServices()
      .then((s) => {
        installSessionAwareNotificationHandler();
        setServices(s);
      })
      .catch((e) => setBootError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  const fontsReady = fontsLoaded || !!fontError;

  if (bootError && fontsReady) {
    SplashScreen.hideAsync().catch(() => {});
    return (
      <View style={styles.error}>
        <Txt variant="title">Gus couldn't wake up</Txt>
        <Txt color="muted">{bootError.message}</Txt>
      </View>
    );
  }
  if (!fontsReady || !services) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ServicesProvider services={services}>
          <Gate />
        </ServicesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gate() {
  const services = useServices();
  const { settings } = useSettings();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const pendingKind = useRef<SessionKind | null>(null);

  // splash stays up until settings are known, so the first frame is the right screen
  useEffect(() => {
    if (settings) SplashScreen.hideAsync().catch(() => {});
  }, [settings]);

  // onboarding gate
  const onboarded = settings?.onboarded ?? null;
  const inOnboarding = segments[0] === 'onboarding';
  useEffect(() => {
    // leaving onboarding is done by the rhythm screen itself (it goes straight into the baseline test)
    if (onboarded === false && !inOnboarding) router.replace('/onboarding/goals');
  }, [onboarded, inOnboarding, router]);

  // reminders: on start (services.init already did) and every time the app comes back
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') services.syncReminders(Date.now()).catch((e) => console.warn('[grasswork] sync failed', e));
    });
    return () => sub.remove();
  }, [services]);

  // notification taps (cold start + while running) → session.
  // Already on /session (a session running, or a grasswork://session link that just opened it): do nothing,
  // otherwise a second camera screen would stack on top of the running session.
  const openSession = (kind: SessionKind) => {
    if (!onboarded) {
      pendingKind.current = kind;
      return;
    }
    if (pathnameRef.current === '/session') return;
    router.push({ pathname: '/session', params: { kind } });
  };
  const openRef = useRef(openSession);
  openRef.current = openSession;

  useEffect(() => {
    let handled: string | null = null;
    const handle = (r: Notifications.NotificationResponse | null) => {
      if (!r || r.notification.request.identifier === handled) return;
      handled = r.notification.request.identifier;
      const url = r.notification.request.content.data?.url;
      const kind = sessionKindFromUrl(typeof url === 'string' ? url : null);
      if (kind) openRef.current(kind);
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (onboarded && pendingKind.current) {
      const k = pendingKind.current;
      pendingKind.current = null;
      if (pathnameRef.current !== '/session') router.push({ pathname: '/session', params: { kind: k } });
    }
  }, [onboarded, router]);

  if (!settings) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.stone }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="session"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, contentStyle: { backgroundColor: color.camera } }}
        />
        <Stack.Screen name="boss" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: color.forest } }} />
        <Stack.Screen
          name="rank-up"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, contentStyle: { backgroundColor: color.moss } }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { flex: 1, padding: 24, justifyContent: 'center', gap: 8, backgroundColor: color.stone },
});
