import { createElement, ReactNode } from 'react';
import { Image, ImageSourcePropType, ImageStyle, Modal as RNModal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text as RNText, TextInput, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, radius, shadow, spacing } from './theme';
import { useResponsive } from './useResponsive';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}><GlobalWebStyles />{children}</View>;
}

function GlobalWebStyles() {
  if (Platform.OS !== 'web') return null;
  return createElement('style', {
    dangerouslySetInnerHTML: {
      __html: `
        input,
        textarea {
          padding-left: 12px;
          padding-right: 12px;
        }
      `
    }
  });
}

export function Container({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={StyleSheet.flatten([styles.container, style])}>{children}</View>;
}

export function Stack({ children, gap = spacing.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={StyleSheet.flatten([{ gap }, style])}>{children}</View>;
}

export function Row({ children, gap = spacing.md, wrap, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={StyleSheet.flatten([styles.row, { gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style])}>{children}</View>;
}

export function Text({ children, style, numberOfLines, ellipsizeMode }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: TextProps['numberOfLines']; ellipsizeMode?: TextProps['ellipsizeMode'] }) {
  return <RNText numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode} style={StyleSheet.flatten([styles.text, style])}>{children}</RNText>;
}

export function Heading({ children, size = 'lg', style, numberOfLines, ellipsizeMode }: { children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; style?: StyleProp<TextStyle>; numberOfLines?: TextProps['numberOfLines']; ellipsizeMode?: TextProps['ellipsizeMode'] }) {
  return <RNText numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode} style={StyleSheet.flatten([styles.heading, headingSizes[size], style])}>{children}</RNText>;
}

export function Card({ children, selected, style }: { children: ReactNode; selected?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={StyleSheet.flatten([styles.card, selected && styles.selectedCard, style])}>{children}</View>;
}

export function Button({ children, onPress, variant = 'primary', icon, style, disabled }: { children: ReactNode; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => StyleSheet.flatten([styles.button, buttonStyles[variant], disabled && styles.disabledButton, pressed && styles.pressed, style])}>
      <Row gap={spacing.sm} style={{ alignItems: 'center', justifyContent: 'center' }}>
        {icon}
        <RNText style={StyleSheet.flatten([styles.buttonText, variant !== 'primary' && { color: buttonTextColors[variant] }, disabled && styles.disabledButtonText])}>{children}</RNText>
      </Row>
    </Pressable>
  );
}

export function Input({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline, style, secureTextEntry, autoCapitalize }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'email-address'; multiline?: boolean; style?: StyleProp<ViewStyle>; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) {
  return (
    <Stack gap={spacing.xs} style={style}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(90,100,128,0.5)"
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={StyleSheet.flatten([styles.input, multiline && styles.textarea])}
      />
    </Stack>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={StyleSheet.flatten([styles.chip, selected && styles.selectedChip])}>
      <Text style={StyleSheet.flatten([styles.chipText, selected && styles.selectedChipText])}>{label}</Text>
    </Pressable>
  );
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) {
  return <RNText style={StyleSheet.flatten([styles.status, statusTones[tone]])}>{children}</RNText>;
}

export function AppModal({ visible, title, children, onClose }: { visible: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const { isMobile } = useResponsive();
  return (
    <RNModal transparent visible={visible} animationType={isMobile ? 'slide' : 'fade'} onRequestClose={onClose}>
      <View style={StyleSheet.flatten([styles.modalOverlay, isMobile && styles.mobileModalOverlay])}>
        <View style={StyleSheet.flatten([styles.modalPanel, isMobile && styles.mobileModalPanel])}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading size="md">{title}</Heading>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.iconButton}>
              <X size={22} color={colors.text} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ gap: spacing.lg }}>{children}</ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

export function Logo({ style }: { style?: StyleProp<ImageStyle> }) {
  return <Image source={require('../imports/tripbuddylogo.svg') as ImageSourcePropType} resizeMode="contain" style={StyleSheet.flatten([styles.logo, style])} />;
}

const headingSizes = StyleSheet.create({
  sm: { fontSize: 18, lineHeight: 24 },
  md: { fontSize: 22, lineHeight: 30 },
  lg: { fontSize: 30, lineHeight: 38 },
  xl: { fontSize: 44, lineHeight: 54 }
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.surface, borderColor: colors.danger }
});

const buttonTextColors = {
  primary: colors.surface,
  secondary: colors.text,
  ghost: colors.primary,
  danger: colors.danger
};

const statusTones = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.muted, borderColor: colors.border },
  success: { backgroundColor: '#E7F6EE', color: colors.success, borderColor: '#BDE7D0' },
  warning: { backgroundColor: '#FFF7D6', color: colors.warning, borderColor: '#FDE68A' },
  danger: { backgroundColor: '#FEEDEB', color: colors.danger, borderColor: '#F8C8C2' },
  primary: { backgroundColor: '#EBF2FE', color: colors.primary, borderColor: 'rgba(37,117,241,0.2)' }
});

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: '100%', backgroundColor: colors.background },
  container: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  row: { flexDirection: 'row' },
  text: { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  heading: { color: colors.text, fontWeight: '800', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  label: { fontSize: 14, color: colors.text, fontWeight: '700', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, ...shadow.card },
  selectedCard: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#F4F8FF' },
  button: { minHeight: 44, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.surface, fontWeight: '800', fontSize: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  disabledButton: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: 0.72 },
  disabledButtonText: { color: 'rgba(90,100,128,0.68)' },
  pressed: { opacity: 0.78 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, fontSize: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  textarea: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' },
  chip: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  selectedChipText: { color: colors.surface },
  status: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: 12, fontWeight: '800' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(0,0,0,0.38)' },
  mobileModalOverlay: { justifyContent: 'flex-end', padding: 0 },
  modalPanel: { width: '100%', maxWidth: 620, maxHeight: '88%', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg },
  mobileModalPanel: { maxWidth: '100%', maxHeight: '92%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  logo: { width: 228, height: 64 }
});
