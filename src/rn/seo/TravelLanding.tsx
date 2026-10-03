import { Link } from 'expo-router';
import { ArrowRight, CalendarDays, ChevronRight, MapPin, Sparkles } from 'lucide-react-native';
import { createElement, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../chrome';
import { useTrip } from '../state/tripStore';
import { colors, radius, spacing } from '../theme';
import { Container, Heading, PageScroll, Row, Screen, Stack, Text } from '../ui';
import { useResponsive } from '../useResponsive';
import {
  itineraryDurationSegment,
  SupportedCity,
  SupportedItineraryDuration,
  supportedCities,
  supportedItineraryDurations
} from './cities';
import { SeoHead } from './SeoHead';

export function TravelDirectoryPage() {
  return (
    <Screen>
      <SeoHead
        title="India Travel Planners & AI Itineraries | TripBuddy"
        description="Explore TripBuddy travel planners for supported destinations across India and create a personalized itinerary for your dates, pace, and interests."
        path="/travel"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Travel', path: '/travel' }
        ]}
      />
      <Header />
      <PageScroll>
        <TravelHero
          eyebrow="Explore destinations"
          title="Travel planners across India"
          description="Choose a destination, compare itinerary lengths, and continue to TripBuddy's planner for a trip shaped around your dates, pace, and interests."
        />
        <DestinationDirectory currentCitySlug={undefined} />
        <Footer />
      </PageScroll>
    </Screen>
  );
}

export function CityTravelPage({ city }: { city: SupportedCity }) {
  const description = `Plan a trip to ${city.name} with TripBuddy. Compare one- to five-day options, then generate a personalized itinerary for your dates, pace, and interests.`;

  return (
    <Screen>
      <SeoHead
        title={`${city.name} Travel Planner & AI Itinerary | TripBuddy`}
        description={description}
        path={`/travel/${city.slug}`}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Travel', path: '/travel' },
          { name: city.name, path: `/travel/${city.slug}` }
        ]}
      />
      <Header />
      <PageScroll>
        <Breadcrumbs city={city} />
        <TravelHero
          eyebrow="Personalized trip planning"
          title={`${city.name} Travel Planner`}
          description={`Choose the trip length that suits you, or head straight to the planner. TripBuddy builds the actual ${city.name} itinerary from your travel dates, preferred pace, and interests.`}
        >
          <PlannerCta city={city} />
        </TravelHero>
        <DurationLinks city={city} />
        <DestinationDirectory currentCitySlug={city.slug} />
        <Footer />
      </PageScroll>
    </Screen>
  );
}

export function DurationTravelPage({ city, days }: { city: SupportedCity; days: SupportedItineraryDuration }) {
  const { isMobile } = useResponsive();
  const description = `Create a personalized ${days} day ${city.name} itinerary with TripBuddy, tailored to your dates, travel pace, and interests.`;

  return (
    <Screen>
      <SeoHead
        title={`${days} Day ${city.name} Itinerary & AI Trip Planner | TripBuddy`}
        description={description}
        path={`/travel/${city.slug}/${itineraryDurationSegment(days)}`}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Travel', path: '/travel' },
          { name: city.name, path: `/travel/${city.slug}` },
          { name: `${days} Day Itinerary`, path: `/travel/${city.slug}/${itineraryDurationSegment(days)}` }
        ]}
      />
      <Header />
      <PageScroll>
        <Breadcrumbs city={city} days={days} />
        <TravelHero
          eyebrow={`${city.name} itinerary planner`}
          title={`${days} Day ${city.name} Itinerary`}
          description={`Use this ${days}-day option as the starting point for a trip that fits you. TripBuddy generates the actual schedule after you provide your dates, origin, preferred pace, and interests.`}
        >
          <PlannerCta city={city} days={days} />
        </TravelHero>
        <View style={styles.detailBand}>
          <Container>
            <Stack gap={spacing.lg} style={StyleSheet.flatten([styles.detailContent, isMobile && styles.detailContentMobile])}>
              <View style={styles.detailIcon}><Sparkles size={24} color={colors.primary} /></View>
              <Stack gap={spacing.sm} style={styles.detailCopy}>
                <Heading size="md">Built around your trip</Heading>
                <Text style={styles.bodyText}>
                  Your generated itinerary can be reviewed and customized in TripBuddy. Move or add places, adjust visit durations and start times, reschedule a day, or compact the plan after generation.
                </Text>
              </Stack>
            </Stack>
          </Container>
        </View>
        <DurationLinks city={city} currentDays={days} />
        <Footer />
      </PageScroll>
    </Screen>
  );
}

