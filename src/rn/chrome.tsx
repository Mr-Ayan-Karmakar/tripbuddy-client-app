import { Link, usePathname, useRouter } from 'expo-router';
import { AlertCircle, Briefcase, CheckCircle2, Hotel, KeyRound, LogIn, LogOut, Mail, Menu, Plane, ShieldCheck, TicketCheck, Train, Trash2, UserPlus, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, ImageSourcePropType, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTrip } from './state/tripStore';
import { colors, spacing } from './theme';
import { AppModal, Button, Container, Input, Logo, Row, Stack, Text } from './ui';
import { useResponsive } from './useResponsive';

export function Header() {
  const pathname = usePathname();
  const { isMobile, width } = useResponsive();
  const useCompactNav = width < 1120;
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { account, logoutAccount } = useTrip();
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
              <Pressable onPress={() => { setMenuOpen(false); setAuthOpen(true); }} style={styles.mobileLink}>
                <Row style={{ alignItems: 'center' }}>
                  <Mail size={16} color={colors.muted} />
                  <Text style={styles.navText}>{account ? account.email : 'Login / Sign Up'}</Text>
                </Row>
              </Pressable>
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
            {account ? (
              <Button variant="secondary" onPress={() => setAuthOpen(true)} icon={<ShieldCheck size={16} color={colors.text} />}>Account</Button>
            ) : (
              <Button onPress={() => setAuthOpen(true)}>Login / Sign Up</Button>
            )}
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
      <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} />
    </View>
  );
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'recover';
type OtpAction = 'signupOtp' | 'forgotOtp' | 'recoverOtp' | 'accountPasswordOtp';
type AuthAction = 'login' | 'signup' | OtpAction | 'verifyReset' | 'reset' | 'recoverOtp' | 'recover' | 'accountPasswordVerify' | 'accountPasswordReset' | 'deleteAccount';

const OTP_RESEND_SECONDS = 60;
const OTP_MAX_SENDS = 3;

function AuthModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { account, loginAccount, sendSignupOtp, registerAccount, startForgotPassword, verifyForgotPassword, resetPassword, startRecoverTrip, verifyAndClaimTrip, logoutAccount, deleteAccount } = useTrip();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [tripCode, setTripCode] = useState('');
  const [message, setMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [accountPasswordOpen, setAccountPasswordOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<AuthAction | null>(null);
  const [otpCooldownEndsAt, setOtpCooldownEndsAt] = useState<Record<string, number>>({});
  const [otpSendCounts, setOtpSendCounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const busy = busyAction !== null;
  const messageTone = message.toLowerCase().includes('failed') || message.toLowerCase().includes('wrong') || message.toLowerCase().includes('required') || message.toLowerCase().includes('invalid') || message.toLowerCase().includes('delete') || message.toLowerCase().includes('permanently') ? 'danger' : 'success';

  useEffect(() => {
    if (!Object.values(otpCooldownEndsAt).some((endsAt) => endsAt > Date.now())) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [otpCooldownEndsAt]);

  async function run(action: () => Promise<void>, success: string, authAction: AuthAction) {
    setBusyAction(authAction);
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusyAction(null);
    }
  }

  async function sendOtpWithCooldown(authAction: OtpAction, key: string, action: () => Promise<void>, success: string) {
    await run(async () => {
      await action();
      setOtpSendCounts((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
      setOtpCooldownEndsAt((current) => ({ ...current, [key]: Date.now() + OTP_RESEND_SECONDS * 1000 }));
      setNow(Date.now());
    }, success, authAction);
  }

  function otpState(key: string, action: OtpAction) {
    const sends = otpSendCounts[key] ?? 0;
    const cooldownSeconds = Math.max(0, Math.ceil(((otpCooldownEndsAt[key] ?? 0) - now) / 1000));
    return {
      disabled: busy || cooldownSeconds > 0 || sends >= OTP_MAX_SENDS,
      label: busyAction === action
        ? 'Sending OTP...'
        : sends >= OTP_MAX_SENDS
          ? 'OTP limit reached'
          : cooldownSeconds > 0
            ? `Resend in ${cooldownSeconds}s`
            : sends > 0
              ? 'Resend OTP'
              : 'Send OTP'
    };
  }

  async function submitLogin() {
    await run(async () => {
      await loginAccount({ email, password });
      onClose();
    }, 'Logged in.', 'login');
  }

  async function submitSignup() {
    await run(async () => {
      await registerAccount({ email, password, otp });
      onClose();
    }, 'Account created.', 'signup');
  }

  async function verifyReset() {
    await run(async () => {
      const result = await verifyForgotPassword({ email, otp });
      setResetToken(result.resetToken);
    }, 'OTP verified. Set a new password.', 'verifyReset');
  }

  async function submitReset() {
    await run(async () => {
      await resetPassword({ resetToken, newPassword });
      setMode('login');
      setPassword('');
      setNewPassword('');
      setOtp('');
      setResetToken('');
    }, 'Password changed. Please log in.', 'reset');
  }

  async function submitRecovery() {
    await run(async () => {
      await verifyAndClaimTrip({ tripCode, organizerEmail: email, otp });
      onClose();
      router.push('/trip/booking');
    }, 'Trip recovered.', 'recover');
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage('');
    setOtp('');
    setResetToken('');
    setDeleteConfirm(false);
    setAccountPasswordOpen(false);
  }

  function toggleAccountPassword() {
    setAccountPasswordOpen((current) => !current);
    setMessage('');
    setOtp('');
    setNewPassword('');
    setResetToken('');
    setDeleteConfirm(false);
  }

  async function verifyAccountPasswordOtp() {
    if (!account) return;
    await run(async () => {
      const result = await verifyForgotPassword({ email: account.email, otp });
      setResetToken(result.resetToken);
    }, 'OTP verified. Set a new password.', 'accountPasswordVerify');
  }

  async function submitAccountPasswordChange() {
    await run(async () => {
      await resetPassword({ resetToken, newPassword });
      await logoutAccount();
      setAccountPasswordOpen(false);
      setOtp('');
      setNewPassword('');
      setResetToken('');
    }, 'Password changed. Please log in.', 'accountPasswordReset');
  }

  async function submitDeleteAccount() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setMessage('Press delete again to permanently remove your account.');
      return;
    }

    await run(async () => {
      await deleteAccount();
      setDeleteConfirm(false);
      onClose();
    }, 'Account deleted.', 'deleteAccount');
  }

  const title = account ? 'Your account' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : mode === 'recover' ? 'Recover trip' : 'Welcome back';
  const normalizedEmail = email.trim().toLowerCase();
  const signupOtp = otpState(`signup:${normalizedEmail}`, 'signupOtp');
  const forgotOtp = otpState(`forgot:${normalizedEmail}`, 'forgotOtp');
  const recoverOtp = otpState(`recover:${tripCode.trim().toUpperCase()}:${normalizedEmail}`, 'recoverOtp');
  const accountPasswordOtp = otpState(`account-password:${account?.email ?? ''}`, 'accountPasswordOtp');

  return (
    <AppModal visible={visible} title={title} onClose={onClose}>
      {account ? (
        <Stack gap={spacing.lg}>
          <View style={styles.authHero}>
            <View style={styles.authHeroIcon}><ShieldCheck size={24} color={colors.surface} /></View>
            <Stack gap={spacing.xs} style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.authEyebrow}>Signed in</Text>
              <Text style={styles.authAccountEmail} numberOfLines={1} ellipsizeMode="tail">{account.email}</Text>
            </Stack>
          </View>
          <Stack gap={spacing.sm}>
            <Button variant="secondary" onPress={toggleAccountPassword} disabled={busy} icon={<KeyRound size={16} color={colors.text} />}>Change password</Button>
            {accountPasswordOpen ? (
              <Stack gap={spacing.md} style={styles.authForm}>
                <Text style={styles.authHint}>We will send a verification code to {account.email}.</Text>
                <Row wrap style={styles.otpRow}>
                  <Input label="OTP" value={otp} onChangeText={setOtp} keyboardType="numeric" placeholder="6-digit code" style={styles.otpInput} />
                  <Button variant="secondary" onPress={() => sendOtpWithCooldown('accountPasswordOtp', `account-password:${account.email}`, () => startForgotPassword(account.email), 'OTP sent.')} disabled={accountPasswordOtp.disabled} icon={<Mail size={16} color={colors.text} />}>{accountPasswordOtp.label}</Button>
                  <Button variant="secondary" onPress={verifyAccountPasswordOtp} disabled={busy || otp.length !== 6} icon={<ShieldCheck size={16} color={colors.text} />}>{busyAction === 'accountPasswordVerify' ? 'Verifying...' : 'Verify'}</Button>
                </Row>
                <Input label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="8+ chars, number, special" />
                <Button onPress={submitAccountPasswordChange} disabled={busy || !resetToken || !newPassword} icon={<KeyRound size={16} color={colors.surface} />}>{busyAction === 'accountPasswordReset' ? 'Saving...' : 'Save password'}</Button>
              </Stack>
            ) : null}
            <Button variant="danger" onPress={submitDeleteAccount} disabled={busy} icon={<Trash2 size={16} color={colors.danger} />}>{busyAction === 'deleteAccount' ? 'Deleting...' : deleteConfirm ? 'Delete permanently' : 'Delete account'}</Button>
            <Button variant="secondary" onPress={() => void logoutAccount()} disabled={busy} icon={<LogOut size={16} color={colors.text} />}>Logout</Button>
          </Stack>
          {message ? <AuthNotice tone={messageTone}>{message}</AuthNotice> : null}
        </Stack>
      ) : (
        <Stack gap={spacing.lg}>
          <View style={styles.authHero}>
            <View style={styles.authHeroIcon}>
              {mode === 'recover' ? <TicketCheck size={24} color={colors.surface} /> : mode === 'forgot' ? <KeyRound size={24} color={colors.surface} /> : mode === 'signup' ? <UserPlus size={24} color={colors.surface} /> : <LogIn size={24} color={colors.surface} />}
            </View>
            <Stack gap={spacing.xs} style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.authEyebrow}>TripBuddy account</Text>
              <Text style={styles.authHeroTitle}>{mode === 'recover' ? 'Find a saved trip' : mode === 'forgot' ? 'Set a new password' : mode === 'signup' ? 'Create your account' : 'Sign in to continue'}</Text>
              <Text style={styles.authHeroText}>{mode === 'recover' ? 'Use the organizer email and Trip ID.' : mode === 'forgot' ? 'Verify your email before changing it.' : mode === 'signup' ? 'Verify your email with a one-time code.' : 'Access your saved trips and bookings.'}</Text>
            </Stack>
          </View>

          <View style={styles.authTabs}>
            <AuthModeTab label="Login" selected={mode === 'login'} icon={<LogIn size={15} color={mode === 'login' ? colors.surface : colors.muted} />} onPress={() => switchMode('login')} />
            <AuthModeTab label="Sign up" selected={mode === 'signup'} icon={<UserPlus size={15} color={mode === 'signup' ? colors.surface : colors.muted} />} onPress={() => switchMode('signup')} />
            <AuthModeTab label="Recover" selected={mode === 'recover'} icon={<TicketCheck size={15} color={mode === 'recover' ? colors.surface : colors.muted} />} onPress={() => switchMode('recover')} />
          </View>

          {mode === 'login' ? (
            <Stack gap={spacing.lg} style={styles.authForm}>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
              <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="8+ chars, number, special" />
              <View style={styles.authActionBlock}>
                <Button onPress={submitLogin} disabled={busy || !email || !password} icon={<LogIn size={16} color={colors.surface} />}>{busyAction === 'login' ? 'Signing in...' : 'Login'}</Button>
                <Pressable accessibilityRole="button" onPress={() => switchMode('forgot')} style={styles.authTextButton}>
                  <Text style={styles.authTextButtonText}>Forgot password?</Text>
                </Pressable>
              </View>
            </Stack>
          ) : null}

          {mode === 'signup' ? (
            <Stack gap={spacing.lg} style={styles.authForm}>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
              <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="8+ chars, number, special" />
              <Text style={styles.authHint}>Use 8+ characters with a number and special character.</Text>
              <Row wrap style={styles.otpRow}>
                <Input label="OTP" value={otp} onChangeText={setOtp} keyboardType="numeric" placeholder="6-digit code" style={styles.otpInput} />
                <Button variant="secondary" onPress={() => sendOtpWithCooldown('signupOtp', `signup:${normalizedEmail}`, () => sendSignupOtp(email), 'OTP sent.')} disabled={!email || signupOtp.disabled} icon={<Mail size={16} color={colors.text} />}>{signupOtp.label}</Button>
              </Row>
              <Button onPress={submitSignup} disabled={busy || !email || !password || otp.length !== 6} icon={<UserPlus size={16} color={colors.surface} />}>{busyAction === 'signup' ? 'Creating...' : 'Create account'}</Button>
            </Stack>
          ) : null}

          {mode === 'forgot' ? (
            <Stack gap={spacing.lg} style={styles.authForm}>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
              <Row wrap style={styles.otpRow}>
                <Input label="OTP" value={otp} onChangeText={setOtp} keyboardType="numeric" placeholder="6-digit code" style={styles.otpInput} />
                <Button variant="secondary" onPress={() => sendOtpWithCooldown('forgotOtp', `forgot:${normalizedEmail}`, () => startForgotPassword(email), 'If an account exists, an OTP has been sent.')} disabled={!email || forgotOtp.disabled} icon={<Mail size={16} color={colors.text} />}>{forgotOtp.label}</Button>
                <Button variant="secondary" onPress={verifyReset} disabled={busy || !email || otp.length !== 6} icon={<ShieldCheck size={16} color={colors.text} />}>{busyAction === 'verifyReset' ? 'Verifying...' : 'Verify'}</Button>
              </Row>
              <Input label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="8+ chars, number, special" />
              <Button onPress={submitReset} disabled={busy || !resetToken || !newPassword} icon={<KeyRound size={16} color={colors.surface} />}>{busyAction === 'reset' ? 'Saving...' : 'Set new password'}</Button>
            </Stack>
          ) : null}

          {mode === 'recover' ? (
            <Stack gap={spacing.lg} style={styles.authForm}>
              <Input label="Trip ID" value={tripCode} onChangeText={(value) => setTripCode(value.toUpperCase())} placeholder="TB-7K9P2M" autoCapitalize="characters" />
              <Input label="Organizer email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
              <Row wrap style={styles.otpRow}>
                <Input label="OTP" value={otp} onChangeText={setOtp} keyboardType="numeric" placeholder="6-digit code" style={styles.otpInput} />
                <Button variant="secondary" onPress={() => sendOtpWithCooldown('recoverOtp', `recover:${tripCode.trim().toUpperCase()}:${normalizedEmail}`, () => startRecoverTrip({ tripCode, organizerEmail: email }), 'If the trip details match, an OTP has been sent.')} disabled={!tripCode || !email || recoverOtp.disabled} icon={<Mail size={16} color={colors.text} />}>{recoverOtp.label}</Button>
              </Row>
              <Button onPress={submitRecovery} disabled={busy || !tripCode || !email || otp.length !== 6} icon={<TicketCheck size={16} color={colors.surface} />}>{busyAction === 'recover' ? 'Recovering...' : 'Recover trip'}</Button>
            </Stack>
          ) : null}

          {message ? <AuthNotice tone={messageTone}>{message}</AuthNotice> : null}
        </Stack>
      )}
    </AppModal>
  );
}

