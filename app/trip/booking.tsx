import { BedDouble, CalendarDays, CreditCard, ExternalLink, Filter, Mail, MapPin, Plane, Plus, Star, Train, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { completeBookings, searchHotels, searchTransport } from '../../src/rn/services/api';
import { daysBetween, formatInr } from '../../src/rn/data';
import { colors, spacing } from '../../src/rn/theme';
import { AppModal, Button, Card, Chip, Container, Heading, Input, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { HotelOption, TransportOption, TransportType } from '../../src/rn/types';
import { useResponsive } from '../../src/rn/useResponsive';

export default function BookingRoute() {
  const { isDesktop } = useResponsive();
  const { trip, addTraveler, removeTraveler, updateOrganizerEmail, selectTransport, addReturnTransport, selectHotel, addStay, markBooked } = useTrip();
  const [travelerOpen, setTravelerOpen] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [travelerName, setTravelerName] = useState('');
  const [travelerAge, setTravelerAge] = useState('');
  const [transportType, setTransportType] = useState<TransportType>('flight');
  const [transportResults, setTransportResults] = useState<Record<string, TransportOption[]>>({});
  const [hotelResults, setHotelResults] = useState<Record<string, HotelOption[]>>({});
  const [message, setMessage] = useState('');
  const organizer = trip.travelers.find((traveler) => traveler.role === 'organizer');
  const adults = Math.max(1, trip.travelers.filter((traveler) => traveler.age >= 18).length);
  const children = trip.travelers.filter((traveler) => traveler.age < 18).length;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [transportEntries, hotelEntries] = await Promise.all([
        Promise.all(trip.transportBookings.map(async (booking) => [booking.id, await searchTransport({ source: booking.source.city, destination: booking.destination.city, date: booking.date, adults, children, type: transportType })] as const)),
        Promise.all(trip.stayBookings.map(async (booking) => [booking.id, await searchHotels({ city: booking.city.city, checkIn: booking.checkIn, checkOut: booking.checkOut, adults, children, rooms: booking.rooms })] as const))
      ]);
      if (!cancelled) {
        setTransportResults(Object.fromEntries(transportEntries));
        setHotelResults(Object.fromEntries(hotelEntries));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [adults, children, transportType, trip.stayBookings, trip.transportBookings]);

  const estimatedTotal = useMemo(() => {
    const transport = trip.transportBookings.reduce((sum, booking) => sum + (booking.selectedOption ? booking.selectedOption.pricePerTraveler * trip.travelers.length : 0), 0);
    const hotels = trip.stayBookings.reduce((sum, booking) => sum + (booking.selectedHotel ? booking.selectedHotel.pricePerNight * daysBetween(booking.checkIn, booking.checkOut) : 0), 0);
    return transport + hotels;
  }, [trip.stayBookings, trip.transportBookings, trip.travelers.length]);

  function submitTraveler() {
    const age = Number(travelerAge);
    if (!travelerName.trim() || !age) return;
    addTraveler({ fullName: travelerName.trim(), age, role: 'traveler' });
    setTravelerName('');
    setTravelerAge('');
    setTravelerOpen(false);
  }

  async function complete() {
    setMessage('Booking selected options...');
    try {
      await completeBookings({
        transport: trip.transportBookings.map((booking) => booking.selectedOption).filter(Boolean) as TransportOption[],
        hotels: trip.stayBookings.map((booking) => booking.selectedHotel).filter(Boolean) as HotelOption[],
        travelers: trip.travelers.map((traveler) => ({ fullName: traveler.fullName, age: traveler.age })),
        source: trip.source.city,
        destination: trip.destination.city,
        date: trip.startDate,
        city: trip.destination.city,
        checkIn: trip.startDate,
        checkOut: trip.endDate,
        adults,
        children
      });
      markBooked();
      setMessage('Selected bookings are confirmed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Booking failed.');
    }
  }

  return (
    <Screen>
      <Header />
      <ScrollView>
        <View style={styles.hero}>
          <Container>
            <Row style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Stack>
                <Text style={styles.eyebrow}>Approved itinerary</Text>
                <Heading size="xl" style={styles.heroTitle}>Book your trip</Heading>
                <Text style={styles.heroText}>Add travelers, choose transportation and arrange your stay.</Text>
              </Stack>
              <Card style={styles.contextCard}>
                <Row style={{ alignItems: 'center' }}><MapPin size={16} color={colors.primary} /><Text style={{ fontWeight: '900' }}>{trip.source.city} to {trip.destination.city}</Text></Row>
                <Text style={{ color: colors.muted }}>{trip.startDate} to {trip.endDate} · {trip.days} days</Text>
              </Card>
            </Row>
          </Container>
        </View>

        <Container>
          <Stack gap={spacing.lg}>
            <Card style={styles.progressCard}>
              <Row>
                {[
                  ['1', 'Travelers', 'Booked'],
                  ['2', 'Transport', 'Selected'],
                  ['3', 'Stay', 'Selected']
                ].map(([num, label, state]) => (
                  <View key={label} style={styles.progressItem}><View style={styles.progressNumber}><Text style={{ color: colors.surface, fontWeight: '900' }}>{num}</Text></View><Stack gap={0}><Text style={{ fontWeight: '900' }}>{label}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{state}</Text></Stack></View>
                ))}
              </Row>
            </Card>

            <Row style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'flex-start' }}>
              <Stack style={{ flex: 1 }}>
                <Card>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}><Heading size="md">Who's traveling?</Heading><Button onPress={() => setTravelerOpen(true)} icon={<Plus size={16} color={colors.surface} />}>Add traveler</Button></Row>
                  <Input label="Organizer email" value={organizer?.email ?? ''} onChangeText={updateOrganizerEmail} keyboardType="email-address" placeholder="you@example.com" />
                  <Row wrap>
                    {trip.travelers.map((traveler) => (
                      <Card key={traveler.id} style={styles.travelerCard}>
                        <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                          <Row style={{ alignItems: 'center' }}><View style={styles.avatar}><User size={20} color={colors.primary} /></View><Stack gap={0}><Text style={{ fontWeight: '900' }}>{traveler.fullName}</Text><Text style={{ color: colors.muted }}>{traveler.role === 'organizer' ? 'Trip organizer' : `Age ${traveler.age} · ${traveler.age < 18 ? 'Child' : 'Adult'}`}</Text></Stack></Row>
                          {traveler.role !== 'organizer' ? <Button variant="danger" onPress={() => removeTraveler(traveler.id)}>Remove</Button> : null}
                        </Row>
                      </Card>
                    ))}
                  </Row>
                </Card>

                <Card>
                  <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}><Row style={{ alignItems: 'center' }}><View style={styles.avatar}><CalendarDays size={20} color={colors.primary} /></View><Stack gap={0}><Heading size="sm">Trip itinerary</Heading><Text style={{ color: colors.muted }}>{trip.destination.city} · {trip.startDate} to {trip.endDate}</Text></Stack></Row><Button variant="secondary" onPress={() => setItineraryOpen(true)}>View itinerary</Button></Row>
                </Card>

                <Card>
                  <Row style={{ justifyContent: 'space-between' }}><Stack><Heading size="md">Transport</Heading><Text style={{ color: colors.muted }}>Choose separate journey segments for this itinerary.</Text></Stack><Button variant="secondary">Add another transport</Button></Row>
                  <Row><Chip label="Flight" selected={transportType === 'flight'} onPress={() => setTransportType('flight')} /><Chip label="Train" selected={transportType === 'train'} onPress={() => setTransportType('train')} /></Row>
                  {trip.transportBookings.map((booking) => (
                    <Stack key={booking.id}>
                      <Row style={styles.segmentHeader}><Stack gap={0}><Text style={{ fontWeight: '900' }}>{booking.source.city} to {booking.destination.city}</Text><Text style={{ color: colors.muted }}>{booking.journeyName} · {booking.date}</Text></Stack><StatusPill tone={booking.status === 'Selected' ? 'primary' : 'neutral'}>{booking.status}</StatusPill></Row>
                      {(transportResults[booking.id] ?? []).length ? (transportResults[booking.id] ?? []).map((option) => <TransportCard key={option.id} option={option} selected={booking.selectedOption?.id === option.id} onSelect={() => selectTransport(booking.id, option)} />) : <Text style={{ color: colors.muted }}>{transportType === 'flight' ? 'No flights found' : 'No trains found'}</Text>}
                    </Stack>
                  ))}
                  <Button variant="secondary" onPress={addReturnTransport}>Add return transport</Button>
                </Card>

                <Card>
                  <Row style={{ justifyContent: 'space-between' }}><Stack><Heading size="md">Stay</Heading><Text style={{ color: colors.muted }}>{trip.destination.city} · {trip.startDate} to {trip.endDate}</Text></Stack><Button variant="secondary" onPress={() => setFiltersOpen(true)} icon={<Filter size={16} color={colors.text} />}>Filters</Button></Row>
                  <Row wrap><Chip label="Area" /><Chip label="Price" /><Chip label="Rating" /><Chip label="Amenities" /></Row>
                  {trip.stayBookings.map((booking) => (
                    <Stack key={booking.id}>
                      <Row style={styles.segmentHeader}><Stack gap={0}><Text style={{ fontWeight: '900' }}>{booking.stayName}</Text><Text style={{ color: colors.muted }}>{booking.city.city} · {booking.checkIn} to {booking.checkOut}</Text></Stack><StatusPill tone={booking.status === 'Selected' ? 'primary' : 'neutral'}>{booking.status}</StatusPill></Row>
                      <Row wrap>{(hotelResults[booking.id] ?? []).map((hotel) => <HotelCard key={hotel.id} hotel={hotel} selected={booking.selectedHotel?.id === hotel.id} nights={daysBetween(booking.checkIn, booking.checkOut)} onSelect={() => selectHotel(booking.id, hotel)} />)}</Row>
                    </Stack>
                  ))}
                  <Button variant="secondary" onPress={addStay}>Add another stay</Button>
                </Card>
              </Stack>

              {isDesktop ? <Summary estimatedTotal={estimatedTotal} message={message} onComplete={complete} /> : null}
            </Row>
            {!isDesktop ? <Button onPress={complete}>Complete bookings</Button> : null}
          </Stack>
        </Container>
        <Footer />
      </ScrollView>

      <AppModal visible={travelerOpen} title="Add traveler" onClose={() => setTravelerOpen(false)}>
        <Input label="Name" value={travelerName} onChangeText={setTravelerName} placeholder="Traveler name" />
        <Input label="Age" value={travelerAge} onChangeText={setTravelerAge} keyboardType="numeric" placeholder="Age" />
        <Button onPress={submitTraveler}>Done</Button>
      </AppModal>
      <AppModal visible={itineraryOpen} title="Trip itinerary" onClose={() => setItineraryOpen(false)}>
        {trip.itinerary.map((day) => <Card key={day.id}><Heading size="sm">{day.restDay ? `Rest day · ${day.date}` : `Day ${day.dayNumber} · ${day.date}`}</Heading><Text style={{ color: colors.muted }}>{day.restDay ? 'No activities planned.' : day.activities.map((activity) => activity.name).join(' · ')}</Text></Card>)}
      </AppModal>
      <AppModal visible={filtersOpen} title="Hotel filters" onClose={() => setFiltersOpen(false)}>
        <Row wrap><Chip label="North Goa" /><Chip label="South Goa" /><Chip label="Under Rs 7,000" /><Chip label="4+ rating" /><Chip label="Breakfast" /></Row>
      </AppModal>
    </Screen>
  );
}

