import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarDays, Check, Clock, Edit3, GripVertical, Info, Lock, MapPin, Moon, Plus, RotateCcw, Sparkles, Star, Trash2, Unlock, Utensils } from 'lucide-react-native';
import { createElement, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Footer, Header } from '../../src/rn/chrome';
import { colors, radius, shadow, spacing } from '../../src/rn/theme';
import { AppModal, Button, Card, Container, Heading, Input, PageScroll, Row, Screen, Stack, StatusPill, Text } from '../../src/rn/ui';
import { useTrip } from '../../src/rn/state/tripStore';
import { addItineraryPlace, CachedItineraryPlace, cleanPlaceDescription, compactItineraryDay, fetchRemainingItineraryPlaces, moveItineraryPlace, rescheduleItineraryDay } from '../../src/rn/services/api';
import { fetchDrivingLeg } from '../../src/rn/services/osrm';
import { Activity, DayPlan, StayBooking, TransportBooking, TravelLeg, Trip } from '../../src/rn/types';
import { useResponsive } from '../../src/rn/useResponsive';

const paceLabel = { relaxed: 'Relaxed', balanced: 'Balanced', fast: 'Fast-paced' };
const paceIcon = { relaxed: '🌿', balanced: '⚖️', fast: '⚡' };
const MIN_VIBE_MATCHED_PLACES = 2;
const MAX_UNDO_SNAPSHOTS = 20;
const UNDO_STORAGE_KEY = 'tripbuddy.itineraryUndo.v1';

type UndoSnapshot = {
  label: string;
  savedAt: number;
  tripKey: string;
  itinerary: DayPlan[];
};

type AddStopState = {
  dayId: string;
  insertIndex: number;
};

type EditDurationState = {
  dayId: string;
  activity: Activity;
};

type CompactPromptState = {
  dayIndex: number;
  message: string;
};

type DragSource = {
  dayIndex: number;
  activityIndex: number;
  activityId: string;
};

type DropTarget = {
  dayIndex: number;
  insertIndex: number;
};

type MoveStartState = {
  source: DragSource;
  targetDayIndex: number;
  insertIndex: number;
};

type WarningState = {
  title: string;
  message: string;
};