export function InvalidTravelPage() {
  return (
    <Screen>
      <SeoHead
        title="Travel planner not found | TripBuddy"
        description="Browse TripBuddy's supported travel destinations."
        path="/travel"
        noIndex
      />
      <Header />
      <PageScroll>
        <Container style={styles.notFound}>
          <Stack gap={spacing.md} style={styles.centered}>
            <Heading size="lg">Travel planner not found</Heading>
            <Text style={styles.bodyText}>That destination or itinerary length is not currently supported.</Text>
            <Link href="/travel" asChild>
              <Pressable accessibilityRole="link" style={styles.secondaryLink}>
                <Text style={styles.secondaryLinkText}>Explore destinations</Text>
              </Pressable>
            </Link>
          </Stack>
        </Container>
        <Footer />
      </PageScroll>
    </Screen>
  );
}

function TravelHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  const { isMobile } = useResponsive();

  return (
    <View style={styles.hero}>
      <Container style={StyleSheet.flatten([styles.heroInner, isMobile && styles.heroInnerMobile])}>
        <Stack gap={spacing.lg} style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <TravelPageTitle>{title}</TravelPageTitle>
          <Text style={styles.heroDescription}>{description}</Text>
          {children}
        </Stack>
        {!isMobile ? <View style={styles.heroMarker} accessibilityElementsHidden>
          <MapPin size={40} color={colors.surface} />
        </View> : null}
      </Container>
    </View>
  );
}

function TravelPageTitle({ children }: { children: string }) {
  if (Platform.OS === 'web') {
    return createElement('h1', { style: webStyles.pageTitle }, children);
  }
  return <Heading size="xl" style={styles.heroTitle}>{children}</Heading>;
}

function PlannerCta({ city, days }: { city: SupportedCity; days?: SupportedItineraryDuration }) {
  const { startNewTrip } = useTrip();
  const { isMobile } = useResponsive();
  const label = days
    ? `Generate My Personalized ${days}-Day ${city.name} Itinerary`
    : `Generate Your Personalized ${city.name} Itinerary`;

  return (
    <Link href="/trip/create" asChild>
      <Pressable
        accessibilityRole="link"
        onPress={() => startNewTrip({ source: '', destination: city.name, ...(days ? { days } : {}) })}
        style={StyleSheet.flatten([styles.primaryCta, isMobile && styles.primaryCtaMobile])}
      >
        <Sparkles size={17} color={colors.surface} />
        <Text style={styles.primaryCtaText}>{label}</Text>
        {!isMobile ? <ArrowRight size={17} color={colors.surface} /> : null}
      </Pressable>
    </Link>
  );
}

