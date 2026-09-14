import React, { useState } from 'react';
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

const QUICK_IPS = [
  { label: 'localhost', url: 'http://localhost:8000' },
  { label: 'emulator', url: 'http://10.0.2.2:8000' },
  { label: '192.168.1.42', url: 'http://192.168.1.42:8000' },
];

export const SettingsScreen: React.FC = () => {
  const { baseUrl, setBaseUrl, testConnectionUrl } = useELO();

  const [inputUrl, setInputUrl] = useState<string>(baseUrl);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const handleTest = async () => {
    Keyboard.dismiss();
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnectionUrl(inputUrl);
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    await setBaseUrl(inputUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    handleTest();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {saved && (
          <Text style={styles.savedText}>URL saved</Text>
        )}

        {/* URL input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="http://192.168.1.42:8000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {inputUrl.length > 0 && (
            <TouchableOpacity onPress={() => setInputUrl('')}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick presets */}
        <View style={styles.presetsRow}>
          {QUICK_IPS.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.preset, inputUrl === p.url && styles.presetActive]}
              onPress={() => setInputUrl(p.url)}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.presetText,
                  inputUrl === p.url && styles.presetTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTest}
            disabled={isTesting}
            activeOpacity={0.6}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.testButtonText}>Test</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Test result */}
        {testResult && (
          <View style={styles.resultRow}>
            <View
              style={[
                styles.resultDot,
                {
                  backgroundColor: testResult.success
                    ? colors.dotOnline
                    : colors.dotOffline,
                },
              ]}
            />
            <Text style={styles.resultText}>
              {testResult.success
                ? `Connected · ${testResult.latencyMs}ms`
                : testResult.error || 'Failed'}
            </Text>
          </View>
        )}

        {/* Collapsible guide */}
        <TouchableOpacity
          style={styles.guideToggle}
          onPress={() => setShowGuide(!showGuide)}
          activeOpacity={0.6}
        >
          <Text style={styles.guideToggleText}>
            {showGuide ? 'Hide setup guide' : 'Need help?'}
          </Text>
          <Ionicons
            name={showGuide ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {showGuide && (
          <View style={styles.guideContent}>
            <Text style={styles.guideStep}>
              1. Connect phone and computer to the same WiFi
            </Text>
            <Text style={styles.guideStep}>
              2. Find your computer's IP with{' '}
              <Text style={styles.code}>ipconfig</Text> (Windows) or{' '}
              <Text style={styles.code}>ifconfig</Text> (Mac)
            </Text>
            <Text style={styles.guideStep}>
              3. Run <Text style={styles.code}>npm run mock</Text> on port 8000 and enter{' '}
              <Text style={styles.code}>http://YOUR_IP:8000</Text> above
            </Text>
          </View>
        )}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  savedText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetActive: {
    borderColor: colors.textPrimary,
  },
  presetText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  presetTextActive: {
    color: colors.textPrimary,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  testButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  resultText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  guideToggleText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  guideContent: {
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  guideStep: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  code: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
