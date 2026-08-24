import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { createDefaultTrip } from '../data';
import { DayPlan, HotelOption, Pace, SavedTrip, TransportOption, Traveler, Trip } from '../types';

type TripContextValue = {
  trip: Trip;
  savedTrips: SavedTrip[];
  plannerInput: { source: string; destination: string };
  setPlannerInput: (input: { source: string; destination: string }) => void;
  setDraft: (input: { source: string; destination: string; startDate: string; days: number; pace: Pace; preferences: string[]; preferenceText: string; endDate?: string; itinerary?: DayPlan[] }) => void;
  selectSavedTrip: (id: string) => void;
  deleteSavedTrip: (id: string) => void;
  addTraveler: (traveler: Omit<Traveler, 'id'>) => void;
  removeTraveler: (id: string) => void;
  updateOrganizerEmail: (email: string) => void;
  selectTransport: (bookingId: string, option: TransportOption) => void;
  addReturnTransport: () => void;
  selectHotel: (bookingId: string, hotel: HotelOption) => void;
  addStay: () => void;
  markBooked: () => void;
};

const TripContext = createContext<TripContextValue | null>(null);
const SAVED_TRIPS_KEY = 'tripbuddy.savedTrips.v1';

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState(createDefaultTrip);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(loadSavedTrips);
  const [currentTripId, setCurrentTripId] = useState('');
  const [plannerInput, setPlannerInput] = useState({ source: '', destination: '' });

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
    plannerInput,
    setPlannerInput,
    setDraft: (input) => {
      if (input.itinerary?.length) setCurrentTripId(createSavedTripId());
      setTrip((current) => createDraftTrip(current, input));
    },
    selectSavedTrip: (id) => {
      const savedTrip = savedTrips.find((item) => item.id === id);
      if (!savedTrip) return;
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...nextTrip } = savedTrip;
      setCurrentTripId(id);
      setTrip(nextTrip);
    },
    deleteSavedTrip: (id) => {
      if (currentTripId === id) setCurrentTripId('');
      setSavedTrips((current) => current.filter((item) => item.id !== id));
    },
    addTraveler: (traveler) => setTrip((current) => ({ ...current, travelers: [...current.travelers, { ...traveler, id: `traveler-${Date.now()}` }] })),
    removeTraveler: (id) => setTrip((current) => ({ ...current, travelers: current.travelers.filter((traveler) => traveler.id !== id || traveler.role === 'organizer') })),
    updateOrganizerEmail: (email) => setTrip((current) => ({ ...current, travelers: current.travelers.map((traveler) => traveler.role === 'organizer' ? { ...traveler, email } : traveler) })),
    selectTransport: (bookingId, option) => setTrip((current) => ({ ...current, transportBookings: current.transportBookings.map((booking) => booking.id === bookingId ? { ...booking, selectedOption: option, type: option.type, status: 'Selected' } : booking) })),
    addReturnTransport: () => setTrip((current) => ({ ...current, transportBookings: [...current.transportBookings, { id: `transport-${Date.now()}`, journeyName: 'Return transport', source: current.destination, destination: current.source, date: current.endDate, type: 'flight', status: 'Not selected' }] })),
    selectHotel: (bookingId, hotel) => setTrip((current) => ({ ...current, stayBookings: current.stayBookings.map((booking) => booking.id === bookingId ? { ...booking, selectedHotel: hotel, area: hotel.area, status: 'Selected' } : booking) })),
    addStay: () => setTrip((current) => ({ ...current, stayBookings: [...current.stayBookings, { id: `stay-${Date.now()}`, stayName: `Stay ${current.stayBookings.length + 1}`, city: current.destination, area: current.destination.city, checkIn: current.startDate, checkOut: current.endDate, rooms: 1, status: 'Not selected' }] })),
    markBooked: () => setTrip((current) => ({ ...current, transportBookings: current.transportBookings.map((booking) => booking.selectedOption ? { ...booking, status: 'Booked' } : booking), stayBookings: current.stayBookings.map((booking) => booking.selectedHotel ? { ...booking, status: 'Booked' } : booking) }))
  }), [trip, savedTrips, plannerInput, currentTripId]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error('useTrip must be used inside TripProvider');
  return value;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function createDraftTrip(current: Trip, input: { source: string; destination: string; startDate: string; days: number; pace: Pace; preferences: string[]; preferenceText: string; endDate?: string; itinerary?: DayPlan[] }): Trip {
  const source = toLocation(input.source);
  const destination = toLocation(input.destination);
  const endDate = input.endDate ?? addDays(input.startDate, input.days - 1);
  const transportBookings = current.transportBookings.length
    ? current.transportBookings.map((booking) => ({ ...booking, source, destination, date: input.startDate }))
    : [{ id: 'transport-1', journeyName: 'Journey 1', source, destination, date: input.startDate, type: 'flight' as const, status: 'Not selected' as const }];
  const stayBookings = current.stayBookings.length
    ? current.stayBookings.map((booking) => ({ ...booking, city: destination, checkIn: input.startDate, checkOut: endDate }))
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