function DurationLinks({ city, currentDays }: { city: SupportedCity; currentDays?: SupportedItineraryDuration }) {
  return (
    <Container>
      <Stack gap={spacing.lg}>
        <Stack gap={spacing.xs}>
          <Text style={styles.sectionEyebrow}>Choose your trip length</Text>
          <Heading size="lg">{city.name} itinerary options</Heading>
        </Stack>
        <View style={styles.linkGrid}>
          {supportedItineraryDurations.map((days) => (
            <Link
              key={days}
              href={{
                pathname: '/travel/[city]/[duration]',
                params: { city: city.slug, duration: itineraryDurationSegment(days) }
              }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                style={StyleSheet.flatten([
                  styles.durationLink,
                  currentDays === days && styles.durationLinkActive
                ])}
              >
                <CalendarDays size={20} color={currentDays === days ? colors.surface : colors.primary} />
                <Text style={StyleSheet.flatten([styles.durationText, currentDays === days && styles.durationTextActive])}>
                  {days} Day {city.name} Itinerary
                </Text>
                <ChevronRight size={17} color={currentDays === days ? colors.surface : colors.muted} />
              </Pressable>
            </Link>
          ))}
        </View>
      </Stack>
    </Container>
  );
}

function DestinationDirectory({ currentCitySlug }: { currentCitySlug: string | undefined }) {
  const { isMobile } = useResponsive();

  return (
    <View style={styles.directoryBand}>
      <Container>
        <Stack gap={spacing.lg}>
          <Stack gap={spacing.xs}>
            <Text style={styles.sectionEyebrow}>Explore destinations</Text>
            <Heading size="lg">TripBuddy travel planners</Heading>
          </Stack>
          <View style={styles.cityGrid}>
            {supportedCities.map((city) => (
              <Link
                key={city.slug}
                href={{ pathname: '/travel/[city]', params: { city: city.slug } }}
                asChild
              >
                <Pressable
                  accessibilityRole="link"
                  style={StyleSheet.flatten([
                    styles.cityLink,
                    isMobile && styles.cityLinkMobile,
                    currentCitySlug === city.slug && styles.cityLinkActive
                  ])}
                >
                  <MapPin size={16} color={currentCitySlug === city.slug ? colors.surface : colors.accent} />
                  <Text style={StyleSheet.flatten([styles.cityLinkText, currentCitySlug === city.slug && styles.cityLinkTextActive])}>{city.name}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </Stack>
      </Container>
    </View>
  );
}

function Breadcrumbs({ city, days }: { city: SupportedCity; days?: SupportedItineraryDuration }) {
  return (
    <View style={styles.breadcrumbBand}>
      <Container style={styles.breadcrumbContainer}>
        <Row wrap gap={spacing.xs} style={styles.breadcrumbRow}>
          <Crumb href="/" label="Home" />
          <Text style={styles.breadcrumbSeparator}>/</Text>
          <Crumb href="/travel" label="Travel" />
          <Text style={styles.breadcrumbSeparator}>/</Text>
          {days ? (
            <>
              <Crumb href={{ pathname: '/travel/[city]', params: { city: city.slug } }} label={city.name} />
              <Text style={styles.breadcrumbSeparator}>/</Text>
              <Text style={styles.breadcrumbCurrent}>{days} Day Itinerary</Text>
            </>
          ) : (
            <Text style={styles.breadcrumbCurrent}>{city.name}</Text>
          )}
        </Row>
      </Container>
    </View>
  );
}

function Crumb({ href, label }: { href: React.ComponentProps<typeof Link>['href']; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link"><Text style={styles.breadcrumbLink}>{label}</Text></Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark },
  heroInner: { minHeight: 350, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xl },
  heroInnerMobile: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center' },
  heroCopy: { flex: 1, width: '100%', minWidth: 0, maxWidth: 790 },
  heroMarker: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 56, backgroundColor: colors.accent },
  eyebrow: { color: '#67E8F9', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: colors.surface },
  heroDescription: { maxWidth: 760, color: 'rgba(255,255,255,0.78)', fontSize: 17, lineHeight: 27 },
  primaryCta: { alignSelf: 'flex-start', minHeight: 48, maxWidth: '100%', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.primary },
  primaryCtaMobile: { alignSelf: 'stretch', width: '100%', paddingHorizontal: spacing.md },
  primaryCtaText: { flex: 1, minWidth: 0, flexShrink: 1, color: colors.surface, fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.78 },
  sectionEyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  durationLink: { width: 220, minHeight: 92, flexGrow: 1, flexBasis: 200, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surface },
  durationLinkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { flex: 1, color: colors.text, fontWeight: '800' },
  durationTextActive: { color: colors.surface },
  directoryBand: { backgroundColor: '#EEF6FF' },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  cityLink: { width: 180, minHeight: 46, flexGrow: 0, flexShrink: 1, flexBasis: 180, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#CFE1F7', borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  cityLinkMobile: { width: '48%', flexBasis: '48%' },
  cityLinkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  cityLinkText: { flexShrink: 1, fontWeight: '800' },
  cityLinkTextActive: { color: colors.surface },
  breadcrumbBand: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  breadcrumbContainer: { paddingVertical: spacing.sm },
  breadcrumbRow: { alignItems: 'center' },
  breadcrumbLink: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  breadcrumbSeparator: { color: colors.muted, fontSize: 13 },
  breadcrumbCurrent: { color: colors.text, fontSize: 13, fontWeight: '800' },
  detailBand: { backgroundColor: colors.surface },
  detailContent: { flexDirection: 'row', alignItems: 'flex-start' },
  detailContentMobile: { flexDirection: 'column' },
  detailIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2FE' },
  detailCopy: { flex: 1, minWidth: 0 },
  bodyText: { color: colors.muted, maxWidth: 760 },
  notFound: { minHeight: 500, alignItems: 'center', justifyContent: 'center' },
  centered: { alignItems: 'center' },
  secondaryLink: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
  secondaryLinkText: { color: colors.primary, fontWeight: '900' }
});

const webStyles = {
  pageTitle: {
    color: colors.surface,
    fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
    fontSize: 44,
    fontWeight: 800,
    lineHeight: '54px',
    margin: 0,
    overflowWrap: 'anywhere'
  }
} as const;
