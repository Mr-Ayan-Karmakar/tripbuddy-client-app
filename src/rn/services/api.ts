import { Platform } from 'react-native';
import { Activity, DayPlan, HotelOption, Pace, SavedTrip, TransportBooking, TransportOption, TransportType, Traveler, Trip, StayBooking } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  session?: AuthSession;
};

export type AuthSession = {
  id: string;
  type: 'GUEST' | 'ACCOUNT';
  accountId: string | null;
  expiresAt?: number;
};

export type Account = {
  id: string;
  email: string;
};

type Envelope<T> = {
  success: boolean;
  data: T;
};

type ErrorEnvelope = {
  success?: boolean;
  error?: string | {
    code?: string;
    message?: string;
  };
  message?: string;
};

type AvailabilityDto = {
  provider: string;
  type: 'flight' | 'train' | 'hotel';
  available: boolean;
  seatsOrRooms: number;
  price: number;
  currency: 'INR';
  details: string;
  externalId?: string;
  rating?: number;
  hotelDetails?: {
    photoUrls?: string[];
    reviewCount?: number;
    reviewScore?: number;
    reviewScoreWord?: string;
  };
  flightDetails?: Array<{
    airline?: string;
    flightNumber?: string;
    from?: string;
    to?: string;
    departureTime?: string;
    arrivalTime?: string;
    durationMinutes?: number;
  }>;
  trainDetails?: {
    trainNumber?: string;
    trainName?: string;
    fromStationCode?: string;
    toStationCode?: string;
    departureTime?: string;
    arrivalTime?: string;
    duration?: string;
    availabilityStatus?: string;
  };
  totalDurationMinutes?: number;
  stops?: number;
  source?: string;
};

type GenerateItineraryInput = {
  startDate: string;
  source: string;
  destination: string;
  days: number;
  activeDates: string[];
  tripVibe?: string;
  prompt: string;
  budget?: 'low' | 'medium' | 'high';
  pace: Pace;
};

type ItineraryStreamOutput = {
  itinerary?: {
    days?: ApiItineraryDay[];
    summary?: string;
  };
  days?: ApiItineraryDay[];
  summary?: string;
};

type ApiItineraryDay = {
  day?: number;
  dayNumber?: number;
  date?: string;
  theme?: string;
  title?: string;
  restDay?: boolean;
  activities?: ApiItineraryActivity[];
};

type ApiItineraryActivity = {
  time?: string;
  place?: string;
  name?: string;
  city?: string;
  location?: string;
  area?: string;
  durationHours?: number;
  duration?: string;
  notes?: string;
  description?: string;
  rating?: number;
  photoUrls?: string[];
  bestTimeOfDay?: string;
  restaurants?: ApiRestaurant[];
  reviews?: ApiPlaceReview[];
  travelFromPrevious?: {
    durationText?: string;
    distanceText?: string;
    recommendation?: string;
  };
};

type ApiRestaurant = {
  name?: string;
  address?: string;
  rating?: number;
  priceLevel?: number;
  distanceMeters?: number;
};

type ApiPlaceReview = {
  authorName?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: string;
};

let tokens: Tokens | undefined;
let tokenPromise: Promise<string> | undefined;
const AUTH_STORAGE_KEY = 'tripbuddy.auth.v1';

export async function getAccessToken(forceRefresh = false) {
  tokens ??= loadTokens();
  if (!forceRefresh && tokens?.accessToken) return tokens.accessToken;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (forceRefresh && tokens?.refreshToken ? refreshSession(tokens.refreshToken) : createGuestSession())
    .then((nextTokens) => {
      setTokens(nextTokens);
      return nextTokens.accessToken;
    })
    .finally(() => {
      tokenPromise = undefined;
    });
  return tokenPromise;
}

async function post<TResponse, TBody>(path: string, body: TBody, retryOnExpiredToken = true): Promise<TResponse> {
  const response = await authorizedFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = payloadError(payload) ?? response.statusText;
    if (retryOnExpiredToken && isAccessTokenExpired(response, payload)) {
      await getAccessToken(true);
      return post<TResponse, TBody>(path, body, false);
    }
    throw new Error(message);
  }
  return payload as TResponse;
}

