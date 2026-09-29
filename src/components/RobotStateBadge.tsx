import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, spacing } from '../theme';
import { RobotMode } from '../types';

interface RobotStateBadgeProps {
  mode: RobotMode;
  updatedAt: string | null;
  isConnected: boolean;
  targetLabel?: string | null;
  targetDistance?: number | null;
  commandPending?: string | null;
}

export const RobotStateBadge: React.FC<RobotStateBadgeProps> = ({
  mode,
  updatedAt,
  isConnected,
  targetLabel,
  targetDistance,
  commandPending,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const prevMode = useRef(mode);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Smooth cross-fade on mode change
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.5, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 0.95, friction: 10, tension: 200, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 150, useNativeDriver: true }),
      ]),
    ]).start();
  }, [mode]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getStateConfig = (m: RobotMode) => {
    switch (m) {
      case 'moving':
        return {
          verb: 'FOLLOWING',
          color: colors.wheelAmber,
          dotColor: colors.wheelAmber,
          subColor: colors.textSecondary,
        };
      case 'interacting':
        return {
          verb: 'INTERACTING',
          color: colors.eyeCyan,
          dotColor: colors.eyeCyan,
          subColor: colors.textSecondary,
        };
      case 'stopped':
        return {
          verb: 'STOPPED',
          color: colors.textMuted,
          dotColor: colors.dotOffline,
          subColor: colors.textMuted,
        };
      default:
        return {
          verb: 'STANDBY',
          color: colors.textMuted,
          dotColor: colors.textMuted,
          subColor: colors.textMuted,
        };
    }
  };

  const config = getStateConfig(mode);
  const timeStr = formatTime(updatedAt);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      {/* Context label */}
      <Text style={styles.contextLabel}>
        {commandPending
          ? commandPending.toUpperCase()
          : timeStr
          ? `SYNCED ${timeStr}`
          : 'CURRENT STATE'}
      </Text>

      {/* State line */}
      <View style={styles.stateRow}>
        <View style={[styles.stateDot, { backgroundColor: config.dotColor }]} />
        <Text style={[styles.stateText, { color: config.color }]}>
          {config.verb}
        </Text>
      </View>

      {/* Target / description */}
      {mode === 'moving' && targetLabel ? (
        <View style={styles.targetRow}>
          <Text style={styles.targetName}>{targetLabel}</Text>
          {targetDistance != null && (
            <Text style={styles.targetDistance}>{targetDistance.toFixed(1)}m away</Text>
          )}
        </View>
      ) : mode === 'interacting' ? (
        <Text style={[styles.subText, { color: config.subColor }]}>
          Conversation · Learning · Companionship
        </Text>
      ) : mode === 'stopped' ? (
        <Text style={[styles.subText, { color: config.subColor }]}>
          Motors disengaged · Ready for command
        </Text>
      ) : (
        <Text style={[styles.subText, { color: config.subColor }]}>
          Syncing telemetry…
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs + 2,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  targetName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  targetDistance: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '400',
  },
  subText: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: spacing.xs,
    letterSpacing: 0.2,
  },
});
