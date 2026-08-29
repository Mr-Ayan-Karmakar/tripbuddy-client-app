import { useRouter } from 'expo-router';
import { ArrowRight, BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, Filter, Mail, MapPin, Plane, Plus, Star, Train, User } from 'lucide-react-native';
import { createElement, type ChangeEvent, type CSSProperties, type ReactNode, useRef, useState, useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { searchHotels, searchTransport } from '../../src/rn/services/api';
import { daysBetween, formatInr } from '../../src/rn/data';
import { colors, spacing } from '../../src/rn/theme';
import { AppModal, Button, Card, Chip, Container, Heading, Input, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { HotelOption, TransportOption, TransportType } from '../../src/rn/types';
import { useResponsive } from '../../src/rn/useResponsive';

type TransportSearchState = {
  source: string;
  destination: string;
  date: string;
};

type HotelSearchState = {
  city: string;
  checkIn: string;
  checkOut: string;
};

type HotelFilterState = {
  area?: string;
  maxPrice?: number;
  minRating?: number;
  breakfastOnly: boolean;
};

export default function BookingRoute() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { trip, addTraveler, removeTraveler, updateOrganizerEmail, selectTransport, addReturnTransport, selectHotel, markBooked, setPlannerInput } = useTrip();
  const [travelerOpen, setTravelerOpen] = useState(false);
  const [finishedBookingOpen, setFinishedBookingOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hotelFilters, setHotelFilters] = useState<HotelFilterState>({ breakfastOnly: false });
  const [travelerName, setTravelerName] = useState('');
  const [travelerAge, setTravelerAge] = useState('');
  const [transportType, setTransportType] = useState<TransportType>('flight');
  const [transportResults, setTransportResults] = useState<Record<string, TransportOption[]>>({});
  const [hotelResults, setHotelResults] = useState<Record<string, HotelOption[]>>({});
  const [transportErrors, setTransportErrors] = useState<Record<string, string>>({});
  const [hotelErrors, setHotelErrors] = useState<Record<string, string>>({});
  const [transportLoading, setTransportLoading] = useState<Record<string, boolean>>({});
  const [hotelLoading, setHotelLoading] = useState<Record<string, boolean>>({});
  const [transportSearched, setTransportSearched] = useState<Record<string, boolean>>({});
  const [hotelSearched, setHotelSearched] = useState<Record<string, boolean>>({});
  const [transportSearch, setTransportSearch] = useState<Record<string, TransportSearchState>>(() => Object.fromEntries(trip.transportBookings.map((booking) => [booking.id, defaultTransportSearch(booking.source.city, booking.destination.city, trip.startDate)])));
  const [hotelSearch, setHotelSearch] = useState<Record<string, HotelSearchState>>(() => Object.fromEntries(trip.stayBookings.map((booking) => [booking.id, defaultHotelSearch(booking.city.city, trip.startDate, trip.endDate)])));
  const [message, setMessage] = useState('');
  const organizer = trip.travelers.find((traveler) => traveler.role === 'organizer');
  const organizerEmail = organizer?.email?.trim() ?? '';
  const bookingTravelers = trip.travelers.filter((traveler) => traveler.role !== 'organizer');
  const canBook = organizerEmail.length > 0;
  const hasTraveler = bookingTravelers.length > 0;
  const canConfirmBooking = canBook && hasTraveler;
  const adults = Math.max(1, bookingTravelers.filter((traveler) => traveler.age >= 18).length);
  const children = bookingTravelers.filter((traveler) => traveler.age < 18).length;

  useEffect(() => {
    setTransportSearch((current) => ({
      ...Object.fromEntries(trip.transportBookings.map((booking) => [booking.id, current[booking.id] ?? defaultTransportSearch(booking.source.city, booking.destination.city, trip.startDate)]))
    }));
    setHotelSearch((current) => ({
      ...Object.fromEntries(trip.stayBookings.map((booking) => [booking.id, current[booking.id] ?? defaultHotelSearch(booking.city.city, trip.startDate, trip.endDate)]))
    }));
  }, [trip.endDate, trip.startDate, trip.stayBookings, trip.transportBookings]);

  const estimatedTotal = useMemo(() => {
    const travelerCount = Math.max(1, bookingTravelers.length);
    const transport = trip.transportBookings.reduce((sum, booking) => sum + (booking.selectedOption ? booking.selectedOption.pricePerTraveler * travelerCount : 0), 0);
    const hotels = trip.stayBookings.reduce((sum, booking) => sum + (booking.selectedHotel ? booking.selectedHotel.pricePerNight * daysBetween(booking.checkIn, booking.checkOut) : 0), 0);
    return transport + hotels;
  }, [bookingTravelers.length, trip.stayBookings, trip.transportBookings]);
  const activeHotelFilterLabels = hotelFilterLabels(hotelFilters);
  const availableHotelAreas = useMemo(() => hotelAreas(hotelResults), [hotelResults]);

  function submitTraveler() {
    const age = Number(travelerAge);
    if (!travelerName.trim() || !age) return;
    addTraveler({ fullName: travelerName.trim(), age, role: 'traveler' });
    setTravelerName('');
    setTravelerAge('');
    setTravelerOpen(false);
  }

  function updateTravelerAge(value: string) {
    setTravelerAge(value.replace(/\D/g, ''));
  }

  function updateTransportSearch(bookingId: string, patch: Partial<TransportSearchState>) {
    const booking = trip.transportBookings.find((item) => item.id === bookingId);
    setTransportSearch((current) => ({ ...current, [bookingId]: { ...(current[bookingId] ?? defaultTransportSearch(booking?.source.city ?? '', booking?.destination.city ?? '', trip.startDate)), ...patch } }));
  }

  function updateHotelSearch(bookingId: string, patch: Partial<HotelSearchState>) {
    const booking = trip.stayBookings.find((item) => item.id === bookingId);
    setHotelSearch((current) => ({ ...current, [bookingId]: { ...(current[bookingId] ?? defaultHotelSearch(booking?.city.city ?? '', trip.startDate, trip.endDate)), ...patch } }));
  }

  async function searchTransportOptions(bookingId: string) {
    if (!hasTraveler) return;
    const criteria = transportSearch[bookingId];
    if (!criteria?.source.trim() || !criteria.destination.trim() || !criteria.date.trim()) return;
    setTransportLoading((current) => ({ ...current, [bookingId]: true }));
    setTransportErrors((current) => ({ ...current, [bookingId]: '' }));
    setTransportSearched((current) => ({ ...current, [bookingId]: true }));
    try {
      const options = await searchTransport({ source: criteria.source.trim(), destination: criteria.destination.trim(), date: criteria.date.trim(), adults, children, type: transportType });
      setTransportResults((current) => ({ ...current, [bookingId]: options }));
    } catch (error) {
      setTransportResults((current) => ({ ...current, [bookingId]: [] }));
      setTransportErrors((current) => ({ ...current, [bookingId]: error instanceof Error ? error.message : 'Unable to load transportation options.' }));
    } finally {
      setTransportLoading((current) => ({ ...current, [bookingId]: false }));
    }
  }

  async function searchHotelOptions(bookingId: string, rooms: number) {
    if (!hasTraveler) return;
    const criteria = hotelSearch[bookingId];
    if (!criteria?.city.trim() || !criteria.checkIn.trim() || !criteria.checkOut.trim()) return;
    setHotelLoading((current) => ({ ...current, [bookingId]: true }));
    setHotelErrors((current) => ({ ...current, [bookingId]: '' }));
    setHotelSearched((current) => ({ ...current, [bookingId]: true }));
    try {
      const options = await searchHotels({ city: criteria.city.trim(), checkIn: criteria.checkIn.trim(), checkOut: criteria.checkOut.trim(), adults, children, rooms });
      setHotelResults((current) => ({ ...current, [bookingId]: options }));
      setHotelFilters((current) => current.area && !options.some((hotel) => hotel.area === current.area) ? { ...current, area: undefined } : current);
    } catch (error) {
      setHotelResults((current) => ({ ...current, [bookingId]: [] }));
      setHotelErrors((current) => ({ ...current, [bookingId]: error instanceof Error ? error.message : 'Unable to load hotel options.' }));
    } finally {
      setHotelLoading((current) => ({ ...current, [bookingId]: false }));
    }
  }

  function finishBooking() {
    if (!canConfirmBooking) return;
    setFinishedBookingOpen(true);
  }

  function regenerateFromBookingDates() {
    const bookingDates = bookingDateWindow();
    markBooked();
    setFinishedBookingOpen(false);
    setPlannerInput({ source: trip.source.city, destination: trip.destination.city, startDate: bookingDates.startDate, days: bookingDates.days, pace: trip.pace, tripVibe: trip.tripVibe });
    router.push('/trip/create');
  }

  function goToMyTrips() {
    markBooked();
    setFinishedBookingOpen(false);
    router.push('/trips');
  }

  function bookingDateWindow() {
    const dates = [
      ...trip.transportBookings.map((booking) => transportSearch[booking.id]?.date ?? booking.date),
      ...trip.stayBookings.flatMap((booking) => [hotelSearch[booking.id]?.checkIn ?? booking.checkIn, hotelSearch[booking.id]?.checkOut ?? booking.checkOut])
    ].filter(isIsoDate);
    const sortedDates = dates.sort();
    const startDate = sortedDates[0] ?? trip.startDate;
    const endDate = sortedDates.at(-1) ?? trip.endDate;
    return { startDate, days: Math.max(1, daysBetween(startDate, endDate)) };
  }

  return (
    <Screen>
      <Header />
      <ScrollView>
        <View style={styles.hero}>
          <Container>
            <Row style={StyleSheet.flatten([styles.heroInner, { flexDirection: isDesktop ? 'row' : 'column' }])}>
              <Stack style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Approved itinerary</Text>
                <Heading size="xl" style={styles.heroTitle}>Book your trip</Heading>
                <Text style={styles.heroText}>Add travelers, choose transportation and arrange your stay.</Text>
              </Stack>
              <Card style={styles.contextCard}>
                <Row gap={spacing.sm} style={{ alignItems: 'center' }}><MapPin size={16} color={colors.primary} /><Text style={styles.contextTitle}>{trip.source.city} to {trip.destination.city}</Text></Row>
                <Text style={styles.contextText}>{trip.startDate} to {trip.endDate} · {trip.days} days</Text>
              </Card>
            </Row>
          </Container>
        </View>

        <Container style={styles.bookingContainer}>
          <Stack gap={spacing.lg}>
            <Card style={styles.progressCard}>
              <Row wrap gap={spacing.sm}>
                {[
                  ['1', 'Organizer', canBook ? 'Ready' : 'Required'],
                  ['2', 'Travelers', hasTraveler ? 'Ready' : 'Required'],
                  ['3', 'Booking', trip.transportBookings.some((booking) => booking.selectedOption) || trip.stayBookings.some((booking) => booking.selectedHotel) ? 'Chosen' : 'Pending']
                ].map(([num, label, state]) => (
                  <View key={label} style={styles.progressItem}>
                    <View style={StyleSheet.flatten([styles.progressNumber, state === 'Ready' || state === 'Chosen' ? styles.progressNumberReady : undefined])}>
                      {state === 'Ready' || state === 'Chosen' ? <Check size={14} color={colors.surface} /> : <Text style={styles.progressNumberText}>{num}</Text>}
                    </View>
                    <Stack gap={0}><Text style={styles.progressLabel}>{label}</Text><Text style={styles.progressState}>{state}</Text></Stack>
                  </View>
                ))}
              </Row>
            </Card>

            <Row gap={spacing.lg} style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'flex-start' }}>
              <Stack gap={spacing.lg} style={styles.bookingMain}>
                <Card style={StyleSheet.flatten([styles.bookingSection, styles.organizerCard])}>
                  <Row style={styles.organizerHeader}>
                    <View style={styles.avatar}><Mail size={20} color={colors.primary} /></View>
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Heading size="md">Organizer contact</Heading>
                      <Text style={{ color: colors.muted }}>Required for booking confirmations and tickets.</Text>
                    </Stack>
                  </Row>
                  <Input label="Organizer email" value={organizer?.email ?? ''} onChangeText={updateOrganizerEmail} keyboardType="email-address" placeholder="you@example.com" />
                  {!canBook ? <Text style={styles.requiredText}>Organizer email is mandatory before you book transport or stay options.</Text> : null}
                </Card>

                <Card style={styles.bookingSection}>
                  <Row wrap style={styles.sectionHeader}><Heading size="md">Who's traveling?</Heading><Button onPress={() => setTravelerOpen(true)} icon={<Plus size={16} color={colors.surface} />}>Add traveler</Button></Row>
                  {bookingTravelers.length ? (
                    <Row wrap>
                      {bookingTravelers.map((traveler) => (
                        <Card key={traveler.id} style={styles.travelerCard}>
                          <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <Row style={{ alignItems: 'center' }}><View style={styles.avatar}><User size={20} color={colors.primary} /></View><Stack gap={0}><Text style={{ fontWeight: '900' }}>{traveler.fullName}</Text><Text style={{ color: colors.muted }}>{`Age ${traveler.age} · ${traveler.age < 18 ? 'Child' : 'Adult'}`}</Text></Stack></Row>
                            <Button variant="danger" onPress={() => removeTraveler(traveler.id)}>Remove</Button>
                          </Row>
                        </Card>
                      ))}
                    </Row>
                  ) : <AvailabilityMessage tone="danger">At least 1 traveler is required before booking. Organizer email is only used for contact.</AvailabilityMessage>}
                </Card>

                <Card style={styles.bookingSection}>
                  <Row wrap style={styles.sectionHeader}><Stack><Heading size="md">Transport</Heading><Text style={{ color: colors.muted }}>Choose separate journey segments for this itinerary.</Text></Stack><Button variant="secondary" onPress={addReturnTransport}>Add another transport</Button></Row>
                  <Row><Chip label="Flight" selected={transportType === 'flight'} onPress={() => setTransportType('flight')} /><Chip label="Train" selected={transportType === 'train'} onPress={() => setTransportType('train')} /></Row>
                  {trip.transportBookings.map((booking) => (
                    <Stack key={booking.id}>
                      <Row style={styles.segmentHeader}><Stack gap={0}><Text style={{ fontWeight: '900' }}>{booking.source.city} to {booking.destination.city}</Text><Text style={{ color: colors.muted }}>{booking.journeyName} · {booking.date}</Text></Stack><StatusPill tone={booking.status === 'Selected' ? 'primary' : 'neutral'}>{booking.status}</StatusPill></Row>
                      <View style={styles.searchGrid}>
                        <Input label="Source" value={transportSearch[booking.id]?.source ?? booking.source.city} onChangeText={(value) => updateTransportSearch(booking.id, { source: value })} placeholder="From city" style={styles.searchInput} />
                        <Input label="Destination" value={transportSearch[booking.id]?.destination ?? booking.destination.city} onChangeText={(value) => updateTransportSearch(booking.id, { destination: value })} placeholder="To city" style={styles.searchInput} />
                        <DatePickerField label="Travel date" value={transportSearch[booking.id]?.date ?? defaultBookingDate(trip.startDate)} onChange={(value) => updateTransportSearch(booking.id, { date: value })} style={styles.searchInput} />
                        <Button onPress={() => searchTransportOptions(booking.id)} disabled={!hasTraveler || transportLoading[booking.id]} style={styles.searchButton}>{transportLoading[booking.id] ? 'Searching...' : 'Search'}</Button>
                      </View>
                      {transportErrors[booking.id] ? <AvailabilityMessage tone="danger">{transportErrors[booking.id]}</AvailabilityMessage> : null}
                      {!hasTraveler ? <AvailabilityMessage tone="danger">Add at least 1 traveler to search and view available {transportType} options.</AvailabilityMessage> : null}
                      {hasTraveler && !transportErrors[booking.id] && !transportSearched[booking.id] ? <AvailabilityMessage>Adjust the route or travel date, then search live {transportType} availability.</AvailabilityMessage> : null}
                      {hasTraveler && !transportErrors[booking.id] && transportLoading[booking.id] ? <AvailabilityMessage>Checking live {transportType} availability...</AvailabilityMessage> : null}
                      {hasTraveler && !transportErrors[booking.id] && !transportLoading[booking.id] && (transportResults[booking.id] ?? []).length ? (
                        <TransportCarousel
                          options={transportResults[booking.id] ?? []}
                          selectedId={booking.selectedOption?.id}
                          canBook={canConfirmBooking}
                          onSelect={(option) => selectTransport(booking.id, option)}
                        />
                      ) : null}
                      {hasTraveler && !transportErrors[booking.id] && transportSearched[booking.id] && !transportLoading[booking.id] && !(transportResults[booking.id] ?? []).length ? <AvailabilityMessage>No {transportType === 'flight' ? 'flights' : 'trains'} returned by the booking API for this segment.</AvailabilityMessage> : null}
                    </Stack>
                  ))}
                </Card>

                <Card style={styles.bookingSection}>
                  <Row wrap style={styles.sectionHeader}><Stack><Heading size="md">Stay</Heading><Text style={{ color: colors.muted }}>{trip.destination.city} · {trip.startDate} to {trip.endDate}</Text></Stack><Button variant="secondary" onPress={() => setFiltersOpen(true)} icon={<Filter size={16} color={colors.text} />}>Filters{activeHotelFilterLabels.length ? ` (${activeHotelFilterLabels.length})` : ''}</Button></Row>
                  <Row wrap>
                    {(activeHotelFilterLabels.length ? activeHotelFilterLabels : ['All hotels']).map((label) => <Chip key={label} label={label} selected={activeHotelFilterLabels.length > 0} onPress={() => setFiltersOpen(true)} />)}
                  </Row>
                  {trip.stayBookings.map((booking) => {
                    const results = hotelResults[booking.id] ?? [];
                    const filteredResults = filterHotels(results, hotelFilters);
                    return (
                      <Stack key={booking.id}>
                        <Row style={styles.segmentHeader}><Stack gap={0}><Text style={{ fontWeight: '900' }}>{booking.stayName}</Text><Text style={{ color: colors.muted }}>{booking.city.city} · {booking.checkIn} to {booking.checkOut}</Text></Stack><StatusPill tone={booking.status === 'Selected' ? 'primary' : 'neutral'}>{booking.status}</StatusPill></Row>
                        <View style={styles.searchGrid}>
                          <Input label="Destination" value={hotelSearch[booking.id]?.city ?? booking.city.city} onChangeText={(value) => updateHotelSearch(booking.id, { city: value })} placeholder="City or destination" style={styles.searchInput} />
                          <Input label="Check-in" value={hotelSearch[booking.id]?.checkIn ?? trip.startDate} onChangeText={(value) => updateHotelSearch(booking.id, { checkIn: value })} placeholder="YYYY-MM-DD" style={styles.searchInput} />
                          <Input label="Check-out" value={hotelSearch[booking.id]?.checkOut ?? trip.endDate} onChangeText={(value) => updateHotelSearch(booking.id, { checkOut: value })} placeholder="YYYY-MM-DD" style={styles.searchInput} />
                          <Button onPress={() => searchHotelOptions(booking.id, booking.rooms)} disabled={!hasTraveler || hotelLoading[booking.id]} style={styles.searchButton}>{hotelLoading[booking.id] ? 'Searching...' : 'Search'}</Button>
                        </View>
                        {hotelErrors[booking.id] ? <AvailabilityMessage tone="danger">{hotelErrors[booking.id]}</AvailabilityMessage> : null}
                        {!hasTraveler ? <AvailabilityMessage tone="danger">Add at least 1 traveler to search and view available hotel options.</AvailabilityMessage> : null}
                        {hasTraveler && !hotelErrors[booking.id] && !hotelSearched[booking.id] ? <AvailabilityMessage>Adjust the destination or stay dates, then search live hotel availability.</AvailabilityMessage> : null}
                        {hasTraveler && !hotelErrors[booking.id] && hotelLoading[booking.id] ? <AvailabilityMessage>Checking live hotel availability...</AvailabilityMessage> : null}
                        {hasTraveler && !hotelErrors[booking.id] && !hotelLoading[booking.id] && filteredResults.length ? <View style={styles.hotelGrid}>{filteredResults.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} selected={booking.selectedHotel?.id === hotel.id} nights={daysBetween(hotelSearch[booking.id]?.checkIn ?? booking.checkIn, hotelSearch[booking.id]?.checkOut ?? booking.checkOut)} canBook={canConfirmBooking} onSelect={() => selectHotel(booking.id, hotel)} />)}</View> : null}
                        {hasTraveler && !hotelErrors[booking.id] && hotelSearched[booking.id] && !hotelLoading[booking.id] && !results.length ? <AvailabilityMessage>No hotels returned by the booking API for this stay.</AvailabilityMessage> : null}
                        {hasTraveler && !hotelErrors[booking.id] && hotelSearched[booking.id] && !hotelLoading[booking.id] && results.length > 0 && !filteredResults.length ? <AvailabilityMessage>No hotels match the selected filters.</AvailabilityMessage> : null}
                      </Stack>
                    );
                  })}
                </Card>
              </Stack>

              {isDesktop ? <BookingRail estimatedTotal={estimatedTotal} message={message} canBook={canConfirmBooking} onFinishedBooking={finishBooking} /> : null}
            </Row>
            {!isDesktop ? <BookingRail estimatedTotal={estimatedTotal} message={message} canBook={canConfirmBooking} onFinishedBooking={finishBooking} /> : null}
          </Stack>
        </Container>
        <Footer />
      </ScrollView>

      <AppModal visible={travelerOpen} title="Add traveler" onClose={() => setTravelerOpen(false)}>
        <Input label="Name" value={travelerName} onChangeText={setTravelerName} placeholder="Traveler name" />
        <Stack gap={spacing.xs}>
          <Text style={styles.inputLabel}>Age</Text>
          <TextInput accessibilityLabel="Age" value={travelerAge} onChangeText={updateTravelerAge} keyboardType="numeric" inputMode="numeric" placeholder="Age" placeholderTextColor="rgba(90,100,128,0.5)" style={styles.numericInput} />
        </Stack>
        <Button onPress={submitTraveler}>Done</Button>
      </AppModal>
      <AppModal visible={filtersOpen} title="Hotel filters" onClose={() => setFiltersOpen(false)}>
        <Stack gap={spacing.lg}>
          <Stack gap={spacing.sm}>
            <Text style={styles.filterGroupLabel}>Area</Text>
            <Row wrap>
              <Chip label="All areas" selected={!hotelFilters.area} onPress={() => setHotelFilters((current) => ({ ...current, area: undefined }))} />
              {availableHotelAreas.map((area) => (
                <Chip key={area} label={area} selected={hotelFilters.area === area} onPress={() => setHotelFilters((current) => ({ ...current, area: current.area === area ? undefined : area }))} />
              ))}
            </Row>
            {!availableHotelAreas.length ? <Text style={styles.filterHelperText}>Search hotels to see area filters.</Text> : null}
          </Stack>
          <Stack gap={spacing.sm}>
            <Text style={styles.filterGroupLabel}>Price and rating</Text>
            <Row wrap>
              <Chip label="Under Rs 7,000" selected={hotelFilters.maxPrice === 7000} onPress={() => setHotelFilters((current) => ({ ...current, maxPrice: current.maxPrice === 7000 ? undefined : 7000 }))} />
              <Chip label="Under Rs 15,000" selected={hotelFilters.maxPrice === 15000} onPress={() => setHotelFilters((current) => ({ ...current, maxPrice: current.maxPrice === 15000 ? undefined : 15000 }))} />
              <Chip label="4+ rating" selected={hotelFilters.minRating === 4} onPress={() => setHotelFilters((current) => ({ ...current, minRating: current.minRating === 4 ? undefined : 4 }))} />
            </Row>
          </Stack>
          <Stack gap={spacing.sm}>
            <Text style={styles.filterGroupLabel}>Amenities</Text>
            <Row wrap>
              <Chip label="Breakfast" selected={hotelFilters.breakfastOnly} onPress={() => setHotelFilters((current) => ({ ...current, breakfastOnly: !current.breakfastOnly }))} />
            </Row>
          </Stack>
          <Row wrap style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onPress={() => setHotelFilters({ breakfastOnly: false })}>Clear filters</Button>
            <Button onPress={() => setFiltersOpen(false)}>Apply filters</Button>
          </Row>
        </Stack>
      </AppModal>
      <AppModal visible={finishedBookingOpen} title="Booking dates changed?" onClose={() => setFinishedBookingOpen(false)}>
        <Stack gap={spacing.md}>
          <Text style={styles.confirmText}>Would you like to regenerate itinerary according to your booking dates?</Text>
          <Row wrap style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onPress={goToMyTrips}>No, go to My Trips</Button>
            <Button onPress={regenerateFromBookingDates} icon={<ArrowRight size={16} color={colors.surface} />}>Yes, regenerate</Button>
          </Row>
        </Stack>
      </AppModal>
    </Screen>
  );
}

