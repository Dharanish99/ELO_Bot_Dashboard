import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import { VoiceState } from '../types';

export interface VoiceVisualizerProps {
  voiceState: VoiceState;
  audioError?: string | null;
  onMicPress: () => void;
  isMuted: boolean;
  isActionInFlight?: boolean;
}

const ELO_IMAGE = require('../../assets/elo-robot.png');
const BAR_COUNT = 20;

const AnimatedBar: React.FC<{ index: number; voiceState: VoiceState }> = ({
  index,
  voiceState,
}) => {
  const heightAnim = useRef(new Animated.Value(3)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();

    if (voiceState === 'speaking') {
      // Vigorous cyan wave for robot speech playback
      const delay = (index / BAR_COUNT) * 400;
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(delay % 200),
          Animated.timing(heightAnim, {
            toValue: 6 + Math.random() * 22,
            duration: 220 + Math.random() * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: 3 + Math.random() * 4,
            duration: 220 + Math.random() * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      loopRef.current.start();
    } else if (voiceState === 'recording') {
      // Dynamic white wave for user speech input
      const delay = (index / BAR_COUNT) * 500;
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(delay % 250),
          Animated.timing(heightAnim, {
            toValue: 4 + Math.random() * 16,
            duration: 280 + Math.random() * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: 3 + Math.random() * 3,
            duration: 280 + Math.random() * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      loopRef.current.start();
    } else if (voiceState === 'processing') {
      // Subtle rhythmic breathing sweep while thinking
      const sweepDelay = (index % 5) * 160;
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(sweepDelay),
          Animated.timing(heightAnim, {
            toValue: 10,
            duration: 450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: 3,
            duration: 450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      loopRef.current.start();
    } else {
      // Resting baseline
      Animated.timing(heightAnim, {
        toValue: 3,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }

    return () => loopRef.current?.stop();
  }, [voiceState]);

  const barColor =
    voiceState === 'speaking'
      ? colors.eyeCyan
      : voiceState === 'recording'
      ? colors.textPrimary
      : voiceState === 'processing'
      ? colors.textMuted
      : colors.borderStrong;

  return (
    <Animated.View
      style={{
        width: 3,
        height: heightAnim,
        borderRadius: 2,
        backgroundColor: barColor,
        marginHorizontal: 2.5,
        alignSelf: 'flex-end',
      }}
    />
  );
};

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  voiceState,
  audioError,
  onMicPress,
  isMuted,
  isActionInFlight = false,
}) => {
  // Float animation for ELO robot
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;
  const headGlow = useRef(new Animated.Value(0.2)).current;
  const ringRef = useRef<Animated.CompositeAnimation | null>(null);

  // Button tactile press animation
  const btnScale = useRef(new Animated.Value(1)).current;
  // Recording button pulse glow
  const recordingPulse = useRef(new Animated.Value(0.4)).current;
  const recPulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Sinusoidal float for robot hero
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []);

  // Concentric audio rings and head glow during speaking / recording
  useEffect(() => {
    ringRef.current?.stop();
    pulseRing1.setValue(0);
    pulseRing2.setValue(0);

    if (voiceState === 'recording' || voiceState === 'speaking') {
      ringRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseRing1, {
              toValue: 1,
              duration: 1800,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(pulseRing1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(900),
            Animated.timing(pulseRing2, {
              toValue: 1,
              duration: 1800,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(pulseRing2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      ringRef.current.start();
    }

    // Glow pulse behind eyes
    if (voiceState === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(headGlow, {
            toValue: 0.9,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(headGlow, {
            toValue: 0.25,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Animated.timing(headGlow, { toValue: 0.15, duration: 400, useNativeDriver: true }).start();
    }

    return () => ringRef.current?.stop();
  }, [voiceState]);

  // Recording button pulse animation
  useEffect(() => {
    recPulseRef.current?.stop();
    if (voiceState === 'recording') {
      recPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(recordingPulse, {
            toValue: 0.35,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      recPulseRef.current.start();
    } else {
      recordingPulse.setValue(0.4);
    }
    return () => recPulseRef.current?.stop();
  }, [voiceState]);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const ringScale1 = pulseRing1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.45],
  });
  const ringOpacity1 = pulseRing1.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.6, 0.4, 0],
  });

  const ringScale2 = pulseRing2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.45],
  });
  const ringOpacity2 = pulseRing2.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.6, 0.4, 0],
  });

  const handlePressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.90,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  };

  // ── State Label (Exact prompt requirements) ──
  const getStateLabel = (): string => {
    if (isMuted) return 'MICROPHONE MUTED';
    if (voiceState === 'error') return audioError || 'MICROPHONE ERROR';
    switch (voiceState) {
      case 'recording':
        return 'LISTENING TO YOU...';
      case 'processing':
        return 'THINKING...';
      case 'speaking':
        return 'ELO IS SPEAKING...';
      case 'idle':
      default:
        return 'READY TO LISTEN';
    }
  };

  // ── Mic Button Disabled Logic (Section 6) ──
  // Only disabled during processing and speaking (or while async start/stop request in flight)
  const isButtonDisabled =
    isActionInFlight || voiceState === 'processing' || voiceState === 'speaking';

  // ── Mic Icon ──
  const getMicIcon = (): keyof typeof Ionicons.glyphMap => {
    if (isMuted) return 'mic-off';
    if (voiceState === 'error') return 'refresh-outline';
    if (voiceState === 'recording') return 'square'; // STOP icon
    if (voiceState === 'processing') return 'ellipsis-horizontal';
    if (voiceState === 'speaking') return 'volume-high';
    return 'mic';
  };

  // ── Visual button style based on state ──
  const getButtonBg = () => {
    if (isMuted) return 'rgba(255, 59, 48, 0.15)';
    if (voiceState === 'error') return 'rgba(255, 59, 48, 0.12)';
    if (voiceState === 'recording') return '#FFFFFF'; // Crisp bright white stop button
    if (voiceState === 'speaking') return 'rgba(77, 217, 245, 0.15)';
    if (voiceState === 'processing') return colors.surfaceElevated;
    return colors.surfaceElevated;
  };

  const getIconColor = () => {
    if (isMuted) return colors.accent;
    if (voiceState === 'error') return colors.accent;
    if (voiceState === 'recording') return '#000000'; // Dark stop square on white
    if (voiceState === 'speaking') return colors.eyeCyan;
    if (voiceState === 'processing') return colors.textMuted;
    return colors.textPrimary;
  };

  return (
    <View style={styles.container}>
      {/* Visualizer Hero Area with ELO Robot */}
      <View style={styles.robotStage} pointerEvents="box-none">
        {/* Radiating voice rings */}
        {(voiceState === 'recording' || voiceState === 'speaking') && (
          <>
            <Animated.View
              style={[
                styles.voiceRing,
                {
                  transform: [{ scale: ringScale1 }],
                  opacity: ringOpacity1,
                  borderColor: voiceState === 'speaking' ? colors.eyeCyan : colors.textMuted,
                },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.voiceRing,
                {
                  transform: [{ scale: ringScale2 }],
                  opacity: ringOpacity2,
                  borderColor: voiceState === 'speaking' ? colors.eyeCyan : colors.textMuted,
                },
              ]}
              pointerEvents="none"
            />
          </>
        )}

        {/* Ambient cyan glow behind head */}
        <Animated.View
          style={[styles.headGlowAura, { opacity: headGlow }]}
          pointerEvents="none"
        />

        {/* ELO Robot Cutout Image with gentle float */}
        <Animated.View
          style={[
            styles.robotImageWrap,
            { transform: [{ translateY: floatY }] },
          ]}
          pointerEvents="none"
        >
          <Image
            source={ELO_IMAGE}
            style={[
              styles.robotImage,
              isMuted && styles.robotImageDimmed,
            ]}
            resizeMode="contain"
            accessibilityLabel="ELO companion robot"
          />
        </Animated.View>

        {/* Soft ground pedestal shadow */}
        <View style={styles.pedestalShadow} pointerEvents="none" />
      </View>

      {/* Waveform Equalizer Bar Strip */}
      <View style={styles.equalizerWrap} pointerEvents="none">
        <View style={styles.barsRow}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <AnimatedBar key={i} index={i} voiceState={voiceState} />
          ))}
        </View>
      </View>

      {/* State label badge */}
      <View style={styles.stateBadge}>
        {voiceState === 'recording' && (
          <Animated.View
            style={[
              styles.stateDot,
              { backgroundColor: colors.accent, opacity: recordingPulse },
            ]}
          />
        )}
        {voiceState === 'speaking' && (
          <View style={[styles.stateDot, { backgroundColor: colors.eyeCyan }]} />
        )}
        {voiceState === 'processing' && (
          <View style={[styles.stateDot, { backgroundColor: colors.wheelAmber }]} />
        )}
        {voiceState === 'idle' && (
          <View style={[styles.stateDot, { backgroundColor: colors.dotOnline }]} />
        )}
        {voiceState === 'error' && (
          <View style={[styles.stateDot, { backgroundColor: colors.accent }]} />
        )}

        <Text
          style={[
            styles.stateLabel,
            isMuted && { color: colors.accent },
            voiceState === 'recording' && { color: colors.textPrimary },
            voiceState === 'speaking' && { color: colors.eyeCyan },
            voiceState === 'processing' && { color: colors.wheelAmber },
            voiceState === 'error' && { color: colors.accent },
          ]}
        >
          {getStateLabel()}
        </Text>
      </View>

      {/* Error Try Again Hint */}
      {voiceState === 'error' && (
        <Text style={styles.errorSubText}>Tap button below to try again</Text>
      )}

      {/* Mic / Stop Trigger Button with tactile animation */}
      <Animated.View
        style={[
          styles.btnWrapper,
          { transform: [{ scale: btnScale }] },
        ]}
      >
        {/* Pulsing halo ring during recording */}
        {voiceState === 'recording' && (
          <Animated.View
            style={[
              styles.recordingHalo,
              { opacity: recordingPulse },
            ]}
            pointerEvents="none"
          />
        )}

        <TouchableOpacity
          style={[
            styles.micButton,
            { backgroundColor: getButtonBg() },
            isMuted && styles.micButtonMuted,
            voiceState === 'recording' && styles.micButtonRecording,
            voiceState === 'speaking' && styles.micButtonSpeaking,
            voiceState === 'processing' && styles.micButtonProcessing,
            voiceState === 'error' && styles.micButtonError,
          ]}
          onPress={onMicPress}
          onPressIn={!isButtonDisabled ? handlePressIn : undefined}
          onPressOut={!isButtonDisabled ? handlePressOut : undefined}
          disabled={isButtonDisabled}
          activeOpacity={0.85}
          accessibilityLabel={
            isMuted
              ? 'Microphone muted — tap to unmute'
              : voiceState === 'recording'
              ? 'Stop recording'
              : voiceState === 'error'
              ? 'Retry audio'
              : 'Tap to talk with ELO'
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: isButtonDisabled }}
        >
          <Ionicons
            name={getMicIcon()}
            size={voiceState === 'recording' ? 24 : 28}
            color={getIconColor()}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    width: '100%',
  },
  robotStage: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: spacing.md,
  },
  robotImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  robotImage: {
    width: 170,
    height: 190,
  },
  robotImageDimmed: {
    opacity: 0.45,
  },
  headGlowAura: {
    position: 'absolute',
    top: 20,
    width: 110,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.eyeCyan,
    shadowColor: colors.eyeCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 22,
    elevation: 6,
    zIndex: 1,
  },
  voiceRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    zIndex: 0,
  },
  pedestalShadow: {
    position: 'absolute',
    bottom: 8,
    width: 130,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 1,
  },
  equalizerWrap: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 7,
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  stateLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  errorSubText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  btnWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 84,
    height: 84,
  },
  recordingHalo: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.6)',
  },
  micButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  micButtonRecording: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  micButtonSpeaking: {
    borderColor: colors.eyeCyan,
    borderWidth: 1.5,
  },
  micButtonProcessing: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  micButtonError: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  micButtonMuted: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
});
