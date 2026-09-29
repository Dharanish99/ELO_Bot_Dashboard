import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

const PRESETS = [15, 30, 45, 60, 90, 120];

export const LimitsScreen: React.FC = () => {
  const { dailyLimitMinutes, setDailyLimit, refreshRestrictions, isConnected, sessionElapsedMinutes } = useELO();

  const [selected, setSelected] = useState<number>(dailyLimitMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    refreshRestrictions();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    setSelected(dailyLimitMinutes);
  }, [dailyLimitMinutes]);

  const handleSave = async (val: number) => {
    if (!isConnected) {
      setSaveStatus('error');
      setSaveMessage('ELO is offline');
      return;
    }
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const ok = await setDailyLimit(val);
      if (ok) {
        setSaveStatus('success');
        setSaveMessage(`Daily limit set to ${val} min`);
      } else {
        setSaveStatus('error');
        setSaveMessage('Could not save — try again');
      }
    } catch {
      setSaveStatus('error');
      setSaveMessage('Unable to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreset = (mins: number) => {
    setSelected(mins);
    handleSave(mins);
  };

  const handleStep = (delta: number) => {
    const next = Math.max(5, Math.min(240, selected + delta));
    setSelected(next);
  };

  // Time remaining calculation
  const timeRemaining = selected - (sessionElapsedMinutes ?? 0);
  const timeRemainingClamped = Math.max(0, timeRemaining);

  const formatRemaining = (mins: number) => {
    if (mins <= 0) return 'Limit reached';
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m left today` : `${h}h left today`;
    }
    return `${mins} min left today`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LIMITS</Text>
        <Text style={styles.headerSub}>Create a healthy balance</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[styles.mainArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Big number */}
          <View style={styles.bigNumberArea}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => handleStep(-15)}
              accessibilityLabel="Decrease limit by 15 minutes"
              accessibilityRole="button"
            >
              <Ionicons name="remove" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.numberDisplay}>
              <Text style={styles.bigNumber} accessibilityLabel={`${selected} minutes per day`}>
                {selected}
              </Text>
              <Text style={styles.numberUnit}>min / day</Text>
            </View>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => handleStep(15)}
              accessibilityLabel="Increase limit by 15 minutes"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Preset row */}
          <View style={styles.presetsRow}>
            {PRESETS.map((mins) => {
              const isActive = selected === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  style={[styles.preset, isActive && styles.presetActive]}
                  onPress={() => handlePreset(mins)}
                  accessibilityLabel={`${mins} minutes`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                    {mins}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, (!isConnected || isSaving) && styles.saveDisabled]}
            onPress={() => handleSave(selected)}
            disabled={!isConnected || isSaving}
            activeOpacity={0.75}
            accessibilityLabel="Save daily limit"
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.saveText}>Set Daily Limit</Text>
            )}
          </TouchableOpacity>

          {/* Feedback */}
          {saveStatus && (
            <Text
              style={[
                styles.feedback,
                saveStatus === 'success' ? styles.feedbackOk : styles.feedbackErr,
              ]}
            >
              {saveMessage}
            </Text>
          )}
        </Animated.View>

        {/* Info rows */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Daily Limit</Text>
              <Text style={styles.infoValue}>
                {`Set the maximum daily usage time.\nELO will gently end sessions when reached.`}
              </Text>
            </View>
          </View>

          {sessionElapsedMinutes != null && (
            <View style={styles.infoRow}>
              <Ionicons
                name="hourglass-outline"
                size={16}
                color={timeRemainingClamped <= 5 ? colors.accent : colors.dotOnline}
              />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Time Remaining</Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: timeRemainingClamped <= 5 ? colors.accent : colors.textPrimary },
                  ]}
                >
                  {formatRemaining(timeRemainingClamped)}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Safety Layer</Text>
              <Text style={styles.infoValue}>Always active — cannot be disabled.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  mainArea: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  bigNumberArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xxl,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberDisplay: {
    alignItems: 'center',
    minWidth: 120,
  },
  bigNumber: {
    fontSize: 80,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 88,
    letterSpacing: -2,
  },
  numberUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginTop: -4,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  preset: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  presetTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  saveButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  saveDisabled: { opacity: 0.3 },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
  feedback: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  feedbackOk: { color: colors.textMuted },
  feedbackErr: { color: colors.accent },
  infoSection: {
    marginTop: spacing.xxl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
