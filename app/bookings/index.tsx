import { CalendarDays, Hotel, Plane, Train } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, spacing } from '../../src/rn/theme';
import { Card, Chip, Container, Heading, Row, Screen, Stack, Text } from '../../src/rn/ui';

export default function BookingsRoute() {
  return (
    <Screen>
      <Header />
      <ScrollView>
        <View style={styles.hero}>
          <Container>
            <Stack gap={spacing.sm}>
              <Text style={styles.eyebrow}>Standalone bookings</Text>
              <Heading size="xl" style={styles.heroTitle}>Bookings</Heading>
              <Text style={styles.heroText}>Flights, trains, and hotels booked directly from the header live here, separate from trip planning.</Text>
            </Stack>
          </Container>
        </View>

        <Container>
          <Stack gap={spacing.lg}>
            <Row wrap>
              <Chip label="Flights" />
              <Chip label="Trains" />
              <Chip label="Hotels" />
            </Row>

            <Card style={styles.emptyCard}>
              <View style={styles.iconRow}>
                <View style={styles.iconBubble}><Plane size={20} color={colors.primary} /></View>
                <View style={styles.iconBubble}><Train size={20} color={colors.accent} /></View>
                <View style={styles.iconBubble}><Hotel size={20} color={colors.cyan} /></View>
              </View>
              <Heading size="md">No standalone bookings yet</Heading>
              <Text style={styles.emptyText}>A booking-history API is not available yet. Once the backend exposes a list endpoint, this page can fetch direct flight, train, and hotel bookings here.</Text>
              <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                <CalendarDays size={14} color={colors.muted} />
                <Text style={styles.metaText}>Trip-specific booking remains under each saved trip.</Text>
              </Row>
            </Card>
          </Stack>
        </Container>
        <Footer />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundImage: 'linear-gradient(135deg, #092141 0%, #17438D 60%, #2575F1 100%)' as never },
  eyebrow: { color: colors.cyan, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: colors.surface },
  heroText: { color: 'rgba(255,255,255,0.74)', maxWidth: 560 },
  emptyCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  iconRow: { flexDirection: 'row', gap: spacing.sm },
  iconBubble: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2FE' },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 520 },
  metaText: { color: colors.muted, fontSize: 13 }
});