export default function ItineraryRoute() {
  const router = useRouter();
  const { trip, updateItinerary, startNewTrip } = useTrip();
  const { isDesktop, isMobile } = useResponsive();
  const [selectedDay, setSelectedDay] = useState(trip.itinerary[0]?.id ?? '');
  const [detailsActivity, setDetailsActivity] = useState<Activity | undefined>();
  const [drivingLegs, setDrivingLegs] = useState<Record<string, TravelLeg>>({});
  const [routingNotice, setRoutingNotice] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>(() => loadUndoStack(trip));
  const [addStop, setAddStop] = useState<AddStopState | undefined>();
  const [editDuration, setEditDuration] = useState<EditDurationState | undefined>();
  const [movingActivityId, setMovingActivityId] = useState('');
  const [customizationError, setCustomizationError] = useState('');
  const [compactPrompt, setCompactPrompt] = useState<CompactPromptState | undefined>();
  const [compactingDayIndex, setCompactingDayIndex] = useState<number | undefined>();
  const [dragSource, setDragSource] = useState<DragSource | undefined>();
  const dragSourceRef = useRef<DragSource | undefined>();
  const dropTargetRef = useRef<DropTarget | undefined>();
  const dropHandledRef = useRef(false);
  const [moveStart, setMoveStart] = useState<MoveStartState | undefined>();
  const [warning, setWarning] = useState<WarningState | undefined>();
  const day = trip.itinerary.find((item) => item.id === selectedDay) ?? trip.itinerary[0];
  const displayedDay = useMemo(() => day ? dayWithResolvedTravelTiming(day, drivingLegs) : undefined, [day, drivingLegs]);
  const tripVibe = trip.tripVibe?.trim() ?? '';
  const hasFewVibeMatches = Boolean(tripVibe && day && !day.restDay && day.activities.length < MIN_VIBE_MATCHED_PLACES);
  const hasBookingProgress = [...trip.transportBookings, ...trip.stayBookings].some(hasBookingEvidence);
  const bookingCtaLabel = hasBookingProgress ? 'Review bookings' : 'Continue to booking';
  const selectedDayIndex = useMemo(() => trip.itinerary.findIndex((item) => item.id === day?.id), [day?.id, trip.itinerary]);
  const moveStartActivity = moveStart ? trip.itinerary[moveStart.source.dayIndex]?.activities[moveStart.source.activityIndex] : undefined;

  const commitItinerary = (nextItinerary: DayPlan[], label: string) => {
    setUndoStack((current) => [{ label, savedAt: Date.now(), tripKey: itineraryTripKey(trip), itinerary: cloneItinerary(trip.itinerary) }, ...current].slice(0, MAX_UNDO_SNAPSHOTS));
    updateItinerary(nextItinerary);
  };

  const undoCustomization = () => {
    const [snapshot, ...rest] = undoStack;
    if (!snapshot) return;
    setUndoStack(rest);
    updateItinerary(snapshot.itinerary);
  };

  const undoAllCustomizations = () => {
    const snapshot = undoStack.at(-1);
    if (!snapshot) return;
    setUndoStack([]);
    updateItinerary(snapshot.itinerary);
  };

  useEffect(() => {
    if (!trip.itinerary.length) return;
    if (trip.itinerary.some((item) => item.id === selectedDay)) return;
    setSelectedDay(trip.itinerary[0]?.id ?? '');
  }, [selectedDay, trip.itinerary]);

  useEffect(() => {
    saveUndoStack(undoStack, trip);
  }, [undoStack]);

  useEffect(() => {
    setUndoStack(loadUndoStack(trip));
  }, [trip.destination.city, trip.startDate, trip.days]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dragSource || typeof document === 'undefined') return;
    let frame = 0;
    let velocity = 0;
    let scrollContainer: HTMLElement | undefined;
    const runAutoScroll = () => {
      if (!velocity || !scrollContainer) {
        frame = 0;
        return;
      }
      scrollContainer.scrollTop += velocity;
      frame = window.requestAnimationFrame(runAutoScroll);
    };
    const autoScroll = (event: DragEvent | PointerEvent) => {
      if (event instanceof DragEvent) {
        const inferredTarget = touchDropTargetAtPoint(event.clientX, event.clientY, dragSource.dayIndex);
        if (inferredTarget) dropTargetRef.current = inferredTarget;
      }
      scrollContainer = nearestScrollableElement(event.target);
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const edge = Math.min(110, Math.max(64, (visibleBottom - visibleTop) * 0.18));
      const topDistance = event.clientY - visibleTop;
      const bottomDistance = visibleBottom - event.clientY;
      if (topDistance >= 0 && topDistance < edge) velocity = -Math.ceil(5 + ((edge - topDistance) / edge) * 24);
      else if (bottomDistance >= 0 && bottomDistance < edge) velocity = Math.ceil(5 + ((edge - bottomDistance) / edge) * 24);
      else velocity = 0;
      if (velocity && !frame) frame = window.requestAnimationFrame(runAutoScroll);
    };
    document.addEventListener('dragover', autoScroll);
    document.addEventListener('pointermove', autoScroll);
    return () => {
      document.removeEventListener('dragover', autoScroll);
      document.removeEventListener('pointermove', autoScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [dragSource]);

  useEffect(() => {
    const controller = new AbortController();
    setDrivingLegs({});
    setRoutingNotice('');

    void resolveMissingDrivingLegs(trip.itinerary, controller.signal, (activityId, leg) => {
      setDrivingLegs((current) => ({ ...current, [activityId]: leg }));
      setRoutingNotice('');
    }, () => {
      setRoutingNotice("We're experiencing unusual traffic on our routing server. Kindly wait while we retry.");
    });

    return () => controller.abort();
  }, [trip.itinerary]);

  const addActivity = async (state: AddStopState, place: CachedItineraryPlace, durationMinutes: number, startTime?: string) => {
    setCustomizationError('');
    const dayIndex = trip.itinerary.findIndex((item) => item.id === state.dayId);
    const currentDay = trip.itinerary[dayIndex];
    if (!currentDay || currentDay.activities.some((activity) => !activity.placeId)) {
      throw new Error('This itinerary is missing backend place IDs. Regenerate it before adding places.');
    }
    const result = await addItineraryPlace({
      trip,
      dayIndex,
      insertIndex: state.insertIndex,
      placeId: place.id,
      placeIds: currentDay.activities.map((activity) => activity.placeId!),
      insertedVisitDurationMinutes: ceilMinutes(durationMinutes, 5),
      ...(startTime ? { insertedPlaceStartTime: startTime } : {}),
      ...(state.insertIndex === 0 && !startTime && currentDay.activities[0]?.startTime ? { firstActivityStartTime: currentDay.activities[0].startTime } : {}),
      durationOverrides: itineraryDurationOverrides(trip.itinerary)
    });
    const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
    const next = trip.itinerary.map((item, index) => index === dayIndex
      ? mergeEditedDay(item, result.day, trip.itinerary, `${place.name} added and validated.${warning}`)
      : item);
    commitItinerary(next, 'Place added');
    setSelectedDay(state.dayId);
  };

  const updateActivityTiming = async (dayId: string, activityId: string, durationMinutesInput: number) => {
    setCustomizationError('');
    const dayIndex = trip.itinerary.findIndex((item) => item.id === dayId);
    const currentDay = trip.itinerary[dayIndex];
    const activityIndex = currentDay?.activities.findIndex((activity) => activity.id === activityId) ?? -1;
    const activity = currentDay?.activities[activityIndex];
    if (!currentDay || !activity?.placeId || currentDay.activities.some((item) => !item.placeId)) {
      throw new Error('This activity is missing a backend place ID. Regenerate the itinerary before changing its duration.');
    }
    const durationMinutes = ceilMinutes(durationMinutesInput, 5);
    const durationOverrides = itineraryDurationOverrides(trip.itinerary);
    durationOverrides[activity.placeId] = durationMinutes;
    const fixedStartTimes = Object.fromEntries(currentDay.activities.slice(0, activityIndex + 1).map((item) => [item.placeId!, item.startTime]));
    const result = await rescheduleItineraryDay({
      trip,
      dayIndex,
      placeIds: currentDay.activities.map((item) => item.placeId!),
      durationOverrides,
      fixedStartTimes
    });
    const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
    const next = trip.itinerary.map((item, index) => index === dayIndex
      ? mergeEditedDay(item, result.day, trip.itinerary, `${activity.name} set to ${durationMinutes} mins and timings adjusted.${warning}`)
      : item);
    commitItinerary(next, 'Visit duration updated');
    setEditDuration(undefined);
    setCompactPrompt({ dayIndex, message: `${activity.name} was updated. Compact and reshuffle this day?` });
  };

  const removeActivity = (dayId: string, activityId: string) => {
    setCustomizationError('');
    const dayIndex = trip.itinerary.findIndex((item) => item.id === dayId);
    const dayToEdit = trip.itinerary.find((item) => item.id === dayId);
    const removed = dayToEdit?.activities.find((activity) => activity.id === activityId);
    if (removed?.locked) return;
    const next = trip.itinerary.map((item) => item.id === dayId ? dayWithActivities(item, item.activities.filter((activity) => activity.id !== activityId), `${removed?.name ?? 'Place'} removed.`) : item);
    commitItinerary(next, 'Place removed');
    setCompactPrompt({ dayIndex, message: `${removed?.name ?? 'Place'} was removed. Compact and reshuffle this day?` });
  };

  const compactDay = async (dayIndex: number) => {
    const currentDay = trip.itinerary[dayIndex];
    if (!currentDay?.activities.length) {
      setCompactPrompt(undefined);
      return;
    }
    if (currentDay.activities.some((activity) => !activity.placeId)) {
      setCustomizationError('This day is missing backend place IDs and cannot be compacted.');
      setCompactPrompt(undefined);
      return;
    }
    setCompactingDayIndex(dayIndex);
    setCustomizationError('');
    try {
      const result = await compactItineraryDay({
        trip,
        dayIndex,
        placeIds: currentDay.activities.map((activity) => activity.placeId!),
        durationOverrides: itineraryDurationOverrides(trip.itinerary)
      });
      const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
      const next = trip.itinerary.map((item, index) => index === dayIndex
        ? mergeEditedDay(item, result.day, trip.itinerary, `Day compacted and validated.${warning}`)
        : item);
      commitItinerary(next, 'Day compacted');
    } catch (error) {
      setCustomizationError(error instanceof Error ? error.message : 'Could not compact this day.');
    } finally {
      setCompactingDayIndex(undefined);
      setCompactPrompt(undefined);
    }
  };

  const toggleActivityLock = (dayId: string, activityId: string) => {
    const next = trip.itinerary.map((item) => {
      if (item.id !== dayId) return item;
      const activities = item.activities.map((activity) => activity.id === activityId ? { ...activity, locked: !activity.locked } : activity);
      const edited = activities.find((activity) => activity.id === activityId);
      return { ...item, activities, editNotice: edited?.locked ? `${edited.name} locked in place.` : `${edited?.name ?? 'Place'} unlocked.` };
    });
    commitItinerary(next, 'Lock changed');
  };

  const moveActivity = async (sourceDayIndex: number, activityIndex: number, targetDayIndex: number, insertIndex: number, startChoice?: { movedPlaceStartTime?: string; targetFirstActivityStartTime?: string }) => {
    if (movingActivityId) return;
    const sourceDay = trip.itinerary[sourceDayIndex];
    const targetDay = trip.itinerary[targetDayIndex];
    const activity = sourceDay?.activities[activityIndex];
    if (!sourceDay || !targetDay || !activity || activity.locked || targetDay.restDay) return;
    if (!activity.placeId || sourceDay.activities.some((candidate) => !candidate.placeId) || targetDay.activities.some((candidate) => !candidate.placeId)) {
      const message = 'This itinerary is missing backend place IDs. Regenerate it before moving places.';
      setCustomizationError(message);
      setWarning({ title: 'Move not applied', message });
      return;
    }

    const sourcePlaceIds = sourceDay.activities.filter((_, index) => index !== activityIndex).map((item) => item.placeId!);
    const targetPlaceIds = sourceDayIndex === targetDayIndex ? sourcePlaceIds : targetDay.activities.map((item) => item.placeId!);
    const originalActivities = new Map(trip.itinerary.flatMap((item) => item.activities).map((item) => [item.placeId!, item]));
    setMovingActivityId(activity.id);
    setCustomizationError('');
    try {
      const result = await moveItineraryPlace({
        trip,
        sourceDayIndex,
        targetDayIndex,
        sourcePlaceIds,
        targetPlaceIds,
        insertIndex,
        placeId: activity.placeId,
        ...(startChoice?.movedPlaceStartTime ? { movedPlaceStartTime: startChoice.movedPlaceStartTime } : {}),
        ...(startChoice?.targetFirstActivityStartTime ? { targetFirstActivityStartTime: startChoice.targetFirstActivityStartTime } : {}),
        durationOverrides: itineraryDurationOverrides(trip.itinerary)
      });
      const warnings = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
      const mergeDay = (current: DayPlan, edited: DayPlan, notice: string): DayPlan => ({
        ...edited,
        id: current.id,
        dayNumber: current.dayNumber,
        date: edited.date || current.date,
        activities: edited.activities.map((item) => ({ ...item, locked: originalActivities.get(item.placeId ?? '')?.locked })),
        editNotice: notice
      });
      const next = trip.itinerary.map((item, index) => {
        if (sourceDayIndex !== targetDayIndex && index === sourceDayIndex && result.sourceDay) {
          return mergeDay(item, result.sourceDay, `${activity.name} moved out.`);
        }
        if (index === targetDayIndex) return mergeDay(item, result.targetDay, `${activity.name} moved and validated.${warnings}`);
        return item;
      });
      commitItinerary(next, 'Place moved');
      setSelectedDay(targetDay.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'This move cannot fit. Try another slot.';
      setCustomizationError(message);
      setWarning({ title: 'Move not applied', message: `${activity.name} was not moved. ${message}` });
    } finally {
      setMovingActivityId('');
    }
  };

  const moveActivityToSlot = (source: DragSource, targetDayIndex: number, rawInsertIndex: number) => {
    const sourceDay = trip.itinerary[source.dayIndex];
    const targetDay = trip.itinerary[targetDayIndex];
    const sourceActivityIndex = sourceDay?.activities.findIndex((activity) => activity.id === source.activityId) ?? -1;
    const activity = sourceDay?.activities[sourceActivityIndex];
    if (!sourceDay || !targetDay || !activity || targetDay.restDay) return;
    if (source.dayIndex === targetDayIndex && (rawInsertIndex === sourceActivityIndex || rawInsertIndex === sourceActivityIndex + 1)) return;
    const insertIndex = source.dayIndex === targetDayIndex && sourceActivityIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
    const resolvedSource = { ...source, activityIndex: sourceActivityIndex };
    if (insertIndex === 0) {
      setMoveStart({ source: resolvedSource, targetDayIndex, insertIndex });
      return;
    }
    void moveActivity(source.dayIndex, sourceActivityIndex, targetDayIndex, insertIndex);
  };

  const completeDragMove = (source: DragSource, target: DropTarget) => {
    if (dropHandledRef.current) return;
    dropHandledRef.current = true;
    moveActivityToSlot(source, target.dayIndex, target.insertIndex);
  };

  const moveActivityWithinDay = (dayId: string, activityIndex: number, direction: -1 | 1) => {
    const sourceDayIndex = trip.itinerary.findIndex((item) => item.id === dayId);
    const targetIndex = activityIndex + direction;
    const sourceDay = trip.itinerary[sourceDayIndex];
    if (!sourceDay || targetIndex < 0 || targetIndex >= sourceDay.activities.length) return;
    const rawInsertIndex = direction < 0 ? targetIndex : targetIndex + 1;
    moveActivityToSlot({ dayIndex: sourceDayIndex, activityIndex, activityId: sourceDay.activities[activityIndex]!.id }, sourceDayIndex, rawInsertIndex);
  };

  const moveActivityToAdjacentDay = (dayId: string, activityIndex: number, direction: -1 | 1) => {
    const sourceDayIndex = trip.itinerary.findIndex((item) => item.id === dayId);
    const targetDayIndex = sourceDayIndex + direction;
    const targetDay = trip.itinerary[targetDayIndex];
    if (!targetDay) return;
    moveActivityToSlot({ dayIndex: sourceDayIndex, activityIndex, activityId: trip.itinerary[sourceDayIndex]!.activities[activityIndex]!.id }, targetDayIndex, targetDay.activities.length);
  };

  if (!trip.itinerary.length) {
    return (
      <Screen>
        <Header />
        <PageScroll>
          <Container style={styles.emptyPageMain}>
            <Card style={styles.emptyGeneratedCard}>
              <CalendarDays size={42} color="rgba(90,100,128,0.45)" />
              <Heading size="md">No itinerary generated yet</Heading>
              <Text style={styles.emptyText}>Start from the planner and generate an itinerary to see your trip details here.</Text>
              <Button onPress={() => { startNewTrip(); router.push('/trip/create'); }} icon={<ArrowRight size={16} color={colors.surface} />}>Plan your trip</Button>
            </Card>
          </Container>
          <Footer />
        </PageScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      <PageScroll>
        <Container style={styles.itineraryContainer}>
          <Row gap={spacing.lg} style={{ alignItems: 'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}>
            {isDesktop ? <Sidebar /> : <MobileSummary />}

            <Stack style={styles.itineraryMain} gap={spacing.lg}>
              <Row wrap gap={spacing.md} style={styles.pageHeader}>
                <Stack gap={spacing.xs}>
                  <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                    <Pressable onPress={() => router.push('/trip/create')}><Text style={styles.breadcrumb}><ArrowLeft size={14} color={colors.muted} /> Plan</Text></Pressable>
                    <Text style={styles.breadcrumb}>›</Text>
                    <Text style={styles.breadcrumbStrong}>Your {trip.destination.city} itinerary</Text>
                  </Row>
                  <Heading size="lg" style={styles.pageTitle}>{trip.days}-day trip to {trip.destination.city}</Heading>
                  <Text style={styles.pageSub}>{formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate, true)} · {paceLabel[trip.pace]}</Text>
                  {tripVibe ? (
                    <Row gap={spacing.xs} style={styles.vibeBadge}>
                      <Sparkles size={13} color={colors.accent} />
                      <Text style={styles.vibeBadgeText}>Trip vibe: {tripVibe}</Text>
                    </Row>
                  ) : null}
                </Stack>
                {!isMobile ? (
                  <Row wrap style={{ alignItems: 'center' }}>
                    {customizing ? (
                      <>
                        <Button variant="secondary" disabled={!undoStack.length} onPress={undoCustomization} icon={<RotateCcw size={16} color={undoStack.length ? colors.text : colors.muted} />}>Undo</Button>
                        <Button variant="ghost" disabled={!undoStack.length} onPress={undoAllCustomizations}>Undo all</Button>
                      </>
                    ) : null}
                    <Button variant={customizing ? 'secondary' : 'primary'} onPress={() => setCustomizing((value) => !value)} icon={<Edit3 size={16} color={customizing ? colors.primary : colors.surface} />}>{customizing ? 'Done customizing' : 'Customize itinerary'}</Button>
                    <Button onPress={() => router.push('/trip/booking')} icon={<ArrowRight size={16} color={colors.surface} />}>{bookingCtaLabel}</Button>
                  </Row>
                ) : null}
              </Row>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
                {trip.itinerary.map((item, itemIndex) => {
                  const active = item.id === selectedDay;
                  return (
                    <DayDropTarget key={item.id} target={{ dayIndex: itemIndex, insertIndex: item.activities.length }} enabled={Boolean(customizing && !item.restDay)} onDragHover={() => {
                      dropTargetRef.current = { dayIndex: itemIndex, insertIndex: item.activities.length };
                    }} onDrop={(source) => {
                      completeDragMove(source, { dayIndex: itemIndex, insertIndex: item.activities.length });
                      dragSourceRef.current = undefined;
                      dropTargetRef.current = undefined;
                      setDragSource(undefined);
                    }}>
                      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setSelectedDay(item.id)} style={StyleSheet.flatten([styles.dayTab, item.restDay && styles.restDayTab, active && styles.activeDayTab])}>
                        <Text style={active ? styles.activeDayText : styles.dayText}>Day {item.dayNumber}</Text>
                        <Text style={active ? styles.activeDaySub : styles.daySub}>{formatDisplayDate(item.date)}</Text>
                        {item.restDay ? <Moon size={12} color={active ? '#BFDBFE' : colors.muted} /> : null}
                      </Pressable>
                    </DayDropTarget>
                  );
                })}
              </ScrollView>

              {isMobile ? (
                <Card style={styles.mobileCustomizeCard}>
                  <Row wrap style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack gap={0} style={{ flex: 1, minWidth: 180 }}>
                      <Text style={styles.customizeTitle}>Itinerary customization</Text>
                      <Text style={styles.customizeCopy}>{customizing ? 'Add, move, lock, remove, or retime places.' : 'Adjust this plan before choosing bookings.'}</Text>
                    </Stack>
                    <Button variant={customizing ? 'secondary' : 'primary'} onPress={() => setCustomizing((value) => !value)} icon={<Edit3 size={16} color={customizing ? colors.primary : colors.surface} />}>{customizing ? 'Done' : 'Customize'}</Button>
                  </Row>
                </Card>
              ) : null}

              {!day ? (
                <EmptyItinerary />
              ) : day.restDay ? (
                <Stack gap={spacing.md}>
                  {customizing ? <CustomizationToolbar undoCount={undoStack.length} onUndo={undoCustomization} onUndoAll={undoAllCustomizations} onAdd={() => setAddStop({ dayId: day.id, insertIndex: 0 })} onCompact={() => void compactDay(selectedDayIndex)} compacting={compactingDayIndex === selectedDayIndex} canCompact={false} isMobile={isMobile} /> : null}
                  <RestDay date={day.date} />
                </Stack>
              ) : hasFewVibeMatches && !day.activities.length ? (
                <Stack gap={spacing.md}>
                  {customizing ? <CustomizationToolbar undoCount={undoStack.length} onUndo={undoCustomization} onUndoAll={undoAllCustomizations} onAdd={() => setAddStop({ dayId: day.id, insertIndex: 0 })} onCompact={() => void compactDay(selectedDayIndex)} compacting={compactingDayIndex === selectedDayIndex} canCompact={false} isMobile={isMobile} /> : null}
                  <TripVibeNoMatches tripVibe={tripVibe} />
                </Stack>
              ) : day.activities.length ? (
                <Stack gap={spacing.md}>
                  {customizing ? <CustomizationToolbar undoCount={undoStack.length} onUndo={undoCustomization} onUndoAll={undoAllCustomizations} onAdd={() => setAddStop({ dayId: day.id, insertIndex: day.activities.length })} onCompact={() => void compactDay(selectedDayIndex)} compacting={compactingDayIndex === selectedDayIndex} canCompact isMobile={isMobile} /> : null}
                  {customizing && day.editNotice ? <EditNotice message={day.editNotice} /> : null}
                  {customizing && customizationError ? <CustomizationError message={customizationError} /> : null}
                  {hasFewVibeMatches ? <TripVibeLowMatches tripVibe={tripVibe} count={day.activities.length} /> : null}
                  {routingNotice ? <RoutingNotice message={routingNotice} /> : null}
                  <View testID="itinerary-activity-list" style={StyleSheet.flatten([styles.activityList, customizing && !isMobile && styles.customizationList])}>
                    {displayedDay?.activities.map((activity, index) => (
                      <View key={activity.id}>
                      {customizing ? <InsertionControl target={{ dayIndex: selectedDayIndex, insertIndex: index }} label={dragSource ? 'Move here' : index === 0 ? 'Add place at start' : 'Add place here'} onPress={() => setAddStop({ dayId: day.id, insertIndex: index })} onDragHover={() => {
                        dropTargetRef.current = { dayIndex: selectedDayIndex, insertIndex: index };
                      }} onDrop={(source) => {
                        completeDragMove(source, { dayIndex: selectedDayIndex, insertIndex: index });
                        dragSourceRef.current = undefined;
                        dropTargetRef.current = undefined;
                        setDragSource(undefined);
                      }} /> : null}
                      {shouldShowLunchBeforeActivity(displayedDay, activity, index) && shouldShowTravelAfterLunch(displayedDay, index, drivingLegs[activity.id] ?? activity.travelFromPrevious) ? <LunchBreakRow lunchBreak={displayedDay.lunchBreak!} /> : null}
                      {index > 0 && (drivingLegs[activity.id] ?? activity.travelFromPrevious) ? <TravelConnector text={travelLegText(drivingLegs[activity.id] ?? activity.travelFromPrevious)} /> : null}
                      {shouldShowLunchBeforeActivity(displayedDay, activity, index) && !shouldShowTravelAfterLunch(displayedDay, index, drivingLegs[activity.id] ?? activity.travelFromPrevious) ? <LunchBreakRow lunchBreak={displayedDay.lunchBreak!} /> : null}
                      <DraggableActivity source={{ dayIndex: selectedDayIndex, activityIndex: index, activityId: activity.id }} previewLabel={activity.name} enabled={Boolean(customizing && !activity.locked && !movingActivityId)} onPointerDrop={(source, target) => {
                        completeDragMove(source, target);
                      }} onDragStart={(source) => {
                        dragSourceRef.current = source;
                        dropTargetRef.current = undefined;
                        dropHandledRef.current = false;
                        setDragSource(source);
                      }} onDragEnd={() => {
                        const source = dragSourceRef.current;
                        const target = dropTargetRef.current;
                        if (source && target) completeDragMove(source, target);
                        dragSourceRef.current = undefined;
                        dropTargetRef.current = undefined;
                        setDragSource(undefined);
                      }}>
                        <ActivityCard
                          activity={activity}
                          index={index}
                          activityCount={day.activities.length}
                          dayIndex={selectedDayIndex}
                          dayCount={trip.itinerary.length}
                          isMobile={isMobile}
                          customizing={customizing}
                          moving={movingActivityId === activity.id}
                          onDetails={() => setDetailsActivity(activity)}
                          onEditDuration={() => setEditDuration({ dayId: day.id, activity })}
                          onRemove={() => removeActivity(day.id, activity.id)}
                          onToggleLock={() => toggleActivityLock(day.id, activity.id)}
                          onMoveUp={() => moveActivityWithinDay(day.id, index, -1)}
                          onMoveDown={() => moveActivityWithinDay(day.id, index, 1)}
                          onMovePreviousDay={() => moveActivityToAdjacentDay(day.id, index, -1)}
                          onMoveNextDay={() => moveActivityToAdjacentDay(day.id, index, 1)}
                        />
                      </DraggableActivity>
                      </View>
                    ))}
                    {customizing ? <InsertionControl target={{ dayIndex: selectedDayIndex, insertIndex: day.activities.length }} label={dragSource ? 'Move to end' : 'Add place at end'} onPress={() => setAddStop({ dayId: day.id, insertIndex: day.activities.length })} onDragHover={() => {
                      dropTargetRef.current = { dayIndex: selectedDayIndex, insertIndex: day.activities.length };
                    }} onDrop={(source) => {
                      completeDragMove(source, { dayIndex: selectedDayIndex, insertIndex: day.activities.length });
                      dragSourceRef.current = undefined;
                      dropTargetRef.current = undefined;
                      setDragSource(undefined);
                    }} /> : null}
                  </View>
                  {day.activities.slice(1).some((activity) => drivingLegs[activity.id] ?? activity.travelFromPrevious) ? <TravelEstimateDisclaimer /> : null}
                </Stack>
              ) : (
                <Stack gap={spacing.md}>
                  {customizing ? <CustomizationToolbar undoCount={undoStack.length} onUndo={undoCustomization} onUndoAll={undoAllCustomizations} onAdd={() => setAddStop({ dayId: day.id, insertIndex: 0 })} onCompact={() => void compactDay(selectedDayIndex)} compacting={compactingDayIndex === selectedDayIndex} canCompact={false} isMobile={isMobile} /> : null}
                  <EmptyDay />
                </Stack>
              )}
            </Stack>
          </Row>
        </Container>
        <Footer />
      </PageScroll>

      {isMobile ? (
        <View style={styles.mobileCta}>
          <Pressable onPress={() => router.push('/trip/booking')} style={styles.mobileCtaButton}>
            <Text style={styles.mobileCtaText}>{bookingCtaLabel}</Text>
            <ArrowRight size={16} color={colors.surface} />
          </Pressable>
        </View>
      ) : null}
      <ActivityDetailsModal activity={detailsActivity} date={day?.date} onClose={() => setDetailsActivity(undefined)} />
      <AddStopModal state={addStop} trip={trip} onClose={() => setAddStop(undefined)} onSave={async (place, durationMinutes, startTime) => {
        if (!addStop) return;
        await addActivity(addStop, place, durationMinutes, startTime);
        setAddStop(undefined);
      }} />
      <EditTimingModal state={editDuration} onClose={() => setEditDuration(undefined)} onSave={async (durationMinutes) => {
        if (!editDuration) return;
        await updateActivityTiming(editDuration.dayId, editDuration.activity.id, durationMinutes);
      }} />
      <AppModal visible={Boolean(compactPrompt)} title="Compact and reshuffle?" onClose={() => setCompactPrompt(undefined)}>
        <Stack>
          <Text style={styles.customizeCopy}>{compactPrompt?.message}</Text>
          <Text style={styles.customizeCopy}>The scheduler will preserve every remaining place, recheck opening hours, and rebuild travel timing.</Text>
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" disabled={compactingDayIndex !== undefined} onPress={() => setCompactPrompt(undefined)}>Not now</Button>
            <Button disabled={compactingDayIndex !== undefined} onPress={() => compactPrompt && void compactDay(compactPrompt.dayIndex)} icon={<Sparkles size={16} color={colors.surface} />}>{compactingDayIndex !== undefined ? 'Compacting...' : 'Compact day'}</Button>
          </Row>
        </Stack>
      </AppModal>
      <MoveStartModal state={moveStart} activity={moveStartActivity} targetDate={moveStart ? trip.itinerary[moveStart.targetDayIndex]?.date : undefined} onClose={() => setMoveStart(undefined)} onConfirm={(startTime) => {
        if (!moveStart) return;
        const targetActivities = trip.itinerary[moveStart.targetDayIndex]?.activities.filter((_, index) => moveStart.source.dayIndex !== moveStart.targetDayIndex || index !== moveStart.source.activityIndex) ?? [];
        const targetFirstActivityStartTime = !startTime ? targetActivities[0]?.startTime : undefined;
        void moveActivity(moveStart.source.dayIndex, moveStart.source.activityIndex, moveStart.targetDayIndex, moveStart.insertIndex, {
          ...(startTime ? { movedPlaceStartTime: startTime } : {}),
          ...(targetFirstActivityStartTime ? { targetFirstActivityStartTime } : {})
        });
        setMoveStart(undefined);
      }} />
      <AppModal visible={Boolean(warning)} title={warning?.title ?? 'Schedule warning'} onClose={() => setWarning(undefined)}>
        <Stack>
          <Text>{warning?.message}</Text>
          <Row style={{ justifyContent: 'flex-end' }}><Button onPress={() => setWarning(undefined)}>OK</Button></Row>
        </Stack>
      </AppModal>
    </Screen>
  );
}

function Sidebar() {
  const router = useRouter();
  const { trip, setPlannerInput } = useTrip();
  const editTripDetails = () => {
    setPlannerInput({ source: trip.source.city, destination: trip.destination.city, startDate: trip.startDate, days: trip.days, pace: trip.pace, tripVibe: trip.tripVibe });
    router.push('/trip/create');
  };

  return (
    <Stack style={styles.sidebar}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryBanner}>
          <MapPin size={18} color={colors.surface} />
          <Stack gap={0}>
            <Text style={styles.summaryLabel}>Destination</Text>
            <Text style={styles.summaryTitle}>{trip.destination.city}</Text>
          </Stack>
        </View>
        <Stack style={styles.summaryBody}>
          <SummaryRow icon={<CalendarDays size={16} color={colors.primary} />} label="Dates" value={`${formatDisplayDate(trip.startDate)} - ${formatDisplayDate(trip.endDate, true)}`} />
          <SummaryRow icon={<Moon size={16} color={colors.primary} />} label="Duration" value={`${trip.days} days`} />
          <SummaryRow icon={<Text style={styles.paceEmoji}>{paceIcon[trip.pace]}</Text>} label="Pace" value={paceLabel[trip.pace]} />
          {trip.tripVibe ? <SummaryRow icon={<Sparkles size={16} color={colors.accent} />} label="Trip vibe" value={trip.tripVibe} /> : null}
          <SummaryRow icon={<MapPin size={16} color={colors.primary} />} label="Starting from" value={trip.source.city || '-'} />
          <View style={styles.rule} />
          <Button variant="secondary" onPress={editTripDetails} icon={<Edit3 size={16} color={colors.primary} />}>Edit trip details</Button>
        </Stack>
      </Card>
      <PlanningProgress />
    </Stack>
  );
}

function PlanningProgress() {
  const { trip } = useTrip();
  const steps = [
    { label: 'Itinerary', status: trip.itinerary.length ? 'Done' : 'Pending', done: trip.itinerary.length > 0 },
    bookingProgressStep('Hotels', trip.stayBookings),
    bookingProgressStep('Transports', trip.transportBookings)
  ];

  return (
    <Card style={styles.progressCard}>
      <Text style={styles.progressTitle}>Planning progress</Text>
      {steps.map((step, index) => (
        <Row key={step.label} style={{ alignItems: 'center' }}>
          <View style={StyleSheet.flatten([styles.progressDot, step.done && styles.progressDone])}>
            {step.done ? <Check size={11} color={colors.surface} /> : <Text style={styles.progressNum}>{index + 1}</Text>}
          </View>
          <Text style={step.done ? styles.progressTextDone : styles.progressText}>{step.label}</Text>
          <Text style={step.done ? styles.doneLabel : styles.pendingLabel}>{step.status}</Text>
        </Row>
      ))}
    </Card>
  );
}

function bookingProgressStep(label: string, bookings: Array<TransportBooking | StayBooking>) {
  if (!bookings.length) return { label, status: 'Pending', done: false };
  if (bookings.every((booking) => hasBookingEvidence(booking) && booking.status === 'Booked')) return { label, status: 'Booked', done: true };
  if (bookings.some((booking) => hasBookingEvidence(booking) && booking.status === 'Booked')) return { label, status: 'Part booked', done: true };
  if (bookings.every((booking) => hasBookingEvidence(booking))) return { label, status: 'Selected', done: true };
  if (bookings.some((booking) => hasBookingEvidence(booking))) return { label, status: 'Part selected', done: true };
  return { label, status: 'Pending', done: false };
}

function hasBookingEvidence(booking: TransportBooking | StayBooking) {
  const transportBooking = booking as Partial<TransportBooking>;
  const stayBooking = booking as Partial<StayBooking>;
  return Boolean(booking.externalBookingId || transportBooking.selectedOption || stayBooking.selectedHotel);
}

function MobileSummary() {
  const { trip } = useTrip();
  const tripVibe = trip.tripVibe?.trim();
  return (
    <Card style={styles.mobileSummary}>
      <Row wrap style={{ alignItems: 'center' }}>
        <MapPin size={14} color={colors.primary} />
        <Text style={{ fontWeight: '900' }}>{trip.destination.city}</Text>
        <Text style={styles.dotText}>·</Text>
        <Text style={styles.mobileSummaryText}>{formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}</Text>
        <Text style={styles.dotText}>·</Text>
        <Text style={styles.mobileSummaryText}>{trip.days} days</Text>
        <Text style={styles.dotText}>·</Text>
        <Text style={styles.mobileSummaryText}>{paceIcon[trip.pace]} {paceLabel[trip.pace]}</Text>
        {tripVibe ? (
          <>
            <Text style={styles.dotText}>·</Text>
            <Text style={styles.mobileSummaryText}>Trip vibe: {tripVibe}</Text>
          </>
        ) : null}
      </Row>
    </Card>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
      {icon}
      <Stack gap={0} style={{ flex: 1 }}>
        <Text style={styles.summaryLabelDark}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </Stack>
    </Row>
  );
}

function CustomizationToolbar({ undoCount, onUndo, onUndoAll, onAdd, onCompact, compacting, canCompact, isMobile }: { undoCount: number; onUndo: () => void; onUndoAll: () => void; onAdd: () => void; onCompact: () => void; compacting: boolean; canCompact: boolean; isMobile: boolean }) {
  return (
    <Card style={styles.customizeCard}>
      <Row wrap={!isMobile} style={StyleSheet.flatten([styles.customizationToolbarLayout, isMobile && styles.customizationToolbarLayoutMobile])}>
        <Stack gap={spacing.xs} style={StyleSheet.flatten([styles.customizationToolbarCopy, isMobile && styles.customizationToolbarCopyMobile])}>
          <Text style={styles.customizeEyebrow}>Customize itinerary</Text>
          <Text style={styles.customizeCopy}>Add stops, move places between days, lock must-see items, remove extras, or update timing.</Text>
        </Stack>
        <Row wrap gap={spacing.sm} style={StyleSheet.flatten([styles.customizationActions, isMobile && styles.customizationActionsMobile])}>
          <Button style={isMobile ? styles.mobileToolbarButton : undefined} variant="secondary" onPress={onAdd} icon={<Plus size={16} color={colors.primary} />}>Add place</Button>
          <Button style={isMobile ? styles.mobileToolbarButton : undefined} variant="secondary" disabled={!canCompact || compacting} onPress={onCompact} icon={<Sparkles size={16} color={canCompact && !compacting ? colors.primary : colors.muted} />}>{compacting ? 'Compacting...' : 'Compact day'}</Button>
          <Button style={isMobile ? styles.mobileToolbarButton : undefined} variant="secondary" disabled={!undoCount} onPress={onUndo} icon={<RotateCcw size={16} color={undoCount ? colors.primary : colors.muted} />}>Undo</Button>
          <Button style={isMobile ? styles.mobileToolbarButton : undefined} variant="ghost" disabled={!undoCount} onPress={onUndoAll}>Undo all</Button>
        </Row>
      </Row>
    </Card>
  );
}

function EditNotice({ message }: { message: string }) {
  return (
    <View style={styles.editNotice}>
      <Check size={16} color={colors.success} />
      <Text style={styles.editNoticeText}>{message}</Text>
    </View>
  );
}

function CustomizationError({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.customizationError}>
      <AlertTriangle size={16} color={colors.danger} />
      <Text style={styles.customizationErrorText}>{message}</Text>
    </View>
  );
}

function InsertionControl({ target, label, onPress, onDragHover, onDrop }: { target: DropTarget; label: string; onPress: () => void; onDragHover?: () => void; onDrop?: (source: DragSource) => void }) {
  const control = (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => StyleSheet.flatten([styles.insertControl, pressed && styles.pressedInsert])}>
      <Plus size={15} color={colors.primary} />
      <Text style={styles.insertText}>{label}</Text>
    </Pressable>
  );
  if (Platform.OS !== 'web' || !onDrop) return control;
  return createElement('div', {
    'data-tripbuddy-drop-day': String(target.dayIndex),
    'data-tripbuddy-drop-index': String(target.insertIndex),
    'data-tripbuddy-drop-kind': 'insertion',
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      onDragHover?.();
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const source = dragSourceFromEvent(event);
      if (source) onDrop(source);
    }
  }, control);
}

