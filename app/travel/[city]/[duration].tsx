import { useLocalSearchParams } from 'expo-router';
import {
  getSupportedCity,
  itineraryDurationSegment,
  parseItineraryDuration,
  supportedCities,
  supportedItineraryDurations
} from '../../../src/rn/seo/cities';
import { DurationTravelPage, InvalidTravelPage } from '../../../src/rn/seo/TravelLanding';

export function generateStaticParams() {
  return supportedCities.flatMap((city) => supportedItineraryDurations.map((days) => ({
    city: city.slug,
    duration: itineraryDurationSegment(days)
  })));
}

export default function DurationRoute() {
  const params = useLocalSearchParams<{ city?: string | string[]; duration?: string | string[] }>();
  const city = getSupportedCity(params.city);
  const days = parseItineraryDuration(params.duration);
  return city && days ? <DurationTravelPage city={city} days={days} /> : <InvalidTravelPage />;
}
