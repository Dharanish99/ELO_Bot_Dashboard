import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { RobotMode } from '../types';

interface RobotStateBadgeProps {
  mode: RobotMode;
  updatedAt: string | null;
  isConnected: boolean;
}

export const RobotStateBadge: React.FC<RobotStateBadgeProps> = ({
  mode,
  updatedAt,
  isConnected,
}) => {
  const isMoving = mode === 'moving';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Entrance animation
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
      {/* Context: tiny timestamp */}
      {timeStr ? (
        <Text style={styles.timestamp}>{timeStr}</Text>
      ) : null}

      {/* Primary: Mode name with icon */}
      <View style={styles.modeRow}>
        <Ionicons
          name={isMoving ? 'footsteps-outline' : 'chatbubble-ellipses-outline'}
          size={28}
          color={colors.textPrimary}
          style={styles.modeIcon}
        />
        <Text style={styles.modeTitle}>
          {isMoving ? 'Moving' : 'Interacting'}
        </Text>
      </View>

      {/* Secondary: one description line */}
      <Text style={styles.modeDescription}>
        {isMoving
          ? 'Following child around the room'
          : 'Teaching, listening & checking in'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.lg,
    fontWeight: '500',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modeIcon: {
    marginRight: spacing.md,
  },
  modeTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  modeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
