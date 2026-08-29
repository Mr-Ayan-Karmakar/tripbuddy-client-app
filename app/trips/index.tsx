import { useRouter } from 'expo-router';
import { ArrowRight, CalendarDays, MapPin, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, spacing } from '../../src/rn/theme';
import { AppModal, Button, Card, Container, Heading, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { SavedTrip } from '../../src/rn/types';

export default function TripsRoute() {
  const router = useRouter();
  const { savedTrips, selectSavedTrip, deleteSavedTrip } = useTrip();
  const [deleteTrip, setDeleteTrip] = useState<SavedTrip | undefined>();

  function openTrip(trip: SavedTrip) {
    const hasAnyBooking = trip.transportBookings.some((booking) => booking.selectedOption || booking.status === 'Booked') || trip.stayBookings.some((booking) => booking.selectedHotel || booking.status === 'Booked');
    selectSavedTrip(trip.id);
    router.push(hasAnyBooking ? '/trip/booking' : '/trip/itinerary');
  }

  function requestDelete(trip: SavedTrip) {
    if (hasFutureBookings(trip)) {
      setDeleteTrip(trip);
      return;
    }
    deleteSavedTrip(trip.id);
  }

  function confirmDelete() {
    if (!deleteTrip) return;
    deleteSavedTrip(deleteTrip.id);
    setDeleteTrip(undefined);
  }

  return (
    <Screen>
      <Header />
      <ScrollView>
        <Container style={styles.tripsContainer}>
          <Stack gap={spacing.xl}>
            <View style={styles.pageHeader}>
              <Text style={styles.eyebrow}>Saved itineraries</Text>
              <Heading size="lg">My Trips</Heading>
              <Text style={styles.subText}>Choose a locally saved itinerary, review it, or continue straight to bookings.</Text>
            </View>

            {savedTrips.length ? (
              <Stack gap={spacing.md}>
                {savedTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onView={() => openTrip(trip)}
                    onDelete={() => requestDelete(trip)}
                  />
                ))}
              </Stack>
            ) : (
              <Card style={styles.emptyCard}>
                <Sparkles size={42} color="rgba(90,100,128,0.45)" />
                <Stack gap={spacing.xs} style={{ alignItems: 'center' }}>
                  <Heading size="md">No saved itineraries yet</Heading>
                  <Text style={styles.emptyText}>Generate an itinerary from the planner and it will appear here automatically.</Text>
                </Stack>
                <Button onPress={() => router.push('/trip/create')} icon={<ArrowRight size={16} color={colors.surface} />}>Plan a trip</Button>
              </Card>
            )}
          </Stack>
        </Container>
        <Footer />
      </ScrollView>
      <AppModal visible={Boolean(deleteTrip)} title="Delete trip?" onClose={() => setDeleteTrip(undefined)}>
        {deleteTrip ? (
          <>
            <Text style={styles.confirmText}>{deleteTrip.destination.city || 'This trip'} has future booking selections. Deleting it will remove the itinerary and booking details from My Trips.</Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Future bookings detected</Text>
              <Text style={styles.warningText}>{futureBookingSummary(deleteTrip)}</Text>
            </View>
            <Row wrap style={{ justifyContent: 'flex-end' }}>
              <Button variant="secondary" onPress={() => setDeleteTrip(undefined)}>Keep trip</Button>
              <Button variant="danger" onPress={confirmDelete} icon={<Trash2 size={16} color={colors.danger} />}>Delete anyway</Button>
            </Row>
          </>
        ) : null}
      </AppModal>
    </Screen>
  );
}