function DraggableActivity({ source, previewLabel, enabled, onDragStart, onDragEnd, onPointerDrop, children }: { source: DragSource; previewLabel: string; enabled: boolean; onDragStart: (source: DragSource) => void; onDragEnd: () => void; onPointerDrop: (source: DragSource, target: DropTarget) => void; children: ReactNode }) {
  const touchDragging = useRef(false);
  const pointerId = useRef<number | undefined>();
  const touchPreviewElement = useRef<HTMLDivElement | null>(null);
  const touchDropTarget = useRef<DropTarget | undefined>();
  const [touchPreview, setTouchPreview] = useState<{ width: number; left: number; top: number } | undefined>();
  if (Platform.OS !== 'web') return children;
  const finishTouchDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!touchDragging.current || pointerId.current !== event.pointerId) return;
    touchDragging.current = false;
    pointerId.current = undefined;
    setTouchPreview(undefined);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.currentTarget.draggable = enabled;
    if (!cancelled) {
      const target = touchDropTargetAtPoint(event.clientX, event.clientY, source.dayIndex) ?? touchDropTarget.current;
      if (target) onPointerDrop(source, target);
    }
    touchDropTarget.current = undefined;
    onDragEnd();
  };
  const preview = touchPreview ? createPortal(createElement('div', {
    ref: touchPreviewElement,
    'aria-hidden': 'true',
    style: {
      position: 'fixed',
      zIndex: 2147483000,
      width: touchPreview.width,
      left: touchPreview.left,
      top: touchPreview.top,
      pointerEvents: 'none',
      boxSizing: 'border-box',
      padding: '12px 14px',
      border: '1px solid #BFDBFE',
      borderRadius: 8,
      background: '#FFFFFF',
      color: '#092141',
      fontFamily: 'inherit',
      fontSize: 14,
      fontWeight: 800,
      lineHeight: '20px',
      overflowWrap: 'anywhere',
      opacity: 0.96,
      boxShadow: '0 14px 34px rgba(9, 33, 65, 0.24)'
    }
  }, previewLabel), document.body) : null;
  return createElement('div', {
    draggable: enabled,
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-tripbuddy-activity', JSON.stringify(source));
      event.dataTransfer.setData('text/plain', JSON.stringify(source));
      onDragStart(source);
    },
    onDragEnd,
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || event.pointerType === 'mouse') return;
      const target = event.target instanceof Element ? event.target : undefined;
      if (!target?.closest('[data-tripbuddy-drag-handle]')) return;
      event.preventDefault();
      event.currentTarget.draggable = false;
      touchDragging.current = true;
      pointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const width = Math.min(280, window.innerWidth - 24);
      const position = touchPreviewPosition(event.clientX, event.clientY, width);
      setTouchPreview({ width, ...position });
      touchDropTarget.current = touchDropTargetAtPoint(event.clientX, event.clientY, source.dayIndex);
      onDragStart(source);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!touchDragging.current || pointerId.current !== event.pointerId) return;
      event.preventDefault();
      touchDropTarget.current = touchDropTargetAtPoint(event.clientX, event.clientY, source.dayIndex) ?? touchDropTarget.current;
      if (touchPreviewElement.current && touchPreview) {
        const position = touchPreviewPosition(event.clientX, event.clientY, touchPreview.width);
        touchPreviewElement.current.style.left = `${position.left}px`;
        touchPreviewElement.current.style.top = `${position.top}px`;
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => finishTouchDrag(event),
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => finishTouchDrag(event, true),
    style: { cursor: enabled ? 'grab' : 'default' }
  }, children, preview);
}

