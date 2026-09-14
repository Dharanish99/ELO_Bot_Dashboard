import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { RobotMode } from '../types';

interface SafetyStatusCardProps {
  obstacleDetected: boolean;
  obstacleDetail?: string | null;
  robotState: RobotMode;
}

export const SafetyStatusCard: React.FC<SafetyStatusCardProps> = ({
  obstacleDetected,
  obstacleDetail,
  robotState,
}) => {
  const isEmergencyStop = robotState === 'stopped';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} style={styles.headerIcon} />
          <Text style={styles.sectionTitle}>SAFETY & OBSTACLES</Text>
        </View>
        <Text style={styles.monitoringLabel}>ACTIVE</Text>
      </View>

      {obstacleDetected ? (
        <View style={styles.obstacleBox}>
          <View style={styles.statusRow}>
            <Ionicons name="warning" size={20} color={colors.accent} style={styles.iconMargin} />
            <Text style={styles.obstacleTitle}>OBSTACLE DETECTED</Text>
          </View>
          <Text style={styles.obstacleDetail}>
            {obstacleDetail || 'Path blocked. Motors auto-inhibited for child safety.'}
          </Text>
        </View>
      ) : isEmergencyStop ? (
        <View style={styles.stoppedBox}>
          <View style={styles.statusRow}>
            <Ionicons name="stop-circle" size={20} color={colors.textSecondary} style={styles.iconMargin} />
            <Text style={styles.stoppedTitle}>ROBOT STOPPED</Text>
          </View>
          <Text style={styles.stoppedDetail}>
            Motors disengaged. Ready for command.
          </Text>
        </View>
      ) : (
        <View style={styles.clearBox}>
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.dotOnline} style={styles.iconMargin} />
            <Text style={styles.clearTitle}>PATH CLEAR</Text>
          </View>
          <Text style={styles.clearDetail}>
            Ultrasonic and proximity safety active
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  monitoringLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  iconMargin: {
    marginRight: spacing.sm,
  },
  obstacleBox: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  obstacleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  obstacleDetail: {
    fontSize: 13,
    color: colors.textPrimary,
    opacity: 0.9,
    lineHeight: 18,
    marginTop: 2,
  },
  stoppedBox: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stoppedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  stoppedDetail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  clearBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  clearTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dotOnline,
    letterSpacing: 0.8,
  },
  clearDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
