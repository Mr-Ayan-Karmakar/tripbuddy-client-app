import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, Edit3, Info, MapPin, Moon, Sparkles, Star, Utensils } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, radius, shadow, spacing } from '../../src/rn/theme';
import { AppModal, Button, Card, Chip, Container, Heading, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { Activity, Restaurant } from '../../src/rn/types';
import { useResponsive } from '../../src/rn/useResponsive';

const fallbackImages = [
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=640&q=80&fit=crop',
  'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=640&q=80&fit=crop',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640&q=80&fit=crop'
];

const paceLabel = { relaxed: 'Relaxed', balanced: 'Balanced', fast: 'Fast-paced' };
const paceIcon = { relaxed: '🌿', balanced: '⚖️', fast: '⚡' };
const MIN_VIBE_MATCHED_PLACES = 2;

export default function ItineraryRoute() {
  const router = useRouter();
  const { trip } = useTrip();
  const { isDesktop, isMobile } = useResponsive();
  const [selectedDay, setSelectedDay] = useState(trip.itinerary[0]?.id ?? '');
  const [detailsActivity, setDetailsActivity] = useState<Activity | undefined>();
  const day = trip.itinerary.find((item) => item.id === selectedDay) ?? trip.itinerary[0];
  const restaurants = uniqueRestaurants(day?.activities.flatMap((activity) => activity.restaurants ?? []) ?? []);
  const tripVibe = trip.tripVibe?.trim() ?? '';
  const hasFewVibeMatches = Boolean(tripVibe && day && !day.restDay && day.activities.length < MIN_VIBE_MATCHED_PLACES);

  useEffect(() => {
    if (!trip.itinerary.length) return;
    if (trip.itinerary.some((item) => item.id === selectedDay)) return;
    setSelectedDay(trip.itinerary[0]?.id ?? '');
  }, [selectedDay, trip.itinerary]);

  if (!trip.itinerary.length) {
    return (
      <Screen>
        <Header />
        <ScrollView>
          <Container>
            <Card style={styles.emptyGeneratedCard}>
              <CalendarDays size={42} color="rgba(90,100,128,0.45)" />
              <Heading size="md">No itinerary generated yet</Heading>
              <Text style={styles.emptyText}>Start from the planner and generate an itinerary to see your trip details here.</Text>
              <Button onPress={() => router.push('/trip/create')} icon={<ArrowRight size={16} color={colors.surface} />}>Plan your trip</Button>
            </Card>
          </Container>
          <Footer />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      <ScrollView>
        <Container>
          <Row style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}>
            {isDesktop ? <Sidebar /> : <MobileSummary />}

            <Stack style={{ flex: 1, minWidth: 0 }} gap={spacing.lg}>
              <Row wrap style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Stack gap={spacing.xs}>
                  <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                    <Pressable onPress={() => router.push('/trip/create')}><Text style={styles.breadcrumb}><ArrowLeft size={14} color={colors.muted} /> Plan</Text></Pressable>
                    <Text style={styles.breadcrumb}>›</Text>
                    <Text style={styles.breadcrumbStrong}>Your {trip.destination.city} itinerary</Text>
                  </Row>
                  <Heading size="lg" style={styles.pageTitle}>{trip.days}-day trip to {trip.destination.city}</Heading>
                  <Text style={styles.pageSub}>{formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate, true)} · {paceLabel[trip.pace]}</Text>
                  {tripVibe ? (
                    <Row gap={spacing.xs} style={styles.vibeBadge}>
                      <Sparkles size={13} color={colors.accent} />
                      <Text style={styles.vibeBadgeText}>Trip vibe: {tripVibe}</Text>
                    </Row>
                  ) : null}
                </Stack>
                {!isMobile ? (
                  <Row wrap>
                    <Button onPress={() => router.push('/trip/booking')} icon={<ArrowRight size={16} color={colors.surface} />}>Continue to booking</Button>
                  </Row>
                ) : null}
              </Row>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
                {trip.itinerary.map((item) => {
                  const active = item.id === selectedDay;
                  return (
                    <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setSelectedDay(item.id)} style={StyleSheet.flatten([styles.dayTab, item.restDay && styles.restDayTab, active && styles.activeDayTab])}>
                      <Text style={active ? styles.activeDayText : styles.dayText}>Day {item.dayNumber}</Text>
                      <Text style={active ? styles.activeDaySub : styles.daySub}>{formatDisplayDate(item.date)}</Text>
                      {item.restDay ? <Moon size={12} color={active ? '#BFDBFE' : colors.muted} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!day ? (
                <EmptyItinerary />
              ) : day.restDay ? (
                <RestDay date={day.date} />
              ) : hasFewVibeMatches && !day.activities.length ? (
                <TripVibeNoMatches tripVibe={tripVibe} />
              ) : day.activities.length ? (
                <Stack gap={spacing.sm}>
                  {hasFewVibeMatches ? <TripVibeLowMatches tripVibe={tripVibe} count={day.activities.length} /> : null}
                  {day.activities.map((activity, index) => (
                    <View key={activity.id}>
                      {index > 0 && activity.travelFromPrevious ? <TravelConnector text={activity.travelFromPrevious} /> : null}
                      <ActivityCard activity={activity} index={index} isMobile={isMobile} onDetails={() => setDetailsActivity(activity)} />
                    </View>
                  ))}
                  {restaurants.length ? <NearbyRestaurants restaurants={restaurants} /> : null}
                </Stack>
              ) : (
                <EmptyDay />
              )}
            </Stack>
          </Row>
        </Container>
        <Footer />
      </ScrollView>

      {isMobile ? (
        <View style={styles.mobileCta}>
          <Pressable onPress={() => router.push('/trip/booking')} style={styles.mobileCtaButton}>
            <Text style={styles.mobileCtaText}>Continue to booking</Text>
            <ArrowRight size={16} color={colors.surface} />
          </Pressable>
        </View>
      ) : null}
      <ActivityDetailsModal activity={detailsActivity} onClose={() => setDetailsActivity(undefined)} />
    </Screen>
  );
}

function Sidebar() {
  const router = useRouter();
  const { trip, setPlannerInput } = useTrip();
  const editTripDetails = () => {
    setPlannerInput({ source: trip.source.city, destination: trip.destination.city });
    router.push('/trip/create');
  };

  return (
    <Stack style={styles.sidebar}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryBanner}>
          <MapPin size={18} color={colors.surface} />
          <Stack gap={0}>
            <Text style={styles.summaryLabel}>Destination</Text>
            <Text style={styles.summaryTitle}>{trip.destination.city}</Text>
          </Stack>
        </View>
        <Stack style={styles.summaryBody}>
          <SummaryRow icon={<CalendarDays size={16} color={colors.primary} />} label="Dates" value={`${formatDisplayDate(trip.startDate)} - ${formatDisplayDate(trip.endDate, true)}`} />
          <SummaryRow icon={<Moon size={16} color={colors.primary} />} label="Duration" value={`${trip.days} days`} />
          <SummaryRow icon={<Text style={styles.paceEmoji}>{paceIcon[trip.pace]}</Text>} label="Pace" value={paceLabel[trip.pace]} />
          {trip.preferences.length ? (
            <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
              <Sparkles size={16} color={colors.primary} />
              <Stack gap={spacing.xs} style={{ flex: 1 }}>
                <Text style={styles.summaryLabelDark}>Interests</Text>
                <Row wrap gap={spacing.xs}>{trip.preferences.map((pref) => <Chip key={pref} label={pref} />)}</Row>
              </Stack>
            </Row>
          ) : null}
          {trip.tripVibe ? <SummaryRow icon={<Sparkles size={16} color={colors.accent} />} label="Trip vibe" value={trip.tripVibe} /> : null}
          <SummaryRow icon={<MapPin size={16} color={colors.primary} />} label="Starting from" value={trip.source.city || '-'} />
          <View style={styles.rule} />
          <Button variant="secondary" onPress={editTripDetails} icon={<Edit3 size={16} color={colors.primary} />}>Edit trip details</Button>
        </Stack>
      </Card>
      <Card style={styles.progressCard}>
        <Text style={styles.progressTitle}>Planning progress</Text>
        {['Itinerary', 'Hotels', 'Transports'].map((step, index) => (
          <Row key={step} style={{ alignItems: 'center' }}>
            <View style={StyleSheet.flatten([styles.progressDot, index === 0 && styles.progressDone])}>{index === 0 ? <Check size={11} color={colors.surface} /> : <Text style={styles.progressNum}>{index + 1}</Text>}</View>
            <Text style={index === 0 ? styles.progressTextDone : styles.progressText}>{step}</Text>
            {index === 0 ? <Text style={styles.doneLabel}>Done</Text> : null}
          </Row>
        ))}
      </Card>
    </Stack>
  );
}

function MobileSummary() {
  const { trip } = useTrip();
  const tripVibe = trip.tripVibe?.trim();
  return (
    <Card style={styles.mobileSummary}>
      <Row wrap style={{ alignItems: 'center' }}>
        <MapPin size={14} color={colors.primary} />
        <Text style={{ fontWeight: '900' }}>{trip.destination.city}</Text>
        <Text style={styles.dotText}>·</Text>
        <Text style={styles.mobileSummaryText}>{formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}</Text>
        <Text style={styles.dotText}>·</Text>
        <Text style={styles.mobileSummaryText}>{trip.days} days</Text>
        <Text style={styles.dotText}>·</Text>
        <Text style={styles.mobileSummaryText}>{paceIcon[trip.pace]} {paceLabel[trip.pace]}</Text>
        {tripVibe ? (
          <>
            <Text style={styles.dotText}>·</Text>
            <Text style={styles.mobileSummaryText}>Trip vibe: {tripVibe}</Text>
          </>
        ) : null}
      </Row>
    </Card>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
      {icon}
      <Stack gap={0} style={{ flex: 1 }}>
        <Text style={styles.summaryLabelDark}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </Stack>
    </Row>
  );
}

function ActivityCard({ activity, index, isMobile, onDetails }: { activity: Activity; index: number; isMobile: boolean; onDetails: () => void }) {
  const imageUrl = activity.imageUrl ?? fallbackImages[index % fallbackImages.length]!;
  return (
    <Row gap={spacing.md} style={{ alignItems: 'stretch' }}>
      {!isMobile ? <View style={styles.timelineDot}><Text style={styles.timelineNum}>{index + 1}</Text></View> : null}
      <Card style={styles.activityCard}>
        <View style={StyleSheet.flatten([styles.activityLayout, isMobile && { flexDirection: 'column' }])}>
          <View style={StyleSheet.flatten([styles.activityImageWrap, isMobile && styles.activityImageMobile])}>
            <Image source={{ uri: imageUrl }} style={styles.activityImage} resizeMode="cover" />
            <View style={styles.categoryBadge}><Text style={styles.categoryText}>{activity.category ?? 'Place'}</Text></View>
          </View>
          <Stack style={styles.activityBody} gap={spacing.sm}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Stack gap={spacing.xs} style={{ flex: 1 }}>
                <Heading size="sm" style={styles.activityTitle}>{activity.name}</Heading>
                <Row gap={spacing.xs} wrap style={{ alignItems: 'center' }}>
                  <Star size={14} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.ratingText}>{activity.rating}</Text>
                  <Text style={styles.dotText}>·</Text>
                  <MapPin size={12} color={colors.muted} />
                  <Text style={styles.metaText}>{activity.area}</Text>
                </Row>
              </Stack>
            </Row>
            <Row wrap gap={spacing.md} style={{ alignItems: 'center' }}>
              <Row gap={spacing.xs} style={{ alignItems: 'center' }}><Clock size={14} color={colors.primary} /><Text style={styles.metaText}>{activity.startTime} - {activity.endTime}</Text></Row>
              <StatusPill>{activity.duration}</StatusPill>
            </Row>
            <Text style={styles.activityDescription}>{activity.description}</Text>
            <Row wrap gap={spacing.sm}>
              <Button variant="secondary" onPress={onDetails} style={styles.detailsButton} icon={<Info size={15} color={colors.primary} />}>Details</Button>
            </Row>
          </Stack>
        </View>
      </Card>
    </Row>
  );
}

function NearbyRestaurants({ restaurants }: { restaurants: Restaurant[] }) {
  return (
    <Card style={styles.restaurantSection}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Row style={{ alignItems: 'center' }}>
          <Utensils size={17} color={colors.accent} />
          <Heading size="sm" style={styles.restaurantHeading}>Nearby restaurants</Heading>
        </Row>
        <Text style={styles.metaText}>Day picks</Text>
      </Row>
      <View style={styles.restaurantGrid}>
        {restaurants.slice(0, 4).map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} />)}
      </View>
    </Card>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <View style={styles.restaurantCard}>
      <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Stack gap={spacing.xs} style={{ flex: 1 }}>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          {restaurant.address ? <Text style={styles.restaurantAddress}>{restaurant.address}</Text> : null}
          <Row gap={spacing.xs} wrap style={{ alignItems: 'center' }}>
            {restaurant.rating ? (
              <>
                <Star size={12} color="#FACC15" fill="#FACC15" />
                <Text style={styles.restaurantMeta}>{restaurant.rating}</Text>
              </>
            ) : null}
            {restaurant.distanceMeters ? <Text style={styles.restaurantMeta}>{formatDistance(restaurant.distanceMeters)}</Text> : null}
          </Row>
        </Stack>
        {restaurant.priceLevel ? <Text style={styles.priceLevel}>{'$'.repeat(Math.min(4, restaurant.priceLevel))}</Text> : null}
      </Row>
    </View>
  );
}

