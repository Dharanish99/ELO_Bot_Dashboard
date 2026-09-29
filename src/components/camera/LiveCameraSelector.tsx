import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { EloTarget, TargetLockState } from '../../types';
import { useCameraStream } from '../../hooks/useCameraStream';
import { CameraViewport } from './CameraViewport';

interface LiveCameraSelectorProps {
  baseUrl: string;
  targets: EloTarget[];
  stagedTargetId: string | null;
  lockedTargetId: string | null;
  targetLockState: TargetLockState;
  isConnected: boolean;
  isActive: boolean;
  onStageTarget: (targetId: string) => void;
  onLockTarget: (targetId: string) => Promise<boolean>;
  onClearSelection: () => void;
}

export const LiveCameraSelector: React.FC<LiveCameraSelectorProps> = ({
  baseUrl,
  targets,
  stagedTargetId,
  lockedTargetId,
  targetLockState,
  isConnected,
  isActive,
  onStageTarget,
  onLockTarget,
  onClearSelection,
}) => {
  const {
    cameraState,
    frameUrl,
    lastGoodFrameUrl,
    frameWidth,
    frameHeight,
    fps,
    onFrameLoaded,
    onFrameError,
    retry,
  } = useCameraStream(baseUrl, isActive && isConnected);

  const handleTargetPress = useCallback(
    (target: EloTarget) => {
      const normalizedId = String(target.id);
      if (targetLockState === 'locked' && lockedTargetId === normalizedId) {
        // Already locked on this target — keep lock
        return;
      }
      onStageTarget(normalizedId);
    },
    [targetLockState, lockedTargetId, onStageTarget]
  );

  const handleLockPress = useCallback(async () => {
    if (!stagedTargetId) return;
    await onLockTarget(stagedTargetId);
  }, [stagedTargetId, onLockTarget]);

  // Target display info
  const displayId = lockedTargetId || stagedTargetId;
  const displayTarget = targets.find((t) => String(t.id) === String(displayId));

  const targetCount = targets.length;
  const hasTargets = targetCount > 0;
  const isLocking = targetLockState === 'locking';
  const isLocked = targetLockState === 'locked';
  const isStaged = targetLockState === 'staged';
  const isLost = targetLockState === 'lost';
  const isReacquiring = targetLockState === 'reacquiring';

  // Check if selected target is currently present in detection frame
  const isPersonCurrentlyVisible =
    stagedTargetId != null &&
    targets.some(
      (t) =>
        String(t.id) === String(stagedTargetId) &&
        t.tracking_state !== 'lost' &&
        t.tracking_state !== 'reacquiring'
    );

  // Contextual hint text below camera
  const getHintText = (): string => {
    if (!isConnected) return 'Connect to ELO to see the view';
    if (cameraState === 'offline') return 'ELO is offline';
    if (cameraState === 'unavailable') return 'Camera unavailable on this ELO';
    if (!hasTargets) return 'No people detected in view';
    if (isLocked && !isLost && !isReacquiring) return `Locked: ${displayTarget?.label ?? lockedTargetId}`;
    if (isLost) return `${displayTarget?.label ?? 'Target'} — searching…`;
    if (isReacquiring) return `Reacquiring ${displayTarget?.label ?? 'target'}…`;
    if (isStaged && displayTarget) return `${displayTarget.label} selected — tap Lock to confirm`;
    return `${targetCount} ${targetCount === 1 ? 'person' : 'people'} detected · Tap to select`;
  };

  const hasSelectionOrLock = stagedTargetId != null || lockedTargetId != null;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>ELO'S VIEW</Text>
        {hasSelectionOrLock && (
          <TouchableOpacity
            onPress={onClearSelection}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear target selection"
            accessibilityRole="button"
          >
            <Text style={styles.clearText}>CLEAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Camera viewport */}
      <CameraViewport
        cameraState={isConnected ? cameraState : 'offline'}
        frameUrl={frameUrl}
        lastGoodFrameUrl={lastGoodFrameUrl}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        fps={fps}
        targets={targets}
        stagedTargetId={stagedTargetId}
        lockedTargetId={lockedTargetId}
        targetLockState={targetLockState}
        isConnected={isConnected}
        onFrameLoaded={onFrameLoaded}
        onFrameError={onFrameError}
        onTargetPress={handleTargetPress}
        onRetry={retry}
      />

      {/* Hint / status line */}
      <Text
        style={[
          styles.hintText,
          isLost && styles.hintTextWarning,
          isLocked && !isLost && styles.hintTextLocked,
        ]}
        numberOfLines={1}
      >
        {getHintText()}
      </Text>

      {/* LOCK TARGET / TARGET LOCKED action zone — never disappears during transient loss */}
      {(hasSelectionOrLock || isStaged || isLocking || isLocked || isLost || isReacquiring) && (
        <View style={styles.lockPanel}>
          {isLocked && !isLost && !isReacquiring ? (
            // Confirmed Locked state
            <View style={styles.lockedRow}>
              <View style={styles.lockIndicatorDot} />
              <Text style={styles.lockedLabel}>TARGET LOCKED</Text>
              {displayTarget?.distance != null && (
                <Text style={styles.lockedMeta}>
                  {displayTarget.distance.toFixed(1)}m away
                </Text>
              )}
            </View>
          ) : isLocked && (isLost || isReacquiring) ? (
            // Locked but target temporarily disappeared (reacquiring)
            <View style={styles.lockedRow}>
              <View style={[styles.lockIndicatorDot, { backgroundColor: colors.wheelAmber }]} />
              <Text style={[styles.lockedLabel, { color: colors.wheelAmber }]}>
                {isReacquiring ? 'REACQUIRING…' : 'TARGET LOST'}
              </Text>
              <Text style={styles.lockedMeta}>Searching for {displayTarget?.label ?? 'person'}…</Text>
            </View>
          ) : isLocking ? (
            // Lock request in-flight
            <View style={[styles.lockButton, styles.lockButtonBusy]}>
              <ActivityIndicator size="small" color={colors.textInverse} style={{ marginRight: 8 }} />
              <Text style={styles.lockButtonText}>LOCKING…</Text>
            </View>
          ) : isStaged && isPersonCurrentlyVisible ? (
            // Target staged and currently visible — enabled
            <TouchableOpacity
              style={styles.lockButton}
              onPress={handleLockPress}
              activeOpacity={0.75}
              accessibilityLabel="Lock target for following"
              accessibilityRole="button"
            >
              <Text style={styles.lockButtonText}>LOCK TARGET</Text>
            </TouchableOpacity>
          ) : isStaged && !isPersonCurrentlyVisible ? (
            // Target staged but temporarily lost — visible but disabled
            <View style={[styles.lockButton, styles.lockButtonWaiting]}>
              <Text style={styles.lockButtonWaitingText}>WAITING FOR TARGET</Text>
              <Text style={styles.lockButtonSubText}>Reacquiring…</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  clearButton: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  clearText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
  },
  hintTextWarning: {
    color: colors.wheelAmber,
  },
  hintTextLocked: {
    color: colors.textSecondary,
  },
  lockPanel: {
    marginTop: spacing.md,
  },
  lockButton: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  lockButtonBusy: {
    opacity: 0.7,
  },
  lockButtonWaiting: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'column',
    paddingVertical: spacing.sm + 2,
    gap: 2,
  },
  lockButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: 1.5,
  },
  lockButtonWaitingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.wheelAmber,
    letterSpacing: 1.2,
  },
  lockButtonSubText: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  lockIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.dotOnline,
  },
  lockedLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  lockedMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
});