function touchPreviewPosition(clientX: number, clientY: number, width: number) {
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, clientX - width / 2));
  const top = Math.max(8, Math.min(window.innerHeight - 56, clientY - 64));
  return { left, top };
}

function touchDropTargetAtPoint(clientX: number, clientY: number, sourceDayIndex: number): DropTarget | undefined {
  const directDrop = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-tripbuddy-drop-day][data-tripbuddy-drop-index]');
  if (directDrop) return dropTargetFromElement(directDrop);

  const insertionTargets = Array.from(document.querySelectorAll<HTMLElement>(
    `[data-tripbuddy-drop-kind="insertion"][data-tripbuddy-drop-day="${sourceDayIndex}"]`
  )).filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom >= 0 && rect.top <= window.innerHeight;
  });
  if (!insertionTargets.length) return undefined;

  const bounds = insertionTargets.reduce((current, element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: Math.min(current.left, rect.left),
      right: Math.max(current.right, rect.right)
    };
  }, { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY });
  if (clientX < bounds.left - 32 || clientX > bounds.right + 32) return undefined;

  const nearest = insertionTargets.reduce((best, element) => {
    const rect = element.getBoundingClientRect();
    const distance = Math.abs(clientY - (rect.top + rect.height / 2));
    return !best || distance < best.distance ? { element, distance } : best;
  }, undefined as { element: HTMLElement; distance: number } | undefined);
  return nearest ? dropTargetFromElement(nearest.element) : undefined;
}

function dropTargetFromElement(element: HTMLElement): DropTarget | undefined {
  const dayIndex = Number(element.dataset.tripbuddyDropDay);
  const insertIndex = Number(element.dataset.tripbuddyDropIndex);
  return Number.isInteger(dayIndex) && Number.isInteger(insertIndex) ? { dayIndex, insertIndex } : undefined;
}