function TransportCard({ option, selected, onSelect }: { option: TransportOption; selected?: boolean; onSelect: () => void }) {
  const Icon = option.type === 'flight' ? Plane : Train;
  return <Card selected={selected}><Stack><Row style={{ justifyContent: 'space-between' }}><Stack gap={0}><Heading size="sm">{option.provider}</Heading><Text style={{ color: colors.muted }}>{option.code}</Text></Stack><StatusPill tone={selected ? 'primary' : 'neutral'}>{selected ? 'Selected' : 'Not selected'}</StatusPill></Row><Row style={{ alignItems: 'center', justifyContent: 'space-between' }}><Stack gap={0}><Text style={styles.time}>{option.departureTime}</Text><Text style={{ color: colors.muted }}>Depart</Text></Stack><Stack gap={0} style={{ alignItems: 'center' }}><Icon size={18} color={colors.primary} /><Text style={{ color: colors.muted }}>{option.duration}</Text><Text style={{ color: colors.muted }}>{option.stops}</Text></Stack><Stack gap={0} style={{ alignItems: 'flex-end' }}><Text style={styles.time}>{option.arrivalTime}</Text><Text style={{ color: colors.muted }}>Arrive</Text></Stack></Row><Row wrap style={{ justifyContent: 'space-between', alignItems: 'center' }}><Text><Text style={{ color: colors.muted }}>Per traveler </Text><Text style={{ fontWeight: '900' }}>{formatInr(option.pricePerTraveler)}</Text></Text><Button variant="secondary">View details</Button><Button onPress={onSelect}>{selected ? 'Selected' : 'Select'}</Button></Row></Stack></Card>;
}

