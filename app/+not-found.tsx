import { Link } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Footer, Header } from '../src/rn/chrome';
import { SeoHead } from '../src/rn/seo/SeoHead';
import { colors, spacing } from '../src/rn/theme';
import { Container, Heading, PageScroll, Row, Screen, Stack, Text } from '../src/rn/ui';

export default function NotFoundRoute() {
  return (
    <Screen>
      <SeoHead
        title="Page not found | TripBuddy"
        description="Return to TripBuddy to plan a personalized trip or explore supported destinations."
        path="/"
        noIndex
      />
      <Header />
      <PageScroll>
        <Container style={styles.main}>
          <Stack gap={spacing.lg} style={styles.content}>
            <Text style={styles.code}>404</Text>
            <Heading size="lg">Page not found</Heading>
            <Text style={styles.message}>This page does not exist or is not one of TripBuddy's supported travel planners.</Text>
            <Row wrap>
              <Link href="/" asChild>
                <Pressable accessibilityRole="link" style={styles.primaryLink}>
                  <ArrowLeft size={16} color={colors.surface} />
                  <Text style={styles.primaryLinkText}>Back to TripBuddy</Text>
                </Pressable>
              </Link>
              <Link href="/travel" asChild>
                <Pressable accessibilityRole="link" style={styles.secondaryLink}>
                  <Text style={styles.secondaryLinkText}>Explore destinations</Text>
                </Pressable>
              </Link>
            </Row>
          </Stack>
        </Container>
        <Footer />
      </PageScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  main: { minHeight: 560, alignItems: 'center', justifyContent: 'center' },
  content: { maxWidth: 620, alignItems: 'center' },
  code: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  message: { color: colors.muted, textAlign: 'center', fontSize: 16, lineHeight: 25 },
  primaryLink: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.primary },
  primaryLinkText: { color: colors.surface, fontWeight: '900' },
  secondaryLink: { minHeight: 46, justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
  secondaryLinkText: { color: colors.primary, fontWeight: '900' }
});
