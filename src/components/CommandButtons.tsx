import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { RobotMode, TargetLockState } from '../types';

interface CommandButtonsProps {
  currentMode: RobotMode;
  commandPending: string | null;
  isConnected: boolean;
  targetLockState: TargetLockState;
  lockedTargetId: string | null;
  onRequestFollow: () => Promise<boolean>;
  onRequestInteract: () => Promise<boolean>;
  onRequestStop: () => Promise<boolean>;
}

// ── Dynamic tactile press physics ──
function useTactileButton() {
  const scale = useRef(new Animated.Value(1)).current;
  const pressGlow = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.92,
        friction: 8,
        tension: 380,
        useNativeDriver: true,
      }),
      Animated.timing(pressGlow, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onPressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 240,
        useNativeDriver: true,
      }),
      Animated.timing(pressGlow, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return { scale, pressGlow, onPressIn, onPressOut };
}

// ── Dynamic walking dots animation for FOLLOW ──
const WalkingDots: React.FC = () => {
  const dots = [0, 1, 2].map((i) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(anim, {
            toValue: -5,
            duration: 280,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 280,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay(260),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);

    return (
      <Animated.View
        key={i}
        style={[styles.walkDot, { transform: [{ translateY: anim }] }]}
      />
    );
  });

  return <View style={styles.walkDotsRow}>{dots}</View>;
};

// ── Dynamic sound wave bars for INTERACT ──
const SoundWaveBars: React.FC = () => {
  const heights = [10, 16, 12, 18, 14];
  const bars = [0, 1, 2, 3, 4].map((i) => {
    const anim = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 90),
          Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.2,
            duration: 320,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);

    const barH = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [4, heights[i]],
    });

    return (
      <Animated.View
        key={i}
        style={[styles.soundBar, { height: barH }]}
      />
    );
  });

  return <View style={styles.soundBarsRow}>{bars}</View>;
};

