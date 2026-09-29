import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { RobotMode } from '../types';

interface EloRobotHeroProps {
  mode: RobotMode;
  isConnected: boolean;
  obstacleDetected: boolean;
  commandPending: string | null;
}

const ELO_IMAGE = require('../../assets/elo-robot.png');

export const EloRobotHero: React.FC<EloRobotHeroProps> = ({
  mode,
  isConnected,
  obstacleDetected,
  commandPending,
}) => {
  // ── Idle float physics ──
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── State-based scale ──
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Tap reaction bounce ──
  const tapBounceAnim = useRef(new Animated.Value(1)).current;
  const [tapMessage, setTapMessage] = useState<string | null>(null);
  const tapMsgOpacity = useRef(new Animated.Value(0)).current;
  const tapMsgY = useRef(new Animated.Value(6)).current;
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State-based rotation (FOLLOWING = slight forward tilt) ──
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // ── Head / Eye glow pulse (cyan) ──
  const headGlowAnim = useRef(new Animated.Value(0.2)).current;
  const headGlowRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Wheel motion radar ripples (FOLLOWING) ──
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const rippleRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Obstacle pulse (danger alert) ──
  const obstaclePulseAnim = useRef(new Animated.Value(0)).current;
  const obstaclePulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Entrance fade + slide ──
  const entranceFade = useRef(new Animated.Value(0)).current;
  const entranceY = useRef(new Animated.Value(24)).current;

  // ── Mode cross-fade ──
  const modeFade = useRef(new Animated.Value(1)).current;

  // ── Initial entrance & Idle float loop ──
  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceFade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entranceY, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Smooth sinusoidal floating physics
    floatRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    floatRef.current.start();

    return () => {
      floatRef.current?.stop();
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // ── Atmospheric Head Glow (Cyan eye aura) ──
  useEffect(() => {
    headGlowRef.current?.stop();

    if (mode === 'interacting') {
      // Energetic conversational glow
      headGlowRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(headGlowAnim, {
            toValue: 0.85,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(headGlowAnim, {
            toValue: 0.25,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      headGlowRef.current.start();
    } else if (isConnected) {
      // Calm ambient breathing glow
      headGlowRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(headGlowAnim, {
            toValue: 0.45,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(headGlowAnim, {
            toValue: 0.15,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      headGlowRef.current.start();
    } else {
      Animated.timing(headGlowAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }

    return () => headGlowRef.current?.stop();
  }, [mode, isConnected]);

  // ── Radar / Wheel Motion Ripples when Moving ──
  useEffect(() => {
    rippleRef.current?.stop();
    rippleAnim1.setValue(0);
    rippleAnim2.setValue(0);

    if (mode === 'moving') {
      rippleRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(rippleAnim1, {
              toValue: 1,
              duration: 1600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(rippleAnim1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(800),
            Animated.timing(rippleAnim2, {
              toValue: 1,
              duration: 1600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(rippleAnim2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      rippleRef.current.start();
    }

    return () => rippleRef.current?.stop();
  }, [mode]);

  // ── Mode-reactive animations ──
  useEffect(() => {
    Animated.sequence([
      Animated.timing(modeFade, {
        toValue: 0.8,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: mode === 'stopped' ? 0.96 : mode === 'moving' ? 1.03 : 1.0,
        friction: 6,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.timing(modeFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Slight lean when moving
    Animated.spring(rotateAnim, {
      toValue: mode === 'moving' ? 1 : 0,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  // ── Obstacle hazard pulse ──
  useEffect(() => {
    obstaclePulseRef.current?.stop();
    obstaclePulseAnim.setValue(0);

    if (obstacleDetected) {
      obstaclePulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(obstaclePulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(obstaclePulseAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      obstaclePulseRef.current.start();
    }

    return () => obstaclePulseRef.current?.stop();
  }, [obstacleDetected]);

  // ── Interactive Tactile Tap Reaction ──
  const handleTap = useCallback(() => {
    // Spring bounce
    Animated.sequence([
      Animated.spring(tapBounceAnim, {
        toValue: 1.07,
        friction: 4,
        tension: 320,
        useNativeDriver: true,
      }),
      Animated.spring(tapBounceAnim, {
        toValue: 1,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // Determine playful contextual reaction
    let msg = '⚡ ELO is ready to roll';
    if (!isConnected) {
      msg = 'Connecting to ELO…';
    } else if (obstacleDetected) {
      msg = '⚠️ Obstacle detected!';
    } else if (mode === 'moving') {
      msg = '🧭 Following target smoothly';
    } else if (mode === 'interacting') {
      msg = '💬 Conversation mode active';
    } else if (mode === 'stopped') {
      msg = '🛑 Standing by for command';
    }

    setTapMessage(msg);
    tapMsgOpacity.setValue(0);
    tapMsgY.setValue(6);

    Animated.parallel([
      Animated.timing(tapMsgOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tapMsgY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      Animated.timing(tapMsgOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setTapMessage(null));
    }, 2200);
  }, [isConnected, obstacleDetected, mode]);

  // ── Interpolations ──
  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  // Inverse shadow scaling: when robot is higher, shadow is smaller and lighter
  const shadowScaleX = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.02, 0.88],
  });

  const shadowScaleY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 0.82],
  });

  const shadowOpacity = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.28],
  });

  const rotateZ = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '2.2deg'],
  });

  // Wheel ripple scales & opacities
  const rippleScale1 = rippleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.6],
  });
  const rippleOpacity1 = rippleAnim1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.35, 0],
  });

  const rippleScale2 = rippleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.6],
  });
  const rippleOpacity2 = rippleAnim2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.35, 0],
  });

  // Obstacle hazard alert
  const obstacleGlowOpacity = obstaclePulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <View style={styles.outerWrapper}>
      {/* Playful contextual reaction toast */}
      {tapMessage && (
        <Animated.View
          style={[
            styles.tapBubble,
            {
              opacity: tapMsgOpacity,
              transform: [{ translateY: tapMsgY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.tapBubbleText}>{tapMessage}</Text>
        </Animated.View>
      )}

      {/* Main interactive robot container */}
      <Pressable
        onPress={handleTap}
        accessibilityLabel="ELO physical robot. Tap to interact."
        accessibilityRole="imagebutton"
        style={styles.pressableWrap}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: Animated.multiply(entranceFade, modeFade),
              transform: [
                { translateY: Animated.add(floatY, entranceY) },
                { scale: Animated.multiply(scaleAnim, tapBounceAnim) },
              ],
            },
          ]}
        >
          {/* Atmospheric Cyan Glow behind Screen Head */}
          <Animated.View
            style={[
              styles.headGlowAura,
              {
                opacity: isConnected ? headGlowAnim : 0,
              },
            ]}
            pointerEvents="none"
          />

          {/* Obstacle Hazard Glow */}
          {obstacleDetected && (
            <Animated.View
              style={[
                styles.obstacleGlow,
                {
                  opacity: obstacleGlowOpacity,
                },
              ]}
              pointerEvents="none"
            />
          )}

          {/* Motion Radar Ripples around Wheels (when moving) */}
          {mode === 'moving' && (
            <>
              <Animated.View
                style={[
                  styles.motionRipple,
                  {
                    transform: [{ scale: rippleScale1 }],
                    opacity: rippleOpacity1,
                  },
                ]}
                pointerEvents="none"
              />
              <Animated.View
                style={[
                  styles.motionRipple,
                  {
                    transform: [{ scale: rippleScale2 }],
                    opacity: rippleOpacity2,
                  },
                ]}
                pointerEvents="none"
              />
            </>
          )}

          {/* Robot Image with Dynamic Tilt */}
          <Animated.View
            style={{
              transform: [{ rotateZ }],
            }}
          >
            <Image
              source={ELO_IMAGE}
              style={[
                styles.robotImage,
                !isConnected && styles.robotImageOffline,
              ]}
              resizeMode="contain"
              accessibilityLabel="ELO robot"
            />
          </Animated.View>
        </Animated.View>

        {/* Dynamic Inversed Ground Shadow under the wheels */}
        <Animated.View
          style={[
            styles.shadowContainer,
            {
              transform: [
                { scaleX: shadowScaleX },
                { scaleY: shadowScaleY },
              ],
              opacity: isConnected ? shadowOpacity : 0.15,
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.groundShadowCore} />
          <View style={styles.groundShadowSoft} />
        </Animated.View>
      </Pressable>

      {/* Wheel spin indicators (when moving) */}
      {mode === 'moving' && <WheelSpinDots />}
    </View>
  );
};

/** Four amber speed dots that orbit to signify active wheel movement */
const WheelSpinDots: React.FC = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const dots = [0, 1, 2, 3].map((i) => {
    const delay = i * 0.25;
    const opacity = spinAnim.interpolate({
      inputRange: [delay, Math.min(delay + 0.2, 1), Math.min(delay + 0.5, 1), 1],
      outputRange: [0.15, 1, 1, 0.15],
      extrapolate: 'clamp',
    });

    const scale = spinAnim.interpolate({
      inputRange: [delay, Math.min(delay + 0.2, 1), Math.min(delay + 0.5, 1), 1],
      outputRange: [0.8, 1.25, 1.25, 0.8],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        key={i}
        style={[
          styles.wheelDot,
          { opacity, transform: [{ scale }], marginHorizontal: 4 },
        ]}
      />
    );
  });

  return (
    <View style={styles.wheelDotsRow} pointerEvents="none">
      <Text style={styles.wheelDotsLabel}>EN ROUTE</Text>
      <View style={styles.dotsGroup}>{dots}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: spacing.sm,
  },
  pressableWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  robotImage: {
    width: 216,
    height: 242,
  },
  robotImageOffline: {
    opacity: 0.38,
  },
  // Cyan halo positioned directly behind the screen head
  headGlowAura: {
    position: 'absolute',
    top: 10,
    width: 140,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.eyeCyan,
    shadowColor: colors.eyeCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 8,
    zIndex: -1,
  },
  // Obstacle hazard alert ring
  obstacleGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    zIndex: -1,
  },
  // Motion radar ripples under the robot
  motionRipple: {
    position: 'absolute',
    bottom: 20,
    width: 220,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: colors.wheelAmber,
    backgroundColor: 'rgba(245, 196, 0, 0.04)',
    zIndex: -1,
  },
  // Dynamic ground shadow
  shadowContainer: {
    width: 190,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    zIndex: 1,
  },
  groundShadowCore: {
    width: 160,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#000000',
    opacity: 0.8,
  },
  groundShadowSoft: {
    position: 'absolute',
    width: 190,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  // Tap contextual bubble
  tapBubble: {
    position: 'absolute',
    top: -12,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  tapBubbleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  // Wheel spin indicator
  wheelDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(245, 196, 0, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 196, 0, 0.25)',
  },
  wheelDotsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.wheelAmber,
    letterSpacing: 1.2,
    marginRight: spacing.sm,
  },
  dotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wheelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.wheelAmber,
  },
});
