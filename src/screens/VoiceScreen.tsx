import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { VoiceVisualizer } from '../components/VoiceVisualizer';
import { api } from '../api/client';
import { CanonicalAudioState, VoiceState } from '../types';

const PROMPT_SHORTCUTS = [
  { label: 'Tell me a story', icon: 'book-outline' as const },
  { label: 'What do you see?', icon: 'eye-outline' as const },
  { label: "Let's learn something", icon: 'bulb-outline' as const },
];

export type DisplayedPhase = 'READY' | 'RECORDING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';

/**
 * Normalizes any Pi Core /audio/status response to canonical states:
 * IDLE | RECORDING | PROCESSING | SPEAKING | OFF
 */
function parsePiAudioStatus(payload: any): CanonicalAudioState {
  if (!payload) return 'OFF';
  const raw = String(payload.status || payload.state || payload.audio_status || payload.audioStatus || '').trim().toUpperCase();
  if (raw === 'IDLE' || raw === 'READY' || raw === 'LISTENING-READY') return 'IDLE';
  if (raw === 'RECORDING' || raw === 'LISTENING') return 'RECORDING';
  if (raw === 'PROCESSING' || raw === 'THINKING') return 'PROCESSING';
  if (raw === 'SPEAKING' || raw === 'PLAYBACK' || raw === 'TTS') return 'SPEAKING';
  if (raw === 'OFF' || raw === 'INACTIVE' || raw === 'OFFLINE') return 'OFF';

  // Boolean flags fallback (if present in real Pi response)
  if (payload.recording === true) return 'RECORDING';
  if (payload.speaking === true) return 'SPEAKING';
  if (payload.processing === true) return 'PROCESSING';
  if (payload.ready === true) return 'IDLE';

  return 'IDLE';
}