function ActivityDetailsModal({ activity, onClose }: { activity?: Activity; onClose: () => void }) {
  if (!activity) return null;
  return (
    <AppModal visible title={activity.name} onClose={onClose}>
      {activity.imageUrl ? <Image source={{ uri: activity.imageUrl }} style={styles.detailsImage} resizeMode="cover" /> : null}
      <Stack gap={spacing.sm}>
        <Row wrap style={{ alignItems: 'center' }}>
          <Star size={14} color="#FACC15" fill="#FACC15" />
          <Text style={styles.ratingText}>{activity.rating}</Text>
          <Text style={styles.dotText}>·</Text>
          <MapPin size={13} color={colors.muted} />
          <Text style={styles.metaText}>{activity.area}</Text>
        </Row>
        <Row wrap style={{ alignItems: 'center' }}>
          <Clock size={14} color={colors.primary} />
          <Text style={styles.metaText}>{activity.startTime} - {activity.endTime}</Text>
          <StatusPill>{activity.duration}</StatusPill>
        </Row>
        <Text style={styles.detailsDescription}>{activity.description || 'No additional details were provided for this place.'}</Text>
      </Stack>
      {activity.reviews?.length ? <ReviewsList reviews={activity.reviews} /> : null}
      {activity.restaurants?.length ? <NearbyRestaurants restaurants={activity.restaurants} /> : null}
    </AppModal>
  );
}

