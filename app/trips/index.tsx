import { useRouter } from 'expo-router';
import { ArrowRight, CalendarDays, Mail, MapPin, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, spacing } from '../../src/rn/theme';
import { AppModal, Button, Card, Container, Heading, Input, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { SavedTrip } from '../../src/rn/types';
import { emailServerTrip, startTripDeleteOtp, verifyTripDeleteOtp } from '../../src/rn/services/api';

export default function TripsRoute() {
  const router = useRouter();
  const { savedTrips, selectSavedTrip, deleteSavedTrip } = useTrip();
  const [deleteTrip, setDeleteTrip] = useState<SavedTrip | undefined>();
  const [otpTrip, setOtpTrip] = useState<SavedTrip | undefined>();
  const [emailTrip, setEmailTrip] = useState<SavedTrip | undefined>();
  const [deleteOtp, setDeleteOtp] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [deleteOtpMessage, setDeleteOtpMessage] = useState('');
  const [deletingTripId, setDeletingTripId] = useState('');
  const [emailingTripId, setEmailingTripId] = useState('');
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [verifyingDeleteOtp, setVerifyingDeleteOtp] = useState(false);

  function openTrip(trip: SavedTrip) {
    const hasAnyBooking = trip.transportBookings.some((booking) => booking.selectedOption || booking.status === 'Booked') || trip.stayBookings.some((booking) => booking.selectedHotel || booking.status === 'Booked');
    selectSavedTrip(trip.id);
    router.push(hasAnyBooking ? '/trip/booking' : '/trip/itinerary');
  }

  async function requestDelete(trip: SavedTrip) {
    setDeleteError('');
    if (hasFutureBookings(trip)) {
      setDeleteTrip(trip);
      return;
    }
    await removeTrip(trip);
  }

  async function confirmDelete() {
    if (!deleteTrip) return;
    await removeTrip(deleteTrip);
  }

  async function removeTrip(trip: SavedTrip) {
    setDeletingTripId(trip.id);
    try {
      await deleteSavedTrip(trip.id);
      setDeleteTrip(undefined);
      setOtpTrip(undefined);
      setDeleteOtp('');
      setDeleteOtpMessage('');
    } catch (error) {
      if (error instanceof Error && error.message === 'DELETE_OTP_REQUIRED') {
        setDeleteTrip(undefined);
        setOtpTrip(trip);
        await sendDeleteOtp(trip);
      } else {
        setDeleteError(error instanceof Error ? error.message : 'Unable to delete this trip.');
      }
    } finally {
      setDeletingTripId('');
    }
  }

  async function sendDeleteOtp(trip: SavedTrip) {
    setSendingDeleteOtp(true);
    setDeleteOtpMessage('');
    setDeleteError('');
    try {
      const result = await startTripDeleteOtp(trip);
      setDeleteOtpMessage(result.required ? `OTP sent to ${result.email ?? 'the organizer email'}.` : 'Delete confirmation is already active.');
    } catch (error) {
      setDeleteOtpMessage(error instanceof Error ? error.message : 'Unable to send delete OTP.');
    } finally {
      setSendingDeleteOtp(false);
    }
  }

  async function verifyDeleteOtpAndRemove() {
    if (!otpTrip || deleteOtp.trim().length !== 6) return;
    setVerifyingDeleteOtp(true);
    setDeleteOtpMessage('');
    try {
      await verifyTripDeleteOtp(otpTrip, deleteOtp.trim());
      await removeTrip(otpTrip);
    } catch (error) {
      setDeleteOtpMessage(error instanceof Error ? error.message : 'Unable to verify delete OTP.');
    } finally {
      setVerifyingDeleteOtp(false);
    }
  }

  function openEmailTrip(trip: SavedTrip) {
    setDeleteError('');
    setEmailMessage('');
    setEmailRecipient(organizerEmail(trip));
    setEmailTrip(trip);
  }

  async function sendTripDetailsEmail() {
    if (!emailTrip || !emailRecipient.trim()) return;
    setEmailingTripId(emailTrip.id);
    setEmailMessage('');
    try {
      const result = await emailServerTrip(emailTrip, emailRecipient.trim());
      setEmailMessage(`Trip details sent to ${result.sentTo}.`);
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : 'Unable to send trip details.');
    } finally {
      setEmailingTripId('');
    }
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
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}

            {savedTrips.length ? (
              <Stack gap={spacing.md}>
                {savedTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onView={() => openTrip(trip)}
                    onDelete={() => requestDelete(trip)}
                    onEmail={() => openEmailTrip(trip)}
                    deleting={deletingTripId === trip.id}
                    emailing={emailingTripId === trip.id}
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
              <Button variant="danger" onPress={confirmDelete} disabled={deletingTripId === deleteTrip.id} icon={<Trash2 size={16} color={colors.danger} />}>{deletingTripId === deleteTrip.id ? 'Deleting...' : 'Delete anyway'}</Button>
            </Row>
          </>
        ) : null}
      </AppModal>
      <AppModal visible={Boolean(otpTrip)} title="Verify delete" onClose={() => setOtpTrip(undefined)}>
        {otpTrip ? (
          <Stack gap={spacing.md}>
            <Text style={styles.confirmText}>Enter the OTP sent to the organizer email to delete this booked trip.</Text>
            <Input
              label="OTP"
              value={deleteOtp}
              onChangeText={(value) => setDeleteOtp(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="numeric"
              placeholder="6-digit OTP"
            />
            {deleteOtpMessage ? <Text style={deleteOtpMessage.includes('sent') || deleteOtpMessage.includes('active') ? styles.infoText : styles.errorText}>{deleteOtpMessage}</Text> : null}
            <Row wrap style={{ justifyContent: 'flex-end' }}>
              <Button variant="secondary" onPress={() => sendDeleteOtp(otpTrip)} disabled={sendingDeleteOtp}>{sendingDeleteOtp ? 'Sending...' : 'Resend OTP'}</Button>
              <Button variant="danger" onPress={verifyDeleteOtpAndRemove} disabled={verifyingDeleteOtp || deleteOtp.trim().length !== 6} icon={<Trash2 size={16} color={colors.danger} />}>{verifyingDeleteOtp ? 'Deleting...' : 'Verify and delete'}</Button>
            </Row>
          </Stack>
        ) : null}
      </AppModal>
      <AppModal visible={Boolean(emailTrip)} title="Email trip details" onClose={() => setEmailTrip(undefined)}>
        {emailTrip ? (
          <Stack gap={spacing.md}>
            <Text style={styles.confirmText}>Send the saved itinerary and booking details for {emailTrip.destination.city || 'this trip'}.</Text>
            <View style={styles.emailPreviewBox}>
              <Text style={styles.emailPreviewTitle}>{emailTrip.source.city || 'Origin'} to {emailTrip.destination.city || 'Destination'}</Text>
              <Text style={styles.emailPreviewText}>{emailTrip.tripCode ? `Trip ID ${emailTrip.tripCode} · ` : ''}{bookingSummary(emailTrip)}</Text>
            </View>
            <Input
              label="Recipient email"
              value={emailRecipient}
              onChangeText={setEmailRecipient}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="traveler@example.com"
            />
            {emailMessage ? <Text style={emailMessage.includes('sent to') ? styles.infoText : styles.errorText}>{emailMessage}</Text> : null}
            <Row wrap style={{ justifyContent: 'flex-end' }}>
              <Button variant="secondary" onPress={() => setEmailTrip(undefined)}>Close</Button>
              <Button onPress={sendTripDetailsEmail} disabled={emailingTripId === emailTrip.id || !emailRecipient.trim()} icon={<Mail size={16} color={colors.surface} />}>{emailingTripId === emailTrip.id ? 'Sending...' : 'Send email'}</Button>
            </Row>
          </Stack>
        ) : null}
      </AppModal>
    </Screen>
  );
}

function TripCard({ trip, onView, onDelete, onEmail, deleting, emailing }: { trip: SavedTrip; onView: () => void; onDelete: () => void; onEmail: () => void; deleting: boolean; emailing: boolean }) {
  const transportSelected = trip.transportBookings.filter((booking) => booking.selectedOption).length;
  const hotelsSelected = trip.stayBookings.filter((booking) => booking.selectedHotel).length;
  const status = trip.transportBookings.some((booking) => booking.status === 'Booked') || trip.stayBookings.some((booking) => booking.status === 'Booked')
    ? 'Booked'
    : transportSelected || hotelsSelected
      ? 'Booking in progress'
      : 'Itinerary ready';
  const viewLabel = status === 'Itinerary ready' ? 'View itinerary' : 'Review booking';
  const canEmail = hasBookingDetails(trip) && Boolean(trip.serverTripId || trip.tripCode);

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
            {trip.tripCode ? <Text style={styles.tripCode}>Trip ID: {trip.tripCode}</Text> : null}
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
          {canEmail ? (
            <Button variant="secondary" onPress={onEmail} disabled={emailing} style={styles.emailButton} icon={<Mail size={16} color={colors.text} />}>{emailing ? 'Sending email...' : 'Email details'}</Button>
          ) : null}
          <Row gap={spacing.sm} style={styles.actionRow}>
            <Button variant="danger" onPress={onDelete} disabled={deleting} style={styles.actionButton} icon={<Trash2 size={16} color={colors.danger} />}>{deleting ? 'Deleting...' : 'Delete'}</Button>
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

function formatTripDate(date: unknown) {
  if (!date) return 'Date not set';
  const parsed = parseTripDate(date);
  if (!parsed) return 'Date not set';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(parsed);
}

function formatSavedDate(date: string) {
  const parsed = parseDateTime(date);
  if (!parsed) return 'recently';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(parsed);
}

function hasFutureBookings(trip: SavedTrip) {
  const today = currentIsoDate();
  const hasTransport = trip.transportBookings.some((booking) => Boolean(booking.selectedOption || booking.status === 'Booked') && isOnOrAfterToday(booking.date, today));
  const hasStay = trip.stayBookings.some((booking) => Boolean(booking.selectedHotel || booking.status === 'Booked') && isOnOrAfterToday(booking.checkOut, today));
  return hasTransport || hasStay;
}

function futureBookingSummary(trip: SavedTrip) {
  const today = currentIsoDate();
  const transport = trip.transportBookings.filter((booking) => Boolean(booking.selectedOption || booking.status === 'Booked') && isOnOrAfterToday(booking.date, today)).length;
  const stays = trip.stayBookings.filter((booking) => Boolean(booking.selectedHotel || booking.status === 'Booked') && isOnOrAfterToday(booking.checkOut, today)).length;
  return `${transport} transport booking${transport === 1 ? '' : 's'} and ${stays} stay booking${stays === 1 ? '' : 's'} are dated today or later.`;
}

function hasBookingDetails(trip: SavedTrip) {
  return trip.transportBookings.some((booking) => Boolean(booking.selectedOption || booking.externalBookingId || booking.status === 'Booked')) || trip.stayBookings.some((booking) => Boolean(booking.selectedHotel || booking.externalBookingId || booking.status === 'Booked'));
}

function bookingSummary(trip: SavedTrip) {
  const transport = trip.transportBookings.filter((booking) => booking.selectedOption || booking.externalBookingId || booking.status === 'Booked').length;
  const stays = trip.stayBookings.filter((booking) => booking.selectedHotel || booking.externalBookingId || booking.status === 'Booked').length;
  return `${transport} transport selection${transport === 1 ? '' : 's'} and ${stays} stay selection${stays === 1 ? '' : 's'}`;
}

function organizerEmail(trip: SavedTrip) {
  return trip.travelers.find((traveler) => traveler.role === 'organizer')?.email ?? '';
}

function currentIsoDate() {
  return toIsoDate(new Date());
}

function isOnOrAfterToday(date: unknown, today: string) {
  const parsed = parseTripDate(date);
  return parsed ? toIsoDate(parsed) >= today : false;
}

function parseTripDate(date: unknown) {
  if (!date) return null;
  const dateOnly = date instanceof Date ? toIsoDate(date) : String(date).trim().slice(0, 10);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!parts) return null;
  const [, yearPart, monthPart, dayPart] = parts;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day ? null : parsed;
}

function parseDateTime(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  tripCode: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  metaText: { color: colors.muted, fontSize: 14 },
  vibeRow: { alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, backgroundColor: '#F8FBFF', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  vibeText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  tripActions: { width: 280, maxWidth: '100%', alignItems: 'stretch', flexShrink: 0 },
  bookingSnapshot: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: '#D7E7FF', backgroundColor: '#F8FBFF', padding: spacing.sm, gap: spacing.sm },
  tripMetric: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E6EEF9' },
  actionRow: { width: '100%' },
  actionButton: { flex: 1 },
  emailButton: { width: '100%' },
  snapshotLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0 },
  snapshotValue: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  emptyCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as never, borderColor: '#D7E7FF', backgroundColor: '#FBFDFF' },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 420 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  infoText: { color: colors.success, fontSize: 13, fontWeight: '800' },
  confirmText: { color: colors.muted, fontSize: 14 },
  emailPreviewBox: { borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 12, backgroundColor: '#F8FBFF', padding: spacing.md, gap: spacing.xs },
  emailPreviewTitle: { color: colors.primaryDark, fontSize: 15, fontWeight: '900' },
  emailPreviewText: { color: colors.muted, fontSize: 13 },
  warningBox: { borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, backgroundColor: '#FFFBEB', padding: spacing.md, gap: spacing.xs },
  warningTitle: { color: colors.warning, fontSize: 13, fontWeight: '900' },
  warningText: { color: colors.muted, fontSize: 13 }
});
