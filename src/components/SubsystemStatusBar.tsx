import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface SubsystemStatusBarProps {
  aiConnected: boolean;
  audioReady: boolean;
  isConnected: boolean;
}

export const SubsystemStatusBar: React.FC<SubsystemStatusBarProps> = ({
  aiConnected,
  audioReady,
  isConnected,
}) => {
  const effectiveAi = isConnected && aiConnected;
  const effectiveAudio = isConnected && audioReady;

  return (
    <View style={styles.container}>
      <View style={styles.subsystemItem}>
        <View
          style={[
            styles.dot,
            { backgroundColor: effectiveAi ? colors.dotOnline : colors.dotOffline },
          ]}
        />
        <Text style={styles.subsystemLabel}>AI Engine:</Text>
        <Text
          style={[
            styles.subsystemValue,
            { color: effectiveAi ? colors.textPrimary : colors.textMuted },
          ]}
        >
          {effectiveAi ? 'Connected' : 'Offline'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.subsystemItem}>
        <View
          style={[
            styles.dot,
            { backgroundColor: effectiveAudio ? colors.dotOnline : colors.dotOffline },
          ]}
        />
        <Text style={styles.subsystemLabel}>Audio:</Text>
        <Text
          style={[
            styles.subsystemValue,
            { color: effectiveAudio ? colors.textPrimary : colors.textMuted },
          ]}
        >
          {effectiveAudio ? 'Ready' : 'Offline'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  subsystemItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs + 2,
  },
  subsystemLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginRight: 4,
  },
  subsystemValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: colors.borderStrong,
  },
});
