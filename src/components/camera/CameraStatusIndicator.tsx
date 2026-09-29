import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors, spacing } from '../../theme';
import { CameraConnectionState } from '../../types';

interface CameraStatusIndicatorProps {
  state: CameraConnectionState;
  isFallback: boolean;
}

export const CameraStatusIndicator: React.FC<CameraStatusIndicatorProps> = ({
  state,
  isFallback,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (state === 'live' || state === 'connecting') {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: state === 'live' ? 1800 : 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: state === 'live' ? 1800 : 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseRef.current?.stop();
  }, [state]);

  const getConfig = () => {
    switch (state) {
      case 'live':
        return {
          dotColor: colors.dotOnline,
          label: 'LIVE',
          labelColor: colors.dotOnline,
        };
      case 'connecting':
        return {
          dotColor: colors.textMuted,
          label: 'CONNECTING',
          labelColor: colors.textMuted,
        };
      case 'degraded':
        return {
          dotColor: colors.stateUnknown,
          label: 'DEGRADED',
          labelColor: colors.stateUnknown,
        };
      case 'unavailable':
        return {
          dotColor: colors.textMuted,
          label: 'NO CAMERA',
          labelColor: colors.textMuted,
        };
      case 'offline':
        return {
          dotColor: colors.accent,
          label: 'PI OFFLINE',
          labelColor: colors.accent,
        };
    }
  };

  const config = getConfig();

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: config.dotColor, opacity: pulseAnim },
        ]}
      />
      <Text style={[styles.label, { color: config.labelColor }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
