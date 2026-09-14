import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

const PRESETS = [15, 30, 45, 60, 90, 120];

export const RestrictionsScreen: React.FC = () => {
  const { dailyLimitMinutes, setDailyLimit, refreshRestrictions, isConnected } = useELO();

  const [limitInput, setLimitInput] = useState<string>(dailyLimitMinutes.toString());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    refreshRestrictions();
  }, [refreshRestrictions]);

  useEffect(() => {
    setLimitInput(dailyLimitMinutes.toString());
  }, [dailyLimitMinutes]);

  const handleSave = async (valueToSave?: number) => {
    Keyboard.dismiss();
    const val = valueToSave ?? parseInt(limitInput, 10);
    if (isNaN(val) || val <= 0) {
      setSaveStatus({ type: 'error', message: 'Enter a valid number.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const success = await setDailyLimit(val);
      if (success) {
        setSaveStatus({ type: 'success', message: `Set to ${val} min` });
        setLimitInput(val.toString());
      } else {
        setSaveStatus({ type: 'error', message: 'Save rejected' });
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message || 'Failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreset = (mins: number) => {
    setLimitInput(mins.toString());
    handleSave(mins);
  };

  const handleStep = (step: number) => {
    const current = parseInt(limitInput, 10) || dailyLimitMinutes;
    const nextVal = Math.max(5, current + step);
    setLimitInput(nextVal.toString());
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Limits</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Feedback */}
        {saveStatus && (
          <Text
            style={[
              styles.feedback,
              saveStatus.type === 'success' ? styles.feedbackOk : styles.feedbackErr,
            ]}
          >
            {saveStatus.message}
          </Text>
        )}

        {/* Big centered number */}
        <View style={styles.inputArea}>
          <TouchableOpacity
            style={styles.stepButton}
            onPress={() => handleStep(-5)}
            activeOpacity={0.5}
          >
            <Ionicons name="remove" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.numericBox}>
            <TextInput
              style={styles.numericInput}
              value={limitInput}
              onChangeText={setLimitInput}
              keyboardType="numeric"
              maxLength={4}
              selectTextOnFocus
            />
            <Text style={styles.unit}>min / day</Text>
          </View>

          <TouchableOpacity
            style={styles.stepButton}
            onPress={() => handleStep(5)}
            activeOpacity={0.5}
          >
            <Ionicons name="add" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Preset chips */}
        <View style={styles.presetsRow}>
          {PRESETS.map((mins) => {
            const selected = parseInt(limitInput, 10) === mins;
            return (
              <TouchableOpacity
                key={mins}
                style={[styles.preset, selected && styles.presetSelected]}
                onPress={() => handlePreset(mins)}
                activeOpacity={0.6}
              >
                <Text
                  style={[styles.presetText, selected && styles.presetTextSelected]}
                >
                  {mins}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, (!isConnected || isSaving) && styles.saveDisabled]}
          onPress={() => handleSave()}
          disabled={!isConnected || isSaving}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
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
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  feedback: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  feedbackOk: {
    color: colors.textSecondary,
  },
  feedbackErr: {
    color: colors.accent,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xxl,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numericBox: {
    alignItems: 'center',
  },
  numericInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    padding: 0,
    minWidth: 100,
  },
  unit: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontWeight: '500',
    letterSpacing: 1,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  preset: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetSelected: {
    borderColor: colors.textPrimary,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  presetTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full,
    minWidth: 160,
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.3,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background,
  },
});