function DayDropTarget({ target, enabled, onDragHover, onDrop, children }: { target: DropTarget; enabled: boolean; onDragHover: () => void; onDrop: (source: DragSource) => void; children: ReactNode }) {
  if (Platform.OS !== 'web') return children;
  return createElement('div', {
    'data-tripbuddy-drop-day': String(target.dayIndex),
    'data-tripbuddy-drop-index': String(target.insertIndex),
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      if (enabled) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragHover();
      }
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      const source = dragSourceFromEvent(event);
      if (source) onDrop(source);
    }
  }, children);
}

function TouchDragHandle() {
  if (Platform.OS !== 'web') return null;
  return createElement('div', {
    'data-tripbuddy-drag-handle': 'true',
    role: 'button',
    'aria-label': 'Drag place',
    style: styles.touchDragHandle as never
  }, <GripVertical size={18} color={colors.primary} />, <Text style={styles.touchDragHandleText}>Drag</Text>);
}

function dragSourceFromEvent(event: React.DragEvent<HTMLElement>): DragSource | undefined {
  try {
    const payload = event.dataTransfer.getData('application/x-tripbuddy-activity') || event.dataTransfer.getData('text/plain');
    const parsed = JSON.parse(payload) as Partial<DragSource>;
    return Number.isInteger(parsed.dayIndex) && Number.isInteger(parsed.activityIndex) && typeof parsed.activityId === 'string'
      ? parsed as DragSource
      : undefined;
  } catch {
    return undefined;
  }
}

function nearestScrollableElement(target: EventTarget | null): HTMLElement | undefined {
  let element = target instanceof HTMLElement ? target : undefined;
  while (element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) return element;
    element = element.parentElement ?? undefined;
  }
  const activityList = document.querySelector<HTMLElement>('[data-testid="itinerary-activity-list"]');
  if (activityList && activityList.scrollHeight > activityList.clientHeight) return activityList;
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : undefined;
}

function IconAction({ label, icon, onPress, disabled, danger }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => StyleSheet.flatten([styles.iconAction, danger && styles.iconActionDanger, disabled && styles.iconActionDisabled, pressed && styles.pressed])}>
      {icon}
      <Text style={StyleSheet.flatten([styles.iconActionText, danger && styles.iconActionTextDanger, disabled && styles.iconActionTextDisabled])}>{label}</Text>
    </Pressable>
  );
}