function defaultTransportSearch(source: string, destination: string, startDate: string): TransportSearchState {
  return { source, destination, date: defaultBookingDate(startDate) };
}

function defaultHotelSearch(city: string, checkIn: string, checkOut: string): HotelSearchState {
  return { city, checkIn, checkOut };
}

function defaultBookingDate(startDate: string) {
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() - 2);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function filterHotels(hotels: HotelOption[], filters: HotelFilterState) {
  return hotels.filter((hotel) => {
    const amenities = hotel.amenities.join(' ').toLowerCase();
    if (filters.area && hotel.area !== filters.area) return false;
    if (filters.maxPrice && hotel.pricePerNight > filters.maxPrice) return false;
    if (filters.minRating && hotel.rating < filters.minRating) return false;
    if (filters.breakfastOnly && !amenities.includes('breakfast')) return false;
    return true;
  });
}

function hotelFilterLabels(filters: HotelFilterState) {
  return [
    filters.area ?? '',
    filters.maxPrice ? `Under ${formatInr(filters.maxPrice)}` : '',
    filters.minRating ? `${filters.minRating}+ rating` : '',
    filters.breakfastOnly ? 'Breakfast' : ''
  ].filter(Boolean);
}

function hotelAreas(results: Record<string, HotelOption[]>) {
  return Array.from(new Set(Object.values(results).flat().map((hotel) => hotel.area).filter(Boolean))).slice(0, 8);
}

