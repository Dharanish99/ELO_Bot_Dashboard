import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

export const SessionTimeIndicator: React.FC = () => {
  const { currentSession } = useELO();

  if (!currentSession) return null;

  const { elapsedMinutes, dailyLimitMinutes } = currentSession;
  const clamped = Math.max(0, elapsedMinutes);
  const limit = Math.max(1, dailyLimitMinutes);
  const pct = Math.min(100, Math.round((clamped / limit) * 100));
  const isNear = pct >= 80;
  const isExceeded = clamped >= limit;

  return (
    <View style={styles.container}>
      {/* Thin progress bar */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              backgroundColor: isExceeded
                ? colors.progressExceeded
                : isNear
                ? colors.progressNearLimit
                : colors.progressFill,
            },
          ]}
        />
      </View>

      {/* Primary: elapsed / limit */}
      <Text style={[styles.timeText, isExceeded && styles.timeTextDanger]}>
        {clamped} / {dailyLimitMinutes} min
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  track: {
    height: 3,
    backgroundColor: colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  timeText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  timeTextDanger: {
    color: colors.accent,
  },
});
