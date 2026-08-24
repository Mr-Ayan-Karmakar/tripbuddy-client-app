import { hotelOptions, transportOptions } from '../data';
import { Activity, DayPlan, HotelOption, Pace, TransportOption, TransportType } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

type Envelope<T> = {
  success: boolean;
  data: T;
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

export async function getAccessToken() {
  if (tokens?.accessToken) return tokens.accessToken;
  if (tokenPromise) return tokenPromise;
  tokenPromise = fetch(`${API_BASE_URL}/auth/api/guest`, { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Unable to create guest session.');
      const body = (await response.json()) as Envelope<Tokens>;
      tokens = body.data;
      return body.data.accessToken;
    })
    .finally(() => {
      tokenPromise = undefined;
    });
  return tokenPromise;
}

async function post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText;
    throw new Error(message);
  }
  return payload as TResponse;
}

export async function generateItinerary(input: GenerateItineraryInput): Promise<DayPlan[]> {
  const token = await getAccessToken();
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
    throw new Error(errorMessageFromText(text) ?? response.statusText);
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
    category: activity.bestTimeOfDay ?? activity.city,
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
    const parsed = JSON.parse(value) as { error?: string; message?: string };
    return parsed.error ?? parsed.message;
  } catch {
    return value;
  }
}

export async function searchTransport(input: { source: string; destination: string; date: string; adults: number; children: number; type: TransportType }): Promise<TransportOption[]> {
  try {
    const result = await post<{ options: AvailabilityDto[] }, typeof input>('/booking/api/transport/availability', input);
    const mapped = result.options.filter((option) => option.available).map((option, index) => ({
      id: option.externalId ?? `${option.provider}-${index}`,
      provider: option.provider,
      code: option.externalId ?? `${input.type.toUpperCase()}-${index + 1}`,
      type: input.type,
      departureTime: 'TBD',
      arrivalTime: 'TBD',
      duration: 'Provider timed',
      stops: `${option.seatsOrRooms} seats`,
      pricePerTraveler: option.price,
      details: option.details
    }));
    return mapped.length ? mapped : transportOptions.filter((option) => option.type === input.type);
  } catch {
    return transportOptions.filter((option) => option.type === input.type);
  }
}

export async function searchHotels(input: { city: string; checkIn: string; checkOut: string; adults: number; children: number; rooms: number }): Promise<HotelOption[]> {
  try {
    const result = await post<{ options: AvailabilityDto[] }, typeof input>('/booking/api/hotel/availability', input);
    const mapped = result.options.filter((option) => option.available).map((option, index) => ({
      id: option.externalId ?? `${option.provider}-${index}`,
      name: option.provider,
      area: option.source ?? input.city,
      rating: 4.2,
      pricePerNight: option.price,
      details: option.details,
      amenities: ['Provider availability', `${option.seatsOrRooms} room${option.seatsOrRooms === 1 ? '' : 's'}`],
      imageUrl: hotelOptions[index % hotelOptions.length]?.imageUrl ?? hotelOptions[0]!.imageUrl
    }));
    return mapped.length ? mapped : hotelOptions;
  } catch {
    return hotelOptions;
  }
}

export async function completeBookings(input: { transport: TransportOption[]; hotels: HotelOption[]; travelers: Array<{ fullName: string; age: number }>; source: string; destination: string; date: string; city: string; checkIn: string; checkOut: string; adults: number; children: number }) {
  await Promise.all([
    ...input.transport.map((selection) => post('/booking/api/transport/book', { selection: { provider: selection.provider, type: selection.type, available: true, seatsOrRooms: 1, price: selection.pricePerTraveler, currency: 'INR', details: selection.details, externalId: selection.id }, source: input.source, destination: input.destination, date: input.date, adults: input.adults, children: input.children, type: selection.type, travelers: input.travelers, documentsAccepted: true })),
    ...input.hotels.map((selection) => post('/booking/api/hotel/book', { selection: { provider: selection.name, type: 'hotel', available: true, seatsOrRooms: 1, price: selection.pricePerNight, currency: 'INR', details: selection.details, externalId: selection.id }, city: input.city, checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults, children: input.children, rooms: 1, guests: input.travelers, documentsAccepted: true }))
  ]);
}