async function patch<TResponse, TBody>(path: string, body: TBody, retryOnExpiredToken = true): Promise<TResponse> {
  const response = await authorizedFetch(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = payloadError(payload) ?? response.statusText;
    if (retryOnExpiredToken && isAccessTokenExpired(response, payload)) {
      await getAccessToken(true);
      return patch<TResponse, TBody>(path, body, false);
    }
    throw new Error(message);
  }
  return payload as TResponse;
}

async function get<TResponse>(path: string, retryOnExpiredToken = true): Promise<TResponse> {
  const response = await authorizedFetch(path, { method: 'GET' });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = payloadError(payload) ?? response.statusText;
    if (retryOnExpiredToken && isAccessTokenExpired(response, payload)) {
      await getAccessToken(true);
      return get<TResponse>(path, false);
    }
    throw new Error(message);
  }
  return payload as TResponse;
}

async function deleteRequest(path: string, retryOnExpiredToken = true): Promise<void> {
  const response = await authorizedFetch(path, { method: 'DELETE' });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = payloadError(payload) ?? response.statusText;
    if (retryOnExpiredToken && isAccessTokenExpired(response, payload)) {
      await getAccessToken(true);
      return deleteRequest(path, false);
    }
    throw new Error(message);
  }
}

async function authorizedFetch(path: string, init: RequestInit) {
  const token = await getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
}

function payloadError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as ErrorEnvelope;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.error?.message === 'string') return record.error.message;
  return record.message;
}

function payloadErrorCode(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as ErrorEnvelope;
  return typeof record.error === 'object' ? record.error.code : undefined;
}

function isAccessTokenExpired(response: Response, payload: unknown) {
  return response.status === 401 && payloadErrorCode(payload) === 'ACCESS_TOKEN_EXPIRED';
}

async function createGuestSession(): Promise<Tokens> {
  const response = await fetch(`${API_BASE_URL}/auth/api/guest`, { method: 'POST' });
  if (!response.ok) throw new Error('Unable to create guest session.');
  const body = (await response.json()) as Envelope<Tokens>;
  return body.data;
}