function AddStopModal({ state, trip, onClose, onSave }: { state?: AddStopState; trip: Trip; onClose: () => void; onSave: (place: CachedItineraryPlace, durationMinutes: number, startTime?: string) => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [places, setPlaces] = useState<CachedItineraryPlace[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingPlaceId, setSavingPlaceId] = useState('');
  const [error, setError] = useState('');
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [startTimes, setStartTimes] = useState<Record<string, string>>({});
  const day = state ? trip.itinerary.find((item) => item.id === state.dayId) : undefined;
  const usedPlaceIds = useMemo(() => [...new Set(trip.itinerary.flatMap((item) => item.activities.flatMap((activity) => activity.placeId ? [activity.placeId] : [])))], [trip.itinerary]);

  useEffect(() => {
    if (!state) return;
    setSearch('');
    setPlaces([]);
    setDurations({});
    setStartTimes({});
    setError('');
  }, [state?.dayId, state?.insertIndex]);

  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => {
      void loadPlaces(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, state?.dayId, state?.insertIndex]);

  const loadPlaces = async (reset: boolean) => {
    if (!state || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchRemainingItineraryPlaces({ trip, usedPlaceIds, offset: reset ? 0 : places.length, limit: 10, search });
      setPlaces((current) => reset ? result.places : [...current, ...result.places]);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setDurations((current) => ({
        ...current,
        ...Object.fromEntries(result.places.filter((place) => current[place.id] === undefined).map((place) => [place.id, String(defaultVisitMinutes(place))]))
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const addPlace = async (place: CachedItineraryPlace) => {
    const minutes = parseVisitDuration(durations[place.id] ?? '');
    if (!minutes) {
      setError('Visit duration must be a whole number from 1 to 1,440 minutes.');
      return;
    }
    setSavingPlaceId(place.id);
    setError('');
    try {
      await onSave(place, ceilMinutes(minutes, 5), startTimes[place.id] || undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'This place cannot fit here. Try another place.');
    } finally {
      setSavingPlaceId('');
    }
  };

  return (
    <AppModal visible={Boolean(state)} title="Add place" onClose={onClose}>
      <Stack>
        <Input label="Search recommended places" value={search} onChangeText={setSearch} placeholder="Search by place name" />
        {error ? <CustomizationError message={error} /> : <Text style={styles.customizeCopy}>{loading ? 'Loading recommendations...' : `${total} recommendation${total === 1 ? '' : 's'} available`}</Text>}
        {!places.length && !loading ? <Text style={styles.emptyText}>No recommendations match your search.</Text> : null}
        {places.map((place) => {
          const duration = durations[place.id] ?? String(defaultVisitMinutes(place));
          const startOptions = state?.insertIndex === 0 ? startTimeOptions(place.openingHours, day?.date ?? trip.startDate, parseVisitDuration(duration) ?? defaultVisitMinutes(place)) : [];
          return (
            <View key={place.id} style={styles.cachedPlaceOption}>
              {place.photoUrls?.[0] ? <Image source={{ uri: place.photoUrls[0] }} style={styles.cachedPlaceImage} resizeMode="cover" /> : <View style={styles.cachedPlacePlaceholder}><MapPin size={22} color={colors.primary} /></View>}
              <Stack gap={spacing.xs} style={styles.cachedPlaceBody}>
                <Heading size="sm" style={styles.cachedPlaceTitle}>{place.name}</Heading>
                <Text style={styles.metaText}>{[place.rank ? `Rating ${place.rank}` : '', place.area, formatVisitDuration(defaultVisitMinutes(place))].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.activityDescription}>{place.reason || 'Recommended for your trip.'}</Text>
                <Input label="Visit minutes" value={duration} onChangeText={(value) => setDurations((current) => ({ ...current, [place.id]: value }))} keyboardType="numeric" style={styles.modalField} />
                {state?.insertIndex === 0 ? (
                  <Stack gap={spacing.xs}>
                    <Text style={styles.inputLabel}>Start time</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.startTimeOptions}>
                      {['', ...startOptions].map((time) => (
                        <Pressable key={time || 'auto'} onPress={() => setStartTimes((current) => ({ ...current, [place.id]: time }))} style={StyleSheet.flatten([styles.startTimeOption, (startTimes[place.id] ?? '') === time && styles.startTimeOptionSelected])}>
                          <Text style={StyleSheet.flatten([styles.startTimeOptionText, (startTimes[place.id] ?? '') === time && styles.startTimeOptionTextSelected])}>{time || 'Auto'}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    {!startOptions.length ? <Text style={styles.customizeCopy}>Opening-hour start options unavailable. Auto will validate the insertion.</Text> : null}
                  </Stack>
                ) : null}
                <Button disabled={Boolean(savingPlaceId) || !parseVisitDuration(duration)} onPress={() => void addPlace(place)} icon={<Plus size={16} color={colors.surface} />}>{savingPlaceId === place.id ? 'Adding...' : 'Add'}</Button>
              </Stack>
            </View>
          );
        })}
        {hasMore ? <Button variant="secondary" disabled={loading} onPress={() => void loadPlaces(false)}>{loading ? 'Loading...' : 'More recommendations'}</Button> : null}
      </Stack>
    </AppModal>
  );
}

function EditTimingModal({ state, onClose, onSave }: { state?: EditDurationState; onClose: () => void; onSave: (durationMinutes: number) => Promise<void> }) {
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state) return;
    setDuration(String(durationToMinutes(state.activity.duration)));
    setError('');
  }, [state]);

  const save = async () => {
    const minutes = parseVisitDuration(duration);
    if (!minutes) {
      setError('Visit duration must be a whole number from 1 to 1,440 minutes.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(ceilMinutes(minutes, 5));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "This duration cannot fit with the day's opening hours.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal visible={Boolean(state)} title={state?.activity.name ?? 'Update visit duration'} onClose={onClose}>
      <Stack>
        <Input label="Visit minutes" value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="90" />
        <Text style={styles.customizeCopy}>The value is rounded up to five minutes. Earlier starts stay fixed while later activities are rescheduled and revalidated.</Text>
        {error ? <CustomizationError message={error} /> : null}
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" disabled={saving} onPress={onClose}>Cancel</Button>
          <Button disabled={saving || !parseVisitDuration(duration)} onPress={() => void save()} icon={<Clock size={16} color={colors.surface} />}>{saving ? 'Validating...' : 'Update'}</Button>
        </Row>
      </Stack>
    </AppModal>
  );
}

function MoveStartModal({ state, activity, targetDate, onClose, onConfirm }: { state?: MoveStartState; activity?: Activity; targetDate?: string; onClose: () => void; onConfirm: (startTime?: string) => void }) {
  const [startTime, setStartTime] = useState('');
  useEffect(() => setStartTime(''), [state]);
  const options = activity ? startTimeOptions(activity.openingHours, targetDate ?? '', durationToMinutes(activity.duration)) : [];
  return (
    <AppModal visible={Boolean(state && activity)} title="Choose start time" onClose={onClose}>
      <Stack>
        <Text style={styles.customizeCopy}>Move {activity?.name ?? 'this place'} to the start of the day. Auto keeps the existing first activity fixed when possible.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.startTimeOptions}>
          {['', ...options].map((time) => (
            <Pressable key={time || 'auto'} onPress={() => setStartTime(time)} style={StyleSheet.flatten([styles.startTimeOption, startTime === time && styles.startTimeOptionSelected])}>
              <Text style={StyleSheet.flatten([styles.startTimeOptionText, startTime === time && styles.startTimeOptionTextSelected])}>{time || 'Auto'}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!options.length ? <Text style={styles.customizeCopy}>Opening-hour choices are unavailable. Auto will ask the scheduler to validate the move.</Text> : null}
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button variant="secondary" onPress={onClose}>Cancel</Button>
          <Button onPress={() => onConfirm(startTime || undefined)}>Validate move</Button>
        </Row>
      </Stack>
    </AppModal>
  );
}

function ActivityCard({
  activity,
  index,
  activityCount,
  dayIndex,
  dayCount,
  isMobile,
  customizing,
  moving,
  onDetails,
  onEditDuration,
  onRemove,
  onToggleLock,
  onMoveUp,
  onMoveDown,
  onMovePreviousDay,
  onMoveNextDay
}: {
  activity: Activity;
  index: number;
  activityCount: number;
  dayIndex: number;
  dayCount: number;
  isMobile: boolean;
  customizing?: boolean;
  moving?: boolean;
  onDetails: () => void;
  onEditDuration: () => void;
  onRemove: () => void;
  onToggleLock: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMovePreviousDay: () => void;
  onMoveNextDay: () => void;
}) {
  const locked = Boolean(activity.locked);
  return (
    <Row gap={spacing.md} style={{ alignItems: 'stretch' }}>
      {!isMobile ? <View style={styles.timelineDot}><Text style={styles.timelineNum}>{index + 1}</Text></View> : null}
      <Card style={styles.activityCard}>
        <View style={StyleSheet.flatten([styles.activityLayout, isMobile && { flexDirection: 'column' }])}>
          <View style={StyleSheet.flatten([styles.activityImageWrap, isMobile && styles.activityImageMobile])}>
            {activity.imageUrl ? (
              <Image source={{ uri: activity.imageUrl }} style={styles.activityImage} resizeMode="cover" />
            ) : (
              <View style={styles.activityImagePlaceholder}>
                <View style={styles.activityImageIcon}>
                  <MapPin size={24} color={colors.primary} />
                </View>
              </View>
            )}
          </View>
          <Stack style={styles.activityBody} gap={spacing.sm}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Stack gap={spacing.xs} style={{ flex: 1 }}>
                <Row gap={spacing.sm} style={{ alignItems: 'center' }} wrap>
                  <Heading size="sm" style={styles.activityTitle}>{activity.name}</Heading>
                  {locked ? <StatusPill tone="warning">Locked</StatusPill> : null}
                </Row>
                <Row gap={spacing.xs} wrap style={{ alignItems: 'center' }}>
                  <Star size={14} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.ratingText}>{activity.rating}</Text>
                  <MapPin size={12} color={colors.muted} />
                  <Text style={styles.metaText}>{activity.area}</Text>
                </Row>
              </Stack>
              {customizing && isMobile && !locked ? <TouchDragHandle /> : null}
            </Row>
            <Row wrap gap={spacing.sm} style={{ alignItems: 'center' }}>
              <View style={styles.activityTimePill}>
                <Clock size={14} color={colors.primary} />
                <Text style={styles.activityTimeText}>{activity.startTime} - {activity.endTime}</Text>
              </View>
              <View style={styles.activityDurationPill}>
                <Text style={styles.activityDurationText}>{activity.duration}</Text>
              </View>
            </Row>
            <Text style={styles.activityDescription}>{cleanPlaceDescription(activity.description)}</Text>
            <Row wrap gap={spacing.sm}>
              <Button variant="secondary" onPress={onDetails} style={styles.detailsButton} icon={<Info size={15} color={colors.primary} />}>Details</Button>
              {customizing ? (
                <>
                  <Button variant="secondary" onPress={onEditDuration} icon={<Clock size={15} color={colors.primary} />}>Time</Button>
                  <Button variant="secondary" onPress={onToggleLock} icon={locked ? <Unlock size={15} color={colors.primary} /> : <Lock size={15} color={colors.primary} />}>{locked ? 'Unlock' : 'Lock'}</Button>
                </>
              ) : null}
            </Row>
            {customizing ? (
              <View style={styles.activityEditPanel}>
                <Row wrap gap={spacing.sm}>
                  <IconAction label={moving ? 'Moving...' : 'Earlier'} disabled={moving || locked || index === 0} onPress={onMoveUp} icon={<ArrowUp size={15} color={moving || locked || index === 0 ? colors.muted : colors.primary} />} />
                  <IconAction label="Later" disabled={moving || locked || index >= activityCount - 1} onPress={onMoveDown} icon={<ArrowDown size={15} color={moving || locked || index >= activityCount - 1 ? colors.muted : colors.primary} />} />
                  <IconAction label="Prev day" disabled={moving || locked || dayIndex <= 0} onPress={onMovePreviousDay} icon={<ArrowLeft size={15} color={moving || locked || dayIndex <= 0 ? colors.muted : colors.primary} />} />
                  <IconAction label="Next day" disabled={moving || locked || dayIndex >= dayCount - 1} onPress={onMoveNextDay} icon={<ArrowRight size={15} color={moving || locked || dayIndex >= dayCount - 1 ? colors.muted : colors.primary} />} />
                  <IconAction label="Remove" disabled={locked} danger onPress={onRemove} icon={<Trash2 size={15} color={locked ? colors.muted : colors.danger} />} />
                </Row>
              </View>
            ) : null}
          </Stack>
        </View>
      </Card>
    </Row>
  );
}

function ActivityDetailsModal({ activity, date, onClose }: { activity?: Activity; date?: string; onClose: () => void }) {
  if (!activity) return null;
  const bestTimeLabel = activity.bestTimeOfDay || bestTimeFromLegacyCategory(activity.category) || `${activity.startTime} - ${activity.endTime}`;
  const openingHours = openingHoursLines(activity.openingHours, date);
  return (
    <AppModal visible title={activity.name} onClose={onClose}>
      {activity.imageUrl ? <Image source={{ uri: activity.imageUrl }} style={styles.detailsImage} resizeMode="cover" /> : null}
      <Stack gap={spacing.sm}>
        <Row wrap style={{ alignItems: 'center' }}>
          <Star size={14} color="#FACC15" fill="#FACC15" />
          <Text style={styles.ratingText}>{activity.rating}</Text>
        </Row>
        <Row gap={spacing.xs} style={{ alignItems: 'flex-start' }}>
          <MapPin size={13} color={colors.muted} />
          <Text style={styles.detailsAddress}>{activity.area}</Text>
        </Row>
        <Row wrap gap={spacing.sm}>
          <View style={styles.detailMetric}>
            <View style={styles.detailMetricIcon}>
              <Sparkles size={14} color={colors.accent} />
            </View>
            <Stack gap={0} style={{ flex: 1 }}>
              <Text style={styles.detailMetricLabel}>Best time to visit</Text>
              <Text style={styles.detailMetricValue}>{bestTimeLabel}</Text>
            </Stack>
          </View>
          <View style={styles.detailMetric}>
            <View style={styles.detailMetricIcon}>
              <Clock size={14} color={colors.primary} />
            </View>
            <Stack gap={0} style={{ flex: 1 }}>
              <Text style={styles.detailMetricLabel}>Time required</Text>
              <Text style={styles.detailMetricValue}>{activity.duration}</Text>
            </Stack>
          </View>
        </Row>
        {openingHours.length ? (
          <View style={styles.openingHoursSection}>
            <Row gap={spacing.sm} style={{ alignItems: 'center' }}>
              <View style={styles.openingHoursIcon}>
                <Clock size={15} color={colors.primary} />
              </View>
              <Text style={styles.openingHoursTitle}>Opening hours</Text>
            </Row>
            <Stack gap={spacing.xs}>
              {openingHours.map((hours, index) => (
                <Text key={`${hours}-${index}`} style={styles.openingHoursText}>{hours}</Text>
              ))}
            </Stack>
            <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
              <AlertTriangle size={13} color={colors.warning} />
              <Text style={styles.openingHoursDisclaimer}>Hours might vary.</Text>
            </Row>
          </View>
        ) : null}
        <Text style={styles.detailsDescription}>{cleanPlaceDescription(activity.description) || 'No additional details were provided for this place.'}</Text>
      </Stack>
      {activity.reviews?.length ? <ReviewsList reviews={activity.reviews} /> : null}
    </AppModal>
  );
}

function ReviewsList({ reviews }: { reviews: NonNullable<Activity['reviews']> }) {
  return (
    <Card style={styles.reviewsSection}>
      <Row style={{ alignItems: 'center' }}>
        <Star size={16} color="#FACC15" fill="#FACC15" />
        <Heading size="sm" style={styles.reviewHeading}>Reviews</Heading>
      </Row>
      <Stack gap={spacing.sm}>
        {reviews.slice(0, 3).map((review, index) => (
          <View key={`${review.authorName ?? 'review'}-${index}`} style={styles.reviewCard}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.reviewAuthor}>{review.authorName ?? 'Traveler review'}</Text>
              {review.rating ? (
                <Row gap={spacing.xs} style={{ alignItems: 'center' }}>
                  <Star size={12} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.reviewMeta}>{review.rating}</Text>
                </Row>
              ) : null}
            </Row>
            {review.relativePublishTimeDescription ? <Text style={styles.reviewMeta}>{review.relativePublishTimeDescription}</Text> : null}
            {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
          </View>
        ))}
      </Stack>
    </Card>
  );
}

function TravelConnector({ text }: { text: string }) {
  return (
    <Row style={styles.travelConnector}>
      <View style={styles.travelLine} />
      <Text style={styles.travelText}>{text}</Text>
    </Row>
  );
}

function LunchBreakRow({ lunchBreak }: { lunchBreak: NonNullable<DayPlan['lunchBreak']> }) {
  return (
    <Row gap={spacing.sm} style={styles.lunchBreakRow}>
      <View style={styles.lunchBreakIcon}>
        <Utensils size={15} color={colors.accent} />
      </View>
      <Stack gap={0} style={{ flex: 1 }}>
        <Text style={styles.lunchBreakTitle}>Lunch break</Text>
        <Text style={styles.lunchBreakTime}>{lunchBreak.startTime} - {lunchBreak.endTime}</Text>
      </Stack>
    </Row>
  );
}

function shouldShowLunchBeforeActivity(day: DayPlan, activity: Activity, activityIndex: number) {
  if (!day.lunchBreak) return false;
  const activityStart = parseTimeForSelect(activity.startTime);
  const lunchEnd = parseTimeForSelect(day.lunchBreak.endTime);
  if (activityStart === undefined || lunchEnd === undefined || activityStart < lunchEnd) return false;
  const previousStart = activityIndex > 0 ? parseTimeForSelect(day.activities[activityIndex - 1]?.startTime) : undefined;
  return previousStart === undefined || previousStart < lunchEnd;
}

function shouldShowTravelAfterLunch(day: DayPlan, activityIndex: number, travelLeg: Activity['travelFromPrevious']) {
  if (!day.lunchBreak || activityIndex <= 0 || !travelLeg) return false;
  const previousEnd = parseTimeForSelect(day.activities[activityIndex - 1]?.endTime);
  const lunchStart = parseTimeForSelect(day.lunchBreak.startTime);
  const lunchEnd = parseTimeForSelect(day.lunchBreak.endTime);
  if (previousEnd === undefined || lunchStart === undefined || lunchEnd === undefined) return false;
  return previousEnd < lunchEnd && previousEnd + travelDurationMinutes(travelLeg) > lunchStart;
}

function travelDurationMinutes(leg: Activity['travelFromPrevious']) {
  if (typeof leg === 'object' && typeof leg.durationSeconds === 'number') return Math.ceil(leg.durationSeconds / 60);
  const text = typeof leg === 'string' ? leg : leg?.durationText ?? '';
  const hours = Number(text.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/i)?.[1] ?? 0);
  const minutes = Number(text.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/i)?.[1] ?? 0);
  return hours * 60 + minutes;
}

function dayWithResolvedTravelTiming(day: DayPlan, resolvedLegs: Record<string, TravelLeg>): DayPlan {
  let previousEnd: number | undefined;
  const activities = day.activities.map((activity, index) => {
    const originalStart = parseTimeForSelect(activity.startTime);
    const durationMinutes = durationToMinutes(activity.duration);
    if (originalStart === undefined) {
      previousEnd = undefined;
      return activity;
    }

    let adjustedStart = originalStart;
    if (index > 0 && previousEnd !== undefined) {
      const leg = resolvedLegs[activity.id] ?? activity.travelFromPrevious;
      const transferMinutes = travelDurationMinutes(leg) + 15;
      let earliestStart = previousEnd + transferMinutes;
      const lunchStart = parseTimeForSelect(day.lunchBreak?.startTime);
      const lunchEnd = parseTimeForSelect(day.lunchBreak?.endTime);
      if (lunchStart !== undefined && lunchEnd !== undefined && previousEnd < lunchEnd && earliestStart > lunchStart) {
        earliestStart = lunchEnd + transferMinutes;
      }
      adjustedStart = Math.max(originalStart, ceilMinutes(earliestStart, 5));
    }

    previousEnd = adjustedStart + durationMinutes;
    if (adjustedStart === originalStart) return activity;
    const startTime = formatMinutesForSelect(adjustedStart);
    return {
      ...activity,
      startTime,
      endTime: addMinutesToTime(startTime, durationMinutes)
    };
  });
  return { ...day, activities };
}

function TravelEstimateDisclaimer() {
  return (
    <Row gap={spacing.xs} style={styles.travelDisclaimer}>
      <Info size={14} color={colors.muted} />
      <Text style={styles.travelDisclaimerText}>Estimated distance and travel time may vary based on route and traffic conditions.</Text>
    </Row>
  );
}

function RoutingNotice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.routingNotice}>
      <AlertTriangle size={17} color={colors.warning} />
      <Text style={styles.routingNoticeText}>{message}</Text>
    </View>
  );
}

async function resolveMissingDrivingLegs(
  days: DayPlan[],
  signal: AbortSignal,
  onResolved: (activityId: string, leg: TravelLeg) => void,
  onRateLimited: () => void
) {
  for (const day of days) {
    for (let index = 1; index < day.activities.length; index += 1) {
      if (signal.aborted) return;
      const previous = day.activities[index - 1];
      const activity = day.activities[index];
      if (!previous?.geo || !activity?.geo || isDatabaseLeg(activity.travelFromPrevious)) continue;
      try {
        const leg = await fetchDrivingLeg(previous.geo, activity.geo, { signal, onRateLimited });
        onResolved(activity.id, leg);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Keep the service estimate when OSRM is temporarily unavailable.
      }
    }
  }
}

function isDatabaseLeg(leg: Activity['travelFromPrevious']) {
  return typeof leg === 'object' && leg?.distanceSource === 'database';
}

function travelLegText(leg: Activity['travelFromPrevious']) {
  if (typeof leg === 'string') return leg;
  return [leg?.durationText, leg?.distanceText].filter(Boolean).join(' · ') || 'Calculating driving route...';
}

function cloneItinerary(days: DayPlan[]): DayPlan[] {
  return days.map((day) => ({
    ...day,
    activities: day.activities.map((activity) => ({
      ...activity,
      geo: activity.geo ? { ...activity.geo } : undefined,
      travelFromPrevious: typeof activity.travelFromPrevious === 'object' ? { ...activity.travelFromPrevious } : activity.travelFromPrevious,
      restaurants: activity.restaurants?.map((restaurant) => ({ ...restaurant })),
      reviews: activity.reviews?.map((review) => ({ ...review }))
    }))
  }));
}

function mergeEditedDay(current: DayPlan, edited: DayPlan, itinerary: DayPlan[], editNotice: string): DayPlan {
  const originals = new Map(itinerary.flatMap((day) => day.activities.flatMap((activity) => activity.placeId ? [[activity.placeId, activity] as const] : [])));
  return {
    ...edited,
    id: current.id,
    dayNumber: current.dayNumber,
    date: edited.date || current.date,
    activities: edited.activities.map((activity) => ({ ...activity, locked: originals.get(activity.placeId ?? '')?.locked })),
    editNotice
  };
}

function itineraryTripKey(trip: Trip) {
  return [trip.destination.city.trim().toLowerCase(), trip.startDate, trip.days].join('|');
}

function loadUndoStack(trip: Trip): UndoSnapshot[] {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${UNDO_STORAGE_KEY}.${itineraryTripKey(trip)}`) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    const tripKey = itineraryTripKey(trip);
    return parsed.filter((item): item is UndoSnapshot => Boolean(item)
      && typeof item === 'object'
      && (item as UndoSnapshot).tripKey === tripKey
      && Array.isArray((item as UndoSnapshot).itinerary))
      .slice(0, MAX_UNDO_SNAPSHOTS);
  } catch {
    return [];
  }
}

function saveUndoStack(stack: UndoSnapshot[], trip: Trip) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${UNDO_STORAGE_KEY}.${itineraryTripKey(trip)}`, JSON.stringify(stack.slice(0, MAX_UNDO_SNAPSHOTS)));
  } catch {
    // In-memory undo remains available when browser storage is unavailable.
  }
}

