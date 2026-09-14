import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

interface ConnectionBannerProps {
  onPressSettings?: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ onPressSettings }) => {
  const { isUnreachable, retryConnection } = useELO();
  const [isRetrying, setIsRetrying] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isUnreachable) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isUnreachable]);

  if (!isUnreachable) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Animated.View style={[styles.row, { opacity: fadeAnim }]}>
      <View style={styles.dot} />
      <Text style={styles.text}>Offline — check WiFi</Text>
      <TouchableOpacity onPress={handleRetry} disabled={isRetrying}>
        <Text style={[styles.retryText, isRetrying && styles.retryTextDisabled]}>
          {isRetrying ? '...' : 'Retry'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.dotOffline,
  },
  text: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '400',
  },
  retryText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  retryTextDisabled: {
    color: colors.textMuted,
  },
});
