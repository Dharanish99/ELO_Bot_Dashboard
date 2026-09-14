import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { EloTarget } from '../types';

interface TargetSelectorProps {
  targets: EloTarget[];
  selectedTargetId: string | null;
  commandPending: string | null;
  isConnected: boolean;
  onSelectTarget: (targetId: string) => Promise<boolean>;
}

export const TargetSelector: React.FC<TargetSelectorProps> = ({
  targets,
  selectedTargetId,
  commandPending,
  isConnected,
  onSelectTarget,
}) => {
  // Local pending selection state before confirmation
  const [stagedTargetId, setStagedTargetId] = useState<string | null>(selectedTargetId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync staged with confirmed selection when it changes externally
  useEffect(() => {
    if (selectedTargetId) {
      setStagedTargetId(selectedTargetId);
    }
  }, [selectedTargetId]);

  const handleSelect = async (targetId: string) => {
    if (!isConnected || isSubmitting || commandPending) return;
    setStagedTargetId(targetId);
    setIsSubmitting(true);
    try {
      await onSelectTarget(targetId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTargetExists =
    !selectedTargetId || targets.some((t) => t.id === selectedTargetId);

  return (
    <View style={[styles.container, !isConnected && styles.disabledContainer]}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="person-circle-outline" size={20} color={colors.textPrimary} style={styles.headerIcon} />
          <Text style={styles.sectionTitle}>TRACKING TARGET</Text>
        </View>
        {selectedTargetId ? (
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedBadgeText}>CONFIRMED</Text>
          </View>
        ) : (
          <View style={styles.unselectedBadge}>
            <Text style={styles.unselectedBadgeText}>NONE SELECTED</Text>
          </View>
        )}
      </View>

      {!selectedTargetExists && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={styles.warningText}>Selected target is no longer detected</Text>
        </View>
      )}

      {targets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="scan-outline" size={24} color={colors.textMuted} />
          <Text style={styles.emptyText}>No persons currently detected in view</Text>
        </View>
      ) : (
        <View style={styles.targetList}>
          {targets.map((target) => {
            const isConfirmed = selectedTargetId === target.id;
            const isStaged = stagedTargetId === target.id;
            const isTargetBusy = isSubmitting && isStaged;

            return (
              <TouchableOpacity
                key={target.id}
                style={[
                  styles.targetCard,
                  isConfirmed && styles.targetCardConfirmed,
                  isStaged && !isConfirmed && styles.targetCardStaged,
                ]}
                onPress={() => handleSelect(target.id)}
                disabled={!isConnected || isSubmitting || !!commandPending}
                activeOpacity={0.7}
              >
                <View style={styles.targetLeft}>
                  <View
                    style={[
                      styles.radioCircle,
                      (isConfirmed || isStaged) && styles.radioCircleActive,
                    ]}
                  >
                    {(isConfirmed || isStaged) && (
                      <View style={styles.radioInnerDot} />
                    )}
                  </View>

                  <View style={styles.targetInfo}>
                    <Text
                      style={[
                        styles.targetLabel,
                        isConfirmed && styles.targetLabelConfirmed,
                      ]}
                    >
                      {target.label}
                    </Text>
                    <View style={styles.metaRow}>
                      {target.distance != null && (
                        <Text style={styles.metaText}>
                          {target.distance.toFixed(1)}m away
                        </Text>
                      )}
                      {target.confidence != null && (
                        <Text style={styles.metaText}>
                          • {Math.round(target.confidence * 100)}% conf
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.targetRight}>
                  {isTargetBusy ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : isConfirmed ? (
                    <View style={styles.activeCheck}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.textPrimary} />
                    </View>
                  ) : (
                    <Text style={styles.selectHint}>Tap to lock</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
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
  disabledContainer: {
    opacity: 0.5,
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
  confirmedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  unselectedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  unselectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  targetList: {
    gap: spacing.sm,
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  targetCardConfirmed: {
    borderColor: colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  targetCardStaged: {
    borderColor: colors.borderStrong,
  },
  targetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioCircleActive: {
    borderColor: colors.textPrimary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
  },
  targetInfo: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  targetLabelConfirmed: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  targetRight: {
    marginLeft: spacing.sm,
  },
  activeCheck: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectHint: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
});
