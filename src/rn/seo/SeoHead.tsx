import Head from 'expo-router/head';
import { Platform } from 'react-native';
import { siteUrl } from './site';

type Breadcrumb = {
  name: string;
  path: string;
};

export function SeoHead({
  title,
  description,
  path,
  noIndex = false,
  breadcrumbs = []
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  breadcrumbs?: Breadcrumb[];
}) {
  if (Platform.OS !== 'web') return null;

  const canonical = siteUrl(path);
  const breadcrumbSchema = breadcrumbs.length > 1 ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((breadcrumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: breadcrumb.name,
      item: siteUrl(breadcrumb.path)
    }))
  } : undefined;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="TripBuddy" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      {noIndex ? <meta name="robots" content="noindex, follow" /> : null}
      {breadcrumbSchema ? (
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      ) : null}
    </Head>
  );
}
