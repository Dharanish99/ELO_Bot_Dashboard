/**
 * PersonRail.tsx
 *
 * Horizontal scrollable rail of detected person chips displayed below the
 * camera panel. Each chip represents a V2Target and lets the user select
 * a person for following without tapping directly in the camera feed.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { V2Target } from '../types/v2';

// ─── Helper ────────────────────────────────────────────────────────────────

function labelFromTrackId(track_id: string, label?: string): string {
  if (label) return label;
  const match = track_id.match(/(\d+)$/);
  return match ? `Person ${parseInt(match[1], 10)}` : `Person ${track_id.slice(-3)}`;
}

function formatRange(range_m: number | null | undefined): string | null {
  if (range_m === null || range_m === undefined) return null;
  return `${range_m.toFixed(1)}m`;
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface PersonRailProps {
  targets: V2Target[];
  confirmedTargetId: string | null;
  pendingTargetId: string | null;
  frameTimestamp: number;
  onSelectPerson: (x: number, y: number, frameTimestamp: number) => void;
  disabled: boolean;
}

// ─── Chip ──────────────────────────────────────────────────────────────────

interface ChipProps {
  target: V2Target;
  isConfirmed: boolean;
  isPending: boolean;
  disabled: boolean;
  onPress: () => void;
}

const PersonChip: React.FC<ChipProps> = ({
  target,
  isConfirmed,
  isPending,
  disabled,
  onPress,
}) => {
  const personLabel = labelFromTrackId(target.track_id, target.label);
  const rangeStr = formatRange(target.range_m);

  const borderColor = isConfirmed
    ? '#FFFFFF'
    : isPending
    ? colors.textSecondary
    : colors.border;

  const textColor = isConfirmed ? colors.textPrimary : colors.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`Select ${personLabel}${rangeStr ? `, ${rangeStr} away` : ''}`}
      style={[
        styles.chip,
        {
          borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        isConfirmed && styles.chipConfirmed,
      ]}
    >
      {/* Label row */}
      <View style={styles.chipRow}>
        <Text style={[styles.chipLabel, { color: textColor }]}>
          {personLabel}
          {isConfirmed ? ' ✓' : ''}
        </Text>
        {isPending && !isConfirmed && (
          <ActivityIndicator
            size="small"
            color={colors.textSecondary}
            style={{ marginLeft: spacing.xs }}
          />
        )}
      </View>

      {/* Range line */}
      {rangeStr ? (
        <Text style={styles.chipRange}>{rangeStr}</Text>
      ) : (
        <Text style={styles.chipRangeEmpty}>–</Text>
      )}
    </TouchableOpacity>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────

export const PersonRail: React.FC<PersonRailProps> = ({
  targets,
  confirmedTargetId,
  pendingTargetId,
  frameTimestamp,
  onSelectPerson,
  disabled,
}) => {
  const handleChipPress = useCallback(
    (target: V2Target) => {
      if (disabled) return;
      const cx = target.bbox.x + target.bbox.width / 2;
      const cy = target.bbox.y + target.bbox.height / 2;
      onSelectPerson(cx, cy, frameTimestamp);
    },
    [disabled, frameTimestamp, onSelectPerson],
  );

  if (targets.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      accessibilityLabel="Person selection rail"
    >
      {targets.map((target) => (
        <PersonChip
          key={target.track_id}
          target={target}
          isConfirmed={target.track_id === confirmedTargetId}
          isPending={target.track_id === pendingTargetId}
          disabled={disabled}
          onPress={() => handleChipPress(target)}
        />
      ))}
    </ScrollView>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  rail: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    minWidth: 72,
  },
  chipConfirmed: {
    backgroundColor: colors.surfaceElevated,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  chipRange: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  chipRangeEmpty: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
