const DEFAULT_SITE_URL = 'https://thetripbuddy.in';

export function siteUrl(path = '/') {
  const origin = (process.env.EXPO_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).trim().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}
