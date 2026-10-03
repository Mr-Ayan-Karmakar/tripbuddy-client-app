import { useLocalSearchParams } from 'expo-router';
import { getSupportedCity, supportedCities } from '../../../src/rn/seo/cities';
import { CityTravelPage, InvalidTravelPage } from '../../../src/rn/seo/TravelLanding';

export function generateStaticParams() {
  return supportedCities.map((city) => ({ city: city.slug }));
}

export default function CityRoute() {
  const { city: citySlug } = useLocalSearchParams<{ city?: string | string[] }>();
  const city = getSupportedCity(citySlug);
  return city ? <CityTravelPage city={city} /> : <InvalidTravelPage />;
}
