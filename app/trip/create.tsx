import { useRouter } from 'expo-router';
import { Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, Minus, Plus, Search, Sparkles, X } from 'lucide-react-native';
import { createElement, type CSSProperties, type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, radius, spacing } from '../../src/rn/theme';
import { Container, Heading, Row, Screen, Stack, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { generateItinerary } from '../../src/rn/services/api';
import { Pace } from '../../src/rn/types';
import { useResponsive } from '../../src/rn/useResponsive';

const preferenceChips = ['Family friendly', 'Beaches', 'Food', 'Adventure', 'History', 'Nightlife', 'Nature', 'Shopping'];
type PreferenceColors = { idleBg: string; idleBorder: string; idleText: string; activeBg: string; activeBorder: string };
const defaultPreferencePalette: PreferenceColors = { idleBg: '#ECFEFF', idleBorder: '#A5F3FC', idleText: '#0E7490', activeBg: '#06B6D4', activeBorder: '#06B6D4' };
const preferencePalette: Record<string, PreferenceColors> = {
  'Family friendly': { idleBg: '#FFF1F2', idleBorder: '#FECDD3', idleText: '#BE123C', activeBg: '#F43F5E', activeBorder: '#F43F5E' },
  Beaches: { idleBg: '#ECFEFF', idleBorder: '#A5F3FC', idleText: '#0E7490', activeBg: '#06B6D4', activeBorder: '#06B6D4' },
  Food: { idleBg: '#FFF7ED', idleBorder: '#FED7AA', idleText: '#C2410C', activeBg: colors.accent, activeBorder: colors.accent },
  Adventure: { idleBg: '#F0FDF4', idleBorder: '#BBF7D0', idleText: '#15803D', activeBg: '#22C55E', activeBorder: '#22C55E' },
  History: { idleBg: '#FFFBEB', idleBorder: '#FDE68A', idleText: '#A16207', activeBg: '#F59E0B', activeBorder: '#F59E0B' },
  Nightlife: { idleBg: '#F5F3FF', idleBorder: '#DDD6FE', idleText: '#6D28D9', activeBg: '#8B5CF6', activeBorder: '#8B5CF6' },
  Nature: { idleBg: '#ECFDF5', idleBorder: '#A7F3D0', idleText: '#047857', activeBg: '#10B981', activeBorder: '#10B981' },
  Shopping: { idleBg: '#EEF2FF', idleBorder: '#C7D2FE', idleText: '#4338CA', activeBg: colors.primary, activeBorder: colors.primary }
};
const paceOptions: Array<{ id: Pace; label: string; icon: string }> = [
  { id: 'relaxed', label: 'Relaxed', icon: '🌿' },
  { id: 'balanced', label: 'Balanced', icon: '⚖️' },
  { id: 'fast', label: 'Fast-paced', icon: '⚡' }
];

export default function PlannerRoute() {
  const router = useRouter();
  const { width } = useResponsive();
  const useWideForm = width >= 1120;
  const { plannerInput, trip, setDraft } = useTrip();
  const hasPlannerInput = Boolean(plannerInput.source || plannerInput.destination);
  const plannerInputMatchesTrip = plannerInput.source === trip.source.city && plannerInput.destination === trip.destination.city;
  const shouldPrefillTripDetails = !hasPlannerInput || plannerInputMatchesTrip;
  const [source, setSource] = useState(plannerInput.source || (shouldPrefillTripDetails ? trip.source.city : ''));
  const [destination, setDestination] = useState(plannerInput.destination || (shouldPrefillTripDetails ? trip.destination.city : ''));
  const [startDate, setStartDate] = useState(shouldPrefillTripDetails ? trip.startDate : '');
  const [days, setDays] = useState(shouldPrefillTripDetails && trip.days ? String(trip.days) : '');
  const [pace, setPace] = useState<Pace>(shouldPrefillTripDetails ? trip.pace : 'balanced');
  const [preferences, setPreferences] = useState<string[]>(shouldPrefillTripDetails ? trip.preferences : []);
  const [tripIdea, setTripIdea] = useState(plannerInput.tripVibe ?? (shouldPrefillTripDetails ? trip.tripVibe ?? '' : ''));
  const [restOpen, setRestOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [restCalendarOpen, setRestCalendarOpen] = useState(false);
  const [restDays, setRestDays] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const numericDays = Math.max(1, Number(days) || 1);
  const canGenerate = source.trim().length > 0 && destination.trim().length > 0 && startDate.trim().length > 0 && Number(days) > 0;
  const canChooseRestDays = startDate.trim().length > 0 && Number(days) > 0;
  const todayIso = toIsoDate(new Date());
  const endDate = canChooseRestDays ? computeActiveEndDate(startDate, numericDays, restDays) : '';

  function updateTripIdea(value: string) {
    setTripIdea(value);
    const matchedPreference = preferenceChips.find((pref) => pref === value.trim());
    setPreferences(matchedPreference ? [matchedPreference] : []);
  }

  function togglePref(pref: string) {
    const isSelected = preferences.includes(pref);
    setPreferences(isSelected ? [] : [pref]);
    setTripIdea(isSelected ? '' : pref);
  }

  async function generate() {
    if (!canGenerate || isGenerating) return;
    setGenerateError('');
    setIsGenerating(true);
    try {
      const activeDates = computeActiveDates(startDate, numericDays, restDays);
      const trimmedTripVibe = tripIdea.trim();
      const promptPreferences = preferences.filter((pref) => pref !== trimmedTripVibe);
      const prompt = [trimmedTripVibe, promptPreferences.join(', ')].filter(Boolean).join('. ') || `Plan a trip to ${destination}.`;
      const itinerary = await generateItinerary({
        source,
        destination,
        startDate,
        days: numericDays,
        activeDates,
        tripVibe: trimmedTripVibe || undefined,
        pace,
        prompt
      });
      setDraft({ source, destination, startDate, days: numericDays, pace, preferences, preferenceText: tripIdea, endDate, itinerary });
      router.push('/trip/itinerary');
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Unable to generate itinerary.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Screen>
      <Header />
      <ScrollView>
        <CalendarCss />
        <View style={styles.banner}>
          <View style={styles.bannerGlow} />
          <Container style={StyleSheet.flatten([styles.bannerInner, !useWideForm && styles.bannerInnerCompact])}>
            <Stack>
              <Text style={styles.eyebrow}>Trip Planner</Text>
              <Heading size="xl" style={styles.bannerTitle}>
                {source && destination ? `${source.split(',')[0]} → ${destination.split(',')[0]}` : destination ? `Planning your trip to ${destination.split(',')[0]}` : 'Plan your trip'}
              </Heading>
              <Text style={styles.bannerText}>Fill in the details below - we'll build an itinerary you can customize.</Text>
            </Stack>
            {canGenerate ? (
              <View style={styles.bannerPill}><CalendarDays size={16} color={colors.accent} /><Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>{numericDays}-day trip · {formatShortDate(startDate)} - {formatShortDate(endDate)}</Text></View>
            ) : null}
          </Container>
        </View>

        <PlannerContentScope>
          <Container>
            <View style={styles.formCard}>
              <View style={styles.formAccentBar} />
              <View style={StyleSheet.flatten([styles.formBody, width < 760 && styles.formBodyCompact])}>
              <Stack gap={spacing.xl}>
                <Stack gap={spacing.lg} style={StyleSheet.flatten([styles.colorPanelBlue, calendarOpen && styles.calendarOpenLayer])}>
                  <SectionTitle color={colors.primary}>Origin &amp; Dates</SectionTitle>
                <Row style={{ flexDirection: useWideForm ? 'row' : 'column' }}>
                  <PlannerInput icon={<Search size={16} color={colors.primary} />} label="Leaving from" value={source} onChangeText={setSource} placeholder="City or airport" />
                  <PlannerInput icon={<MapPin size={16} color={colors.accent} />} label="Destination" value={destination} onChangeText={setDestination} placeholder="Where to?" />
                  <Stack gap={spacing.xs} style={styles.datePickerField}>
                    <Text style={styles.inputLabel}>Start date</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Start date" onPress={() => setCalendarOpen((value) => !value)} style={styles.inputShell}>
                      <Calendar size={16} color={colors.cyan} />
                      <Text style={StyleSheet.flatten([styles.dateValue, !startDate && styles.placeholderText])}>{startDate || 'Select date'}</Text>
                    </Pressable>
                    {calendarOpen ? (
                      <CalendarPopover placement="start">
                        <MiniCalendar selected={startDate} minDate={todayIso} onSelect={(value) => { setStartDate(value); setCalendarOpen(false); setRestDays([]); }} />
                      </CalendarPopover>
                    ) : null}
                  </Stack>
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Number of days</Text>
                    <Row gap={0} style={styles.stepper}>
                      <Pressable style={styles.stepperButton} onPress={() => { setDays(String(Math.max(1, numericDays - 1))); setRestDays([]); }}><Minus size={16} color={colors.muted} /></Pressable>
                      <TextInput accessibilityLabel="Number of days" value={days} onChangeText={(value) => { setDays(value); setRestDays([]); }} keyboardType="numeric" placeholder="7" placeholderTextColor="rgba(90,100,128,0.5)" style={styles.stepperInput} />
                      <Pressable style={styles.stepperButton} onPress={() => { setDays(String(numericDays + 1)); setRestDays([]); }}><Plus size={16} color={colors.muted} /></Pressable>
                    </Row>
                  </Stack>
                </Row>
                </Stack>

                <View style={styles.rule} />

                <Stack gap={spacing.md} style={styles.colorPanelOrange}>
                  <SectionTitle color={colors.accent}>Travel pace</SectionTitle>
                  <View style={styles.segmented}>
                    {paceOptions.map((option) => {
                      const selected = pace === option.id;
                      return (
                        <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPace(option.id)} style={StyleSheet.flatten([styles.segment, selected && styles.segmentSelected])}>
                          <Text style={StyleSheet.flatten([styles.segmentText, selected && styles.segmentTextSelected])}>{option.icon} {option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Stack>

                <View style={styles.rule} />

                <Row style={{ flexDirection: useWideForm ? 'row' : 'column', alignItems: 'stretch' }}>
                  <Stack style={StyleSheet.flatten([styles.colorPanelViolet, useWideForm ? { flex: 1 } : styles.fullWidth])} gap={spacing.md}>
                    <Row style={{ alignItems: 'center' }}><SectionTitle color="#A78BFA">Trip vibe</SectionTitle><Text style={styles.optional}>Optional</Text></Row>
                    <TextInput accessibilityLabel="Trip vibe" value={tripIdea} onChangeText={updateTripIdea} multiline placeholder="Describe your ideal trip - beaches, street food, temples, photography spots..." placeholderTextColor="rgba(90,100,128,0.5)" style={styles.textArea} />
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Or pick your interests:</Text>
                  <View style={styles.prefGrid}>
                    {preferenceChips.map((pref) => {
                      const selected = preferences.includes(pref);
                      const palette = preferencePalette[pref] ?? defaultPreferencePalette;
                      return (
                        <Pressable
                          key={pref}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => togglePref(pref)}
                          style={StyleSheet.flatten([
                            styles.prefChip,
                            { backgroundColor: palette.idleBg, borderColor: palette.idleBorder },
                            selected && { backgroundColor: palette.activeBg, borderColor: palette.activeBorder }
                          ])}
                        >
                          {selected ? <Check size={12} color={colors.surface} /> : null}
                          <Text style={StyleSheet.flatten([styles.prefText, { color: palette.idleText }, selected && styles.prefTextSelected])}>{pref}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Stack>
                <Stack style={StyleSheet.flatten([styles.colorPanelCyan, useWideForm ? { flex: 1 } : styles.fullWidth])} gap={spacing.md}>
                  <Pressable onPress={() => setRestOpen((value) => !value)} style={styles.restHeader}>
                    <SectionTitle color={colors.cyan}>Rest / inactive days</SectionTitle>
                    <ChevronRight size={14} color={colors.muted} style={StyleSheet.flatten([restOpen && styles.rotated])} />
                    <Text style={styles.optional}>Optional</Text>
                  </Pressable>
                  {restOpen ? (
                    <View style={styles.restBox}>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>Rest days extend your end date - they don't count as active days.</Text>
                      <View style={styles.restCalendarAnchor}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: !canChooseRestDays }}
                          disabled={!canChooseRestDays}
                          onPress={() => setRestCalendarOpen((value) => !value)}
                          style={StyleSheet.flatten([styles.secondaryButton, !canChooseRestDays && styles.secondaryButtonDisabled])}
                        >
                          <Calendar size={16} color={canChooseRestDays ? colors.text : 'rgba(90,100,128,0.35)'} />
                          <Text style={StyleSheet.flatten([styles.secondaryButtonText, !canChooseRestDays && { color: 'rgba(90,100,128,0.45)' }])}>Select rest days</Text>
                        </Pressable>
                        {canChooseRestDays && restCalendarOpen ? (
                          <CalendarPopover placement="rest">
                            <MiniCalendar
                              selected={restDays}
                              minDate={startDate}
                              maxDate={endDate}
                              multiSelect
                              onSelect={(value) => setRestDays((current) => current.includes(value) ? current.filter((date) => date !== value) : [...current, value].sort())}
                            />
                          </CalendarPopover>
                        ) : null}
                      </View>
                      {!canChooseRestDays ? <Text style={styles.restHelper}>Set date &amp; duration first</Text> : null}
                      {canChooseRestDays ? (
                        <Text style={styles.restHelper}>
                          {numericDays} active days{restDays.length > 0 ? ` + ${restDays.length} rest days = ends ${formatShortDate(endDate)}` : ''}
                        </Text>
                      ) : null}
                      {restDays.length > 0 ? (
                        <Row wrap>
                          {restDays.map((date) => (
                            <Pressable key={date} onPress={() => setRestDays((current) => current.filter((item) => item !== date))} style={styles.restToken}>
                              <Text style={{ color: colors.muted, fontSize: 12 }}>{formatShortDate(date)}</Text>
                              <X size={12} color={colors.muted} />
                            </Pressable>
                          ))}
                        </Row>
                      ) : (
                        <View style={styles.restToken}>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>No rest days selected</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={{ color: colors.muted, fontSize: 13 }}>All days active - click to add rest days.</Text>
                  )}
                </Stack>
              </Row>
              </Stack>
              </View>
              <View style={styles.ctaBar}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                {canGenerate ? <>Ready! Building <Text style={{ fontWeight: '800' }}>{numericDays} active days</Text> for <Text style={{ fontWeight: '800' }}>{destination || 'your destination'}</Text>, ending {formatShortDate(endDate)}.</> : 'Fill in the required fields above to get started.'}
              </Text>
              {generateError ? <Text style={styles.errorText}>{generateError}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canGenerate || isGenerating }} onPress={generate} style={StyleSheet.flatten([styles.generateButton, width < 760 && styles.generateButtonCompact, (!canGenerate || isGenerating) && styles.generateDisabled])}>
                <Sparkles size={16} color={canGenerate && !isGenerating ? colors.surface : 'rgba(90,100,128,0.5)'} />
                <Text style={StyleSheet.flatten([styles.generateText, (!canGenerate || isGenerating) && styles.generateTextDisabled])}>{isGenerating ? 'Generating...' : 'Generate itinerary'}</Text>
              </Pressable>
              </View>
            </View>
          </Container>
        </PlannerContentScope>
        <Footer />
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Row gap={spacing.sm} style={{ alignItems: 'center' }}>
      <View style={StyleSheet.flatten([styles.dot, { backgroundColor: color }])} />
      <Text style={styles.sectionLabel}>{children}</Text>
    </Row>
  );
}

function PlannerInput({ icon, label, value, onChangeText, placeholder }: { icon: ReactNode; label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <Stack gap={spacing.xs} style={{ flex: 1 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputShell}>
        {icon}
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(90,100,128,0.5)" style={styles.inputText} />
      </View>
    </Stack>
  );
}

function CalendarPopover({ children, placement }: { children: ReactNode; placement: 'start' | 'rest' }) {
  return createElement('div', { className: 'tripbuddy-calendar-popover', style: placement === 'start' ? webStyles.startCalendarPopover : webStyles.restCalendarPopover }, children);
}

function PlannerContentScope({ children }: { children: ReactNode }) {
  return createElement('div', { className: 'tripbuddy-planner-content', style: webStyles.plannerContentScope }, children);
}

function CalendarCss() {
  return createElement('style', {
    dangerouslySetInnerHTML: {
      __html: `
        .tripbuddy-calendar-popover,
        .tripbuddy-calendar-panel {
          opacity: 1 !important;
          background: #FFFFFF !important;
          isolation: isolate;
        }

        .tripbuddy-calendar-popover {
          z-index: 2147483000 !important;
          pointer-events: auto !important;
        }

        .tripbuddy-calendar-popover {
          z-index: 2147483000 !important;
        }

        .tripbuddy-planner-content .css-175oi2r {
          z-index: auto !important;
        }

        .tripbuddy-planner-content > .css-175oi2r {
          margin-left: auto !important;
          margin-right: auto !important;
        }
      `
    }
  });
}

function MiniCalendar({
  selected,
  minDate,
  maxDate,
  multiSelect,
  onSelect
}: {
  selected: string | string[];
  minDate?: string;
  maxDate?: string;
  multiSelect?: boolean;
  onSelect: (date: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const firstSelected = Array.isArray(selected) ? selected[0] : selected;
    const date = firstSelected ? new Date(`${firstSelected}T00:00:00`) : minDate ? new Date(`${minDate}T00:00:00`) : new Date();
    date.setDate(1);
    return date;
  });
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = viewDate.getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `empty-${index}`, day: 0 })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 }))
  ];

  function moveMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function selectDay(day: number) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const iso = toIsoDate(date);
    if (isDateDisabled(iso, minDate, maxDate)) return;
    onSelect(iso);
  }

  return (
    <CalendarPanel>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={styles.calendarNav}><ChevronLeft size={16} color={colors.text} /></Pressable>
        <Text style={styles.calendarMonth}>{monthLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={styles.calendarNav}><ChevronRight size={16} color={colors.text} /></Pressable>
      </Row>
      <View style={styles.weekGrid}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <Text key={day} style={styles.weekLabel}>{day}</Text>)}
        {cells.map(({ key, day }) => {
          const iso = day ? toIsoDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)) : '';
          const isSelected = Array.isArray(selected) ? selected.includes(iso) : iso === selected;
          const disabled = day ? isDateDisabled(iso, minDate, maxDate) : false;
          return day ? (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${multiSelect && isSelected ? 'Remove' : 'Select'} ${iso}`}
              accessibilityState={{ disabled, selected: isSelected }}
              disabled={disabled}
              onPress={() => selectDay(day)}
              style={StyleSheet.flatten([styles.dayCell, disabled && styles.dayCellDisabled, isSelected && styles.dayCellSelected])}
            >
              <Text style={StyleSheet.flatten([styles.dayText, disabled && styles.dayTextDisabled, isSelected && styles.dayTextSelected])}>{day}</Text>
            </Pressable>
          ) : (
            <View key={key} style={styles.dayCell} />
          );
        })}
      </View>
    </CalendarPanel>
  );
}

function CalendarPanel({ children }: { children: ReactNode }) {
  return createElement('div', { className: 'tripbuddy-calendar-panel', style: webStyles.calendarPanel }, children);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

function computeActiveEndDate(startDate: string, activeDays: number, restDates: string[]) {
  const activeDates = computeActiveDates(startDate, activeDays, restDates);
  return activeDates.at(-1) ?? startDate;
}

function computeActiveDates(startDate: string, activeDays: number, restDates: string[]) {
  const restDateSet = new Set(restDates);
  const current = new Date(`${startDate}T00:00:00`);
  let countedActiveDays = 0;
  const activeDates: string[] = [];

  while (countedActiveDays < activeDays) {
    const iso = toIsoDate(current);
    if (!restDateSet.has(iso)) {
      activeDates.push(iso);
      countedActiveDays += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return activeDates;
}

function isDateDisabled(value: string, minDate?: string, maxDate?: string) {
  if (minDate && value < minDate) return true;
  if (maxDate && value > maxDate) return true;
  return false;
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const webStyles: Record<'plannerContentScope' | 'startCalendarPopover' | 'restCalendarPopover' | 'calendarPanel', CSSProperties> = {
  plannerContentScope: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    width: '100%'
  },
  startCalendarPopover: {
    position: 'absolute',
    top: 74,
    left: 0,
    zIndex: 1000
  },
  restCalendarPopover: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    zIndex: 1000
  },
  calendarPanel: {
    width: 304,
    padding: spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    opacity: 1,
    boxShadow: '0 18px 45px rgba(9,33,65,0.18)'
  }
};

const styles = StyleSheet.create({
  banner: { position: 'relative', backgroundImage: 'linear-gradient(135deg, #092141 0%, #17438D 48%, #2575F1 78%, #5EC8DF 100%)' as never, overflow: 'hidden' },
  bannerGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.22, backgroundImage: 'radial-gradient(circle at 76% 18%, rgba(248,105,30,0.82) 0%, rgba(248,105,30,0.28) 28%, transparent 56%)' as never },
  bannerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.xl, paddingVertical: 44 },
  bannerInnerCompact: { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 32 },
  eyebrow: { color: colors.cyan, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  bannerTitle: { color: colors.surface, fontSize: 38, lineHeight: 46 },
  bannerText: { color: 'rgba(255,255,255,0.78)', fontSize: 14 },
  bannerPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(9,33,65,0.34)' },
  formCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(37,117,241,0.18)', overflow: 'visible', shadowColor: '#1A5F72', shadowOpacity: 0.1, shadowRadius: 26, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  formAccentBar: { height: 6, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundImage: 'linear-gradient(90deg, #2575F1 0%, #5EC8DF 34%, #F8691E 68%, #8B5CF6 100%)' as never },
  formBody: { padding: spacing.xxl },
  formBodyCompact: { padding: spacing.lg },
  colorPanelBlue: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #F8FBFF 0%, #EBF2FE 100%)' as never, padding: spacing.lg },
  calendarOpenLayer: { position: 'relative', zIndex: 10 },
  colorPanelOrange: { borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #FFF7ED 0%, #FEF0EB 100%)' as never, padding: spacing.lg },
  colorPanelViolet: { borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #FBF9FF 0%, #F5F3FF 100%)' as never, padding: spacing.lg },
  colorPanelCyan: { borderWidth: 1, borderColor: '#A5F3FC', borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #F8FEFF 0%, #ECFEFF 100%)' as never, padding: spacing.lg },
  fullWidth: { width: '100%' },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary },
  sectionLabel: { color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12, fontWeight: '900' },
  optional: { color: colors.muted, backgroundColor: colors.surfaceMuted, borderRadius: 999, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: 12 },
  inputLabel: { fontSize: 14, fontWeight: '700' },
  datePickerField: { flex: 1, position: 'relative', zIndex: 1200 },
  inputShell: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: 'rgba(37,117,241,0.18)', borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14 },
  inputText: { flex: 1, minHeight: 42, color: colors.text, paddingHorizontal: spacing.sm, fontSize: 14, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  dateValue: { flex: 1, color: colors.text, fontSize: 14 },
  placeholderText: { color: 'rgba(90,100,128,0.5)' },
  calendarNav: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  calendarMonth: { fontWeight: '800', fontSize: 14 },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekLabel: { width: 36, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '800' },
  dayCell: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dayCellDisabled: { opacity: 0.38 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, fontWeight: '700' },
  dayTextDisabled: { color: colors.muted },
  dayTextSelected: { color: colors.surface },
  stepper: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  stepperButton: { width: 44, minWidth: 44, flexShrink: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepperInput: { flex: 1, minWidth: 0, minHeight: 44, textAlign: 'center', color: colors.text, paddingHorizontal: spacing.sm, fontSize: 14, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  rule: { height: 1, backgroundColor: colors.border },
  segmented: { alignSelf: 'flex-start', flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(248,105,30,0.22)', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.62)', padding: spacing.xs, gap: spacing.xs },
  segment: { minHeight: 38, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#FDBA74', shadowColor: '#F8691E', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  segmentTextSelected: { color: colors.text },
  textArea: { minHeight: 76, borderWidth: 1, borderColor: '#DDD6FE', borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, paddingVertical: spacing.md, textAlignVertical: 'top', fontSize: 14, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" },
  prefGrid: { display: 'grid' as never, gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))' as never, gap: spacing.sm },
  prefChip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md },
  prefText: { fontSize: 12, fontWeight: '800' },
  prefTextSelected: { color: colors.surface },
  restHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rotated: { transform: [{ rotate: '90deg' }] },
  restBox: { gap: spacing.md },
  restCalendarAnchor: { position: 'relative', alignSelf: 'flex-start', zIndex: 1200 },
  secondaryButton: { alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 14, borderWidth: 1, borderColor: '#A5F3FC', borderRadius: radius.md, backgroundColor: colors.surface },
  secondaryButtonText: { fontWeight: '400' },
  secondaryButtonDisabled: { borderColor: 'rgba(37,117,241,0.08)', backgroundColor: colors.surfaceMuted },
  restHelper: { color: colors.muted, fontSize: 12 },
  restToken: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#A5F3FC', borderRadius: 999, backgroundColor: '#ECFEFF', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  errorText: { color: colors.danger, fontSize: 13, flexShrink: 1 },
  ctaBar: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'space-between', alignItems: 'center', backgroundImage: 'linear-gradient(90deg, rgba(37,117,241,0.08), rgba(94,200,223,0.1), rgba(248,105,30,0.08))' as never },
  generateButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl, borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #F8691E 0%, #FF8C42 100%)' as never },
  generateButtonCompact: { width: '100%' },
  generateDisabled: { backgroundImage: undefined as never, backgroundColor: colors.surfaceMuted },
  generateText: { color: colors.surface, fontWeight: '800', fontSize: 14 },
  generateTextDisabled: { color: 'rgba(90,100,128,0.5)' }
});