function HotelCard({ hotel, selected, nights, onSelect }: { hotel: HotelOption; selected?: boolean; nights: number; onSelect: () => void }) {
  return <Card selected={selected} style={styles.hotelCard}><Image source={{ uri: hotel.imageUrl }} style={styles.hotelImage} /><Stack><Row style={{ justifyContent: 'space-between' }}><Stack gap={0}><Heading size="sm">{hotel.name}</Heading><Text style={{ color: colors.muted }}>{hotel.area}</Text></Stack><Row gap={spacing.xs}><Star size={15} color="#FACC15" fill="#FACC15" /><Text style={{ fontWeight: '900' }}>{hotel.rating}</Text></Row></Row><Text style={{ color: colors.muted }}>{hotel.details}</Text><Text><Text style={{ color: colors.muted }}>Per night </Text><Text style={{ fontWeight: '900' }}>{formatInr(hotel.pricePerNight)}</Text> · <Text style={{ color: colors.muted }}>Total </Text><Text style={{ fontWeight: '900' }}>{formatInr(hotel.pricePerNight * nights)}</Text></Text><Row><Button variant="secondary">View details</Button><Button onPress={onSelect}>{selected ? 'Selected hotel' : 'Select hotel'}</Button></Row></Stack></Card>;
}

function Summary({ estimatedTotal, message, onComplete }: { estimatedTotal: number; message: string; onComplete: () => void }) {
  const { trip, markBooked } = useTrip();
  return <Card style={styles.summary}><Stack><Heading size="sm">Booking summary</Heading><Row style={{ justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Travelers</Text><Text style={{ fontWeight: '900' }}>{trip.travelers.length}</Text></Row><View style={styles.rule} /><Stack gap={spacing.xs}><Text style={{ color: colors.muted }}>Selected transportation</Text>{trip.transportBookings.filter((booking) => booking.selectedOption).length ? trip.transportBookings.filter((booking) => booking.selectedOption).map((booking) => <Text key={booking.id} style={{ fontWeight: '900' }}>{booking.selectedOption?.provider} {booking.selectedOption?.code}</Text>) : <Text>Not selected</Text>}</Stack><View style={styles.rule} /><Stack gap={spacing.xs}><Text style={{ color: colors.muted }}>Hotels</Text>{trip.stayBookings.filter((booking) => booking.selectedHotel).length ? trip.stayBookings.filter((booking) => booking.selectedHotel).map((booking) => <Text key={booking.id} style={{ fontWeight: '900' }}>{booking.selectedHotel?.name}</Text>) : <Text>Not selected</Text>}</Stack><View style={styles.rule} /><Row style={{ justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.muted }}>Estimated total</Text><Heading size="sm">{formatInr(estimatedTotal)}</Heading></Row>{message ? <Text style={{ color: message.includes('failed') ? colors.danger : colors.success }}>{message}</Text> : null}<Button onPress={onComplete} icon={<CreditCard size={16} color={colors.surface} />}>Complete bookings</Button><Button variant="secondary" onPress={markBooked} icon={<ExternalLink size={16} color={colors.text} />}>I've finished booking</Button></Stack></Card>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark },
  heroTitle: { color: colors.surface },
  heroText: { color: 'rgba(255,255,255,0.72)' },
  eyebrow: { color: colors.cyan, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  contextCard: { backgroundColor: 'rgba(255,255,255,0.95)', minWidth: 240 },
  progressCard: { borderRadius: 12 },
  progressItem: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#EBF2FE', borderRadius: 8, padding: spacing.sm },
  progressNumber: { width: 28, height: 28, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  travelerCard: { flex: 1, minWidth: 280, backgroundColor: 'rgba(245,244,241,0.5)' },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EBF2FE', alignItems: 'center', justifyContent: 'center' },
  segmentHeader: { justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: 12, backgroundColor: '#EBF2FE' },
  time: { fontSize: 20, fontWeight: '900' },
  hotelCard: { flex: 1, minWidth: 300, padding: 0, overflow: 'hidden' },
  hotelImage: { width: '100%', height: 160 },
  summary: { width: 320, position: 'sticky' as never, top: 96 },
  rule: { height: 1, backgroundColor: colors.border }
});
