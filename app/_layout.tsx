import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TripProvider } from '../src/rn/state/tripStore';
import { AppModal, Button, Stack as UiStack, Text } from '../src/rn/ui';
import { DEMO_API_REQUEST_EVENT } from '../src/rn/services/demoMode';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const faviconHref = '/favicon.svg?v=2';
    document.querySelectorAll("link[rel~='icon']").forEach((node) => node.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = faviconHref;
    document.head.appendChild(link);

    ensureHeadLink('apple-touch-icon', '/tripbuddy-icon-192.png');
    ensureHeadLink('manifest', '/manifest.webmanifest');

    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      document.head.appendChild(themeColor);
    }
    themeColor.content = '#2575F1';
  }, []);

  return (
    <SafeAreaProvider>
      <TripProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
        <DemoAvailabilityModal />
      </TripProvider>
    </SafeAreaProvider>
  );
}

function DemoAvailabilityModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const show = () => setVisible(true);
    window.addEventListener(DEMO_API_REQUEST_EVENT, show);
    return () => window.removeEventListener(DEMO_API_REQUEST_EVENT, show);
  }, []);

  return (
    <AppModal visible={visible} title="Demo available on request" onClose={() => setVisible(false)}>
      <UiStack>
        <Text>This hosted preview does not connect to TripBuddy backend services. Contact us to request a live demo.</Text>
        <Button onPress={() => setVisible(false)}>OK</Button>
      </UiStack>
    </AppModal>
  );
}

function ensureHeadLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}