function AuthModeTab({ label, selected, icon, onPress }: { label: string; selected: boolean; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={StyleSheet.flatten([styles.authTab, selected && styles.authTabSelected])}>
      <Row gap={spacing.xs} style={{ alignItems: 'center', justifyContent: 'center' }}>
        {icon}
        <Text style={StyleSheet.flatten([styles.authTabText, selected && styles.authTabTextSelected])}>{label}</Text>
      </Row>
    </Pressable>
  );
}

function AuthNotice({ tone, children }: { tone: 'success' | 'danger'; children: ReactNode }) {
  return (
    <View style={StyleSheet.flatten([styles.authNotice, tone === 'danger' ? styles.authNoticeDanger : styles.authNoticeSuccess])}>
      {tone === 'danger' ? <AlertCircle size={16} color={colors.danger} /> : <CheckCircle2 size={16} color={colors.success} />}
      <Text style={StyleSheet.flatten([styles.authNoticeText, tone === 'danger' ? styles.authNoticeDangerText : styles.authNoticeSuccessText])}>{children}</Text>
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
  authHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 12, backgroundColor: '#F8FBFF', padding: spacing.lg },
  authHeroIcon: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  authEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  authHeroTitle: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  authHeroText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  authAccountEmail: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900' },
  authTabs: { flexDirection: 'row', minHeight: 48, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 10, padding: spacing.xs, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  authTab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: spacing.sm },
  authTabSelected: { backgroundColor: colors.primary },
  authTabText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  authTabTextSelected: { color: colors.surface },
  authForm: { borderWidth: 1, borderColor: '#E6EEF9', borderRadius: 12, backgroundColor: colors.surface, padding: spacing.lg },
  authHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -spacing.sm },
  authActionBlock: { gap: spacing.sm },
  authTextButton: { minHeight: 40, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  authTextButtonText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  otpRow: { alignItems: 'flex-end' },
  otpInput: { minWidth: 160, flex: 1 },
  authNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: 10, padding: spacing.md },
  authNoticeSuccess: { borderColor: '#BDE7D0', backgroundColor: '#E7F6EE' },
  authNoticeDanger: { borderColor: '#F8C8C2', backgroundColor: '#FEEDEB' },
  authNoticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  authNoticeSuccessText: { color: colors.success },
  authNoticeDangerText: { color: colors.danger },
  mobileServiceBar: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#F3F7FF' },
  mobileServiceItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xxl },
  footerContainer: { paddingVertical: spacing.xl },
  footerLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  productBy: { alignItems: 'center', minHeight: 44, gap: spacing.xs },
  kreativoLogoLink: { minHeight: 44, justifyContent: 'center' },
  kreativoLogo: { width: 82, height: 40 }
});