function ReviewsList({ reviews }: { reviews: NonNullable<Activity['reviews']> }) {
  return (
    <Card style={styles.reviewsSection}>
      <Row style={{ alignItems: 'center' }}>
        <Star size={16} color="#FACC15" fill="#FACC15" />
        <Heading size="sm" style={styles.restaurantHeading}>Reviews</Heading>
      </Row>
      <Stack gap={spacing.sm}>
        {reviews.slice(0, 3).map((review, index) => (
          <View key={`${review.authorName ?? 'review'}-${index}`} style={styles.reviewCard}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.reviewAuthor}>{review.authorName ?? 'Traveler review'}</Text>
              {review.rating ? (
                <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                  <Star size={12} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.restaurantMeta}>{review.rating}</Text>
                </Row>
              ) : null}
            </Row>
            {review.relativePublishTimeDescription ? <Text style={styles.restaurantMeta}>{review.relativePublishTimeDescription}</Text> : null}
            {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
          </View>
        ))}
      </Stack>
    </Card>
  );
}

function TravelConnector({ text }: { text: string }) {
  return (
    <Row style={styles.travelConnector}>
      <View style={styles.travelLine} />
      <Text style={styles.travelText}>{text}</Text>
    </Row>
  );
}

function RestDay({ date }: { date: string }) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.restIcon}><Moon size={28} color={colors.muted} /></View>
      <Heading size="md">Rest day</Heading>
      <Text style={styles.emptyText}>You have scheduled a rest day for {formatDisplayDate(date, true)}. Take it easy, recharge and enjoy the hotel.</Text>
    </Card>
  );
}

