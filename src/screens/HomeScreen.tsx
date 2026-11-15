/**
 * HomeScreen.tsx  —  ELO Follow Console (V2)
 *
 * Camera-first layout:
 *   A. Compact inline header (ELO wordmark + Pi state pill)
 *   B. CameraPanel — full-width 4:3 live feed with bbox overlays
 *   C. Person count line + PersonRail
 *   D. Follow target summary line
 *   E. Action dock: FOLLOW · INTERACT · STOP
 *   F. Command error banner
 *   G. Secondary fold: SubsystemStatusBar, SafetyStatusCard,
 *      SessionTimeIndicator, PrivacyCard
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { useV2 } from '../context/V2Context';

import { CameraPanel } from '../components/CameraPanel';
import { PersonRail } from '../components/PersonRail';
import { SubsystemStatusBar } from '../components/SubsystemStatusBar';
import { SafetyStatusCard } from '../components/SafetyStatusCard';
import { SessionTimeIndicator } from '../components/SessionTimeIndicator';
import { PrivacyCard } from '../components/PrivacyCard';

// ─── Helpers ───────────────────────────────────────────────────────────────

function labelFromTrackId(track_id: string, label?: string): string {
  if (label) return label;
  const match = track_id.match(/(\d+)$/);
  return match ? `Person ${parseInt(match[1], 10)}` : `Person ${track_id.slice(-3)}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const HomeScreen: React.FC = () => {
  // ── V1 ELO context ────────────────────────────────────────────────────────
  const {
    isConnected,
    isUnreachable,
    retryConnection,
    obstacleDetected,
    obstacleDetail,
    aiConnected,
    audioReady,
    isMuted,
    excludeFromReport,
    setMuteMicrophone,
    setExcludeFromReport,
    isTogglingMute,
    isTogglingVisibility,
    commandError: v1CommandError,
    clearCommandError: clearV1CommandError,
  } = useELO();

  // ── V2 context ────────────────────────────────────────────────────────────
  const {
    isWsConnected,
    latestState,
    displayedFrame,
    isFrameStale,
    selectionPendingId,
    commandPending,
    commandError: v2CommandError,
    clearCommandError: clearV2CommandError,
    selectByPoint,
    sendFollow,
    sendStop,
    sendInteract,
    activateControl,
    deactivateControl,
  } = useV2();

  // ── Focus lifecycle ───────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      activateControl();
      return () => {
        deactivateControl();
      };
    }, [activateControl, deactivateControl]),
  );

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await retryConnection();
    } finally {
      setRefreshing(false);
    }
  }, [retryConnection]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const confirmedTargetId = latestState?.selection.target_id ?? null;
  const motionEnabled = latestState?.motion.enabled ?? true;
  const safetyLocked = latestState?.robot.safety_locked ?? false;
  const robotMode = latestState?.robot.mode ?? 'stopped';

  const controlDisabled = !isWsConnected || !!commandPending;

  const targets = displayedFrame?.targets ?? latestState?.targets ?? [];
  const frameTimestamp = displayedFrame?.frameTimestamp ?? 0;

  // Person labels for display
  const confirmedTarget = targets.find((t) => t.track_id === confirmedTargetId);
  const confirmedLabel = confirmedTarget
    ? labelFromTrackId(confirmedTarget.track_id, confirmedTarget.label)
    : confirmedTargetId
    ? `Person ${confirmedTargetId.slice(-3)}`
    : null;

  const pendingTarget = targets.find((t) => t.track_id === selectionPendingId);
  const pendingLabel = pendingTarget
    ? labelFromTrackId(pendingTarget.track_id, pendingTarget.label)
    : selectionPendingId
    ? `Person ${selectionPendingId.slice(-3)}`
    : null;

  // Check if confirmed target is currently lost from view
  const isTargetLost = Boolean(confirmedTargetId && !confirmedTarget);

  // Active error — V2 takes priority
  const activeError = v2CommandError ?? v1CommandError;
  const clearActiveError = v2CommandError
    ? clearV2CommandError
    : clearV1CommandError;

  // Follow button state
  const followDisabled =
    !isWsConnected ||
    !!commandPending ||
    !confirmedTargetId ||
    isTargetLost ||
    !motionEnabled ||
    safetyLocked;

  const followLabel = confirmedTargetId
    ? `Follow ${confirmedLabel ?? 'Person'}`
    : 'Select a Person First';

  const isMoving = robotMode === 'moving';
  const isInteracting = robotMode === 'interacting';

  // Pi state pill label
  const piModeLabel = latestState
    ? `PI ONLINE · ${robotMode.toUpperCase()}`
    : isWsConnected
    ? 'PI ONLINE'
    : 'PI OFFLINE';

  const piDotColor = isWsConnected ? colors.dotOnline : colors.accent;

  // Motion disabled reason
  const motionReason = isTargetLost
    ? 'Selected person is not visible in current frame'
    : !motionEnabled || safetyLocked
    ? latestState?.motion.reason ?? 'Motion disabled by Pi'
    : null;

  // Target summary line
  let targetSummary: string;
  if (confirmedTargetId && confirmedLabel) {
    if (isTargetLost) {
      targetSummary = `Following target: ${confirmedLabel} (lost from view) · range unavailable`;
    } else {
      const rangeTarget = confirmedTarget;
      const rangeStr =
        rangeTarget?.range_m != null
          ? `${rangeTarget.range_m.toFixed(1)}m`
          : 'range unavailable';
      targetSummary = `Following target: ${confirmedLabel} · ${rangeStr}`;
    }
  } else if (selectionPendingId && pendingLabel) {
    targetSummary = `Selecting ${pendingLabel}...`;
  } else {
    targetSummary = 'No target selected — tap a person in the feed';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── A. Compact inline header ───────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>ELO</Text>
        <View style={styles.headerRight}>
          {isUnreachable && (
            <Text style={styles.unreachableText}>Pi unreachable</Text>
          )}
          <View style={styles.piPill}>
            <View style={[styles.piDot, { backgroundColor: piDotColor }]} />
            <Text style={styles.piPillText}>{piModeLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* ── B. Camera Panel ──────────────────────────────────────────── */}
        <CameraPanel
          displayedFrame={displayedFrame}
          isFrameStale={isFrameStale}
          isWsConnected={isWsConnected}
          confirmedTargetId={confirmedTargetId}
          pendingTargetId={selectionPendingId}
          onTapTarget={selectByPoint}
          disabled={controlDisabled}
        />

        {/* ── C. Person count + rail ───────────────────────────────────── */}
        <View style={styles.personCountRow}>
          {targets.length > 0 ? (
            <Text style={styles.personCountText}>
              {targets.length} {targets.length === 1 ? 'person' : 'people'} in view
            </Text>
          ) : (
            <Text style={styles.personCountText}>
              No people detected in the current frame
            </Text>
          )}
        </View>

        {targets.length > 0 && (
          <PersonRail
            targets={targets}
            confirmedTargetId={confirmedTargetId}
            pendingTargetId={selectionPendingId}
            frameTimestamp={frameTimestamp}
            onSelectPerson={selectByPoint}
            disabled={controlDisabled}
          />
        )}

        {/* ── D. Follow target summary ─────────────────────────────────── */}
        <View style={styles.targetSummaryRow}>
          <Text style={styles.targetSummaryText}>{targetSummary}</Text>
        </View>

        {/* ── F. Command error banner ──────────────────────────────────── */}
        {activeError ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.accent}
              style={{ marginRight: spacing.sm }}
            />
            <Text style={styles.errorBannerText}>{activeError}</Text>
            <TouchableOpacity
              onPress={clearActiveError}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Dismiss error"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── E. Action dock ───────────────────────────────────────────── */}
        <View style={styles.actionDock}>
          {/* FOLLOW button (flex 2) */}
          <View style={{ flex: 2 }}>
            <TouchableOpacity
              onPress={() => sendFollow()}
              disabled={followDisabled}
              accessibilityLabel={followLabel}
              style={[
                styles.followBtn,
                followDisabled && styles.btnDisabled,
                isMoving && styles.followBtnActive,
              ]}
            >
              {commandPending === 'follow' ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <Text
                  style={[
                    styles.followBtnText,
                    followDisabled && styles.btnTextDisabled,
                  ]}
                >
                  {isMoving ? '● ' : ''}{followLabel}
                </Text>
              )}
            </TouchableOpacity>
            {/* Motion disabled reason */}
            {motionReason && (
              <Text style={styles.motionReasonText}>{motionReason}</Text>
            )}
          </View>

          {/* INTERACT button (smaller, only when not interacting) */}
          {!isInteracting && (
            <TouchableOpacity
              onPress={() => sendInteract()}
              disabled={!isWsConnected || !!commandPending || !confirmedTargetId}
              accessibilityLabel="Interact"
              style={[
                styles.interactBtn,
                (!isWsConnected || !!commandPending || !confirmedTargetId) &&
                  styles.btnDisabled,
              ]}
            >
              {commandPending === 'interact' ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={styles.interactBtnText}>Interact</Text>
              )}
            </TouchableOpacity>
          )}

          {/* STOP button (flex 1, red) */}
          <TouchableOpacity
            onPress={() => sendStop()}
            disabled={!isWsConnected}
            accessibilityLabel="Stop"
            style={[
              styles.stopBtn,
              { flex: 1 },
              !isWsConnected && styles.btnDisabled,
            ]}
          >
            {commandPending === 'stop' ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={styles.stopBtnText}>STOP</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── G. Secondary fold ────────────────────────────────────────── */}
        <View style={styles.secondaryFold}>
          <SubsystemStatusBar
            aiConnected={aiConnected}
            audioReady={audioReady}
            isConnected={isConnected}
          />
          <SafetyStatusCard
            obstacleDetected={obstacleDetected}
            obstacleDetail={obstacleDetail}
            robotState={robotMode === 'moving' ? 'moving' : robotMode === 'interacting' ? 'interacting' : 'stopped'}
          />
          <SessionTimeIndicator />
          <PrivacyCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unreachableText: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  piPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 5,
  },
  piDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  piPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // ── Scroll ───────────────────────────────────────────────────────────────
  scrollContent: {
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  // ── Person count ─────────────────────────────────────────────────────────
  personCountRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  personCountText: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  // ── Target summary ────────────────────────────────────────────────────────
  targetSummaryRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  targetSummaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  // ── Error banner ──────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },
  // ── Action dock ───────────────────────────────────────────────────────────
  actionDock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  followBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  followBtnActive: {
    borderColor: colors.stateMoving,
    borderWidth: 2,
  },
  followBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  interactBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  interactBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stopBtn: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  stopBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.5,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnTextDisabled: {
    color: colors.textMuted,
  },
  motionReasonText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  // ── Secondary fold ────────────────────────────────────────────────────────
  secondaryFold: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
