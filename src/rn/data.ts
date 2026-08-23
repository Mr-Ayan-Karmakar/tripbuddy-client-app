import { HotelOption, Location, TransportOption, Trip } from './types';

export const locations: Location[] = [
  { id: 'kolkata', name: 'Kolkata, CCU - Netaji Subhas Chandra Bose Intl.', city: 'Kolkata' },
  { id: 'goa', name: 'Goa, India', city: 'Goa' },
  { id: 'delhi', name: 'Delhi, India', city: 'Delhi' },
  { id: 'hyderabad', name: 'Hyderabad, Telangana', city: 'Hyderabad' },
  { id: 'mumbai', name: 'Mumbai, Maharashtra', city: 'Mumbai' }
];

const emptyLocation = { id: '', name: '', city: '' };

export const transportOptions: TransportOption[] = [
  { id: '6E-621', provider: 'IndiGo', code: '6E 621', type: 'flight', departureTime: '07:15', arrivalTime: '10:05', duration: '2h 50m', stops: 'Nonstop', pricePerTraveler: 7840, details: 'Early nonstop flight from Kolkata to Goa.' },
  { id: 'AI-772', provider: 'Air India Express', code: 'IX 772', type: 'flight', departureTime: '13:40', arrivalTime: '17:15', duration: '3h 35m', stops: '1 stop', pricePerTraveler: 6950, details: 'Afternoon option with one stop.' },
  { id: 'train-1', provider: 'Konkan Railways', code: 'MAO Express', type: 'train', departureTime: '23:20', arrivalTime: '18:10', duration: '18h 50m', stops: 'Sleeper route', pricePerTraveler: 2860, details: 'Long rail route with overnight travel.' }
];

export const hotelOptions: HotelOption[] = [
  { id: 'casa', name: 'Casa Shoreline Resort', area: 'North Goa - Candolim', rating: 4.6, pricePerNight: 9200, details: 'Beach-first resort close to Candolim restaurants.', amenities: ['Breakfast', 'Pool', 'Airport transfer'], imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=640&q=80&fit=crop' },
  { id: 'fontainhas', name: 'Fontainhas Heritage Inn', area: 'Panjim', rating: 4.4, pricePerNight: 6800, details: 'Heritage stay near cafes and Latin Quarter walks.', amenities: ['Breakfast', 'Walkable area'], imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=640&q=80&fit=crop' },
  { id: 'bay', name: 'Bay Nest Suites', area: 'South Goa - Colva', rating: 4.7, pricePerNight: 11400, details: 'Quiet resort option for the South Goa segment.', amenities: ['Quiet location', 'Pool', 'Spa'], imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=640&q=80&fit=crop' }
];

export function createDefaultTrip(): Trip {
  return {
    source: emptyLocation,
    destination: emptyLocation,
    startDate: '',
    endDate: '',
    days: 0,
    pace: 'balanced',
    preferences: [],
    travelers: [
      { id: 'traveler-organizer', fullName: 'Trip organizer', age: 18, email: '', role: 'organizer' }
    ],
    itinerary: [],
    transportBookings: [],
    stayBookings: []
  };
}

export function formatInr(value: number) {
  return `Rs ${Math.round(value).toLocaleString('en-IN')}`;
}

export function daysBetween(start: string, end: string) {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}
