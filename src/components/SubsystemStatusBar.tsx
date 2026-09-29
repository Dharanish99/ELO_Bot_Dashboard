import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface SubsystemStatusBarProps {
  aiConnected: boolean;
  audioReady: boolean;
  isConnected: boolean;
  displayConnected?: boolean;
  cameraReady?: boolean;
}

interface SubsystemDotProps {
  active: boolean;
  label: string;
  value: string;
}

const SubsystemDot: React.FC<SubsystemDotProps> = ({ active, label, value }) => (
  <View style={styles.subsystemItem} accessibilityLabel={`${label} ${value}`}>
    <View
      style={[
        styles.dot,
        { backgroundColor: active ? colors.dotOnline : colors.dotOffline },
      ]}
    />
    <Text style={styles.subsystemLabel}>{label}</Text>
    <Text
      style={[
        styles.subsystemValue,
        { color: active ? colors.textPrimary : colors.textMuted },
      ]}
    >
      {value}
    </Text>
  </View>
);

export const SubsystemStatusBar: React.FC<SubsystemStatusBarProps> = ({
  aiConnected,
  audioReady,
  isConnected,
  displayConnected,
  cameraReady,
}) => {
  const effectiveAi = isConnected && aiConnected;
  const effectiveAudio = isConnected && audioReady;
  const effectiveDisplay = isConnected && (displayConnected ?? false);
  const effectiveCamera = isConnected && (cameraReady ?? false);

  // Show 4 subsystems if display/camera data is available, else 2
  const showExtended = displayConnected !== undefined || cameraReady !== undefined;

  return (
    <View style={styles.container}>
      <SubsystemDot
        active={effectiveAi}
        label="AI"
        value={effectiveAi ? 'Connected' : 'Offline'}
      />

      <View style={styles.divider} />

      <SubsystemDot
        active={effectiveAudio}
        label="Audio"
        value={effectiveAudio ? 'Ready' : 'Offline'}
      />

      {showExtended && (
        <>
          <View style={styles.divider} />
          <SubsystemDot
            active={effectiveCamera}
            label="Camera"
            value={effectiveCamera ? 'Ready' : 'Offline'}
          />
          <View style={styles.divider} />
          <SubsystemDot
            active={effectiveDisplay}
            label="Display"
            value={effectiveDisplay ? 'On' : 'Offline'}
          />
        </>
      )}
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
