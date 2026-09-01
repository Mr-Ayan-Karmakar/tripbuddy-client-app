import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { createDefaultTrip } from '../data';
import { Account, AuthSession, bookHotel, bookTransport, claimRecoveredTrip, completePasswordReset, createServerTrip, deleteAccount, deleteServerTrip, getCurrentAuth, linkServerBooking, listServerTrips, login, logout, register, sendOtp, startPasswordReset, startTripRecovery, updateServerTrip, verifyPasswordReset, verifyTripRecovery } from '../services/api';
import { DayPlan, HotelOption, Pace, SavedTrip, TransportOption, Traveler, Trip } from '../types';

type TripContextValue = {
  trip: Trip;
  savedTrips: SavedTrip[];
  account: Account | null;
  session: AuthSession | null;
  plannerInput: PlannerInput;
  setPlannerInput: (input: PlannerInput) => void;
  setDraft: (input: DraftTripInput) => void;
  selectSavedTrip: (id: string) => void;
  deleteSavedTrip: (id: string) => Promise<void>;
  addTraveler: (traveler: Omit<Traveler, 'id'>) => void;
  removeTraveler: (id: string) => void;
  updateOrganizerEmail: (email: string) => void;
  selectTransport: (bookingId: string, option: TransportOption, travelDate?: string) => Promise<void>;
  addReturnTransport: () => void;
  selectHotel: (bookingId: string, hotel: HotelOption, stayDates?: { checkIn?: string; checkOut?: string }) => Promise<void>;
  addStay: () => void;
  markBooked: () => Promise<void>;
  refreshRemoteTrips: () => Promise<void>;
  sendSignupOtp: (email: string) => Promise<void>;
  registerAccount: (input: { email: string; password: string; otp: string }) => Promise<void>;
  loginAccount: (input: { email: string; password: string }) => Promise<void>;
  logoutAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  startForgotPassword: (email: string) => Promise<void>;
  verifyForgotPassword: (input: { email: string; otp: string }) => Promise<{ resetToken: string; expiresIn: number }>;
  resetPassword: (input: { resetToken: string; newPassword: string }) => Promise<void>;
  startRecoverTrip: (input: { tripCode: string; organizerEmail: string }) => Promise<void>;
  verifyAndClaimTrip: (input: { tripCode: string; organizerEmail: string; otp: string }) => Promise<void>;
};

