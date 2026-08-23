import { Link, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Search, ShieldCheck, Star } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Footer, Header } from '../src/rn/chrome';
import { colors, spacing } from '../src/rn/theme';
import { Card, Container, Heading, Row, Screen, Stack, Text } from '../src/rn/ui';
import { useResponsive } from '../src/rn/useResponsive';
import { useTrip } from '../src/rn/state/tripStore';

const heroImage = { uri: 'https://images.unsplash.com/photo-1633460205593-11131ea78e20?w=1600&q=85&fit=crop' };
const destinations = [
  { name: 'Jaipur', rating: 4.8, reviews: '2.3k', tag: 'Royal Heritage', image: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Amber_Fort-Jaipur-India0010.JPG' },
  { name: 'Goa', rating: 4.9, reviews: '1.4k', tag: 'Beach Retreat', image: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Palolem_beach.jpg' },
  { name: 'Darjeeling', rating: 4.7, reviews: '3.2k', tag: 'Mountain Escape', image: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Panorama_from_Tiger_Hill_Darjeeling_with_praying_flags_1.jpg' },
  { name: 'Jodhpur', rating: 4.7, reviews: '1.6k', tag: 'Blue City', image: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Mehrangarh_Fort.jpg' },
  { name: 'Delhi', rating: 4.6, reviews: '2.8k', tag: 'Capital Classics', image: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Lotus_Temple-Panoroma-Visit_During_WCI_2016-_IMG_6471.jpg' },
  { name: 'Srinagar', rating: 4.8, reviews: '980', tag: 'Lake Retreat', image: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Dal_Lake_Hazratbal_Srinagar.jpg' },
  { name: 'Puri', rating: 4.6, reviews: '1.8k', tag: 'Temple Coast', image: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Front_view_of_Shree_Jagannath_Temple_on_the_day_of_Ratha_Jatra_in_2024.jpg' }
];

export default function LandingRoute() {
  const router = useRouter();
  const destinationsRef = useRef<ScrollView>(null);
  const destinationsOffset = useRef(0);
  const [destinationsViewportWidth, setDestinationsViewportWidth] = useState(0);
  const [destinationsContentWidth, setDestinationsContentWidth] = useState(0);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [hoveredDestination, setHoveredDestination] = useState<string | null>(null);
  const { isDesktop, isMobile } = useResponsive();
  const { setPlannerInput } = useTrip();
  const startPlanning = (nextSource = source, nextDestination = destination) => {
    setPlannerInput({ source: nextSource, destination: nextDestination });
    router.push('/trip/create');
  };
  const scrollDestinations = (direction: 'left' | 'right') => {
    const nextOffset = Math.max(0, destinationsOffset.current + (direction === 'right' ? 720 : -720));
    destinationsOffset.current = nextOffset;
    destinationsRef.current?.scrollTo({ x: nextOffset, animated: true });
  };
  const destinationsOverflow = destinationsContentWidth > destinationsViewportWidth + 8;

  return (
    <Screen>
      <Header />
      <ScrollView>
        <ImageBackground source={heroImage} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlayGradient} />
          <View style={styles.heroStage}>
            <Container style={styles.heroContainer}>
              <Stack gap={spacing.xl} style={styles.heroContent}>
                <Stack>
                  <Heading size="xl" style={StyleSheet.flatten([styles.heroTitle, isMobile && { fontSize: 38, lineHeight: 46 }])}>Your Journey, <Text style={StyleSheet.flatten([styles.heroAccent, isMobile && { fontSize: 38, lineHeight: 46 }])}>Perfectly Planned</Text></Heading>
                  <Text style={styles.heroCopy}>Plan your trip, discover amazing places and experience the world like never before.</Text>
                  <Pressable accessibilityRole="button" onPress={() => startPlanning()} style={({ pressed, hovered }) => StyleSheet.flatten([styles.heroButton, hovered && styles.heroButtonHover, pressed && styles.pressedButton])}>
                    <Row gap={10} style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={styles.gradientButtonText}>Plan Your Trip</Text>
                      <ArrowRight size={16} color={colors.surface} />
                    </Row>
                  </Pressable>
                </Stack>
              </Stack>
            </Container>
          </View>
          <Container style={{ paddingTop: 0, paddingBottom: 0 }}>
            <Card style={styles.searchCard}>
              <Row gap={0} style={{ flexDirection: isDesktop ? 'row' : 'column', alignItems: 'stretch' }}>
                <View style={styles.searchField}>
                  <Search size={20} color={colors.primary} />
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Text style={styles.searchLabel}>From</Text>
                    <TextInput
                      accessibilityLabel="From"
                      value={source}
                      onChangeText={setSource}
                      placeholder="City, airport or region..."
                      placeholderTextColor="#9CA3AF"
                      style={styles.searchInput}
                    />
                  </Stack>
                </View>
                <View style={styles.searchField}>
                  <MapPin size={20} color={colors.primary} />
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Text style={styles.searchLabel}>To</Text>
                    <TextInput
                      accessibilityLabel="To"
                      value={destination}
                      onChangeText={setDestination}
                      placeholder="Where do you want to go?"
                      placeholderTextColor="#9CA3AF"
                      style={styles.searchInput}
                    />
                  </Stack>
                </View>
                <Pressable accessibilityRole="button" onPress={() => startPlanning()} style={({ pressed }) => StyleSheet.flatten([styles.startButton, pressed && styles.pressedButton])}>
                  <Row gap={spacing.sm} style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={styles.gradientButtonText}>Start Planning</Text>
                    <ArrowRight size={16} color={colors.surface} />
                  </Row>
                </Pressable>
              </Row>
            </Card>
          </Container>
        </ImageBackground>

        <View style={styles.featuresBand}>
          <Container style={{ paddingVertical: 0 }}>
            <Row style={{ flexDirection: isDesktop ? 'row' : 'column' }} gap={0}>
              {[
                { icon: CalendarDays, color: colors.primary, bg: '#EBF2FE', title: 'Smart Itinerary', sub: 'AI-powered itineraries tailored for you' },
                { icon: MapPin, color: colors.accent, bg: colors.accentSoft, title: 'Handpicked Places', sub: 'Discover top attractions and hidden gems' },
                { icon: ShieldCheck, color: '#22C55E', bg: '#EDFBF2', title: 'Best Price Guarantee', sub: 'Get the best deals on flights and hotels' }
              ].map(({ icon: Icon, color, bg, title, sub }, index) => (
                <View
                  key={title}
                  style={StyleSheet.flatten([
                    styles.featureItem,
                    isDesktop
                      ? index < 2 && styles.featureItemDesktopDivider
                      : index < 2 && styles.featureItemMobileDivider
                  ])}
                >
                  <View style={StyleSheet.flatten([styles.featureIcon, { backgroundColor: bg }])}><Icon size={22} color={color} /></View>
                  <Stack gap={spacing.xs}><Text style={{ fontWeight: '800' }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{sub}</Text></Stack>
                </View>
              ))}
            </Row>
          </Container>
        </View>

        <Container>
          <Stack gap={spacing.xl}>
            <Stack gap={spacing.sm}>
              <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Heading size="lg">Popular Destinations</Heading>
                {destinationsOverflow ? (
                  <Row gap={spacing.sm}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Previous destinations" onPress={() => scrollDestinations('left')} style={styles.destinationArrow}>
                      <ArrowLeft size={18} color={colors.text} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Next destinations" onPress={() => scrollDestinations('right')} style={styles.destinationArrow}>
                      <ArrowRight size={18} color={colors.text} />
                    </Pressable>
                  </Row>
                ) : null}
              </Row>
            </Stack>
            <ScrollView
              ref={destinationsRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.destinationsScroller}
              onLayout={(event) => setDestinationsViewportWidth(event.nativeEvent.layout.width)}
              onContentSizeChange={(width) => setDestinationsContentWidth(width)}
              onScroll={(event) => { destinationsOffset.current = event.nativeEvent.contentOffset.x; }}
              scrollEventThrottle={16}
            >
              {destinations.map((destination) => (
                <Link key={destination.name} href="/trip/create" asChild>
                  <Pressable
                    style={StyleSheet.flatten([styles.destinationCard, isMobile && styles.destinationCardMobile])}
                    onPress={() => startPlanning('', destination.name)}
                    onHoverIn={() => setHoveredDestination(destination.name)}
                    onHoverOut={() => setHoveredDestination(null)}
                  >
                    <Image
                      source={{ uri: destination.image }}
                      style={StyleSheet.flatten([
                        styles.destinationImage,
                        hoveredDestination === destination.name && styles.destinationImageHover
                      ])}
                    />
                    <Text style={styles.destinationTag}>{destination.tag}</Text>
                    <View style={styles.destinationInfo}>
                      <Text style={styles.destinationName}>{destination.name}</Text>
                      <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                        <Star size={13} color="#FACC15" fill="#FACC15" />
                        <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '700' }}>{destination.rating}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12 }}>({destination.reviews} reviews)</Text>
                      </Row>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          </Stack>
        </Container>
        <Footer />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 580 },
  heroImage: { resizeMode: 'cover' },
  heroOverlayGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: 'linear-gradient(to right, rgba(15,35,55,0.82) 0%, rgba(15,35,55,0.55) 55%, rgba(15,35,55,0.15) 100%)' as never
  },
  heroStage: { minHeight: 520, justifyContent: 'center' },
  heroContainer: { paddingVertical: 64 },
  heroContent: { maxWidth: 580 },
  heroTitle: { color: colors.surface, fontSize: 58, lineHeight: 66 },
  heroAccent: { color: colors.cyan, fontSize: 58, lineHeight: 66, fontWeight: '800' },
  heroCopy: { color: 'rgba(255,255,255,0.82)', fontSize: 18, lineHeight: 28, maxWidth: 460 },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xl,
    minHeight: 50,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #4A90F2 100%)' as never,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5
  },
  heroButtonHover: { shadowOpacity: 0.24, transform: [{ translateY: -2 }] },
  pressedButton: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  gradientButtonText: { color: colors.surface, fontWeight: '700', fontSize: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  searchCard: { marginTop: -82, borderRadius: 16, padding: spacing.sm, borderWidth: 0, gap: spacing.sm, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 20 }, elevation: 8 },
  searchField: { flex: 1, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12, borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12 },
  searchLabel: { color: '#6B7280', fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase' },
  searchInput: { minHeight: 30, color: '#1F2937', fontSize: 14, paddingVertical: 0, paddingHorizontal: spacing.sm },
  startButton: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 12,
    borderRadius: 12,
    margin: spacing.sm,
    backgroundImage: 'linear-gradient(135deg, #F8691E 0%, #FF8C42 100%)' as never
  },
  featuresBand: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  featureItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl, borderColor: colors.border },
  featureItemDesktopDivider: { borderRightWidth: 1 },
  featureItemMobileDivider: { borderBottomWidth: 1 },
  featureIcon: { width: 48, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  destinationsScroller: { gap: spacing.lg, paddingRight: spacing.xl },
  destinationArrow: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#092141', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  destinationCard: { width: 216, aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.primaryDark },
  destinationCardMobile: { width: 230 },
  destinationImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  destinationImageHover: { transform: [{ scale: 1.05 }] },
  destinationTag: { position: 'absolute', top: spacing.md, left: spacing.md, color: colors.surface, backgroundColor: 'rgba(26,95,114,0.85)', borderRadius: 999, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: 11, fontWeight: '800' },
  destinationInfo: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingTop: 72 },
  destinationName: { color: colors.surface, fontWeight: '800', fontSize: 15, marginTop: spacing.sm }
});