function EmptyDay() {
  return (
    <Card style={styles.emptyCard}>
      <CalendarDays size={40} color="rgba(90,100,128,0.45)" />
      <Heading size="md">No activities yet</Heading>
      <Text style={styles.emptyText}>No activities were returned for this day.</Text>
    </Card>
  );
}

function TripVibeNoMatches({ tripVibe }: { tripVibe: string }) {
  return (
    <Card style={styles.vibeEmptyCard}>
      <Sparkles size={40} color={colors.accent} />
      <Heading size="md" style={styles.vibeEmptyTitle}>Not enough matching popular places</Heading>
      <Text style={styles.emptyText}>We couldn't find enough popular places matching "{tripVibe}" for this day. Try a broader Trip vibe or remove it to generate more options.</Text>
    </Card>
  );
}

function TripVibeLowMatches({ tripVibe, count }: { tripVibe: string; count: number }) {
  const placeLabel = count === 1 ? 'place' : 'places';
  return (
    <Card style={styles.vibeNoticeCard}>
      <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
        <Sparkles size={17} color={colors.accent} />
        <Stack gap={spacing.xs} style={{ flex: 1 }}>
          <Text style={styles.vibeNoticeTitle}>Limited matches for this Trip vibe</Text>
          <Text style={styles.vibeNoticeText}>Only {count} popular {placeLabel} matched "{tripVibe}" for this day, so the plan may feel lighter than usual.</Text>
        </Stack>
      </Row>
    </Card>
  );
}

