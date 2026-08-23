import { useRouter } from 'expo-router';
import { ArrowRight, CalendarDays, MapPin, Plane, Sparkles, Trash2 } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, spacing } from '../../src/rn/theme';
import { Button, Card, Container, Heading, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { SavedTrip } from '../../src/rn/types';

export default function TripsRoute() {
  const router = useRouter();
  const { savedTrips, selectSavedTrip, deleteSavedTrip } = useTrip();

  function openTrip(id: string, path: '/trip/itinerary' | '/trip/booking') {
    selectSavedTrip(id);
    router.push(path);
  }

  return (
    <Screen>
      <Header />
      <ScrollView>
        <Container>
          <Stack gap={spacing.xl}>
            <Stack gap={spacing.xs}>
              <Text style={styles.eyebrow}>Saved itineraries</Text>
              <Heading size="lg">My Trips</Heading>
              <Text style={styles.subText}>Choose a locally saved itinerary, review it, or continue straight to bookings.</Text>
            </Stack>

            {savedTrips.length ? (
              <Stack gap={spacing.md}>
                {savedTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onView={() => openTrip(trip.id, '/trip/itinerary')}
                    onBook={() => openTrip(trip.id, '/trip/booking')}
                    onDelete={() => deleteSavedTrip(trip.id)}
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
    </Screen>
  );
}

function TripCard({ trip, onView, onBook, onDelete }: { trip: SavedTrip; onView: () => void; onBook: () => void; onDelete: () => void }) {
  const transportSelected = trip.transportBookings.filter((booking) => booking.selectedOption).length;
  const hotelsSelected = trip.stayBookings.filter((booking) => booking.selectedHotel).length;

  return (
    <Card style={styles.tripCard}>
      <Row wrap style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Stack gap={spacing.md} style={{ flex: 1, minWidth: 260 }}>
          <Row wrap gap={spacing.sm} style={{ alignItems: 'center' }}>
            <StatusPill tone="primary">{trip.itinerary.length} day plan</StatusPill>
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
          </Stack>
          <Row wrap gap={spacing.sm}>
            {trip.preferences.slice(0, 4).map((preference) => <View key={preference} style={styles.preferencePill}><Text style={styles.preferenceText}>{preference}</Text></View>)}
          </Row>
        </Stack>

        <Stack gap={spacing.md} style={styles.tripActions}>
          <View style={styles.bookingSnapshot}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.snapshotLabel}>Transport</Text>
              <Text style={styles.snapshotValue}>{transportSelected}/{trip.transportBookings.length || 1}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.snapshotLabel}>Hotels</Text>
              <Text style={styles.snapshotValue}>{hotelsSelected}/{trip.stayBookings.length || 1}</Text>
            </Row>
          </View>
          <Row wrap gap={spacing.sm} style={{ justifyContent: 'flex-end' }}>
            <Button variant="danger" onPress={onDelete} icon={<Trash2 size={16} color={colors.danger} />}>Delete</Button>
            <Button variant="secondary" onPress={onView}>View itinerary</Button>
            <Button onPress={onBook} icon={<Plane size={16} color={colors.surface} />}>Book trip</Button>
          </Row>
        </Stack>
      </Row>
    </Card>
  );
}

function formatTripDate(date: string) {
  if (!date) return 'Date not set';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function formatSavedDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  subText: { color: colors.muted, maxWidth: 620 },
  tripCard: { padding: spacing.xl },
  savedDate: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  metaText: { color: colors.muted, fontSize: 14 },
  preferencePill: { borderRadius: 999, backgroundColor: '#EBF2FE', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  preferenceText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  tripActions: { minWidth: 260, alignItems: 'stretch' },
  bookingSnapshot: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: spacing.md, gap: spacing.sm },
  snapshotLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  snapshotValue: { color: colors.text, fontSize: 13, fontWeight: '900' },
  emptyCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as never },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 420 }
});