function dayWithActivities(day: DayPlan, activities: Activity[], editNotice: string): DayPlan {
  return {
    ...day,
    editNotice,
    restDay: false,
    activities: activities.map((activity, index) => {
      const { travelFromPrevious: _travelFromPrevious, ...rest } = activity;
      return index === 0 ? rest : { ...rest };
    })
  };
}

function itineraryDurationOverrides(days: DayPlan[]) {
  return Object.fromEntries(days.flatMap((day) => day.activities.flatMap((activity) => (
    activity.placeId ? [[activity.placeId, durationToMinutes(activity.duration)] as const] : []
  ))));
}

function parseVisitDuration(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1440 ? parsed : undefined;
}

function ceilMinutes(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function normalizeClockTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return '';
  const hour = Number(match[1]);
  if (hour > 23) return '';
  return `${`${hour}`.padStart(2, '0')}:${match[2]}`;
}

function addMinutesToTime(value: string, minutes: number) {
  const normalized = normalizeClockTime(value);
  if (!normalized) return value;
  const [hour = '0', minute = '0'] = normalized.split(':');
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function formatVisitDuration(minutes: number) {
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours} hr${hours === 1 ? '' : 's'}`;
}

function defaultVisitMinutes(place: CachedItineraryPlace) {
  const hours = Number(place.durationHours);
  return ceilMinutes(Number.isFinite(hours) && hours > 0 ? Math.ceil(hours * 60) : 120, 5);
}

function startTimeOptions(openingHours: string | string[] | undefined, date: string, durationMinutes: number) {
  const windows = openingWindowsForDate(openingHours, date);
  const options: string[] = [];
  for (const window of windows) {
    const latestStart = window.closeMinutes - durationMinutes;
    const firstStart = Math.ceil(window.openMinutes / 30) * 30;
    for (let minutes = firstStart; minutes <= latestStart && options.length < 40; minutes += 30) {
      options.push(formatMinutesForSelect(minutes));
    }
  }
  return options;
}

function openingHoursLines(openingHours: Activity['openingHours'], date?: string) {
  if (!date) return [];
  const weekday = weekdayNameForDate(date) ?? 'Sunday';
  if (Array.isArray(openingHours)) {
    const entries = openingHours.map((entry) => entry.trim()).filter(Boolean);
    const dayEntry = entries.find((entry) => entry.toLowerCase().startsWith(`${weekday.toLowerCase()}:`));
    return dayEntry ? [dayEntry] : entries.length === 1 ? entries : [];
  }
  const normalized = openingHours?.trim();
  if (!normalized) return [];

  const dayCodes: Record<string, string> = {
    Monday: 'M',
    Tuesday: 'TU',
    Wednesday: 'W',
    Thursday: 'TH',
    Friday: 'FR',
    Saturday: 'SA',
    Sunday: 'SU',
  };
  if (/^(?:M|TU|W|TH|FR|SA|SU)\[/.test(normalized)) {
    const match = normalized.match(new RegExp(`(?:^|,)${dayCodes[weekday]}\\[([^\\]]*)\\]`));
    const hours = match?.[1];
    if (!hours) return [];
    const displayHours = hours === 'C'
      ? 'Closed'
      : hours === '00:00-24:00'
        ? 'Open 24 hours'
        : hours.replaceAll(';', ', ');
    return [`${weekday}: ${displayHours}`];
  }

  const entries = normalized.split(/\r?\n|;\s*(?=[A-Za-z]+:)/).map((entry) => entry.trim()).filter(Boolean);
  const dayEntry = entries.find((entry) => entry.toLowerCase().startsWith(`${weekday.toLowerCase()}:`));
  return dayEntry ? [dayEntry] : entries.length === 1 ? entries : [];
}

function openingWindowsForDate(openingHours: string | string[] | undefined, date: string) {
  if (!openingHours) return [];
  if (Array.isArray(openingHours)) {
    const weekday = weekdayNameForDate(date) ?? 'Sunday';
    const description = openingHours.find((entry) => entry.toLowerCase().startsWith(`${weekday.toLowerCase()}:`))
      ?? (openingHours.length === 1 ? openingHours[0] : undefined);
    return parseOpeningWindowsFromDescription(description);
  }
  const normalized = openingHours.trim();
  const compact = compactOpeningWindowsForDate(normalized, date);
  return compact.length ? compact : parseOpeningWindowsFromDescription(normalized);
}

function compactOpeningWindowsForDate(openingHours: string, date: string) {
  if (!/^(?:M|TU|W|TH|FR|SA|SU)\[/.test(openingHours)) return [];
  const dayCodes = ['SU', 'M', 'TU', 'W', 'TH', 'FR', 'SA'];
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const dayCode = dayCodes[Number.isNaN(parsed.getTime()) ? 0 : parsed.getUTCDay()];
  const match = openingHours.match(new RegExp(`(?:^|,)${dayCode}\\[([^\\]]*)\\]`));
  const hours = match?.[1];
  if (!hours || hours === 'C') return [];
  if (hours === '00:00-24:00') return [{ openMinutes: 0, closeMinutes: 1440 }];
  return hours.split(';').flatMap((window) => {
    const [open, close] = window.split('-');
    const openMinutes = parseTimeForSelect(open);
    const closeMinutes = parseTimeForSelect(close);
    return openMinutes === undefined || closeMinutes === undefined ? [] : [{ openMinutes, closeMinutes: closeMinutes <= openMinutes ? closeMinutes + 1440 : closeMinutes }];
  });
}

function parseOpeningWindowsFromDescription(description?: string) {
  if (!description) return [];
  const hoursText = description.replace(/^[^:]+:\s*/, '').replace(/\u202f|\u00a0/g, ' ').trim();
  if (!hoursText || /closed|unavailable|NA/i.test(hoursText)) return [];
  if (/open\s*24\s*hours|24\/7/i.test(hoursText)) return [{ openMinutes: 0, closeMinutes: 1440 }];
  return hoursText.split(/\s*,\s*/).flatMap((period) => {
    const parts = period.split(/\s*(?:-|–|—|to)\s*/i);
    if (!parts[0] || !parts[1]) return [];
    const closeMeridiem = parts[1].match(/\b(am|pm)\b/i)?.[1];
    const openText = closeMeridiem && !/\b(am|pm)\b/i.test(parts[0]) ? `${parts[0]} ${closeMeridiem}` : parts[0];
    const openMinutes = parseTimeForSelect(openText);
    const closeMinutes = parseTimeForSelect(parts[1]);
    return openMinutes === undefined || closeMinutes === undefined ? [] : [{ openMinutes, closeMinutes: closeMinutes <= openMinutes ? closeMinutes + 1440 : closeMinutes }];
  });
}

function weekdayNameForDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number.isNaN(parsed.getTime()) ? 0 : parsed.getUTCDay()];
}

function parseTimeForSelect(value?: string) {
  const match = String(value ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return undefined;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (hours > 24 || minutes > 59) return undefined;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (!meridiem && hours === 24 && minutes === 0) return 1440;
  return hours > 23 ? undefined : hours * 60 + minutes;
}

function formatMinutesForSelect(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${`${Math.floor(normalized / 60)}`.padStart(2, '0')}:${`${normalized % 60}`.padStart(2, '0')}`;
}

function durationToMinutes(value: string) {
  const text = value.toLowerCase();
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  const minuteMatch = text.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = Math.round(hours + minutes);
  return total > 0 ? total : 90;
}

function RestDay({ date }: { date: string }) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.restIcon}><Moon size={28} color={colors.muted} /></View>
      <Heading size="md">Rest day</Heading>
      <Text style={styles.emptyText}>You have scheduled a rest day for {formatDisplayDate(date, true)}. Take it easy, recharge and enjoy the hotel.</Text>
    </Card>
  );
}

function EmptyDay() {
  return (
    <Card style={styles.emptyCard}>
      <CalendarDays size={40} color="rgba(90,100,128,0.45)" />
      <Heading size="md">No activities yet</Heading>
      <Text style={styles.emptyText}>No activities were returned for this day.</Text>
    </Card>
  );
}

function TripVibeNoMatches({ tripVibe }: { tripVibe: string }) {
  return (
    <Card style={styles.vibeEmptyCard}>
      <Sparkles size={40} color={colors.accent} />
      <Heading size="md" style={styles.vibeEmptyTitle}>Not enough matching popular places</Heading>
      <Text style={styles.emptyText}>We couldn't find enough popular places matching "{tripVibe}" for this day. Try a broader Trip vibe or remove it to generate more options.</Text>
    </Card>
  );
}