function DatePickerField({ label, value, onChange, style }: { label: string; value: string; onChange: (value: string) => void; style?: object }) {
  return (
    <Stack gap={spacing.xs} style={style}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.dateInputShell}>
        <CalendarDays size={16} color={colors.primary} />
        {createElement('input', {
          'aria-label': label,
          type: 'date',
          value,
          onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
          style: webDateInputStyle
        })}
      </View>
    </Stack>
  );
}

function TransportCarousel({ options, selectedId, canBook, onSelect }: { options: TransportOption[]; selectedId?: string; canBook: boolean; onSelect: (option: TransportOption) => void }) {
  const scrollerRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const canScroll = contentWidth > viewportWidth + 8;

  function scroll(direction: 'left' | 'right') {
    const nextOffset = Math.max(0, scrollOffset.current + (direction === 'right' ? 344 : -344));
    scrollOffset.current = nextOffset;
    scrollerRef.current?.scrollTo({ x: nextOffset, animated: true });
  }

  return (
    <Stack gap={spacing.sm}>
      {canScroll ? (
        <Row gap={spacing.sm} style={{ alignSelf: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous transport options" onPress={() => scroll('left')} style={styles.carouselArrow}>
            <ChevronLeft size={17} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next transport options" onPress={() => scroll('right')} style={styles.carouselArrow}>
            <ChevronRight size={17} color={colors.text} />
          </Pressable>
        </Row>
      ) : null}
      <ScrollView
        ref={scrollerRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.transportCarousel}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
      >
        {options.map((option) => (
          <TransportCard key={option.id} option={option} selected={selectedId === option.id} canBook={canBook} onSelect={() => onSelect(option)} />
        ))}
      </ScrollView>
    </Stack>
  );
}

function TransportCard({ option, selected, canBook, onSelect }: { option: TransportOption; selected?: boolean; canBook: boolean; onSelect: () => void }) {
  const Icon = option.type === 'flight' ? Plane : Train;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const title = option.transportNumber ? `${option.transportName ?? option.provider} (${option.transportNumber})` : option.transportName ?? option.provider;
  const seatsLabel = option.seatsAvailable ?? '-';
  return (
    <>
      <Card selected={selected} style={styles.transportOptionCard}>
        <Stack gap={spacing.md}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Stack gap={spacing.xs} style={styles.transportTitleBlock}>
              <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                <Icon size={16} color={colors.primary} />
                <Text style={styles.transportTypeLabel}>{option.type === 'train' ? 'Train option' : 'Flight option'}</Text>
              </Row>
              <Pressable accessibilityRole="button" accessibilityLabel={`Show details for ${title}`} onPress={() => setDetailsOpen(true)}>
                <Heading size="sm" style={styles.transportTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Heading>
              </Pressable>
            </Stack>
            <StatusPill tone={selected ? 'primary' : 'neutral'}>{selected ? 'Selected' : 'Available'}</StatusPill>
          </Row>

          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack gap={spacing.xs}>
              <Text style={styles.time}>{formatTransportTime(option.departureTime)}</Text>
              <Text style={styles.stationCode}>{option.fromCode ?? '-'}</Text>
            </Stack>
            <Stack gap={spacing.xs} style={styles.durationBlock}>
              <Clock size={14} color={colors.primary} />
              <Text style={styles.durationText}>{option.duration}</Text>
            </Stack>
            <Stack gap={spacing.xs} style={{ alignItems: 'flex-end' }}>
              <Text style={styles.time}>{formatTransportTime(option.arrivalTime)}</Text>
              <Text style={styles.stationCode}>{option.toCode ?? '-'}</Text>
            </Stack>
          </Row>

          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack gap={0}>
              <Text style={styles.transportMetaLabel}>Available seats</Text>
              <Text style={styles.transportMetaValue}>{option.seatsAvailable ?? '-'}</Text>
            </Stack>
            <Stack gap={0} style={{ alignItems: 'flex-end' }}>
              <Text style={styles.transportMetaLabel}>Price / seat</Text>
              <Text style={styles.transportPrice}>{formatInr(option.pricePerTraveler)}</Text>
            </Stack>
          </Row>

          <Button onPress={onSelect} disabled={!canBook}>{selected ? 'Booked' : 'Book'}</Button>
        </Stack>
      </Card>
      <AppModal visible={detailsOpen} title={title} onClose={() => setDetailsOpen(false)}>
        <Stack gap={spacing.md}>
          <View style={styles.transportDetailsHero}>
            <View style={styles.transportDetailsIcon}><Icon size={24} color={colors.surface} /></View>
            <Stack gap={spacing.xs} style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.transportDetailsKicker}>{option.type === 'train' ? 'Train option' : 'Flight option'}</Text>
              <Heading size="sm" numberOfLines={2}>{title}</Heading>
              <Text style={styles.transportDetailsMuted}>{option.provider}{option.code ? ` · ${option.code}` : ''}</Text>
            </Stack>
            <StatusPill tone={selected ? 'primary' : 'neutral'}>{selected ? 'Selected' : 'Available'}</StatusPill>
          </View>
          <View style={styles.transportDetailsRoute}>
            <Stack gap={spacing.xs}>
              <Text style={styles.time}>{formatTransportTime(option.departureTime)}</Text>
              <Text style={styles.stationCode}>{option.fromCode ?? '-'}</Text>
            </Stack>
            <Stack gap={spacing.xs} style={styles.transportDetailsDuration}>
              <Clock size={15} color={colors.primary} />
              <Text style={styles.durationText}>{option.duration}</Text>
            </Stack>
            <Stack gap={spacing.xs} style={{ alignItems: 'flex-end' }}>
              <Text style={styles.time}>{formatTransportTime(option.arrivalTime)}</Text>
              <Text style={styles.stationCode}>{option.toCode ?? '-'}</Text>
            </Stack>
          </View>
          <Row wrap style={styles.hotelDetailsStats}>
            <View style={styles.hotelStatCard}>
              <Text style={styles.hotelStatLabel}>Stops</Text>
              <Text style={styles.hotelStatValue}>{option.stops}</Text>
            </View>
            <View style={styles.hotelStatCard}>
              <Text style={styles.hotelStatLabel}>Seats</Text>
              <Text style={styles.hotelStatValue}>{seatsLabel}</Text>
            </View>
            <View style={styles.hotelStatCard}>
              <Text style={styles.hotelStatLabel}>Price / seat</Text>
              <Text style={styles.hotelStatValue}>{formatInr(option.pricePerTraveler)}</Text>
            </View>
          </Row>
          <Stack gap={spacing.sm} style={styles.hotelDetailsPanel}>
            <Text style={styles.hotelDetailsLabel}>Journey details</Text>
            <Text style={styles.hotelDetailsText}>{option.details}</Text>
          </Stack>
          <Row wrap style={styles.hotelDetailsFooter}>
            <Stack gap={0}>
              <Text style={styles.hotelPriceLabel}>Price / seat</Text>
              <Text style={styles.hotelDetailsPrice}>{formatInr(option.pricePerTraveler)}</Text>
            </Stack>
            <Button onPress={onSelect} disabled={!canBook} style={styles.hotelDetailsBookButton}>{selected ? 'Booked' : `Book ${option.type}`}</Button>
          </Row>
        </Stack>
      </AppModal>
    </>
  );
}

function formatTransportTime(value: string) {
  if (!value || value === 'TBD') return value || 'TBD';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return value;
}

function HotelCard({ hotel, selected, nights, canBook, onSelect }: { hotel: HotelOption; selected?: boolean; nights: number; canBook: boolean; onSelect: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsImageUrl, setDetailsImageUrl] = useState(() => hotel.imageUrl ? largeBookingHotelImageUrl(hotel.imageUrl) : undefined);
  const reviewText = hotel.reviewCount ? `${hotel.reviewCount.toLocaleString()} reviews` : hotel.reviewLabel ?? 'Reviews';
  const totalPrice = hotel.pricePerNight * nights;

  return (
    <>
      <Card selected={selected} style={styles.hotelCard}>
        <Stack style={styles.hotelBody} gap={spacing.sm}>
          <Row style={{ alignItems: 'flex-start' }}>
            {hotel.imageUrl ? <Image source={{ uri: hotel.imageUrl }} style={styles.hotelImage} resizeMode="cover" /> : <View style={styles.hotelImagePlaceholder}><BedDouble size={22} color={colors.primary} /></View>}
            <Stack gap={spacing.xs} style={{ flex: 1, minWidth: 0 }}>
              <Heading size="sm" style={styles.hotelTitle} numberOfLines={1} ellipsizeMode="tail">{hotel.name}</Heading>
              <Text style={styles.hotelArea}>{hotel.area}</Text>
              {hotel.rating > 0 ? (
                <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                  <Star size={14} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.hotelRating}>{hotel.rating.toFixed(1)}</Text>
                  <Text style={styles.hotelReview}>{reviewText}</Text>
                </Row>
              ) : <Text style={styles.hotelReview}>{reviewText}</Text>}
            </Stack>
          </Row>
          <View style={styles.rule} />
          <Row style={styles.hotelPriceRow}>
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.hotelPriceLabel}>Per night</Text>
              <Text style={styles.hotelPrice}>{formatInr(hotel.pricePerNight)}</Text>
            </Stack>
            <Text style={styles.hotelTotal}>{formatInr(totalPrice)} total</Text>
          </Row>
          <Row gap={spacing.sm} style={styles.hotelCardActions}>
            <Button variant="secondary" onPress={() => setDetailsOpen(true)} style={styles.hotelDetailsButton}>Details</Button>
            <Button onPress={onSelect} disabled={!canBook} style={styles.hotelBookButton}>{selected ? 'Booked' : 'Book'}</Button>
          </Row>
        </Stack>
      </Card>
      <AppModal visible={detailsOpen} title={hotel.name} onClose={() => setDetailsOpen(false)}>
        <Stack gap={spacing.md}>
          {detailsImageUrl ? (
            <Image
              source={{ uri: detailsImageUrl }}
              style={styles.hotelDetailsImage}
              resizeMode="cover"
              onError={() => setDetailsImageUrl((current) => current === hotel.imageUrl ? undefined : hotel.imageUrl)}
            />
          ) : (
            <View style={styles.hotelDetailsPlaceholder}>
              <BedDouble size={34} color={colors.primary} />
            </View>
          )}
          <Row wrap style={styles.hotelDetailsStats}>
            <View style={styles.hotelStatCard}>
              <Text style={styles.hotelStatLabel}>Rating</Text>
              <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                <Star size={15} color="#FACC15" fill="#FACC15" />
                <Text style={styles.hotelStatValue}>{hotel.rating > 0 ? hotel.rating.toFixed(1) : 'New'}</Text>
              </Row>
            </View>
            <View style={styles.hotelStatCard}>
              <Text style={styles.hotelStatLabel}>Reviews</Text>
              <Text style={styles.hotelStatValue}>{reviewText}</Text>
            </View>
            <View style={styles.hotelStatCard}>
              <Text style={styles.hotelStatLabel}>Stay total</Text>
              <Text style={styles.hotelStatValue}>{formatInr(totalPrice)}</Text>
            </View>
          </Row>
          <View style={styles.hotelLocationRow}>
            <MapPin size={16} color={colors.primary} />
            <Text style={styles.hotelLocationText}>{hotel.area}</Text>
          </View>
          <Stack gap={spacing.sm} style={styles.hotelDetailsPanel}>
            <Text style={styles.hotelDetailsLabel}>About this stay</Text>
            <Text style={styles.hotelDetailsText}>{hotel.details}</Text>
          </Stack>
          {hotel.amenities.length ? (
            <Stack gap={spacing.sm}>
              <Text style={styles.hotelDetailsLabel}>Amenities</Text>
              <Row wrap gap={spacing.sm}>{hotel.amenities.map((amenity) => <Chip key={amenity} label={amenity} />)}</Row>
            </Stack>
          ) : null}
          <Row wrap style={styles.hotelDetailsFooter}>
            <Stack gap={0}>
              <Text style={styles.hotelPriceLabel}>Per night</Text>
              <Text style={styles.hotelDetailsPrice}>{formatInr(hotel.pricePerNight)}</Text>
            </Stack>
            <Button onPress={onSelect} disabled={!canBook} style={styles.hotelDetailsBookButton}>{selected ? 'Booked' : 'Book this stay'}</Button>
          </Row>
        </Stack>
      </AppModal>
    </>
  );
}

