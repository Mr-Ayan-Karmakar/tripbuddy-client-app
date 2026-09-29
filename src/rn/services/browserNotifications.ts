import { isBackendDemoMode } from './demoMode';

const NOTIFICATION_WORKER_PATH = '/tripbuddy-notification-sw.js';
const NOTIFICATION_ICON_PATH = '/tripbuddy-icon-192.png';

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (isBackendDemoMode) return false;
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  try {
    if (window.Notification.permission === 'granted') return true;
    if (window.Notification.permission === 'denied') return false;
    return await window.Notification.requestPermission() === 'granted';
  } catch {
    return false;
  }
}

export async function showItineraryReadyNotification(destination: string, days: number): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') return;

  const city = destination.split(',')[0]?.trim() || 'your destination';
  const title = 'Your TripBuddy itinerary is ready';
  const options: NotificationOptions = {
    body: `Your ${days}-day ${city} itinerary is ready to review and customize.`,
    icon: NOTIFICATION_ICON_PATH,
    badge: NOTIFICATION_ICON_PATH,
    tag: 'tripbuddy-itinerary-ready'
  };

  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register(NOTIFICATION_WORKER_PATH);
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    }

    new window.Notification(title, options);
  } catch {
    try {
      new window.Notification(title, options);
    } catch {
      // Notifications are optional and must not interrupt the completed itinerary flow.
    }
  }
}
