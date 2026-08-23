import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TripProvider } from '../src/rn/state/tripStore';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const faviconHref = '/favicon.svg';
    document.querySelectorAll("link[rel~='icon']").forEach((node) => node.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = faviconHref;
    document.head.appendChild(link);
  }, []);

  return (
    <SafeAreaProvider>
      <TripProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </TripProvider>
    </SafeAreaProvider>
  );
}
