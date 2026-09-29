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

interface DiagnosticRowProps {
  label: string;
  value: string;
  active?: boolean;
  isLoading?: boolean;
}

const DiagnosticRow: React.FC<DiagnosticRowProps> = ({ label, value, active, isLoading }) => (
  <View style={diagStyles.row} accessibilityLabel={`${label}: ${value}`}>
    <Text style={diagStyles.label}>{label}</Text>
    <View style={diagStyles.valueGroup}>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : active !== undefined ? (
        <>
          <View
            style={[
              diagStyles.dot,
              { backgroundColor: active ? colors.dotOnline : colors.dotOffline },
            ]}
          />
          <Text style={[diagStyles.value, { color: active ? colors.textPrimary : colors.textMuted }]}>
            {value}
          </Text>
        </>
      ) : (
        <Text style={diagStyles.valueNeutral}>{value}</Text>
      )}
    </View>
  </View>
);

export const SettingsScreen: React.FC = () => {
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
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {saved && (
          <Text style={styles.savedText} accessibilityLiveRegion="polite">
            URL saved
          </Text>
        )}

        {/* Section: Pi Connection */}
        <Text style={styles.sectionTitle}>PI CONNECTION</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder={DEFAULT_ELO_CORE_URL}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Raspberry Pi URL"
          />
          {inputUrl.length > 0 && (
            <TouchableOpacity
              onPress={() => setInputUrl('')}
              accessibilityLabel="Clear URL"
              accessibilityRole="button"
            >
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
              accessibilityLabel={`Set URL to ${p.label}`}
              accessibilityRole="button"
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
            accessibilityLabel="Test connection"
            accessibilityRole="button"
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
            accessibilityLabel="Save connection URL"
            accessibilityRole="button"
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
                : testResult.error || 'ELO couldn\'t connect'}
            </Text>
          </View>
        )}

        {/* Section: System Diagnostics */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>SYSTEM</Text>
        <View style={styles.diagnosticsPanel}>
          <DiagnosticRow
            label="Pi"
            value={isConnected ? 'Connected' : 'Offline'}
            active={isConnected && eloOnline}
          />
          <DiagnosticRow
            label="AI Engine"
            value={aiConnected && isConnected ? 'Connected' : 'Offline'}
            active={aiConnected && isConnected}
          />
          <DiagnosticRow
            label="Audio"
            value={audioReady && isConnected ? 'Ready' : 'Offline'}
            active={audioReady && isConnected}
          />
          <DiagnosticRow
            label="Display"
            value={displayConnected && isConnected ? 'Connected' : 'Offline'}
            active={displayConnected && isConnected}
          />

          {/* Camera diagnostic row */}
          {cameraStatus ? (
            <>
              <DiagnosticRow
                label="Camera"
                value={cameraStatus.available ? 'Ready' : 'Unavailable'}
                active={cameraStatus.available}
              />
              {cameraStatus.available && (
                <DiagnosticRow
                  label=""
                  value={`${cameraStatus.width}×${cameraStatus.height} · ${cameraStatus.fps}fps · ${cameraStatus.format.toUpperCase()}`}
                />
              )}
            </>
          ) : (
            <DiagnosticRow
              label="Camera"
              value={isFetchingCamera ? 'Checking…' : 'Tap to check'}
              isLoading={isFetchingCamera}
            />
          )}

          {/* Ping row */}
          {testResult?.success && testResult.latencyMs !== undefined && (
            <DiagnosticRow
              label="Ping"
              value={`${testResult.latencyMs} ms`}
            />
          )}
        </View>

        {/* Check camera button */}
        {!cameraStatus && !isFetchingCamera && isConnected && (
          <TouchableOpacity
            style={styles.checkCameraButton}
            onPress={fetchCameraStatus}
            activeOpacity={0.7}
            accessibilityLabel="Check camera status"
            accessibilityRole="button"
          >
            <Text style={styles.checkCameraText}>Check camera</Text>
          </TouchableOpacity>
        )}

        {/* Collapsible guide */}
        <TouchableOpacity
          style={styles.guideToggle}
          onPress={() => setShowGuide(!showGuide)}
          activeOpacity={0.6}
          accessibilityLabel={showGuide ? 'Hide setup guide' : 'Show setup guide'}
          accessibilityRole="button"
          accessibilityState={{ expanded: showGuide }}
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
              1. Connect phone and Raspberry Pi to the same WiFi network
            </Text>
            <Text style={styles.guideStep}>
              2. Find your Raspberry Pi's IP with{' '}
              <Text style={styles.code}>hostname -I</Text> on the Pi
            </Text>
            <Text style={styles.guideStep}>
              3. Enter <Text style={styles.code}>http://{'<PI_IP>'}:8090</Text> above or configure{' '}
              <Text style={styles.code}>EXPO_PUBLIC_ELO_CORE_URL</Text> in .env
            </Text>
            <Text style={styles.guideStep}>
              4. Camera stream is available at <Text style={styles.code}>/camera/stream</Text> (MJPEG) or{' '}
              <Text style={styles.code}>/camera/frame</Text> (JPEG). All video is local-only.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const diagStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs + 2,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
  valueNeutral: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '400',
  },
});

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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
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
    flexWrap: 'wrap',
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
  diagnosticsPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkCameraButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.xl,
  },
  checkCameraText: {
    fontSize: 12,
    fontWeight: '600',
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