export const VoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    baseUrl,
    isConnected,
    aiConnected,
    audioReady,
    isMuted,
    setMuteMicrophone,
  } = useELO();

  // ── Canonical Pi Audio State & Displayed Phase ──
  const [interactionSessionActive, setInteractionSessionActive] = useState<boolean>(false);
  const [piAudioStatus, setPiAudioStatus] = useState<CanonicalAudioState>('IDLE');
  const [displayedPhase, setDisplayedPhase] = useState<DisplayedPhase>('READY');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isActionInFlight, setIsActionInFlight] = useState<boolean>(false);

  // ── Synchronization Refs to avoid stale closures & race conditions ──
  const canonicalStatusRef = useRef<CanonicalAudioState>('IDLE');
  const lastLoggedStatusRef = useRef<CanonicalAudioState | null>(null);
  const actionInFlightRef = useRef<boolean>(false);
  const interactionActiveRef = useRef<boolean>(false);
  const isEndingRef = useRef<boolean>(false);
  const expectTransitionUntilRef = useRef<number>(0);
  const expectedStatusRef = useRef<CanonicalAudioState | null>(null);
  const processingStartTimeRef = useRef<number>(0);

  // ── Development Logger for audio status transitions ──
  const logAudioStatus = useCallback((status: CanonicalAudioState) => {
    if (lastLoggedStatusRef.current !== status) {
      lastLoggedStatusRef.current = status;
      console.log(`[ELO-VOICE] audio/status -> ${status}`);
    }
  }, []);

  // ── Session Init: VoiceScreen is the SOLE owner of POST /interaction/start ──
  useEffect(() => {
    let isMounted = true;
    isEndingRef.current = false;

    const initSession = async () => {
      try {
        const res = await api.startInteraction(baseUrl);
        if (!isMounted) return;

        if (res && res.success !== false) {
          interactionActiveRef.current = true;
          setInteractionSessionActive(true);
          setAudioError(null);

          // Query initial audio status from Pi
          const statusRes = await api.getAudioStatus(baseUrl).catch(() => ({ status: 'IDLE' }));
          if (!isMounted) return;

          const canonical = parsePiAudioStatus(statusRes);
          canonicalStatusRef.current = canonical;
          setPiAudioStatus(canonical);
          logAudioStatus(canonical);
          setDisplayedPhase(canonical === 'RECORDING' ? 'RECORDING' : 'READY');
        } else {
          throw new Error('Failed to start interaction session on Pi');
        }
      } catch (err: any) {
        console.warn('[ELO-VOICE] Interaction start warning:', err?.message || err);
        if (isMounted) {
          // Allow fallback so user can interact even with network warnings
          interactionActiveRef.current = true;
          setInteractionSessionActive(true);
          setPiAudioStatus('IDLE');
          setDisplayedPhase('READY');
          logAudioStatus('IDLE');
        }
      }
    };

    initSession();

    return () => {
      isMounted = false;
    };
  }, [baseUrl, logAudioStatus]);

  // ── Session Teardown: VoiceScreen is the SOLE owner of POST /interaction/end ──
  const endSession = useCallback(async () => {
    if (!interactionActiveRef.current || isEndingRef.current) return;
    isEndingRef.current = true;
    interactionActiveRef.current = false;

    try {
      await api.endInteraction(baseUrl);
    } catch (err: any) {
      console.warn('[ELO-VOICE] Interaction end warning:', err?.message || err);
    } finally {
      setInteractionSessionActive(false);
      setPiAudioStatus('OFF');
      setDisplayedPhase('READY');
      setAudioError(null);
    }
  }, [baseUrl]);

  const handleBack = useCallback(() => {
    endSession().finally(() => {
      navigation.goBack();
    });
  }, [endSession, navigation]);

  // Handle hardware / gesture back navigation cleanly
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (interactionActiveRef.current && !isEndingRef.current) {
        endSession();
      }
    });
    return unsubscribe;
  }, [navigation, endSession]);

  // ── Polling GET /audio/status as the Source of Truth ──
  useEffect(() => {
    if (!interactionSessionActive) return;

    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const statusRes = await api.getAudioStatus(baseUrl);
        if (!isMounted) return;

        const canonical = parsePiAudioStatus(statusRes);
        setPiAudioStatus(canonical);
        logAudioStatus(canonical);

        // Check if we are currently within an expected transition grace window
        const inGrace = Date.now() < expectTransitionUntilRef.current;
        const expected = expectedStatusRef.current;

        if (inGrace && expected) {
          if (expected === 'RECORDING') {
            if (canonical === 'RECORDING') {
              expectedStatusRef.current = null;
              canonicalStatusRef.current = 'RECORDING';
              setDisplayedPhase('RECORDING');
            }
            // While expecting RECORDING, do not let an older IDLE response reset the UI
            return;
          }

          if (expected === 'PROCESSING') {
            if (canonical === 'PROCESSING' || canonical === 'SPEAKING') {
              expectedStatusRef.current = null;
              canonicalStatusRef.current = canonical;
              setDisplayedPhase(canonical === 'SPEAKING' ? 'SPEAKING' : 'PROCESSING');
            }
            // While expecting PROCESSING, do not let an older RECORDING response reset the UI
            return;
          }
        }

        // Canonical reconciliation with Pi source of truth
        canonicalStatusRef.current = canonical;

        if (canonical === 'RECORDING') {
          setDisplayedPhase('RECORDING');
        } else if (canonical === 'PROCESSING') {
          setDisplayedPhase('PROCESSING');
        } else if (canonical === 'SPEAKING') {
          setDisplayedPhase('SPEAKING');
        } else if (canonical === 'IDLE' || canonical === 'OFF') {
          // Reconcile back to READY when playback finishes and no action is pending
          if (displayedPhase !== 'READY' && displayedPhase !== 'ERROR' && !actionInFlightRef.current) {
            setDisplayedPhase('READY');
          }
        }

        // Safety watchdog: if in PROCESSING for > 15s, recover to READY
        if (displayedPhase === 'PROCESSING' && processingStartTimeRef.current > 0) {
          if (Date.now() - processingStartTimeRef.current > 15000) {
            processingStartTimeRef.current = 0;
            setDisplayedPhase('READY');
            console.log('[ELO-VOICE] audio/status -> IDLE (watchdog timeout recovery)');
          }
        }
      } catch (err) {
        // Polling network glitch — ignore
      } finally {
        if (isMounted) {
          pollTimer = setTimeout(poll, 400);
        }
      }
    };

    pollTimer = setTimeout(poll, 400);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [interactionSessionActive, baseUrl, displayedPhase, logAudioStatus]);

  // ── Push-to-Talk Mic Press Handler ──
  const handleMicPress = useCallback(async () => {
    if (actionInFlightRef.current) return;

    // Error recovery tap
    if (audioError) {
      setAudioError(null);
      setDisplayedPhase('READY');
      logAudioStatus('IDLE');
      return;
    }

    if (isMuted) {
      try {
        await setMuteMicrophone(false);
      } catch {}
      return;
    }

    // Button disabled during PROCESSING and SPEAKING
    if (displayedPhase === 'PROCESSING' || displayedPhase === 'SPEAKING') {
      return;
    }

    // Watchdog timer to ensure actionInFlight can NEVER get stuck forever
    const watchdog = setTimeout(() => {
      actionInFlightRef.current = false;
      setIsActionInFlight(false);
    }, 6000);

    // ── CASE 1: READY (IDLE) -> START RECORDING ──
    if (displayedPhase === 'READY') {
      actionInFlightRef.current = true;
      setIsActionInFlight(true);
      setAudioError(null);
      expectTransitionUntilRef.current = Date.now() + 2500;
      expectedStatusRef.current = 'RECORDING';

      try {
        const res = await api.startAudio(baseUrl);
        if (res && res.success !== false) {
          // Immediately confirm with GET /audio/status
          let confirmed = false;
          for (let i = 0; i < 4; i++) {
            const statusRes = await api.getAudioStatus(baseUrl).catch(() => null);
            const canonical = parsePiAudioStatus(statusRes);
            if (canonical === 'RECORDING') {
              confirmed = true;
              canonicalStatusRef.current = 'RECORDING';
              setPiAudioStatus('RECORDING');
              logAudioStatus('RECORDING');
              setDisplayedPhase('RECORDING');
              expectedStatusRef.current = null;
              break;
            }
            await new Promise((r) => setTimeout(r, 120));
          }

          if (!confirmed) {
            // Even if fast poll didn't catch RECORDING yet, maintain state during grace window
            setDisplayedPhase('RECORDING');
          }
        } else {
          throw new Error('Audio start rejected');
        }
      } catch (err: any) {
        console.log('[ELO-VOICE] audio start error', err?.message || err);
        expectedStatusRef.current = null;
        setDisplayedPhase('ERROR');
        setAudioError('MICROPHONE ERROR');
      } finally {
        clearTimeout(watchdog);
        actionInFlightRef.current = false;
        setIsActionInFlight(false);
      }
    } else if (displayedPhase === 'RECORDING') {
      // ── CASE 2: RECORDING -> STOP RECORDING ──
      actionInFlightRef.current = true;
      setIsActionInFlight(true);
      setAudioError(null);
      expectTransitionUntilRef.current = Date.now() + 2500;
      expectedStatusRef.current = 'PROCESSING';
      processingStartTimeRef.current = Date.now();

      // Immediately transition UI to THINKING and disable button
      setDisplayedPhase('PROCESSING');

      try {
        const res = await api.stopAudio(baseUrl);
        if (!res || res.success === false) {
          throw new Error('Audio stop rejected');
        }
        // Audio stop succeeded; background polling handles PROCESSING -> SPEAKING -> IDLE
      } catch (err: any) {
        console.log('[ELO-VOICE] audio stop error', err?.message || err);
        expectedStatusRef.current = null;
        processingStartTimeRef.current = 0;
        setDisplayedPhase('ERROR');
        setAudioError("COULDN'T SEND AUDIO");
      } finally {
        clearTimeout(watchdog);
        actionInFlightRef.current = false;
        setIsActionInFlight(false);
      }
    }
  }, [
    baseUrl,
    displayedPhase,
    audioError,
    isMuted,
    setMuteMicrophone,
    logAudioStatus,
  ]);

  const handlePrompt = useCallback(async (promptText: string) => {
    if (!isConnected || isMuted || displayedPhase === 'PROCESSING' || displayedPhase === 'SPEAKING' || isActionInFlight) return;
    if (displayedPhase === 'READY') {
      handleMicPress();
    }
  }, [isConnected, isMuted, displayedPhase, isActionInFlight, handleMicPress]);

  // Map canonical phase to VoiceVisualizer voiceState
  const voiceState: VoiceState = useMemo(() => {
    if (displayedPhase === 'ERROR') return 'error';
    if (displayedPhase === 'RECORDING') return 'recording';
    if (displayedPhase === 'PROCESSING') return 'processing';
    if (displayedPhase === 'SPEAKING') return 'speaking';
    return 'idle'; // READY TO LISTEN
  }, [displayedPhase]);

  // Detect contract mismatch for development diagnostics
  const isMismatch =
    (displayedPhase === 'RECORDING' && piAudioStatus === 'IDLE') ||
    (displayedPhase === 'READY' && piAudioStatus === 'RECORDING');

  const aiStatus = aiConnected && isConnected ? 'Online' : 'Offline';
  const micStatus = isMuted ? 'Muted' : audioReady ? 'On' : 'Off';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="End interaction and go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>VOICE</Text>
          <Text style={styles.headerSub}>Talk to ELO</Text>
        </View>

        <TouchableOpacity
          onPress={handleBack}
          style={styles.endBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="End interaction"
          accessibilityRole="button"
        >
          <Text style={styles.endBtnText}>End</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Muted banner */}
        {isMuted && (
          <View style={styles.mutedBanner}>
            <Ionicons name="mic-off" size={16} color={colors.accent} />
            <Text style={styles.mutedBannerText}>
              Microphone muted — ELO cannot hear your child
            </Text>
            <TouchableOpacity
              onPress={() => setMuteMicrophone(false)}
              style={styles.unmuteBtn}
              activeOpacity={0.7}
              accessibilityLabel="Unmute microphone"
              accessibilityRole="button"
            >
              <Text style={styles.unmuteBtnText}>Unmute</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI offline banner */}
        {!aiConnected && isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              AI Engine offline — ELO can't have conversations right now
            </Text>
          </View>
        )}

        {/* Voice Visualizer (Zero overlays, tactile mic button) */}
        <VoiceVisualizer
          voiceState={voiceState}
          audioError={audioError}
          onMicPress={handleMicPress}
          isMuted={isMuted}
          isActionInFlight={isActionInFlight}
        />

        {/* Prompt shortcuts */}
        {!isMuted && displayedPhase === 'READY' && (
          <View style={styles.promptsSection}>
            <Text style={styles.promptsLabel}>SUGGESTIONS</Text>
            <View style={styles.promptsRow}>
              {PROMPT_SHORTCUTS.map(({ label, icon }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.promptChip}
                  onPress={() => handlePrompt(label)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Say: ${label}`}
                  accessibilityRole="button"
                >
                  <Ionicons name={icon} size={14} color={colors.textMuted} />
                  <Text style={styles.promptChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Runtime Contract Diagnostic (Makes mismatches immediately observable) */}
        <View style={[styles.diagBadge, isMismatch && styles.diagBadgeMismatch]}>
          <Ionicons
            name={isMismatch ? 'warning-outline' : 'radio-outline'}
            size={13}
            color={isMismatch ? colors.accent : colors.textMuted}
          />
          <Text style={[styles.diagText, isMismatch && styles.diagTextMismatch]}>
            Dashboard phase: {displayedPhase} · Pi audio status: {piAudioStatus}
          </Text>
        </View>

        {/* Status row */}
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: aiConnected && isConnected ? colors.dotOnline : colors.dotOffline },
              ]}
            />
            <Text style={styles.statusItemLabel}>AI Engine</Text>
            <Text
              style={[
                styles.statusItemValue,
                { color: aiConnected && isConnected ? colors.textPrimary : colors.textMuted },
              ]}
            >
              {aiStatus}
            </Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: audioReady && isConnected ? colors.dotOnline : colors.dotOffline },
              ]}
            />
            <Text style={styles.statusItemLabel}>Audio</Text>
            <Text
              style={[
                styles.statusItemValue,
                { color: audioReady && isConnected ? colors.textPrimary : colors.textMuted },
              ]}
            >
              {audioReady && isConnected ? 'Ready' : 'Offline'}
            </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 44,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  endBtn: {
    width: 44,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  endBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.lg,
  },
  mutedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
    width: '90%',
  },
  mutedBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  unmuteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  unmuteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  offlineBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    width: '90%',
  },
  offlineBannerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  promptsSection: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  promptsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  promptsRow: {
    gap: spacing.sm,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  promptChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  diagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diagBadgeMismatch: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderColor: colors.accent,
  },
  diagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  diagTextMismatch: {
    color: colors.accent,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: '90%',
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusItemLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  statusItemValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
});
