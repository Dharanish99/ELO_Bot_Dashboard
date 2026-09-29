import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { EloTarget, TargetLockState } from '../../types';
import { ContainedImageRect, mapBBoxToScreen } from './geometry';

interface TargetMarkerProps {
  target: EloTarget;
  isStaged: boolean;
  isLocked: boolean;
  lockState: TargetLockState;
  imageRect: ContainedImageRect;
  onPress: (target: EloTarget) => void;
}

export const TargetMarker: React.FC<TargetMarkerProps> = ({
  target,
  isStaged,
  isLocked,
  lockState,
  imageRect,
  onPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const reacquireAnim = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(isStaged || isLocked ? 1 : 0)).current;

  const [isPressed, setIsPressed] = useState(false);
  const prevLockStateRef = useRef(lockState);

  const isReacquiring =
    lockState === 'reacquiring' ||
    lockState === 'lost' ||
    target.tracking_state === 'reacquiring';

  // Spring animation when target becomes staged or reacquired
  useEffect(() => {
    if (isStaged || isLocked) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          friction: 7,
          tension: 240,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          friction: 7,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isStaged, isLocked]);

  // Reacquiring -> Tracked transition animation
  useEffect(() => {
    if (
      (prevLockStateRef.current === 'reacquiring' || prevLockStateRef.current === 'lost') &&
      lockState === 'locked'
    ) {
      // Small joyful bounce on target reacquisition
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.08,
          friction: 6,
          tension: 260,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          friction: 6,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevLockStateRef.current = lockState;
  }, [lockState]);

  // Amber breathing pulse when reacquiring
  useEffect(() => {
    if (isReacquiring) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(reacquireAnim, {
            toValue: 0.45,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(reacquireAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      reacquireAnim.setValue(1);
    }
  }, [isReacquiring]);

  if (!target.bbox || imageRect.width <= 0 || imageRect.height <= 0) {
    return null;
  }

  const { pixelX, pixelY, pixelW, pixelH } = mapBBoxToScreen(target.bbox, imageRect);

  // Border colors according to target specification
  let borderColor = 'rgba(255, 255, 255, 0.28)';
  let borderWidth = 1;

  if (isReacquiring) {
    borderColor = colors.wheelAmber;
    borderWidth = 1.5;
  } else if (isLocked) {
    borderColor = '#FFFFFF';
    borderWidth = 2;
  } else if (isStaged) {
    borderColor = '#FFFFFF';
    borderWidth = 1.8;
  } else if (isPressed) {
    borderColor = 'rgba(255, 255, 255, 0.65)';
    borderWidth = 1.2;
  }

  // Format label and metadata (e.g. "PERSON 10", "2.1m • 94%")
  const labelText = isReacquiring
    ? 'REACQUIRING…'
    : target.label.toUpperCase();

  const metaParts: string[] = [];
  if (target.distance != null) {
    metaParts.push(`${target.distance.toFixed(1)}m`);
  }
  if (target.confidence != null) {
    metaParts.push(`${Math.round(target.confidence * 100)}%`);
  }
  const metaText = metaParts.join(' • ');

  return (
    <Animated.View
      style={[
        styles.marker,
        {
          left: pixelX,
          top: pixelY,
          width: pixelW,
          height: pixelH,
          borderColor,
          borderWidth,
          borderStyle: isReacquiring ? 'dashed' : 'solid',
          opacity: isReacquiring ? reacquireAnim : 1,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      accessibilityLabel={`${target.label}${target.distance ? `, ${target.distance.toFixed(1)}m away` : ''}`}
    >
      {/* Touch surface */}
      <Pressable
        style={styles.touchArea}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        onPress={() => onPress(target)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Select ${target.label}`}
      />

      {/* Lock indicator corner marks */}
      {isLocked && !isReacquiring && (
        <>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </>
      )}

      {/* Label and distance pill above target box */}
      <Animated.View
        style={[
          styles.labelContainer,
          {
            opacity: labelOpacity,
            backgroundColor: isReacquiring ? 'rgba(30, 20, 0, 0.85)' : 'rgba(0, 0, 0, 0.8)',
            borderColor: isReacquiring ? colors.wheelAmber : colors.borderStrong,
          },
        ]}
        pointerEvents="none"
      >
        <Text
          style={[
            styles.labelText,
            isReacquiring && { color: colors.wheelAmber },
          ]}
          numberOfLines={1}
        >
          {labelText}
        </Text>
        {metaText && !isReacquiring && (
          <Text style={styles.metaText}>{metaText}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    borderRadius: 2,
    zIndex: 10,
  },
  touchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  labelContainer: {
    position: 'absolute',
    top: -26,
    left: -1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.5,
    gap: 4,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  metaText: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  corner: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
});
