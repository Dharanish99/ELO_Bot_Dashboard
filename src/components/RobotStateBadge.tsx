import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { RobotMode } from '../types';

interface RobotStateBadgeProps {
  mode: RobotMode;
  updatedAt: string | null;
  isConnected: boolean;
  targetLabel?: string | null;
  commandPending?: string | null;
}

export const RobotStateBadge: React.FC<RobotStateBadgeProps> = ({
  mode,
  updatedAt,
  isConnected,
  targetLabel,
  commandPending,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Micro-bounce on mode change
  useEffect(() => {
    scaleAnim.setValue(0.92);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const timeStr = formatTime(updatedAt);

  // Configure appearance per RobotMode
  const getStateConfig = (currentMode: RobotMode) => {
    switch (currentMode) {
      case 'moving':
        return {
          title: 'Moving',
          icon: 'footsteps-outline' as const,
          description: targetLabel
            ? `Following: ${targetLabel}`
            : 'Following child around the room',
          color: colors.stateMoving || colors.textPrimary,
        };
      case 'interacting':
        return {
          title: 'Interacting',
          icon: 'chatbubble-ellipses-outline' as const,
          description: 'Teaching, listening & checking in',
          color: colors.stateInteracting || colors.textPrimary,
        };
      case 'stopped':
        return {
          title: 'Stopped',
          icon: 'pause-circle-outline' as const,
          description: 'Motors stopped • Stationary & safe',
          color: colors.stateStopped || colors.textMuted,
        };
      case 'unknown':
      default:
        return {
          title: 'Standby',
          icon: 'help-circle-outline' as const,
          description: 'Syncing robot telemetry...',
          color: colors.stateUnknown || colors.textMuted,
        };
    }
  };

  const config = getStateConfig(mode);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {/* Context: tiny timestamp or transitional message */}
      <Text style={styles.timestamp}>
        {commandPending ? commandPending.toUpperCase() : timeStr ? `SYNCED AT ${timeStr}` : 'CURRENT STATE'}
      </Text>

      {/* Primary: Mode name with icon */}
      <View style={styles.modeRow}>
        <Ionicons
          name={config.icon}
          size={32}
          color={config.color}
          style={styles.modeIcon}
        />
        <Text style={[styles.modeTitle, { color: config.color }]}>
          {config.title}
        </Text>
      </View>

      {/* Secondary: description line */}
      <Text style={styles.modeDescription}>
        {config.description}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modeIcon: {
    marginRight: spacing.md,
  },
  modeTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