function EmptyItinerary() {
  return (
    <Card style={styles.emptyCard}>
      <Heading size="md">No itinerary generated yet</Heading>
      <Text style={styles.emptyText}>Go back to the planner and generate an itinerary to continue.</Text>
    </Card>
  );
}

function formatDisplayDate(value: string, includeYear = false) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' as const } : {}) });
}

function uniqueRestaurants(restaurants: Restaurant[]) {
  const seen = new Set<string>();
  return restaurants.filter((restaurant) => {
    const key = restaurant.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDistance(distanceMeters: number) {
  return distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters)} m`;
}

const styles = StyleSheet.create({
  sidebar: { width: 272, position: 'sticky' as never, top: 0 },
  summaryCard: { padding: 0, overflow: 'hidden', borderRadius: radius.xl, borderColor: 'rgba(37,117,241,0.18)', backgroundColor: '#F8FBFF', ...shadow.card },
  summaryBanner: { minHeight: 64, backgroundImage: 'linear-gradient(135deg, #17438D 0%, #2575F1 56%, #5EC8DF 100%)' as never, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryLabel: { color: '#B6CEE1', textTransform: 'uppercase', fontSize: 10, fontWeight: '800' },
  summaryTitle: { color: colors.surface, fontWeight: '900' },
  summaryBody: { padding: spacing.lg, backgroundColor: '#F8FBFF' },
  summaryLabelDark: { color: colors.muted, textTransform: 'uppercase', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  summaryValue: { color: colors.text, fontSize: 12, fontWeight: '800' },
  paceEmoji: { fontSize: 14, lineHeight: 18 },
  rule: { height: 1, backgroundColor: colors.border },
  progressCard: { borderRadius: radius.lg, padding: spacing.md, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  progressTitle: { color: colors.muted, textTransform: 'uppercase', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  progressDot: { width: 18, height: 18, borderRadius: 999, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  progressDone: { backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #5EC8DF 100%)' as never },
  progressNum: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  progressText: { flex: 1, color: colors.muted, fontSize: 12 },
  progressTextDone: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  doneLabel: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  mobileSummary: { width: '100%', padding: spacing.md, borderRadius: radius.lg, borderColor: 'rgba(37,117,241,0.18)', backgroundColor: '#F8FBFF' },
  mobileSummaryText: { color: colors.muted, fontSize: 12 },
  pageTitle: { fontSize: 24, lineHeight: 31 },
  pageSub: { color: colors.muted, fontSize: 14 },
  vibeBadge: { alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 999, backgroundColor: '#FFF7ED', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  vibeBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  breadcrumb: { color: colors.muted, fontSize: 12 },
  breadcrumbStrong: { color: colors.text, fontSize: 12, fontWeight: '800' },
  dayTabs: { gap: spacing.sm, paddingBottom: spacing.xs },
  dayTab: { minWidth: 72, minHeight: 66, borderWidth: 2, borderColor: '#BFDBFE', borderRadius: 12, backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  restDayTab: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  activeDayTab: { backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #5EC8DF 100%)' as never, borderColor: colors.primary },
  dayText: { color: colors.text, fontWeight: '900', fontSize: 12 },
  activeDayText: { color: colors.surface, fontWeight: '900', fontSize: 12 },
  daySub: { color: colors.muted, fontSize: 11 },
  activeDaySub: { color: '#BFDBFE', fontSize: 11 },
  timelineDot: { width: 31, height: 31, borderRadius: 999, backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #F8691E 100%)' as never, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface, marginTop: spacing.lg },
  timelineNum: { color: colors.surface, fontWeight: '900', fontSize: 12 },
  activityCard: { flex: 1, padding: 0, borderRadius: radius.xl, overflow: 'hidden', borderColor: '#D7E7FF', backgroundColor: '#FBFDFF' },
  activityLayout: { flexDirection: 'row' },
  activityImageWrap: { width: 148, minHeight: 176, position: 'relative', backgroundColor: colors.surfaceMuted },
  activityImageMobile: { width: '100%', height: 178 },
  activityImage: { width: '100%', height: '100%' },
  categoryBadge: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, borderRadius: 999, backgroundImage: 'linear-gradient(135deg, rgba(37,117,241,0.94), rgba(248,105,30,0.92))' as never, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  categoryText: { color: colors.surface, fontSize: 10, fontWeight: '900' },
  activityBody: { flex: 1, minWidth: 0, padding: spacing.lg, backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #F8FBFF 100%)' as never },
  activityTitle: { fontSize: 16, lineHeight: 21 },
  ratingText: { fontWeight: '800', fontSize: 12 },
  metaText: { color: colors.muted, fontSize: 12 },
  dotText: { color: colors.muted, fontSize: 12 },
  activityDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  detailsButton: { backgroundColor: '#EBF2FE', borderColor: '#BFDBFE' },
  travelConnector: { alignItems: 'center', marginLeft: 15, paddingVertical: spacing.xs },
  travelLine: { width: 1, height: 24, backgroundColor: colors.border },
  travelText: { color: colors.muted, fontSize: 11, marginLeft: spacing.lg },
  restaurantSection: { marginTop: spacing.lg, borderRadius: radius.xl, borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  restaurantHeading: { fontSize: 16 },
  restaurantGrid: { display: 'grid' as never, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' as never, gap: spacing.md },
  restaurantCard: { borderWidth: 1, borderColor: '#FED7AA', borderRadius: radius.lg, padding: spacing.md, backgroundColor: '#FFF7ED' },
  restaurantName: { fontSize: 14, fontWeight: '900' },
  restaurantAddress: { color: colors.muted, fontSize: 12 },
  restaurantMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  priceLevel: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  detailsImage: { width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  detailsDescription: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  reviewsSection: { borderRadius: radius.xl, borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
  reviewCard: { borderWidth: 1, borderColor: '#D7E7FF', borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface },
  reviewAuthor: { fontSize: 13, fontWeight: '900' },
  reviewText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  emptyCard: { borderStyle: 'dashed', alignItems: 'center', padding: spacing.xxl },
  vibeEmptyCard: { borderStyle: 'dashed', alignItems: 'center', padding: spacing.xxl, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  vibeEmptyTitle: { color: colors.primaryDark, textAlign: 'center' },
  vibeNoticeCard: { borderRadius: radius.lg, borderColor: '#FED7AA', backgroundColor: '#FFF7ED', padding: spacing.md },
  vibeNoticeTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  vibeNoticeText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  emptyGeneratedCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  restIcon: { width: 52, height: 52, borderRadius: 999, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 360 },
  mobileCta: { position: 'sticky' as never, bottom: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  mobileCtaButton: { minHeight: 48, borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #F8691E 100%)' as never, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  mobileCtaText: { color: colors.surface, fontWeight: '900' }
});
