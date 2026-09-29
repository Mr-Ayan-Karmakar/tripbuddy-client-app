import { Platform } from 'react-native';

export const DEMO_API_REQUEST_EVENT = 'tripbuddy:demo-api-request';

const configuredDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE;
const hasConfiguredApi = Boolean(process.env.EXPO_PUBLIC_API_BASE_URL?.trim());

export const isBackendDemoMode = Platform.OS === 'web' && (
  configuredDemoMode === 'true'
  || (configuredDemoMode !== 'false' && process.env.NODE_ENV === 'production' && !hasConfiguredApi)
);

export function requireBackendAvailable() {
  if (!isBackendDemoMode) return;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DEMO_API_REQUEST_EVENT));
  }
  throw new Error('Demo available on request.');
}
