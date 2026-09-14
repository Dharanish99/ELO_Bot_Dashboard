import React, { useRef, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { RobotMode } from '../types';

interface ModeToggleButtonProps {
  currentMode: RobotMode;
  isPending: boolean;
  onToggle: () => Promise<void>;
  disabled?: boolean;
}

export const ModeToggleButton: React.FC<ModeToggleButtonProps> = ({
  currentMode,
  isPending,
  onToggle,
  disabled = false,
}) => {
  const [localPending, setLocalPending] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const targetMode: RobotMode = currentMode === 'moving' ? 'interacting' : 'moving';
  const busy = isPending || localPending;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    if (busy || disabled) return;
    setLocalPending(true);
    try {
      await onToggle();
    } catch (err: any) {
      Alert.alert(
        'Mode Switch Failed',
        err.message || 'Could not change robot mode.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocalPending(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.button,
          (busy || disabled) && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={busy || disabled}
        activeOpacity={1}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <>
            <Text style={styles.buttonText}>
              Switch to {targetMode === 'interacting' ? 'Interacting' : 'Moving'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={colors.textMuted}
            />
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
});