export const CommandButtons: React.FC<CommandButtonsProps> = ({
  currentMode,
  commandPending,
  isConnected,
  targetLockState,
  lockedTargetId,
  onRequestFollow,
  onRequestInteract,
  onRequestStop,
}) => {
  const isBusy = !!commandPending;

  const followEnabled = isConnected && !isBusy && targetLockState === 'locked';
  const interactEnabled = isConnected && !isBusy;
  const stopEnabled = !isBusy;

  const followBtn = useTactileButton();
  const interactBtn = useTactileButton();
  const stopBtn = useTactileButton();

  const isFollowing = currentMode === 'moving';
  const isInteracting = currentMode === 'interacting';
  const isStopped = currentMode === 'stopped';

  // Active breathing pulse for FOLLOW
  const followPulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (isFollowing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(followPulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(followPulseAnim, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      followPulseAnim.setValue(0.4);
    }
  }, [isFollowing]);

  // Active breathing pulse for INTERACT
  const interactPulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (isInteracting) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(interactPulseAnim, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(interactPulseAnim, {
            toValue: 0.35,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      interactPulseAnim.setValue(0.4);
    }
  }, [isInteracting]);

  // Alert pulse for STOP when moving
  const stopAlertPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isFollowing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(stopAlertPulse, {
            toValue: 1.05,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(stopAlertPulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      stopAlertPulse.setValue(1);
    }
  }, [isFollowing]);

  const getFollowHint = (): string | null => {
    if (!isConnected) return 'Connect to ELO first';
    if (targetLockState === 'none') return 'Select a person on Camera to follow';
    if (targetLockState === 'staged' || targetLockState === 'locking') return 'Lock target on Camera to enable';
    if (targetLockState === 'lost') return 'Target lost — reacquiring…';
    if (targetLockState === 'reacquiring') return 'Reacquiring target…';
    return null;
  };

  const followHint = targetLockState !== 'locked' ? getFollowHint() : null;

  return (
    <View style={styles.container}>
      {commandPending ? (
        <View style={styles.pendingBanner}>
          <ActivityIndicator size="small" color={colors.textPrimary} style={{ marginRight: spacing.sm }} />
          <Text style={styles.pendingText}>{commandPending}</Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        {/* ── FOLLOW BUTTON ── */}
        <Animated.View style={[styles.btnWrapper, { transform: [{ scale: followBtn.scale }] }]}>
          <TouchableOpacity
            style={[
              styles.cmdButton,
              isFollowing && styles.followActive,
              !followEnabled && styles.disabledButton,
            ]}
            onPress={onRequestFollow}
            onPressIn={followEnabled ? followBtn.onPressIn : undefined}
            onPressOut={followEnabled ? followBtn.onPressOut : undefined}
            disabled={!followEnabled}
            activeOpacity={1}
            accessibilityLabel="Follow target"
            accessibilityRole="button"
            accessibilityState={{ disabled: !followEnabled, selected: isFollowing }}
          >
            {/* Active Amber Glow */}
            {isFollowing && (
              <Animated.View
                style={[
                  styles.activeGlow,
                  {
                    backgroundColor: colors.wheelAmberMuted,
                    opacity: followPulseAnim,
                  },
                ]}
              />
            )}

            {/* Press highlight */}
            <Animated.View
              style={[
                styles.pressHighlight,
                { opacity: followBtn.pressGlow },
              ]}
              pointerEvents="none"
            />

            {/* Icon / State Indicator */}
            {isFollowing ? (
              <WalkingDots />
            ) : (
              <Ionicons
                name="walk-outline"
                size={22}
                color={isFollowing ? colors.wheelAmber : followEnabled ? colors.textPrimary : colors.textMuted}
              />
            )}

            <Text
              style={[
                styles.buttonLabel,
                isFollowing && { color: colors.wheelAmber, fontWeight: '900' },
                !followEnabled && { color: colors.textMuted },
              ]}
            >
              {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
            </Text>

            {isFollowing && (
              <View style={[styles.activeBorderTop, { backgroundColor: colors.wheelAmber }]} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── INTERACT BUTTON ── */}
        <Animated.View style={[styles.btnWrapper, { transform: [{ scale: interactBtn.scale }] }]}>
          <TouchableOpacity
            style={[
              styles.cmdButton,
              isInteracting && styles.interactActive,
              !interactEnabled && styles.disabledButton,
            ]}
            onPress={onRequestInteract}
            onPressIn={interactEnabled ? interactBtn.onPressIn : undefined}
            onPressOut={interactEnabled ? interactBtn.onPressOut : undefined}
            disabled={!interactEnabled}
            activeOpacity={1}
            accessibilityLabel="Start interaction"
            accessibilityRole="button"
            accessibilityState={{ disabled: !interactEnabled, selected: isInteracting }}
          >
            {/* Active Cyan Glow */}
            {isInteracting && (
              <Animated.View
                style={[
                  styles.activeGlow,
                  {
                    backgroundColor: colors.eyeCyanMuted,
                    opacity: interactPulseAnim,
                  },
                ]}
              />
            )}

            {/* Press highlight */}
            <Animated.View
              style={[
                styles.pressHighlight,
                { opacity: interactBtn.pressGlow },
              ]}
              pointerEvents="none"
            />

            {/* Icon / Soundwave indicator */}
            {isInteracting ? (
              <SoundWaveBars />
            ) : (
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={isInteracting ? colors.eyeCyan : interactEnabled ? colors.textPrimary : colors.textMuted}
              />
            )}

            <Text
              style={[
                styles.buttonLabel,
                isInteracting && { color: colors.eyeCyan, fontWeight: '900' },
                !interactEnabled && { color: colors.textMuted },
              ]}
            >
              {isInteracting ? 'CHATTING' : 'INTERACT'}
            </Text>

            {isInteracting && (
              <View style={[styles.activeBorderTop, { backgroundColor: colors.eyeCyan }]} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── EMERGENCY STOP BUTTON ── */}
        <Animated.View
          style={[
            styles.btnWrapperStop,
            {
              transform: [
                { scale: isFollowing ? Animated.multiply(stopBtn.scale, stopAlertPulse) : stopBtn.scale },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.cmdButton,
              styles.stopButton,
              isStopped && styles.stopActive,
              !stopEnabled && styles.disabledButton,
            ]}
            onPress={onRequestStop}
            onPressIn={stopBtn.onPressIn}
            onPressOut={stopBtn.onPressOut}
            disabled={!stopEnabled}
            activeOpacity={1}
            accessibilityLabel="Emergency stop"
            accessibilityRole="button"
          >
            {/* Press highlight */}
            <Animated.View
              style={[
                styles.pressHighlight,
                { opacity: stopBtn.pressGlow },
              ]}
              pointerEvents="none"
            />

            <Ionicons name="stop-circle" size={26} color={colors.accent} />
            <Text style={styles.stopLabel}>STOP</Text>

            {isFollowing && (
              <View style={[styles.activeBorderTop, { backgroundColor: colors.accent }]} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Contextual guidance hint */}
      {followHint ? (
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
          <Text style={styles.followHint}>{followHint}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  btnWrapper: {
    flex: 1,
  },
  btnWrapperStop: {
    width: 92,
  },
  cmdButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 84,
  },
  pressHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  activeBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  followActive: {
    borderColor: colors.wheelAmberBorder,
    borderWidth: 1.5,
  },
  interactActive: {
    borderColor: colors.eyeCyanBorder,
    borderWidth: 1.5,
  },
  stopButton: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  stopActive: {
    borderWidth: 1.5,
  },
  disabledButton: {
    opacity: 0.35,
  },
  buttonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginTop: spacing.xs + 2,
  },
  stopLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.2,
    marginTop: spacing.xs + 2,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  followHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  // Walking dots (FOLLOW active)
  walkDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    gap: 4,
  },
  walkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.wheelAmber,
  },
  // Sound wave bars (INTERACT active)
  soundBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    gap: 3,
  },
  soundBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: colors.eyeCyan,
  },
});