async function refreshSession(refreshToken: string): Promise<Tokens> {
  const response = await fetch(`${API_BASE_URL}/auth/api/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) return createGuestSession();
  const body = (await response.json()) as Envelope<Tokens>;
  return body.data;
}

function setTokens(nextTokens: Tokens | undefined) {
  tokens = nextTokens;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (nextTokens) window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextTokens));
    else window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing or embedded webviews.
  }
}

function loadTokens(): Tokens | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Tokens : undefined;
  } catch {
    return undefined;
  }
}

export async function getCurrentAuth(): Promise<{ session: AuthSession; account: Account | null }> {
  const result = await get<Envelope<{ session: AuthSession; account: Account | null }>>('/auth/api/me');
  return result.data;
}

export async function sendOtp(input: { email: string; purpose: 'signup' | 'login' | 'trip_recovery' | 'password_reset' }) {
  await publicPost('/auth/api/otp/send', input);
}

export async function register(input: { email: string; password: string; otp: string }): Promise<{ session: AuthSession; account: Account }> {
  await getAccessToken();
  const result = await post<Envelope<Tokens & { account: Account }>, typeof input>('/auth/api/register', input);
  setTokens(result.data);
  return { session: result.data.session!, account: result.data.account };
}

export async function login(input: { email: string; password: string }): Promise<{ session: AuthSession; account: Account }> {
  const result = await publicPost<Envelope<Tokens & { account: Account }>, typeof input>('/auth/api/login', input);
  setTokens(result.data);
  return { session: result.data.session!, account: result.data.account };
}

export async function logout() {
  try {
    await authorizedFetch('/auth/api/logout', { method: 'POST' });
  } finally {
    setTokens(undefined);
  }
}

export async function deleteAccount() {
  try {
    await deleteRequest('/auth/api/account');
  } finally {
    setTokens(undefined);
  }
}

export async function startPasswordReset(email: string) {
  await publicPost('/auth/api/password-reset/start', { email });
}

export async function verifyPasswordReset(input: { email: string; otp: string }): Promise<{ resetToken: string; expiresIn: number }> {
  const result = await publicPost<Envelope<{ resetToken: string; expiresIn: number }>, typeof input>('/auth/api/password-reset/verify', input);
  return result.data;
}

export async function completePasswordReset(input: { resetToken: string; newPassword: string }) {
  await publicPost('/auth/api/password-reset/complete', input);
}

async function publicPost<TResponse = unknown, TBody = unknown>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new Error(payloadError(payload) ?? response.statusText);
  return payload as TResponse;
}

export async function generateItinerary(input: GenerateItineraryInput): Promise<DayPlan[]> {
  return generateItineraryWithToken(input, true);
}

async function generateItineraryWithToken(input: GenerateItineraryInput, retryOnExpiredToken: boolean): Promise<DayPlan[]> {
  const token = await getAccessToken(!retryOnExpiredToken);
  const response = await fetch(`${API_BASE_URL}/itinerary/api/stream`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'text/event-stream'
    },
    body: JSON.stringify({
      startDate: input.startDate,
      source: input.source,
      destination: input.destination,
      days: input.days,
      activeDates: input.activeDates,
      ...(input.tripVibe ? { tripVibe: input.tripVibe } : {}),
      prompt: input.prompt,
      budget: input.budget ?? 'medium',
      pace: input.pace === 'fast' ? 'packed' : input.pace
    })
  });

  if (!response.ok) {
    const text = await response.text();
    const message = errorMessageFromText(text) ?? response.statusText;
    if (retryOnExpiredToken && response.status === 401 && errorCodeFromText(text) === 'ACCESS_TOKEN_EXPIRED') {
      await getAccessToken(true);
      return generateItineraryWithToken(input, false);
    }
    throw new Error(message);
  }

  const output = await readItineraryStream(response);
  const days = output.itinerary?.days ?? output.days ?? [];
  if (!days.length) throw new Error('No itinerary days were returned.');
  return days.map(mapItineraryDay);
}

async function readItineraryStream(response: Response): Promise<ItineraryStreamOutput> {
  const reader = response.body?.getReader();
  if (!reader) {
    return parseSseText(await response.text());
  }

  const decoder = new TextDecoder();
  let sseBuffer = '';
  let tokenBuffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const parts = sseBuffer.split('\n\n');
    sseBuffer = parts.pop() ?? '';
    for (const part of parts) {
      const event = parseSseEvent(part);
      if (event.name === 'token' && typeof event.data === 'string') tokenBuffer += event.data;
      if (event.name === 'error') throw new Error(typeof event.data?.message === 'string' ? event.data.message : 'Itinerary generation failed.');
    }
  }

  if (sseBuffer.trim()) {
    const event = parseSseEvent(sseBuffer);
    if (event.name === 'token' && typeof event.data === 'string') tokenBuffer += event.data;
  }

  return parseTokenBuffer(tokenBuffer);
}

function parseSseText(value: string): ItineraryStreamOutput {
  let tokenBuffer = '';
  for (const part of value.split('\n\n')) {
    if (!part.trim()) continue;
    const event = parseSseEvent(part);
    if (event.name === 'token' && typeof event.data === 'string') tokenBuffer += event.data;
    if (event.name === 'error') throw new Error(typeof event.data?.message === 'string' ? event.data.message : 'Itinerary generation failed.');
  }
  return parseTokenBuffer(tokenBuffer);
}

function parseSseEvent(chunk: string) {
  const eventLine = chunk.split('\n').find((line) => line.startsWith('event:'));
  const dataLines = chunk.split('\n').filter((line) => line.startsWith('data:'));
  const rawData = dataLines.map((line) => line.slice(5).trimStart()).join('\n');
  return {
    name: eventLine?.slice(6).trim(),
    data: rawData ? JSON.parse(rawData) : undefined
  };
}

function parseTokenBuffer(value: string): ItineraryStreamOutput {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('No itinerary content was returned.');
  return JSON.parse(trimmed) as ItineraryStreamOutput;
}

function mapItineraryDay(day: ApiItineraryDay, index: number): DayPlan {
  const dayNumber = day.dayNumber ?? day.day ?? index + 1;
  return {
    id: `day-${dayNumber}`,
    dayNumber,
    date: day.date ?? '',
    title: day.title ?? day.theme ?? `Day ${dayNumber}`,
    restDay: day.restDay === true,
    activities: (day.activities ?? []).map((activity, activityIndex) => mapItineraryActivity(activity, dayNumber, activityIndex))
  };
}

function mapItineraryActivity(activity: ApiItineraryActivity, dayNumber: number, index: number): Activity {
  const durationHours = typeof activity.durationHours === 'number' ? activity.durationHours : undefined;
  const duration = activity.duration ?? (durationHours ? `${durationHours} hr${durationHours === 1 ? '' : 's'}` : '1.5 hrs');
  const startTime = normalizeTime(activity.time);
  return {
    id: `day-${dayNumber}-activity-${index + 1}`,
    name: activity.place ?? activity.name ?? 'Suggested activity',
    area: activity.location ?? activity.area ?? activity.city ?? 'Nearby',
    rating: typeof activity.rating === 'number' ? activity.rating : 4.5,
    startTime,
    endTime: addHoursToTime(startTime, durationHours ?? 1.5),
    duration,
    description: activity.notes ?? activity.description ?? '',
    imageUrl: activity.photoUrls?.[0],
    category: activity.city,
    bestTimeOfDay: activity.bestTimeOfDay,
    reviews: (activity.reviews ?? []).map((review) => ({
      authorName: review.authorName,
      rating: review.rating,
      relativePublishTimeDescription: review.relativePublishTimeDescription,
      text: review.text
    })),
    restaurants: (activity.restaurants ?? []).map((restaurant, restaurantIndex) => ({
      id: `day-${dayNumber}-activity-${index + 1}-restaurant-${restaurantIndex + 1}`,
      name: restaurant.name ?? 'Nearby restaurant',
      address: restaurant.address,
      rating: restaurant.rating,
      priceLevel: restaurant.priceLevel,
      distanceMeters: restaurant.distanceMeters
    })),
    travelFromPrevious: activity.travelFromPrevious?.durationText ?? activity.travelFromPrevious?.distanceText
  };
}

function normalizeTime(value?: string) {
  if (!value || value.toLowerCase() === 'full day') return value ?? '09:00';
  const match = value.match(/\b(\d{1,2}):(\d{2})\b/);
  return match ? `${match[1]!.padStart(2, '0')}:${match[2]}` : value;
}

function addHoursToTime(value: string, hours: number) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  date.setMinutes(date.getMinutes() + Math.round(hours * 60));
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function errorMessageFromText(value: string) {
  if (!value.trim()) return undefined;
  try {
    return payloadError(JSON.parse(value));
  } catch {
    return value;
  }
}

function errorCodeFromText(value: string) {
  if (!value.trim()) return undefined;
  try {
    return payloadErrorCode(JSON.parse(value));
  } catch {
    return undefined;
  }
}

export async function searchTransport(input: { source: string; destination: string; date: string; adults: number; children: number; type: TransportType }): Promise<TransportOption[]> {
  const result = await post<{ options: AvailabilityDto[] }, typeof input>('/booking/api/transport/availability', input);
  return result.options.filter((option) => option.available).map((option, index) => {
    const firstFlight = option.flightDetails?.[0];
    const lastFlight = option.flightDetails?.at(-1);
    const train = option.trainDetails;
    const duration = train?.duration ?? formatDurationMinutes(option.totalDurationMinutes ?? firstFlight?.durationMinutes);
    const transportNumber = train?.trainNumber ?? firstFlight?.flightNumber ?? option.externalId;
    const transportName = train?.trainName ?? firstFlight?.airline ?? option.provider;
    return {
      id: option.externalId ?? `${option.provider}-${index}`,
      provider: option.provider,
      code: transportNumber ?? `${input.type.toUpperCase()}-${index + 1}`,
      type: input.type,
      departureTime: train?.departureTime ?? firstFlight?.departureTime ?? 'TBD',
      arrivalTime: train?.arrivalTime ?? lastFlight?.arrivalTime ?? 'TBD',
      duration: duration ?? 'Provider timed',
      stops: typeof option.stops === 'number' ? `${option.stops} stop${option.stops === 1 ? '' : 's'}` : input.type === 'train' ? (train?.availabilityStatus ?? 'Available') : 'Available',
      pricePerTraveler: option.price,
      seatsAvailable: option.seatsOrRooms,
      fromCode: train?.fromStationCode ?? firstFlight?.from ?? input.source,
      toCode: train?.toStationCode ?? lastFlight?.to ?? input.destination,
      transportName,
      transportNumber,
      details: option.details
    };
  });
}

function formatDurationMinutes(value?: number) {
  if (!Number.isFinite(value)) return undefined;
  const minutes = Number(value);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  return `${hours}h ${remainingMinutes}m`;
}

export async function searchHotels(input: { city: string; checkIn: string; checkOut: string; adults: number; children: number; rooms: number }): Promise<HotelOption[]> {
  const result = await post<{ options: AvailabilityDto[] }, typeof input>('/booking/api/hotel/availability', input);
  return result.options.filter((option) => option.available).map((option, index) => ({
    id: option.externalId ?? `${option.provider}-${index}`,
    name: option.provider,
    area: option.source ?? input.city,
    rating: option.rating ?? option.hotelDetails?.reviewScore ?? 0,
    reviewCount: option.hotelDetails?.reviewCount,
    reviewLabel: option.hotelDetails?.reviewScoreWord,
    pricePerNight: option.price,
    details: option.details,
    amenities: ['Provider availability', `${option.seatsOrRooms} room${option.seatsOrRooms === 1 ? '' : 's'}`],
    imageUrl: option.hotelDetails?.photoUrls?.[0]
  }));
}

export type BookingResult = {
  status: 'action_required' | 'confirmed';
  bookingId: string;
  message: string;
  requiredActions?: string[];
  ticket?: { fileName: string; mimeType: string; content: string };
};

export async function bookTransport(input: { booking: TransportBooking; travelers: Array<{ fullName: string; age: number }>; adults: number; children: number }): Promise<BookingResult> {
  if (!input.booking.selectedOption) throw new Error('Choose a transport option first.');
  const selection = input.booking.selectedOption;
  return post<BookingResult, unknown>('/booking/api/transport/book', {
    selection: {
      provider: selection.provider,
      type: selection.type,
      available: true,
      seatsOrRooms: selection.seatsAvailable ?? 1,
      price: selection.pricePerTraveler,
      currency: 'INR',
      details: selection.details,
      externalId: selection.id
    },
    source: input.booking.source.city,
    destination: input.booking.destination.city,
    date: input.booking.date,
    adults: input.adults,
    children: input.children,
    type: selection.type,
    travelers: input.travelers,
    seatPreference: 'any',
    mealPreference: selection.type === 'flight' ? 'none' : undefined,
    documentsAccepted: true
  });
}

export async function bookHotel(input: { booking: StayBooking; travelers: Array<{ fullName: string; age: number }>; adults: number; children: number }): Promise<BookingResult> {
  if (!input.booking.selectedHotel) throw new Error('Choose a hotel first.');
  const selection = input.booking.selectedHotel;
  return post<BookingResult, unknown>('/booking/api/hotel/book', {
    selection: {
      provider: selection.name,
      type: 'hotel',
      available: true,
      seatsOrRooms: input.booking.rooms,
      price: selection.pricePerNight,
      currency: 'INR',
      details: selection.details,
      externalId: selection.id
    },
    city: input.booking.city.city,
    checkIn: input.booking.checkIn,
    checkOut: input.booking.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.booking.rooms,
    guests: input.travelers,
    documentsAccepted: true
  });
}

type ServerTrip = {
  id: string;
  tripCode: string;
  source: Trip['source'];
  destination: Trip['destination'];
  startDate: string | null;
  endDate: string | null;
  days: number;
  pace: Pace;
  tripVibe?: string | null;
  preferences?: string[];
  status: string;
  itinerary?: DayPlan[];
  travelers?: Traveler[];
  bookingSelections?: Array<{ clientBookingId: string; bookingType: 'TRANSPORT' | 'HOTEL'; segment: unknown; selection: unknown; status?: string }>;
  bookingLinks?: Array<{ bookingType: 'TRANSPORT' | 'HOTEL'; externalBookingId: string; status: string }>;
  createdAt: string;
  updatedAt: string;
};

export async function createServerTrip(trip: Trip): Promise<SavedTrip> {
  const result = await post<Envelope<ServerTrip>, unknown>('/trip/api/trips', tripToServerPayload(trip));
  return serverTripToSavedTrip(result.data);
}

export async function updateServerTrip(trip: Trip): Promise<SavedTrip> {
  const id = trip.serverTripId ?? trip.tripCode;
  if (!id) return createServerTrip(trip);
  const result = await patch<Envelope<ServerTrip>, unknown>(`/trip/api/trips/${encodeURIComponent(id)}`, tripToServerPayload(trip));
  return serverTripToSavedTrip(result.data);
}

export async function deleteServerTrip(trip: Pick<Trip, 'serverTripId' | 'tripCode'>): Promise<void> {
  const id = trip.serverTripId ?? trip.tripCode;
  if (!id) return;
  await deleteRequest(`/trip/api/trips/${encodeURIComponent(id)}`);
}

export async function startTripDeleteOtp(trip: Pick<Trip, 'serverTripId' | 'tripCode'>): Promise<{ required: boolean; email?: string; expiresIn: number }> {
  const id = trip.serverTripId ?? trip.tripCode;
  if (!id) return { required: false, expiresIn: 0 };
  const result = await post<Envelope<{ required: boolean; email?: string; expiresIn: number }>, Record<string, never>>(`/trip/api/trips/${encodeURIComponent(id)}/delete-otp/start`, {});
  return result.data;
}

export async function verifyTripDeleteOtp(trip: Pick<Trip, 'serverTripId' | 'tripCode'>, otp: string): Promise<{ expiresIn: number }> {
  const id = trip.serverTripId ?? trip.tripCode;
  if (!id) return { expiresIn: 0 };
  const result = await post<Envelope<{ expiresIn: number }>, { otp: string }>(`/trip/api/trips/${encodeURIComponent(id)}/delete-otp/verify`, { otp });
  return result.data;
}

export async function emailServerTrip(trip: Pick<Trip, 'serverTripId' | 'tripCode'>, email?: string): Promise<{ sentTo: string }> {
  const id = trip.serverTripId ?? trip.tripCode;
  if (!id) throw new Error('Trip must be saved before emailing details.');
  const result = await post<Envelope<{ sentTo: string }>, { email?: string }>(`/trip/api/trips/${encodeURIComponent(id)}/email`, email ? { email } : {});
  return result.data;
}

export async function listServerTrips(): Promise<SavedTrip[]> {
  const result = await get<Envelope<ServerTrip[]>>('/trip/api/trips');
  return result.data.map(serverTripToSavedTrip);
}

export async function linkServerBooking(trip: Trip, input: { bookingType: 'TRANSPORT' | 'HOTEL'; externalBookingId: string; status: string; response: BookingResult }): Promise<SavedTrip> {
  const id = trip.serverTripId ?? trip.tripCode;
  if (!id) throw new Error('Trip must be saved before linking bookings.');
  const result = await post<Envelope<ServerTrip>, unknown>(`/trip/api/trips/${encodeURIComponent(id)}/bookings/link`, input);
  return serverTripToSavedTrip(result.data);
}

export async function startTripRecovery(input: { tripCode: string; organizerEmail: string }) {
  await publicPost('/trip/api/recovery/start', input);
}

export async function verifyTripRecovery(input: { tripCode: string; organizerEmail: string; otp: string }): Promise<{ recoveryToken: string; expiresIn: number }> {
  const result = await publicPost<Envelope<{ recoveryToken: string; expiresIn: number }>, typeof input>('/trip/api/recovery/verify', input);
  return result.data;
}

export async function fetchRecoveredTrip(input: { tripCode: string; recoveryToken: string }): Promise<SavedTrip> {
  const response = await fetch(`${API_BASE_URL}/trip/api/recovery/${encodeURIComponent(input.tripCode)}`, {
    headers: { 'x-trip-recovery-token': input.recoveryToken }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(payloadError(body) ?? response.statusText);
  return serverTripToSavedTrip((body as Envelope<ServerTrip>).data);
}

export async function claimRecoveredTrip(input: { tripCode: string; recoveryToken: string }): Promise<SavedTrip> {
  const result = await post<Envelope<ServerTrip>, { recoveryToken: string }>(`/trip/api/recovery/${encodeURIComponent(input.tripCode)}/claim`, { recoveryToken: input.recoveryToken });
  return serverTripToSavedTrip(result.data);
}

function tripToServerPayload(trip: Trip) {
  return {
    organizerEmail: trip.travelers.find((traveler) => traveler.role === 'organizer')?.email ?? '',
    source: trip.source,
    destination: trip.destination,
    startDate: normalizeIsoDate(trip.startDate),
    endDate: normalizeIsoDate(trip.endDate),
    days: trip.days,
    pace: trip.pace,
    tripVibe: trip.tripVibe,
    preferences: trip.preferences,
    itinerary: trip.itinerary,
    travelers: trip.travelers,
    bookingSelections: [
      ...trip.transportBookings.filter((booking) => booking.selectedOption).map((booking) => ({
        clientBookingId: booking.id,
        bookingType: 'TRANSPORT' as const,
        segment: { source: booking.source, destination: booking.destination, date: booking.date, type: booking.type, journeyName: booking.journeyName },
        selection: booking.selectedOption,
        status: booking.status
      })),
      ...trip.stayBookings.filter((booking) => booking.selectedHotel).map((booking) => ({
        clientBookingId: booking.id,
        bookingType: 'HOTEL' as const,
        segment: { city: booking.city, area: booking.area, checkIn: booking.checkIn, checkOut: booking.checkOut, rooms: booking.rooms, stayName: booking.stayName },
        selection: booking.selectedHotel,
        status: booking.status
      }))
    ],
    status: trip.transportBookings.some((booking) => booking.status === 'Booked') || trip.stayBookings.some((booking) => booking.status === 'Booked')
      ? 'BOOKED'
      : trip.transportBookings.some((booking) => booking.selectedOption) || trip.stayBookings.some((booking) => booking.selectedHotel)
        ? 'BOOKING_IN_PROGRESS'
        : trip.itinerary.length
          ? 'ITINERARY_READY'
          : 'DRAFT'
  };
}

function normalizeIsoDate(value: unknown) {
  if (!value) return '';
  const dateOnly = value instanceof Date ? toLocalIsoDate(value) : String(value).trim().slice(0, 10);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!parts) return '';
  const [, yearPart, monthPart, dayPart] = parts;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ? '' : dateOnly;
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function serverTripToSavedTrip(serverTrip: ServerTrip): SavedTrip {
  const source = serverTrip.source ?? { id: '', name: '', city: '' };
  const destination = serverTrip.destination ?? { id: '', name: '', city: '' };
  const itinerary = Array.isArray(serverTrip.itinerary) ? serverTrip.itinerary : [];
  const derivedDates = deriveTripDates(serverTrip, itinerary);
  const startDate = normalizeIsoDate(serverTrip.startDate) || derivedDates.startDate;
  const endDate = normalizeIsoDate(serverTrip.endDate) || derivedDates.endDate || startDate;
  return {
    serverTripId: serverTrip.id,
    tripCode: serverTrip.tripCode,
    syncStatus: 'synced',
    id: serverTrip.tripCode,
    createdAt: serverTrip.createdAt,
    updatedAt: serverTrip.updatedAt,
    source,
    destination,
    startDate,
    endDate,
    days: serverTrip.days,
    pace: serverTrip.pace,
    tripVibe: serverTrip.tripVibe ?? '',
    preferences: Array.isArray(serverTrip.preferences) ? serverTrip.preferences : [],
    travelers: restoreTravelers(serverTrip.travelers),
    itinerary,
    transportBookings: restoreTransportBookings(serverTrip, source, destination),
    stayBookings: restoreStayBookings(serverTrip, destination)
  };
}

function deriveTripDates(serverTrip: ServerTrip, itinerary: DayPlan[]) {
  const dates = [
    ...itinerary.map((day) => day.date),
    ...(serverTrip.bookingSelections ?? []).flatMap((selection) => {
      const segment = selection.segment as Record<string, unknown>;
      return [segment.date, segment.checkIn, segment.checkOut];
    })
  ].map(normalizeIsoDate).filter(Boolean).sort();
  return {
    startDate: dates[0] ?? '',
    endDate: dates.at(-1) ?? ''
  };
}

function restoreTravelers(travelers?: Traveler[]): Traveler[] {
  const values = Array.isArray(travelers) ? travelers : [];
  if (values.some((traveler) => traveler.role === 'organizer')) return values;
  return [{ id: 'traveler-organizer', fullName: 'Trip organizer', age: 18, email: '', role: 'organizer' }, ...values];
}

function restoreTransportBookings(serverTrip: ServerTrip, source: Trip['source'], destination: Trip['destination']): TransportBooking[] {
  const selections = (serverTrip.bookingSelections ?? []).filter((selection) => selection.bookingType === 'TRANSPORT');
  const links = serverTrip.bookingLinks ?? [];
  const startDate = normalizeIsoDate(serverTrip.startDate);
  if (!selections.length) {
    return [{ id: 'transport-1', journeyName: 'Journey 1', source, destination, date: startDate, type: 'flight', status: 'Not selected' }];
  }
  return selections.map((selection) => {
    const segment = selection.segment as Partial<TransportBooking>;
    const selectedOption = selection.selection as TransportOption;
    const link = links.find((item) => item.bookingType === 'TRANSPORT');
    return {
      id: selection.clientBookingId,
      journeyName: segment.journeyName ?? 'Journey',
      source: segment.source ?? source,
      destination: segment.destination ?? destination,
      date: normalizeIsoDate(segment.date) || startDate,
      type: selectedOption.type ?? segment.type ?? 'flight',
      selectedOption,
      status: link?.status === 'confirmed' ? 'Booked' : 'Selected',
      externalBookingId: link?.externalBookingId
    };
  });
}

function restoreStayBookings(serverTrip: ServerTrip, destination: Trip['destination']): StayBooking[] {
  const selections = (serverTrip.bookingSelections ?? []).filter((selection) => selection.bookingType === 'HOTEL');
  const links = serverTrip.bookingLinks ?? [];
  const startDate = normalizeIsoDate(serverTrip.startDate);
  const endDate = normalizeIsoDate(serverTrip.endDate);
  if (!selections.length) {
    return [{ id: 'stay-1', stayName: 'Stay 1', city: destination, area: destination.city, checkIn: startDate, checkOut: endDate, rooms: 1, status: 'Not selected' }];
  }
  return selections.map((selection) => {
    const segment = selection.segment as Partial<StayBooking>;
    const link = links.find((item) => item.bookingType === 'HOTEL');
    return {
      id: selection.clientBookingId,
      stayName: segment.stayName ?? 'Stay',
      city: segment.city ?? destination,
      area: segment.area ?? destination.city,
      checkIn: normalizeIsoDate(segment.checkIn) || startDate,
      checkOut: normalizeIsoDate(segment.checkOut) || endDate,
      rooms: segment.rooms ?? 1,
      selectedHotel: selection.selection as HotelOption,
      status: link?.status === 'confirmed' ? 'Booked' : 'Selected',
      externalBookingId: link?.externalBookingId
    };
  });
}
