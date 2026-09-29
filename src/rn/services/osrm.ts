import { GeoPoint, TravelLeg } from '../types';

const OSRM_BASE_URL = (process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(/\/$/, '');
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 10_000;

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{ distance?: number; duration?: number }>;
};

export async function fetchDrivingLeg(
  from: GeoPoint,
  to: GeoPoint,
  options: { signal?: AbortSignal; onRateLimited?: (retryDelayMs: number) => void } = {}
): Promise<TravelLeg> {
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=false&steps=false`;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(url, { signal: options.signal });
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryDelayMs = retryDelay(response.headers.get('retry-after'), attempt);
      options.onRateLimited?.(retryDelayMs);
      await wait(retryDelayMs, options.signal);
      continue;
    }
    if (!response.ok) throw new Error(`OSRM request failed with status ${response.status}.`);

    const payload = await response.json() as OsrmRouteResponse;
    const route = payload.routes?.[0];
    if (payload.code !== 'Ok' || !Number.isFinite(route?.distance) || !Number.isFinite(route?.duration)) {
      throw new Error('OSRM did not return a driving route.');
    }
    const distanceMeters = Math.round(route!.distance!);
    const durationSeconds = Math.round(route!.duration!);
    return {
      distanceSource: 'osrm',
      distanceMeters,
      durationSeconds,
      distanceText: formatDistance(distanceMeters),
      durationText: formatDuration(durationSeconds)
    };
  }

  throw new Error('OSRM rate limit retries were exhausted.');
}

function retryDelay(retryAfter: string | null, attempt: number) {
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(MAX_RETRY_DELAY_MS, retryAfterSeconds * 1000);
  }
  return Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempt);
}

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(abortError());
    }, { once: true });
  });
}

function abortError() {
  const error = new Error('The OSRM request was cancelled.');
  error.name = 'AbortError';
  return error;
}

function formatDistance(distanceMeters: number) {
  return distanceMeters < 1000 ? `${distanceMeters} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} mins` : `${hours} hr${hours === 1 ? '' : 's'}`;
}
