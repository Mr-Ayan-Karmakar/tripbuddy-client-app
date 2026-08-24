export type Pace = 'relaxed' | 'balanced' | 'fast';
export type BookingStatus = 'Not selected' | 'Selected' | 'Booking' | 'Booked' | 'Failed';
export type TransportType = 'flight' | 'train';

export type Location = {
  id: string;
  name: string;
  city: string;
};

export type Traveler = {
  id: string;
  fullName: string;
  age: number;
  email?: string;
  role?: 'organizer' | 'traveler';
};

export type Activity = {
  id: string;
  name: string;
  area: string;
  rating: number;
  startTime: string;
  endTime: string;
  duration: string;
  description: string;
  imageUrl?: string;
  category?: string;
  restaurants?: Restaurant[];
  reviews?: PlaceReview[];
  travelFromPrevious?: string;
  locked?: boolean;
};

export type PlaceReview = {
  authorName?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  priceLevel?: number;
  distanceMeters?: number;
};

export type DayPlan = {
  id: string;
  dayNumber: number;
  date: string;
  title: string;
  restDay: boolean;
  activities: Activity[];
};

export type TransportOption = {
  id: string;
  provider: string;
  code: string;
  type: TransportType;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: string;
  pricePerTraveler: number;
  details: string;
};

export type HotelOption = {
  id: string;
  name: string;
  area: string;
  rating: number;
  pricePerNight: number;
  details: string;
  amenities: string[];
  imageUrl: string;
};

export type TransportBooking = {
  id: string;
  journeyName: string;
  source: Location;
  destination: Location;
  date: string;
  type: TransportType;
  status: BookingStatus;
  selectedOption?: TransportOption;
};

export type StayBooking = {
  id: string;
  stayName: string;
  city: Location;
  area: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  status: BookingStatus;
  selectedHotel?: HotelOption;
};

export type Trip = {
  source: Location;
  destination: Location;
  startDate: string;
  endDate: string;
  days: number;
  pace: Pace;
  tripVibe?: string;
  preferences: string[];
  travelers: Traveler[];
  itinerary: DayPlan[];
  transportBookings: TransportBooking[];
  stayBookings: StayBooking[];
};

export type SavedTrip = Trip & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
