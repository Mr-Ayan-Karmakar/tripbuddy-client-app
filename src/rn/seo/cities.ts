import cityData from './supportedCities.json';

export type SupportedCity = {
  name: string;
  slug: string;
  featured?: {
    rating: number;
    tag: string;
    image: string;
  };
};

export const supportedCities = cityData satisfies SupportedCity[];
export const supportedItineraryDurations = [1, 2, 3, 4, 5] as const;

export type SupportedItineraryDuration = typeof supportedItineraryDurations[number];

export function getSupportedCity(slug: string | string[] | undefined) {
  const value = Array.isArray(slug) ? slug[0] : slug;
  return supportedCities.find((city) => city.slug === value?.toLowerCase());
}

export function itineraryDurationSegment(days: SupportedItineraryDuration) {
  return `${days}-day-itinerary`;
}

export function parseItineraryDuration(value: string | string[] | undefined): SupportedItineraryDuration | undefined {
  const segment = Array.isArray(value) ? value[0] : value;
  const match = /^(\d)-day-itinerary$/.exec(segment ?? '');
  const days = Number(match?.[1]);
  return supportedItineraryDurations.find((duration) => duration === days);
}