function TripCard({ trip, onView, onDelete }: { trip: SavedTrip; onView: () => void; onDelete: () => void }) {
  const transportSelected = trip.transportBookings.filter((booking) => booking.selectedOption).length;
  const hotelsSelected = trip.stayBookings.filter((booking) => booking.selectedHotel).length;
  const status = trip.transportBookings.some((booking) => booking.status === 'Booked') || trip.stayBookings.some((booking) => booking.status === 'Booked')
    ? 'Booked'
    : transportSelected || hotelsSelected
      ? 'Booking in progress'
      : 'Itinerary ready';
  const viewLabel = status === 'Itinerary ready' ? 'View itinerary' : 'Review booking';

  return (
    <Card style={styles.tripCard}>
      <Row wrap gap={spacing.lg} style={styles.tripCardLayout}>
        <Stack gap={spacing.md} style={styles.tripContent}>
          <Row wrap gap={spacing.sm} style={{ alignItems: 'center' }}>
            <StatusPill tone="primary">{trip.itinerary.length} day plan</StatusPill>
            <StatusPill tone={status === 'Booked' ? 'success' : status === 'Booking in progress' ? 'warning' : 'neutral'}>{status}</StatusPill>
            <Text style={styles.savedDate}>Saved {formatSavedDate(trip.updatedAt)}</Text>
          </Row>
          <Stack gap={spacing.xs}>
            <Heading size="md">{trip.destination.city || 'Untitled trip'}</Heading>
            <Row wrap gap={spacing.sm} style={{ alignItems: 'center' }}>
              <MapPin size={14} color={colors.primary} />
              <Text style={styles.metaText}>{trip.source.city || 'Origin'} to {trip.destination.city || 'Destination'}</Text>
            </Row>
            <Row wrap gap={spacing.sm} style={{ alignItems: 'center' }}>
              <CalendarDays size={14} color={colors.primary} />
              <Text style={styles.metaText}>{formatTripDate(trip.startDate)} - {formatTripDate(trip.endDate)} · {trip.days} days</Text>
            </Row>
            {trip.tripVibe ? (
              <Row gap={spacing.sm} style={styles.vibeRow}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={styles.vibeText}>Trip vibe: {trip.tripVibe}</Text>
              </Row>
            ) : null}
          </Stack>
        </Stack>

        <Stack gap={spacing.md} style={styles.tripActions}>
          <View style={styles.bookingSnapshot}>
            <TripMetric label="Days" value={trip.itinerary.length} />
            <TripMetric label="Transport" value={transportSelected} />
            <TripMetric label="Hotels" value={hotelsSelected} />
          </View>
          <Row gap={spacing.sm} style={styles.actionRow}>
            <Button variant="danger" onPress={onDelete} style={styles.actionButton} icon={<Trash2 size={16} color={colors.danger} />}>Delete</Button>
            <Button onPress={onView} style={styles.actionButton} icon={<ArrowRight size={16} color={colors.surface} />}>{viewLabel}</Button>
          </Row>
        </Stack>
      </Row>
    </Card>
  );
}

function TripMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.tripMetric}>
      <Text style={styles.snapshotValue}>{value}</Text>
      <Text style={styles.snapshotLabel}>{label}</Text>
    </View>
  );
}

function formatTripDate(date: string) {
  if (!date) return 'Date not set';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function formatSavedDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

function hasFutureBookings(trip: SavedTrip) {
  const today = currentIsoDate();
  const hasTransport = trip.transportBookings.some((booking) => Boolean(booking.selectedOption || booking.status === 'Booked') && booking.date >= today);
  const hasStay = trip.stayBookings.some((booking) => Boolean(booking.selectedHotel || booking.status === 'Booked') && booking.checkOut >= today);
  return hasTransport || hasStay;
}

function futureBookingSummary(trip: SavedTrip) {
  const today = currentIsoDate();
  const transport = trip.transportBookings.filter((booking) => Boolean(booking.selectedOption || booking.status === 'Booked') && booking.date >= today).length;
  const stays = trip.stayBookings.filter((booking) => Boolean(booking.selectedHotel || booking.status === 'Booked') && booking.checkOut >= today).length;
  return `${transport} transport booking${transport === 1 ? '' : 's'} and ${stays} stay booking${stays === 1 ? '' : 's'} are dated today or later.`;
}

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  tripsContainer: { paddingTop: spacing.xl },
  pageHeader: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 16, backgroundImage: 'linear-gradient(135deg, #EBF2FE 0%, #F8FBFF 44%, #FEF0EB 100%)' as never, padding: spacing.xl, gap: spacing.xs },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  subText: { color: colors.muted, maxWidth: 620 },
  tripCard: { minHeight: 210, padding: spacing.xl, borderColor: '#D7E7FF', backgroundColor: '#FFFFFF', borderRadius: 14 },
  tripCardLayout: { justifyContent: 'space-between', alignItems: 'stretch' },
  tripContent: { flex: 1, minWidth: 280 },
  savedDate: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  metaText: { color: colors.muted, fontSize: 14 },
  vibeRow: { alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, backgroundColor: '#F8FBFF', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  vibeText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  tripActions: { width: 280, maxWidth: '100%', alignItems: 'stretch', flexShrink: 0 },
  bookingSnapshot: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#D7E7FF', backgroundColor: '#F8FBFF', padding: spacing.sm, gap: spacing.sm },
  tripMetric: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E6EEF9' },
  actionRow: { width: '100%' },
  actionButton: { flex: 1 },
  snapshotLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0 },
  snapshotValue: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  emptyCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as never, borderColor: '#D7E7FF', backgroundColor: '#FBFDFF' },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 420 },
  confirmText: { color: colors.muted, fontSize: 14 },
  warningBox: { borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, backgroundColor: '#FFFBEB', padding: spacing.md, gap: spacing.xs },
  warningTitle: { color: colors.warning, fontSize: 13, fontWeight: '900' },
  warningText: { color: colors.muted, fontSize: 13 }
});