const TripContext = createContext<TripContextValue | null>(null);
const SAVED_TRIPS_KEY = 'tripbuddy.savedTrips.v1';
type PlannerInput = { source: string; destination: string; startDate?: string; days?: number; pace?: Pace; tripVibe?: string; preserveBookings?: boolean };
type DraftTripInput = { source: string; destination: string; startDate: string; days: number; pace: Pace; preferences: string[]; preferenceText: string; endDate?: string; itinerary?: DayPlan[]; preserveBookings?: boolean };

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState(createDefaultTrip);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(loadSavedTrips);
  const [currentTripId, setCurrentTripId] = useState('');
  const [plannerInput, setPlannerInput] = useState<PlannerInput>({ source: '', destination: '' });
  const [account, setAccount] = useState<Account | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    void hydrateAuthAndTrips();
  }, []);

  useEffect(() => {
    saveTripsToStorage(savedTrips);
  }, [savedTrips]);

  useEffect(() => {
    if (!currentTripId || !trip.itinerary.length) return;
    const now = new Date().toISOString();
    setSavedTrips((current) => {
      const existing = current.find((item) => item.id === currentTripId);
      const savedTrip: SavedTrip = {
        ...trip,
        id: currentTripId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      const next = [savedTrip, ...current.filter((item) => item.id !== currentTripId)];
      return next;
    });
  }, [currentTripId, trip]);

  const value = useMemo<TripContextValue>(() => ({
    trip,
    savedTrips,
    account,
    session,
    plannerInput,
    setPlannerInput,
    setDraft: (input) => {
      if (input.itinerary?.length && !currentTripId) setCurrentTripId(createSavedTripId());
      setTrip((current) => {
        const next = createDraftTrip(current, input);
        void persistTripIfRecoverable(next);
        return next;
      });
    },
    selectSavedTrip: (id) => {
      const savedTrip = savedTrips.find((item) => item.id === id);
      if (!savedTrip) return;
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...nextTrip } = savedTrip;
      setCurrentTripId(id);
      setTrip(nextTrip);
    },
    deleteSavedTrip: async (id) => {
      const savedTrip = savedTrips.find((item) => item.id === id || item.serverTripId === id || item.tripCode === id);
      if (savedTrip) {
        await deleteServerTrip(savedTrip);
      }
      if (currentTripId === id || currentTripId === savedTrip?.id || currentTripId === savedTrip?.serverTripId || currentTripId === savedTrip?.tripCode) setCurrentTripId('');
      setSavedTrips((current) => current.filter((item) => item.id !== id && item.serverTripId !== id && item.tripCode !== id && item.id !== savedTrip?.id && item.serverTripId !== savedTrip?.serverTripId && item.tripCode !== savedTrip?.tripCode));
    },
    addTraveler: (traveler) => setTrip((current) => ({ ...current, travelers: [...current.travelers, { ...traveler, id: `traveler-${Date.now()}` }] })),
    removeTraveler: (id) => setTrip((current) => ({ ...current, travelers: current.travelers.filter((traveler) => traveler.id !== id || traveler.role === 'organizer') })),
    updateOrganizerEmail: (email) => setTrip((current) => ({ ...current, travelers: current.travelers.map((traveler) => traveler.role === 'organizer' ? { ...traveler, email } : traveler) })),
    selectTransport: async (bookingId, option, travelDate) => {
      const nextTrip = withTransportSelection(trip, bookingId, option, travelDate);
      setTrip({ ...nextTrip, syncStatus: 'syncing' });
      try {
        const saved = await persistTrip(nextTrip);
        const selectedBooking = saved.transportBookings.find((booking) => booking.id === bookingId) ?? nextTrip.transportBookings.find((booking) => booking.id === bookingId);
        if (!selectedBooking?.selectedOption) return;
        const travelers = nextTrip.travelers.filter((traveler) => traveler.role !== 'organizer').map(({ fullName, age }) => ({ fullName, age }));
        const adults = travelers.filter((traveler) => traveler.age >= 18).length;
        const children = travelers.filter((traveler) => traveler.age < 18).length;
        const bookingResult = await bookTransport({ booking: selectedBooking, travelers, adults, children });
        const linked = await linkServerBooking({ ...nextTrip, serverTripId: saved.serverTripId, tripCode: saved.tripCode }, { bookingType: 'TRANSPORT', externalBookingId: bookingResult.bookingId, status: bookingResult.status, response: bookingResult });
        const finalTrip = savedTripToTrip(linked);
        setCurrentTripId(linked.id);
        setTrip(finalTrip);
        upsertSavedTrip(linked);
      } catch (error) {
        setTrip({ ...nextTrip, syncStatus: 'failed', syncError: error instanceof Error ? error.message : 'Unable to book transport.' });
      }
    },
    addReturnTransport: () => setTrip((current) => ({ ...current, transportBookings: [...current.transportBookings, { id: `transport-${Date.now()}`, journeyName: 'Return transport', source: current.destination, destination: current.source, date: current.endDate, type: 'flight', status: 'Not selected' }] })),
    selectHotel: async (bookingId, hotel, stayDates) => {
      const nextTrip = withHotelSelection(trip, bookingId, hotel, stayDates);
      setTrip({ ...nextTrip, syncStatus: 'syncing' });
      try {
        const saved = await persistTrip(nextTrip);
        const selectedBooking = saved.stayBookings.find((booking) => booking.id === bookingId) ?? nextTrip.stayBookings.find((booking) => booking.id === bookingId);
        if (!selectedBooking?.selectedHotel) return;
        const travelers = nextTrip.travelers.filter((traveler) => traveler.role !== 'organizer').map(({ fullName, age }) => ({ fullName, age }));
        const adults = travelers.filter((traveler) => traveler.age >= 18).length;
        const children = travelers.filter((traveler) => traveler.age < 18).length;
        const bookingResult = await bookHotel({ booking: selectedBooking, travelers, adults, children });
        const linked = await linkServerBooking({ ...nextTrip, serverTripId: saved.serverTripId, tripCode: saved.tripCode }, { bookingType: 'HOTEL', externalBookingId: bookingResult.bookingId, status: bookingResult.status, response: bookingResult });
        const finalTrip = savedTripToTrip(linked);
        setCurrentTripId(linked.id);
        setTrip(finalTrip);
        upsertSavedTrip(linked);
      } catch (error) {
        setTrip({ ...nextTrip, syncStatus: 'failed', syncError: error instanceof Error ? error.message : 'Unable to book hotel.' });
      }
    },
    addStay: () => setTrip((current) => ({ ...current, stayBookings: [...current.stayBookings, { id: `stay-${Date.now()}`, stayName: `Stay ${current.stayBookings.length + 1}`, city: current.destination, area: current.destination.city, checkIn: current.startDate, checkOut: current.endDate, rooms: 1, status: 'Not selected' }] })),
    markBooked: async () => {
      const nextTrip = {
        ...trip,
        transportBookings: trip.transportBookings.map((booking) => booking.selectedOption ? { ...booking, status: 'Booked' as const } : booking),
        stayBookings: trip.stayBookings.map((booking) => booking.selectedHotel ? { ...booking, status: 'Booked' as const } : booking)
      };
      setTrip(nextTrip);
      await persistTripIfRecoverable(nextTrip);
    },
    refreshRemoteTrips: hydrateAuthAndTrips,
    sendSignupOtp: (email) => sendOtp({ email, purpose: 'signup' }),
    registerAccount: async (input) => {
      const result = await register(input);
      setSession(result.session);
      setAccount(result.account);
      await hydrateRemoteTripsOnly();
    },
    loginAccount: async (input) => {
      const result = await login(input);
      setSession(result.session);
      setAccount(result.account);
      await hydrateRemoteTripsOnly();
    },
    logoutAccount: async () => {
      await logout();
      setSession(null);
      setAccount(null);
    },
    deleteAccount: async () => {
      await deleteAccount();
      setSession(null);
      setAccount(null);
      setSavedTrips([]);
      setCurrentTripId('');
    },
    startForgotPassword: startPasswordReset,
    verifyForgotPassword: verifyPasswordReset,
    resetPassword: async (input) => {
      await completePasswordReset(input);
    },
    startRecoverTrip: startTripRecovery,
    verifyAndClaimTrip: async (input) => {
      const verified = await verifyTripRecovery(input);
      const recovered = await claimRecoveredTrip({ tripCode: input.tripCode, recoveryToken: verified.recoveryToken });
      setCurrentTripId(recovered.id);
      setTrip(savedTripToTrip(recovered));
      upsertSavedTrip(recovered);
    }
  }), [trip, savedTrips, account, session, plannerInput, currentTripId]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;

  async function hydrateAuthAndTrips() {
    try {
      const auth = await getCurrentAuth();
      setSession(auth.session);
      setAccount(auth.account);
      await hydrateRemoteTripsOnly();
    } catch {
      // The API may be offline during local UI work; local saved trips still work.
    }
  }

  async function hydrateRemoteTripsOnly() {
    try {
      const remoteTrips = await listServerTrips();
      if (remoteTrips.length) {
        setSavedTrips((current) => mergeSavedTrips(remoteTrips, current));
      }
    } catch {
      // Local cache remains available if Trip Service is not running.
    }
  }

  async function persistTripIfRecoverable(nextTrip: Trip) {
    if (!organizerEmail(nextTrip)) return;
    try {
      await persistTrip(nextTrip);
    } catch {
      // Keep local state usable when backend persistence is unavailable.
    }
  }

  async function persistTrip(nextTrip: Trip): Promise<SavedTrip> {
    const saved = nextTrip.serverTripId || nextTrip.tripCode ? await updateServerTrip(nextTrip) : await createServerTrip(nextTrip);
    setCurrentTripId(saved.id);
    setTrip((current) => ({ ...current, serverTripId: saved.serverTripId, tripCode: saved.tripCode, syncStatus: 'synced', syncError: undefined }));
    upsertSavedTrip(saved);
    return saved;
  }

  function upsertSavedTrip(saved: SavedTrip) {
    setSavedTrips((current) => [saved, ...current.filter((item) => item.id !== saved.id && item.serverTripId !== saved.serverTripId)]);
  }
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error('useTrip must be used inside TripProvider');
  return value;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return toLocalIsoDate(value);
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDraftTrip(current: Trip, input: DraftTripInput): Trip {
  const source = toLocation(input.source);
  const destination = toLocation(input.destination);
  const endDate = input.endDate ?? addDays(input.startDate, input.days - 1);
  const resetTransportBooking = (booking: Trip['transportBookings'][number]) => ({
    id: booking.id,
    journeyName: booking.journeyName,
    source,
    destination,
    date: input.startDate,
    type: booking.type,
    status: 'Not selected' as const
  });
  const resetStayBooking = (booking: Trip['stayBookings'][number]) => ({
    id: booking.id,
    stayName: booking.stayName,
    city: destination,
    area: destination.city,
    checkIn: input.startDate,
    checkOut: endDate,
    rooms: booking.rooms,
    status: 'Not selected' as const
  });
  const transportBookings = current.transportBookings.length
    ? current.transportBookings.map((booking) => input.preserveBookings ? { ...booking, source, destination, date: input.startDate } : resetTransportBooking(booking))
    : [{ id: 'transport-1', journeyName: 'Journey 1', source, destination, date: input.startDate, type: 'flight' as const, status: 'Not selected' as const }];
  const stayBookings = current.stayBookings.length
    ? current.stayBookings.map((booking) => input.preserveBookings ? { ...booking, city: destination, checkIn: input.startDate, checkOut: endDate } : resetStayBooking(booking))
    : [{ id: 'stay-1', stayName: 'Stay 1', city: destination, area: destination.city, checkIn: input.startDate, checkOut: endDate, rooms: 1, status: 'Not selected' as const }];

  return {
    ...current,
    source,
    destination,
    startDate: input.startDate,
    days: input.days,
    pace: input.pace,
    tripVibe: input.preferenceText.trim(),
    preferences: input.preferences,
    itinerary: input.itinerary ?? current.itinerary,
    endDate,
    transportBookings,
    stayBookings
  };
}

function toLocation(value: string) {
  return { id: value.toLowerCase(), name: value, city: value.split(',')[0] ?? value };
}

function createSavedTripId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSavedTrips(): SavedTrip[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedTrip);
  } catch {
    return [];
  }
}

