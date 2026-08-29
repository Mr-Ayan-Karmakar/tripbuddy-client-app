import { Link, usePathname } from 'expo-router';
import { Briefcase, Hotel, Menu, Plane, Train, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ImageSourcePropType, Linking, Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from './theme';
import { AppModal, Button, Container, Logo, Row, Text } from './ui';
import { useResponsive } from './useResponsive';

export function Header() {
  const pathname = usePathname();
  const { isMobile, width } = useResponsive();
  const useCompactNav = width < 1120;
  const [menuOpen, setMenuOpen] = useState(false);
  const pageNav = [
    { label: 'Home', href: '/' },
    { label: 'My Trips', href: '/trips' },
    { label: 'Bookings', href: '/bookings' }
  ] as const;
  const serviceNav = [
    { label: 'Flights', href: '/bookings', icon: Plane },
    { label: 'Trains', href: '/bookings', icon: Train },
    { label: 'Hotels', href: '/bookings', icon: Hotel }
  ] as const;

  return (
    <View style={styles.header}>
      <Container style={styles.headerContainer}>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link">
            <Logo style={StyleSheet.flatten([styles.headerLogo, useCompactNav && styles.headerLogoCompact])} />
          </Pressable>
        </Link>
        {useCompactNav ? (
          <>
            <Button variant="ghost" icon={menuOpen ? <X size={20} color={colors.primary} /> : <Menu size={20} color={colors.primary} />} onPress={() => setMenuOpen(true)}>Menu</Button>
            <AppModal visible={menuOpen} title="Menu" onClose={() => setMenuOpen(false)}>
              {[pageNav[0], ...serviceNav, pageNav[1], pageNav[2]].map((item) => {
                const Icon = 'icon' in item ? item.icon : undefined;
                return (
                  <Link key={item.label} href={item.href} asChild>
                    <Pressable onPress={() => setMenuOpen(false)} style={styles.mobileLink}>
                      <Row style={{ alignItems: 'center' }}>
                        {Icon ? <Icon size={16} color={colors.muted} /> : item.label === 'My Trips' ? <Briefcase size={16} color={colors.muted} /> : null}
                        <Text style={pathname === item.href ? styles.activeText : styles.navText}>{item.label}</Text>
                      </Row>
                    </Pressable>
                  </Link>
                );
              })}
              <Text>Support</Text>
              <Text>Log In</Text>
            </AppModal>
          </>
        ) : (
          <Row gap={spacing.sm} style={{ alignItems: 'center' }}>
            {pageNav.slice(0, 1).map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.label} href={item.href} asChild>
                  <Pressable style={StyleSheet.flatten([styles.navItem, active && styles.activeNavItem])}>
                    <Text style={active ? styles.activeText : styles.navText}>{item.label}</Text>
                  </Pressable>
                </Link>
              );
            })}
            {serviceNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} asChild>
                  <Pressable style={styles.navItem}>
                    <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                      <Icon size={14} color={colors.muted} />
                      <Text style={styles.navText}>{item.label}</Text>
                    </Row>
                  </Pressable>
                </Link>
              );
            })}
            <View style={styles.navDivider} />
            {pageNav.slice(1).map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.label} href={item.href} asChild>
                  <Pressable style={StyleSheet.flatten([styles.navItem, active && styles.activeNavItem])}>
                    <Text style={active ? styles.activeText : styles.navText}>{item.label}</Text>
                  </Pressable>
                </Link>
              );
            })}
            <Button>Login / Sign Up</Button>
          </Row>
        )}
      </Container>
      {useCompactNav ? (
        <Row style={styles.mobileServiceBar} gap={0}>
          {[
            { label: 'Flights', icon: Plane },
            { label: 'Trains', icon: Train },
            { label: 'Hotels', icon: Hotel }
          ].map(({ label, icon: Icon }) => (
            <Link key={label} href="/bookings" asChild>
              <Pressable style={styles.mobileServiceItem}>
                <Icon size={15} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            </Link>
          ))}
        </Row>
      ) : null}
    </View>
  );
}

export function Footer() {
  const footerLinks = [
    { label: 'About Us', onPress: () => Linking.openURL('https://www.kreativo.co.in/#about') },
    { label: 'Contact', onPress: () => Linking.openURL('https://kreativo.co.in/#contact') }
  ];

  return (
    <View style={styles.footer}>
      <Container style={styles.footerContainer}>
        <Row wrap style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Row style={{ alignItems: 'center' }}>
            <Logo style={{ width: 96, height: 28 }} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>AI-powered travel planning</Text>
          </Row>
          <Row style={styles.productBy}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>A product by</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Kreativo" onPress={() => Linking.openURL('https://kreativo.co.in/')} style={styles.kreativoLogoLink}>
              <Image
                source={require('../imports/Kreativo-logo-transparent.svg') as ImageSourcePropType}
                resizeMode="contain"
                style={styles.kreativoLogo}
              />
            </Pressable>
          </Row>
          <Row wrap>
            {footerLinks.map((link) => (
              <Pressable
                key={link.label}
                accessibilityRole="link"
                onPress={link.onPress}
                style={styles.footerLink}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>{link.label}</Text>
              </Pressable>
            ))}
          </Row>
          <Text style={{ color: colors.muted, fontSize: 12 }}>© 2026 Kreativo Pvt. Ltd.</Text>
        </Row>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1, borderBottomColor: colors.border, shadowColor: colors.primaryDark, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 2 }, elevation: 4, zIndex: 30 },
  headerContainer: { minHeight: 80, paddingVertical: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLogo: { width: 228, height: 64 },
  headerLogoCompact: { width: 186, height: 56 },
  navItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeNavItem: { borderBottomColor: colors.primary, backgroundColor: 'transparent', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  navDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  navText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  activeText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  mobileLink: { minHeight: 44, justifyContent: 'center' },
  mobileServiceBar: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F3F7FF' },
  mobileServiceItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xxl },
  footerContainer: { paddingVertical: spacing.xl },
  footerLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  productBy: { alignItems: 'center', minHeight: 44, gap: spacing.xs },
  kreativoLogoLink: { minHeight: 44, justifyContent: 'center' },
  kreativoLogo: { width: 82, height: 40 }
});
