import React, { useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { DEFAULT_ELO_CORE_URL, api } from '../api/client';
import { CameraStatus } from '../types';

const QUICK_IPS = [
  { label: 'Pi (Default)', url: DEFAULT_ELO_CORE_URL },
  { label: '192.168.1.100', url: 'http://192.168.1.100:8090' },
  { label: 'raspberrypi.local', url: 'http://raspberrypi.local:8090' },
];

interface StatusRowProps {
  label: string;
  value: string;
  active?: boolean;
  isLoading?: boolean;
}

const StatusRow: React.FC<StatusRowProps> = ({ label, value, active, isLoading }) => (
  <View style={styles.statusRow} accessibilityLabel={`${label}: ${value}`}>
    <Text style={styles.statusLabel}>{label}</Text>
    <View style={styles.statusValueGroup}>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : active !== undefined ? (
        <>
          <View style={[styles.statusDot, { backgroundColor: active ? colors.dotOnline : colors.dotOffline }]} />
          <Text style={[styles.statusValue, { color: active ? colors.textPrimary : colors.textMuted }]}>
            {value}
          </Text>
        </>
      ) : (
        <Text style={styles.statusValueNeutral}>{value}</Text>
      )}
    </View>
  </View>
);

export const PiConnectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    baseUrl,
    setBaseUrl,
    testConnectionUrl,
    isConnected,
    aiConnected,
    audioReady,
    displayConnected,
    eloOnline,
  } = useELO();

  const [inputUrl, setInputUrl] = useState<string>(baseUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean; latencyMs?: number; error?: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [isFetchingCamera, setIsFetchingCamera] = useState(false);

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

  const fetchCameraStatus = useCallback(async () => {
    if (isFetchingCamera) return;
    setIsFetchingCamera(true);
    try {
      const status = await api.getCameraStatus(baseUrl);
      setCameraStatus(status);
    } catch {
      setCameraStatus(null);
    } finally {
      setIsFetchingCamera(false);
    }
  }, [baseUrl, isFetchingCamera]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>PI CONNECTION</Text>
          <Text style={styles.headerSub}>Connect to your Raspberry Pi</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* URL input */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionLabel}>PI BASE URL</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.urlInput}
              value={inputUrl}
              onChangeText={(v) => {
                setInputUrl(v);
                setSaved(false);
                setTestResult(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.x.x:8090"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleTest}
              accessibilityLabel="Pi IP address or URL"
            />
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setInputUrl('')}
              accessibilityLabel="Clear URL"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick presets */}
        <View style={styles.presetsSection}>
          <Text style={styles.sectionLabel}>QUICK PRESETS</Text>
          <View style={styles.presetsRow}>
            {QUICK_IPS.map(({ label, url }) => (
              <TouchableOpacity
                key={url}
                style={[styles.preset, inputUrl === url && styles.presetActive]}
                onPress={() => { setInputUrl(url); setTestResult(null); }}
                activeOpacity={0.7}
                accessibilityLabel={label}
                accessibilityRole="button"
              >
                <Text style={[styles.presetText, inputUrl === url && styles.presetTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Test / Save buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.testButton, isTesting && styles.btnDisabled]}
            onPress={handleTest}
            disabled={isTesting || !inputUrl.trim()}
            activeOpacity={0.7}
            accessibilityLabel="Test connection"
            accessibilityRole="button"
          >
            {isTesting ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={styles.testButtonText}>Test Connection</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, !inputUrl.trim() && styles.btnDisabled]}
            onPress={handleSave}
            disabled={!inputUrl.trim()}
            activeOpacity={0.7}
            accessibilityLabel="Save Pi connection URL"
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>{saved ? '✓ Saved' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {/* Test result */}
        {testResult && (
          <View style={[
            styles.testResult,
            testResult.success ? styles.testResultOk : styles.testResultErr,
          ]}>
            <Ionicons
              name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={testResult.success ? colors.dotOnline : colors.accent}
            />
            <Text style={[
              styles.testResultText,
              { color: testResult.success ? colors.dotOnline : colors.accent },
            ]}>
              {testResult.success
                ? `Connected · ${testResult.latencyMs ?? '–'}ms`
                : testResult.error ?? 'Unable to connect'}
            </Text>
          </View>
        )}

        {/* System status */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionLabel}>SYSTEM STATUS</Text>
          <View style={styles.statusCard}>
            <StatusRow
              label="Raspberry Pi"
              value={isConnected && eloOnline ? 'Online' : 'Offline'}
              active={isConnected && eloOnline}
            />
            <View style={styles.rowDivider} />
            <StatusRow
              label="AI Engine"
              value={aiConnected ? 'Online' : isConnected ? 'Offline' : 'Unknown'}
              active={aiConnected}
            />
            <View style={styles.rowDivider} />
            <StatusRow
              label="Audio"
              value={audioReady ? 'Ready' : isConnected ? 'Offline' : 'Unknown'}
              active={audioReady}
            />
            <View style={styles.rowDivider} />
            <StatusRow
              label="Display"
              value={displayConnected ? 'Online' : isConnected ? 'Offline' : 'Unknown'}
              active={displayConnected}
            />
            <View style={styles.rowDivider} />
            <StatusRow
              label="Camera"
              value={
                cameraStatus
                  ? cameraStatus.available ? 'Online' : 'Offline'
                  : 'Tap to check'
              }
              active={cameraStatus?.available}
              isLoading={isFetchingCamera}
            />
          </View>
          <TouchableOpacity
            style={styles.checkCameraBtn}
            onPress={fetchCameraStatus}
            disabled={!isConnected || isFetchingCamera}
            activeOpacity={0.7}
            accessibilityLabel="Check camera status"
            accessibilityRole="button"
          >
            <Text style={[styles.checkCameraBtnText, !isConnected && { opacity: 0.35 }]}>
              Check Camera
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1.5, marginBottom: spacing.sm,
  },
  inputSection: { marginBottom: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
  },
  urlInput: {
    flex: 1, paddingVertical: spacing.md, fontSize: 14,
    color: colors.textPrimary, fontFamily: 'monospace' as any,
  },
  clearBtn: { padding: spacing.xs },
  presetsSection: { marginBottom: spacing.lg },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  presetActive: { borderColor: colors.textPrimary },
  presetText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  presetTextActive: { color: colors.textPrimary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  testButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  testButtonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  saveButton: {
    flex: 0,
    minWidth: 100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: { fontSize: 14, fontWeight: '700', color: colors.textInverse },
  btnDisabled: { opacity: 0.3 },
  testResult: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, marginBottom: spacing.lg,
  },
  testResultOk: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  testResultErr: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(255,59,48,0.25)',
  },
  testResultText: { fontSize: 13, fontWeight: '600' },
  statusSection: { marginBottom: spacing.lg },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statusLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  statusValueGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusValue: { fontSize: 13, fontWeight: '600' },
  statusValueNeutral: { fontSize: 13, color: colors.textMuted },
  rowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  checkCameraBtn: {
    marginTop: spacing.sm, alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkCameraBtnText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
