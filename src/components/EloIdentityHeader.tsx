import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface EloIdentityHeaderProps {
  isOnline: boolean;
  lastUpdated?: string | null;
}

export const EloIdentityHeader: React.FC<EloIdentityHeaderProps> = ({
  isOnline,
  lastUpdated,
}) => {
  // Heartbeat pulse on the status dot when online
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fade-in on mount
  const mountFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mountFade, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    pulseRef.current?.stop();
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.6);

    if (isOnline) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, {
              toValue: 1.6,
              duration: 700,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(1800),
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      pulseRef.current.start();
    }

    return () => pulseRef.current?.stop();
  }, [isOnline]);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const formattedTime = formatTime(lastUpdated);
  const dotColor = isOnline ? colors.dotOnline : colors.dotOffline;

  return (
    <Animated.View style={[styles.container, { opacity: mountFade }]}>
      <View style={styles.topRow}>
        {/* Brand */}
        <View>
          <Text style={styles.brandTitle}>ELO</Text>
          <Text style={styles.brandSubtitle}>
            {formattedTime ? `Synced ${formattedTime}` : "Your child's AI companion"}
          </Text>
        </View>

        {/* Status badge with heartbeat */}
        <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
          {/* Ripple ring */}
          <View style={styles.dotContainer}>
            {isOnline && (
              <Animated.View
                style={[
                  styles.pulseDot,
                  {
                    backgroundColor: dotColor,
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
            )}
            {/* Solid center dot */}
            <View style={[styles.solidDot, { backgroundColor: dotColor }]} />
          </View>
          <Text style={[styles.statusText, { color: isOnline ? colors.dotOnline : colors.dotOffline }]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  brandSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: spacing.xs + 2,
  },
  badgeOnline: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  dotContainer: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  solidDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
