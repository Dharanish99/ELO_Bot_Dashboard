import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { EloTarget, TargetLockState } from '../../types';
import { TargetMarker } from './TargetMarker';
import { ContainedImageRect } from './geometry';

interface DetectionOverlayProps {
  targets: EloTarget[];
  stagedTargetId: string | null;
  lockedTargetId: string | null;
  targetLockState: TargetLockState;
  imageRect: ContainedImageRect;
  onTargetPress: (target: EloTarget) => void;
}

interface OverlapCandidate {
  targets: EloTarget[];
}

function boxesOverlap(
  a: EloTarget['bbox'],
  b: EloTarget['bbox']
): boolean {
  if (!a || !b) return false;
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  targets,
  stagedTargetId,
  lockedTargetId,
  targetLockState,
  imageRect,
  onTargetPress,
}) => {
  const [disambiguationModal, setDisambiguationModal] = useState<OverlapCandidate | null>(null);

  const handleTargetPress = useCallback(
    (pressedTarget: EloTarget) => {
      if (!pressedTarget.bbox) {
        onTargetPress(pressedTarget);
        return;
      }

      // Check for heavily overlapping candidate targets
      const overlapping = targets.filter(
        (t) =>
          String(t.id) !== String(pressedTarget.id) &&
          t.bbox &&
          boxesOverlap(pressedTarget.bbox, t.bbox)
      );

      if (overlapping.length > 0) {
        setDisambiguationModal({
          targets: [pressedTarget, ...overlapping],
        });
      } else {
        onTargetPress(pressedTarget);
      }
    },
    [targets, onTargetPress]
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {targets.map((target) => {
        if (!target.bbox) return null;
        const normalizedId = String(target.id);
        const isStaged = stagedTargetId != null && String(stagedTargetId) === normalizedId;
        const isLocked = lockedTargetId != null && String(lockedTargetId) === normalizedId;

        return (
          <TargetMarker
            key={normalizedId}
            target={target}
            isStaged={isStaged}
            isLocked={isLocked}
            lockState={isLocked ? targetLockState : isStaged ? 'staged' : 'none'}
            imageRect={imageRect}
            onPress={handleTargetPress}
          />
        );
      })}

      {/* Disambiguation modal for overlapping targets */}
      <Modal
        visible={!!disambiguationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDisambiguationModal(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDisambiguationModal(null)}
        >
          <View style={styles.disambiguationPanel}>
            <Text style={styles.disambiguationTitle}>
              {disambiguationModal?.targets.length} people here
            </Text>
            {disambiguationModal?.targets.map((t) => (
              <TouchableOpacity
                key={String(t.id)}
                style={styles.disambiguationOption}
                onPress={() => {
                  setDisambiguationModal(null);
                  onTargetPress(t);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.disambiguationLabel}>{t.label}</Text>
                {t.distance != null && (
                  <Text style={styles.disambiguationMeta}>{t.distance.toFixed(1)}m</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  disambiguationPanel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    width: '100%',
    maxWidth: 280,
  },
  disambiguationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  disambiguationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  disambiguationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  disambiguationMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