function TripVibeLowMatches({ tripVibe, count }: { tripVibe: string; count: number }) {
  const placeLabel = count === 1 ? 'place' : 'places';
  return (
    <Card style={styles.vibeNoticeCard}>
      <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
        <Sparkles size={17} color={colors.accent} />
        <Stack gap={spacing.xs} style={{ flex: 1 }}>
          <Text style={styles.vibeNoticeTitle}>Limited matches for this Trip vibe</Text>
          <Text style={styles.vibeNoticeText}>Only {count} popular {placeLabel} matched "{tripVibe}" for this day, so the plan may feel lighter than usual.</Text>
        </Stack>
      </Row>
    </Card>
  );
}

function EmptyItinerary() {
  return (
    <Card style={styles.emptyCard}>
      <Heading size="md">No itinerary generated yet</Heading>
      <Text style={styles.emptyText}>Go back to the planner and generate an itinerary to continue.</Text>
    </Card>
  );
}

function formatDisplayDate(value: string, includeYear = false) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' as const } : {}) });
}

function bestTimeFromLegacyCategory(category?: string) {
  if (!category) return undefined;
  const value = category.trim();
  return /^(early morning|morning|midday|afternoon|evening|night|late night)$/i.test(value) ? value : undefined;
}

const styles = StyleSheet.create({
  emptyPageMain: { flexGrow: 1 },
  itineraryContainer: { flexGrow: 1, paddingTop: spacing.xl },
  itineraryMain: { flex: 1, minWidth: 0 },
  activityList: { gap: spacing.md },
  customizationList: { maxHeight: 'calc(100vh - 260px)' as never, minHeight: 320, overflowY: 'auto' as never, overscrollBehavior: 'contain' as never, paddingRight: spacing.xs, paddingBottom: spacing.md },
  pressed: { opacity: 0.78 },
  sidebar: { width: 292, position: 'sticky' as never, top: spacing.md, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 24px)' as never, overflowY: 'auto' as never, paddingRight: spacing.xs },
  summaryCard: { padding: 0, overflow: 'hidden', borderRadius: 14, borderColor: '#D7E7FF', backgroundColor: '#FBFDFF', ...shadow.card },
  summaryBanner: { minHeight: 72, backgroundImage: 'linear-gradient(135deg, #092141 0%, #2575F1 58%, #5EC8DF 100%)' as never, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryLabel: { color: '#B6CEE1', textTransform: 'uppercase', fontSize: 10, fontWeight: '800' },
  summaryTitle: { color: colors.surface, fontWeight: '900' },
  summaryBody: { padding: spacing.lg, backgroundColor: '#FBFDFF' },
  summaryLabelDark: { color: colors.muted, textTransform: 'uppercase', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  summaryValue: { color: colors.text, fontSize: 12, fontWeight: '800' },
  paceEmoji: { fontSize: 14, lineHeight: 18 },
  rule: { height: 1, backgroundColor: colors.border },
  progressCard: { borderRadius: radius.lg, padding: spacing.md, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  progressTitle: { color: colors.muted, textTransform: 'uppercase', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  progressDot: { width: 18, height: 18, borderRadius: 999, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  progressDone: { backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #5EC8DF 100%)' as never },
  progressNum: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  progressText: { flex: 1, color: colors.muted, fontSize: 12 },
  progressTextDone: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  doneLabel: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  pendingLabel: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  mobileSummary: { width: '100%', padding: spacing.md, borderRadius: radius.lg, borderColor: '#D7E7FF', backgroundColor: '#F8FBFF' },
  mobileSummaryText: { color: colors.muted, fontSize: 12 },
  pageHeader: { justifyContent: 'space-between', alignItems: 'flex-start', borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 16, backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #F8FBFF 58%, #FEF0EB 100%)' as never, padding: spacing.xl },
  pageTitle: { fontSize: 24, lineHeight: 31 },
  pageSub: { color: colors.muted, fontSize: 14 },
  vibeBadge: { alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 999, backgroundColor: '#FFF7ED', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  vibeBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  breadcrumb: { color: colors.muted, fontSize: 12 },
  breadcrumbStrong: { color: colors.text, fontSize: 12, fontWeight: '800' },
  dayTabs: { gap: spacing.sm, paddingBottom: spacing.xs },
  dayTab: { minWidth: 86, minHeight: 68, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: 12, backgroundColor: '#FBFDFF', alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  restDayTab: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  activeDayTab: { backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #5EC8DF 100%)' as never, borderColor: colors.primary },
  dayText: { color: colors.text, fontWeight: '900', fontSize: 12 },
  activeDayText: { color: colors.surface, fontWeight: '900', fontSize: 12 },
  daySub: { color: colors.muted, fontSize: 11 },
  activeDaySub: { color: '#BFDBFE', fontSize: 11 },
  mobileCustomizeCard: { width: '100%', padding: spacing.md, borderRadius: radius.lg, borderColor: '#D7E7FF', backgroundColor: '#FBFDFF' },
  customizeCard: { borderRadius: radius.lg, borderColor: '#D7E7FF', backgroundColor: '#F8FBFF', padding: spacing.lg },
  customizationToolbarLayout: { alignItems: 'center', justifyContent: 'space-between' },
  customizationToolbarLayoutMobile: { flexDirection: 'column', alignItems: 'stretch' },
  customizationToolbarCopy: { flex: 1, minWidth: 260 },
  customizationToolbarCopyMobile: { width: '100%', minWidth: 0 },
  customizationActions: { alignItems: 'center' },
  customizationActionsMobile: { width: '100%' },
  mobileToolbarButton: { flexGrow: 1, flexBasis: '47%', minWidth: 0, paddingHorizontal: spacing.sm },
  customizeEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  customizeTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  customizeCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  editNotice: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#BDE7D0', borderRadius: radius.md, backgroundColor: '#E7F6EE', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editNoticeText: { flex: 1, color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  customizationError: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#F8C8C2', borderRadius: radius.md, backgroundColor: '#FEEDEB', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  customizationErrorText: { flex: 1, color: colors.danger, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  cachedPlaceOption: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md },
  cachedPlaceImage: { width: 112, height: 112, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  cachedPlacePlaceholder: { width: 112, height: 112, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  cachedPlaceBody: { flex: 1, minWidth: 0 },
  cachedPlaceTitle: { fontSize: 16, lineHeight: 21 },
  inputLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  startTimeOptions: { gap: spacing.xs, paddingVertical: spacing.xs },
  startTimeOption: { minWidth: 62, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  startTimeOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  startTimeOptionText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  startTimeOptionTextSelected: { color: colors.surface },
  insertControl: { minHeight: 34, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFDBFE', borderRadius: radius.md, backgroundColor: '#F8FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  pressedInsert: { backgroundColor: '#EBF2FE' },
  insertText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  timelineDot: { width: 31, height: 31, borderRadius: 999, backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #F8691E 100%)' as never, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface, marginTop: spacing.lg },
  timelineNum: { color: colors.surface, fontWeight: '900', fontSize: 12 },
  activityCard: { flex: 1, padding: 0, borderRadius: 14, overflow: 'hidden', borderColor: '#D7E7FF', backgroundColor: '#FBFDFF' },
  activityLayout: { flexDirection: 'row' },
  activityImageWrap: { width: 156, minHeight: 184, position: 'relative', backgroundColor: colors.surfaceMuted },
  activityImageMobile: { width: '100%', height: 178 },
  activityImage: { width: '100%', height: '100%' },
  activityImagePlaceholder: { width: '100%', height: '100%', minHeight: 176, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#F8FBFF', padding: spacing.md },
  activityImageIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2FE', borderWidth: 1, borderColor: '#BFDBFE' },
  activityBody: { flex: 1, minWidth: 0, padding: spacing.lg, backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #F8FBFF 100%)' as never },
  activityTitle: { fontSize: 17, lineHeight: 23 },
  ratingText: { fontWeight: '800', fontSize: 12 },
  metaText: { color: colors.muted, fontSize: 12 },
  detailsAddress: { color: colors.muted, fontSize: 12, flex: 1 },
  activityTimePill: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 999, backgroundColor: '#EBF2FE', paddingHorizontal: spacing.md },
  activityTimeText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  activityDurationPill: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 999, backgroundColor: '#FFF7ED', paddingHorizontal: spacing.md },
  activityDurationText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  detailMetric: { minWidth: 180, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: radius.lg, backgroundColor: '#F8FBFF', padding: spacing.md },
  detailMetricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  detailMetricLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  detailMetricValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  openingHoursSection: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: '#D7E7FF', paddingTop: spacing.md, marginTop: spacing.xs },
  openingHoursIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2FE' },
  openingHoursTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  openingHoursText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  openingHoursDisclaimer: { color: colors.warning, fontSize: 12, fontWeight: '800' },
  dotText: { color: colors.muted, fontSize: 12 },
  activityDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  detailsButton: { backgroundColor: '#EBF2FE', borderColor: '#BFDBFE' },
  activityEditPanel: { borderTopWidth: 1, borderTopColor: '#D7E7FF', paddingTop: spacing.sm, marginTop: spacing.xs },
  touchDragHandle: { width: 54, minHeight: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderStyle: 'solid', borderColor: '#D7E7FF', borderRadius: radius.md, backgroundColor: '#F8FBFF', touchAction: 'none', cursor: 'grab', userSelect: 'none' },
  touchDragHandleText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  iconAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: '#D7E7FF', borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  iconActionDanger: { borderColor: '#F8C8C2', backgroundColor: '#FEEDEB' },
  iconActionDisabled: { backgroundColor: colors.surfaceMuted, opacity: 0.72 },
  iconActionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  iconActionTextDanger: { color: colors.danger },
  iconActionTextDisabled: { color: colors.muted },
  travelConnector: { alignItems: 'center', marginLeft: 15, paddingVertical: spacing.xs },
  travelLine: { width: 1, height: 24, backgroundColor: colors.border },
  travelText: { color: colors.muted, fontSize: 11, marginLeft: spacing.lg },
  lunchBreakRow: { minHeight: 60, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA', borderRadius: radius.md, backgroundColor: '#FFF7ED', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginLeft: 47 },
  lunchBreakIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  lunchBreakTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  lunchBreakTime: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  travelDisclaimer: { alignItems: 'flex-start', paddingHorizontal: spacing.xs },
  travelDisclaimerText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  routingNotice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.md, backgroundColor: '#FFFBEB', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  routingNoticeText: { flex: 1, color: colors.warning, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  reviewHeading: { fontSize: 16 },
  reviewMeta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  detailsImage: { width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  detailsDescription: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  reviewsSection: { borderRadius: radius.xl, borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
  reviewCard: { borderWidth: 1, borderColor: '#D7E7FF', borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surface },
  reviewAuthor: { fontSize: 13, fontWeight: '900' },
  reviewText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  emptyCard: { borderStyle: 'dashed', alignItems: 'center', padding: spacing.xxl },
  vibeEmptyCard: { borderStyle: 'dashed', alignItems: 'center', padding: spacing.xxl, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  vibeEmptyTitle: { color: colors.primaryDark, textAlign: 'center' },
  vibeNoticeCard: { borderRadius: radius.lg, borderColor: '#FED7AA', backgroundColor: '#FFF7ED', padding: spacing.md },
  vibeNoticeTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  vibeNoticeText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  emptyGeneratedCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  restIcon: { width: 52, height: 52, borderRadius: 999, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 360 },
  modalField: { flex: 1, minWidth: 180 },
  mobileCta: { position: 'sticky' as never, bottom: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  mobileCtaButton: { minHeight: 48, borderRadius: 12, backgroundImage: 'linear-gradient(135deg, #2575F1 0%, #F8691E 100%)' as never, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  mobileCtaText: { color: colors.surface, fontWeight: '900' }
});
