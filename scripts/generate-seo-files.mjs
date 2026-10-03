import { readFile, writeFile } from 'node:fs/promises';

const cityFile = new URL('../src/rn/seo/supportedCities.json', import.meta.url);
const publicDirectory = new URL('../public/', import.meta.url);
const cities = JSON.parse(await readFile(cityFile, 'utf8'));
const siteUrl = (process.env.EXPO_PUBLIC_SITE_URL || 'https://thetripbuddy.in').trim().replace(/\/$/, '');
const durations = [1, 2, 3, 4, 5];
const paths = [
  '/',
  '/travel',
  ...cities.flatMap(({ slug }) => [
    `/travel/${slug}`,
    ...durations.map((days) => `/travel/${slug}/${days}-day-itinerary`)
  ])
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...paths.map((path) => `  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc></url>`),
  '</urlset>',
  ''
].join('\n');

const robots = [
  'User-agent: *',
  'Allow: /',
  'Allow: /travel/',
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  ''
].join('\n');

await Promise.all([
  writeFile(new URL('sitemap.xml', publicDirectory), sitemap),
  writeFile(new URL('robots.txt', publicDirectory), robots)
]);

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