function largeBookingHotelImageUrl(value: string) {
  return value.replace('/square60/', '/square600/');
}

function AvailabilityMessage({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'danger' }) {
  return <View style={StyleSheet.flatten([styles.availabilityMessage, tone === 'danger' && styles.availabilityError])}><Text style={StyleSheet.flatten([styles.availabilityText, tone === 'danger' && styles.availabilityErrorText])}>{children}</Text></View>;
}

function BookingRail({ estimatedTotal, message, canBook, onFinishedBooking }: { estimatedTotal: number; message: string; canBook: boolean; onFinishedBooking: () => void }) {
  const { isDesktop } = useResponsive();
  return (
    <View style={StyleSheet.flatten([styles.bookingRail, !isDesktop && styles.mobileBookingRail])}>
      <ItineraryPanel />
      <Summary estimatedTotal={estimatedTotal} message={message} canBook={canBook} onFinishedBooking={onFinishedBooking} />
    </View>
  );
}

function ItineraryPanel() {
  const { trip } = useTrip();
  return (
    <Card style={styles.itineraryPanel}>
      <Row style={{ alignItems: 'center' }}>
        <View style={styles.avatar}><CalendarDays size={20} color={colors.primary} /></View>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Heading size="sm">Trip itinerary</Heading>
          <Text style={styles.railSubText} numberOfLines={1} ellipsizeMode="tail">{trip.destination.city} · {trip.startDate} to {trip.endDate}</Text>
        </Stack>
      </Row>
      <ScrollView style={styles.itineraryScroll} contentContainerStyle={styles.itineraryScrollContent} nestedScrollEnabled>
        {trip.itinerary.map((day) => (
          <View key={day.id} style={styles.itineraryDay}>
            <Text style={styles.itineraryDayTitle}>{day.restDay ? `Rest day · ${day.date}` : `Day ${day.dayNumber} · ${day.date}`}</Text>
            <Text style={styles.itineraryDayText} numberOfLines={2} ellipsizeMode="tail">{day.restDay ? 'No activities planned.' : day.activities.map((activity) => activity.name).join(' · ')}</Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

function Summary({ estimatedTotal, message, canBook, onFinishedBooking }: { estimatedTotal: number; message: string; canBook: boolean; onFinishedBooking: () => void }) {
  const { trip } = useTrip();
  const hasOrganizerEmail = trip.travelers.some((traveler) => traveler.role === 'organizer' && traveler.email?.trim());
  const travelerCount = trip.travelers.filter((traveler) => traveler.role !== 'organizer').length;
  const selectedTransport = trip.transportBookings.filter((booking) => booking.selectedOption);
  const selectedStays = trip.stayBookings.filter((booking) => booking.selectedHotel);
  return (
    <Card style={styles.summary}>
      <Stack gap={spacing.md}>
        <Heading size="sm">Booking summary</Heading>
        <View style={styles.summaryChecklist}>
          <SummaryStatus label="Organizer email" value={hasOrganizerEmail ? 'Added' : 'Required'} ready={hasOrganizerEmail} />
          <SummaryStatus label="Travelers" value={travelerCount ? `${travelerCount}` : 'Required'} ready={travelerCount > 0} />
        </View>
        <View style={styles.rule} />
        <SummarySelection title="Booked transportation" empty="Not booked">
          {selectedTransport.map((booking) => <Text key={booking.id} style={styles.summarySelectionText}>{booking.selectedOption?.provider} {booking.selectedOption?.code}</Text>)}
        </SummarySelection>
        <View style={styles.rule} />
        <SummarySelection title="Booked stays" empty="Not booked">
          {selectedStays.map((booking) => <Text key={booking.id} style={styles.summarySelectionText}>{booking.selectedHotel?.name}</Text>)}
        </SummarySelection>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Estimated total</Text>
          <Heading size="sm">{formatInr(estimatedTotal)}</Heading>
        </View>
        {message ? <Text style={StyleSheet.flatten([styles.summaryMessage, (message.includes('failed') || message.includes('required')) && styles.summaryMessageError])}>{message}</Text> : null}
        <Button variant="secondary" onPress={onFinishedBooking} disabled={!canBook} icon={<ExternalLink size={16} color={colors.text} />}>I've finished booking</Button>
      </Stack>
    </Card>
  );
}

function SummaryStatus({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <Row style={styles.summaryStatusRow}>
      <Text style={styles.summaryStatusLabel}>{label}</Text>
      <Text style={ready ? styles.summaryReady : styles.summaryRequired}>{value}</Text>
    </Row>
  );
}

function SummarySelection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <Stack gap={spacing.xs}>
      <Text style={styles.summaryStatusLabel}>{title}</Text>
      {Array.isArray(children) && children.length ? children : <Text style={styles.summaryEmpty}>{empty}</Text>}
    </Stack>
  );
}

const webDateInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: colors.text,
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
  fontSize: 15,
  fontWeight: 700
};

const styles = StyleSheet.create({
  hero: { backgroundImage: 'linear-gradient(135deg, #092141 0%, #17438D 58%, #2575F1 100%)' as never },
  heroInner: { alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg },
  heroTitle: { color: colors.surface },
  heroText: { color: 'rgba(255,255,255,0.72)' },
  eyebrow: { color: colors.cyan, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 },
  contextCard: { backgroundColor: 'rgba(255,255,255,0.95)', minWidth: 260, borderColor: 'rgba(255,255,255,0.64)' },
  contextTitle: { color: colors.primaryDark, fontWeight: '900' },
  contextText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  bookingContainer: { paddingTop: spacing.xl },
  progressCard: { borderRadius: 12, backgroundColor: '#FBFDFF', borderColor: '#D7E7FF', padding: spacing.md },
  progressItem: { flex: 1, minWidth: 180, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 10, padding: spacing.md },
  progressNumber: { width: 28, height: 28, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  progressNumberReady: { backgroundColor: colors.success },
  progressNumberText: { color: colors.surface, fontWeight: '900' },
  progressLabel: { color: colors.text, fontWeight: '900' },
  progressState: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  bookingMain: { flex: 1, minWidth: 0 },
  bookingSection: { borderRadius: 14, borderColor: '#D7E7FF', backgroundColor: '#FFFFFF' },
  sectionHeader: { justifyContent: 'space-between', alignItems: 'center' },
  organizerCard: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
  organizerHeader: { alignItems: 'center', justifyContent: 'flex-start', gap: spacing.md },
  requiredText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  filterGroupLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  filterHelperText: { color: colors.muted, fontSize: 12 },
  travelerCard: { flex: 1, minWidth: 280, backgroundColor: 'rgba(245,244,241,0.5)' },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EBF2FE', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  numericInput: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  segmentHeader: { justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: 12, backgroundColor: '#EBF2FE', borderWidth: 1, borderColor: '#D7E7FF' },
  searchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-end' },
  searchInput: { flexGrow: 1, flexBasis: 180, minWidth: 180 },
  dateInputShell: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchButton: { minWidth: 120 },
  transportCarousel: { gap: spacing.md, paddingRight: spacing.lg },
  carouselArrow: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  transportOptionCard: { width: 316, minHeight: 248, borderRadius: 12, backgroundColor: '#FBFDFF', borderColor: '#D7E7FF' },
  transportTypeLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  transportTitleBlock: { flex: 1, minWidth: 0, height: 48 },
  transportTitle: { fontSize: 16, lineHeight: 22 },
  time: { fontSize: 20, fontWeight: '900' },
  stationCode: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  durationBlock: { alignItems: 'center', minWidth: 86, paddingHorizontal: spacing.sm },
  durationText: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  transportMetaLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  transportMetaValue: { color: colors.text, fontSize: 15, fontWeight: '900' },
  transportPrice: { color: colors.primaryDark, fontSize: 16, fontWeight: '900' },
  transportDetailsHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 12, backgroundColor: '#F8FBFF', padding: spacing.md },
  transportDetailsIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #5EC8DF 100%)' as never },
  transportDetailsKicker: { color: colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  transportDetailsMuted: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  transportDetailsRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 12, backgroundColor: '#FFFFFF', padding: spacing.lg },
  transportDetailsDuration: { alignItems: 'center', minWidth: 100, paddingHorizontal: spacing.md },
  hotelGrid: { display: 'grid' as never, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' as never, gap: spacing.md, width: '100%' },
  hotelCard: { width: '100%', minWidth: 0, padding: 0, overflow: 'hidden', borderColor: '#D7E7FF' },
  hotelImage: { width: 68, height: 68, borderRadius: 8, backgroundColor: '#EBF2FE' },
  hotelImagePlaceholder: { width: 68, height: 68, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2FE' },
  hotelBody: { padding: spacing.md, height: '100%', justifyContent: 'space-between' },
  hotelTitle: { fontSize: 16, lineHeight: 21 },
  hotelArea: { color: colors.muted, fontSize: 12 },
  hotelRating: { fontSize: 13, fontWeight: '900' },
  hotelReview: { color: colors.muted, fontSize: 12 },
  hotelPriceLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  hotelPrice: { color: colors.primaryDark, fontSize: 16, fontWeight: '900' },
  hotelTotal: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  hotelPriceRow: { justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md },
  hotelCardActions: { alignItems: 'center', width: '100%' },
  hotelDetailsButton: { flex: 1, minHeight: 42, paddingHorizontal: spacing.md },
  hotelBookButton: { flex: 1, minHeight: 42, paddingHorizontal: spacing.md },
  hotelDetailsImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#EBF2FE' },
  hotelDetailsPlaceholder: { width: '100%', height: 180, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2FE', borderWidth: 1, borderColor: '#D7E7FF' },
  hotelDetailsStats: { alignItems: 'stretch' },
  hotelStatCard: { flex: 1, minWidth: 150, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 10, backgroundColor: '#F8FBFF', padding: spacing.md, gap: spacing.xs },
  hotelStatLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  hotelStatValue: { color: colors.text, fontSize: 15, fontWeight: '900' },
  hotelLocationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 10, backgroundColor: '#FFFFFF', padding: spacing.md },
  hotelLocationText: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  hotelDetailsPanel: { borderRadius: 12, backgroundColor: colors.surfaceMuted, padding: spacing.md },
  hotelDetailsLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  hotelDetailsText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  hotelDetailsFooter: { justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  hotelDetailsPrice: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  hotelDetailsBookButton: { minWidth: 160 },
  availabilityMessage: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceMuted, padding: spacing.md },
  availabilityText: { color: colors.muted, fontSize: 13 },
  availabilityError: { borderColor: '#F8C8C2', backgroundColor: '#FEEDEB' },
  availabilityErrorText: { color: colors.danger },
  confirmText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  summaryReady: { color: colors.success, fontSize: 12, fontWeight: '900' },
  summaryRequired: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  bookingRail: { width: 320, position: 'sticky' as never, top: spacing.md, alignSelf: 'flex-start' },
  mobileBookingRail: { width: '100%', position: 'relative' as never, top: 0 },
  itineraryPanel: { maxHeight: 300, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: '#D7E7FF', backgroundColor: '#FBFDFF' },
  railSubText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  itineraryScroll: { maxHeight: 190 },
  itineraryScrollContent: { gap: spacing.sm },
  itineraryDay: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surfaceMuted },
  itineraryDayTitle: { fontSize: 13, fontWeight: '900' },
  itineraryDayText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  summary: { width: '100%', marginTop: -1, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderColor: '#D7E7FF' },
  summaryChecklist: { borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 12, overflow: 'hidden', backgroundColor: '#F8FBFF' },
  summaryStatusRow: { minHeight: 42, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: '#E6EEF9' },
  summaryStatusLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  summarySelectionText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  summaryEmpty: { color: colors.text, fontSize: 13 },
  totalBox: { borderRadius: 12, backgroundColor: '#EBF2FE', borderWidth: 1, borderColor: '#BFDBFE', padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  summaryMessage: { color: colors.success, fontSize: 13, fontWeight: '800' },
  summaryMessageError: { color: colors.danger },
  rule: { height: 1, backgroundColor: colors.border }
});