function saveTripsToStorage(trips: SavedTrip[]) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
}

function isSavedTrip(value: unknown): value is SavedTrip {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedTrip>;
  return typeof candidate.id === 'string' && typeof candidate.destination?.city === 'string' && Array.isArray(candidate.itinerary);
}

function organizerEmail(trip: Trip) {
  return trip.travelers.find((traveler) => traveler.role === 'organizer')?.email?.trim() ?? '';
}

function withTransportSelection(trip: Trip, bookingId: string, option: TransportOption, travelDate?: string): Trip {
  return {
    ...trip,
    syncError: undefined,
    transportBookings: trip.transportBookings.map((booking) => booking.id === bookingId ? { ...booking, date: travelDate ?? booking.date, selectedOption: option, type: option.type, status: 'Booking' } : booking)
  };
}

function withHotelSelection(trip: Trip, bookingId: string, hotel: HotelOption, stayDates?: { checkIn?: string; checkOut?: string }): Trip {
  return {
    ...trip,
    syncError: undefined,
    stayBookings: trip.stayBookings.map((booking) => booking.id === bookingId ? { ...booking, checkIn: stayDates?.checkIn ?? booking.checkIn, checkOut: stayDates?.checkOut ?? booking.checkOut, selectedHotel: hotel, area: hotel.area, status: 'Booking' } : booking)
  };
}

function savedTripToTrip(savedTrip: SavedTrip): Trip {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...trip } = savedTrip;
  return trip;
}

function mergeSavedTrips(primary: SavedTrip[], fallback: SavedTrip[]) {
  const seen = new Set<string>();
  const merged: SavedTrip[] = [];
  for (const trip of [...primary, ...fallback]) {
    const key = trip.serverTripId ?? trip.tripCode ?? trip.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trip);
  }
  return merged;
}
