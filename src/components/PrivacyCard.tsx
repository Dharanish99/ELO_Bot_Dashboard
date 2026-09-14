import React from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

export const PrivacyCard: React.FC = () => {
  const {
    excludeFromReport,
    isMuted,
    setExcludeFromReport,
    setMuteMicrophone,
    isConnected,
  } = useELO();

  const handleToggleExclude = async (val: boolean) => {
    try {
      await setExcludeFromReport(val);
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not update.');
    }
  };

  const handleToggleMute = async (val: boolean) => {
    try {
      await setMuteMicrophone(val);
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not update.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Toggle 1: Exclude from report */}
      <View style={styles.row}>
        <Text style={styles.label}>Exclude from report</Text>
        <Switch
          value={excludeFromReport}
          onValueChange={handleToggleExclude}
          disabled={!isConnected}
          trackColor={{ false: colors.border, true: colors.textMuted }}
          thumbColor={excludeFromReport ? colors.textPrimary : colors.textMuted}
        />
      </View>

      <View style={styles.separator} />

      {/* Toggle 2: Mute microphone — red when active is the ONLY color event */}
      <View style={styles.row}>
        <View>
          <Text style={[styles.label, isMuted && styles.labelDanger]}>
            Mute microphone
          </Text>
          {isMuted && (
            <Text style={styles.dangerHint}>Tutoring disabled</Text>
          )}
        </View>
        <Switch
          value={isMuted}
          onValueChange={handleToggleMute}
          disabled={!isConnected}
          trackColor={{ false: colors.border, true: colors.accentMuted }}
          thumbColor={isMuted ? colors.accent : colors.textMuted}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  labelDanger: {
    color: colors.accent,
  },
  dangerHint: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 2,
    fontWeight: '400',
  },
});
