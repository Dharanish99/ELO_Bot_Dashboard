import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { RobotMode } from '../types';

interface CommandButtonsProps {
  currentMode: RobotMode;
  commandPending: string | null;
  isConnected: boolean;
  selectedTargetId: string | null;
  onRequestFollow: () => Promise<boolean>;
  onRequestInteract: () => Promise<boolean>;
  onRequestStop: () => Promise<boolean>;
}

export const CommandButtons: React.FC<CommandButtonsProps> = ({
  currentMode,
  commandPending,
  isConnected,
  selectedTargetId,
  onRequestFollow,
  onRequestInteract,
  onRequestStop,
}) => {
  const isBusy = !!commandPending;
  const isDisabled = !isConnected || isBusy;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>PRIMARY COMMANDS</Text>

      {/* Transitional status display if command is in-flight */}
      {commandPending ? (
        <View style={styles.pendingBanner}>
          <ActivityIndicator size="small" color={colors.textPrimary} style={{ marginRight: spacing.sm }} />
          <Text style={styles.pendingText}>{commandPending}</Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        {/* FOLLOW BUTTON */}
        <TouchableOpacity
          style={[
            styles.cmdButton,
            styles.followButton,
            currentMode === 'moving' && styles.activeFollowButton,
            isDisabled && styles.disabledButton,
          ]}
          onPress={onRequestFollow}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <Ionicons
            name="walk-outline"
            size={22}
            color={currentMode === 'moving' ? colors.textInverse : colors.textPrimary}
          />
          <Text
            style={[
              styles.buttonText,
              currentMode === 'moving' && styles.activeButtonText,
            ]}
          >
            FOLLOW
          </Text>
          {currentMode === 'moving' && (
            <View style={styles.activeDot} />
          )}
        </TouchableOpacity>

        {/* INTERACT BUTTON */}
        <TouchableOpacity
          style={[
            styles.cmdButton,
            styles.interactButton,
            currentMode === 'interacting' && styles.activeInteractButton,
            isDisabled && styles.disabledButton,
          ]}
          onPress={onRequestInteract}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={22}
            color={currentMode === 'interacting' ? colors.textInverse : colors.textPrimary}
          />
          <Text
            style={[
              styles.buttonText,
              currentMode === 'interacting' && styles.activeButtonText,
            ]}
          >
            INTERACT
          </Text>
          {currentMode === 'interacting' && (
            <View style={styles.activeDot} />
          )}
        </TouchableOpacity>

        {/* EMERGENCY STOP BUTTON */}
        <TouchableOpacity
          style={[
            styles.cmdButton,
            styles.stopButton,
            currentMode === 'stopped' && styles.activeStopButton,
            isDisabled && styles.disabledButton,
          ]}
          onPress={onRequestStop}
          disabled={isDisabled}
          activeOpacity={0.7}
        >
          <Ionicons
            name="stop-circle"
            size={22}
            color={colors.accent}
          />
          <Text style={[styles.buttonText, styles.stopButtonText]}>
            STOP
          </Text>
        </TouchableOpacity>
      </View>

      {!selectedTargetId && (
        <Text style={styles.followHint}>
          * Select a target person above before commanding FOLLOW
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cmdButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    position: 'relative',
  },
  followButton: {},
  activeFollowButton: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  interactButton: {},
  activeInteractButton: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  stopButton: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  activeStopButton: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  disabledButton: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  activeButtonText: {
    color: colors.textInverse,
  },
  stopButtonText: {
    color: colors.accent,
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.dotOnline,
  },
  followHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs + 2,
    textAlign: 'center',
  },
});
