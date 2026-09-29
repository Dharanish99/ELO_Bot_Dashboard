import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { colors, spacing, radius } from '../../theme';
import { CameraConnectionState, EloTarget, TargetLockState } from '../../types';
import { CameraStatusIndicator } from './CameraStatusIndicator';
import { DetectionOverlay } from './DetectionOverlay';
import { getContainedImageRect, ContainedImageRect } from './geometry';

interface CameraViewportProps {
  cameraState: CameraConnectionState;
  frameUrl: string | null;
  lastGoodFrameUrl: string | null;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  targets: EloTarget[];
  stagedTargetId: string | null;
  lockedTargetId: string | null;
  targetLockState: TargetLockState;
  isConnected: boolean;
  onFrameLoaded: () => void;
  onFrameError: (error: any) => void;
  onTargetPress: (target: EloTarget) => void;
  onRetry: () => void;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  cameraState,
  frameUrl,
  lastGoodFrameUrl,
  frameWidth,
  frameHeight,
  fps,
  targets,
  stagedTargetId,
  lockedTargetId,
  targetLockState,
  isConnected,
  onFrameLoaded,
  onFrameError,
  onTargetPress,
  onRetry,
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Pulse animation while connecting before first frame
  useEffect(() => {
    if (cameraState === 'connecting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [cameraState]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  // Use actual camera aspect ratio from status (e.g. 640/480 = 4/3, never forced 16:9)
  const cameraAspectRatio =
    frameWidth > 0 && frameHeight > 0 ? frameWidth / frameHeight : 4 / 3;

  // Active image source: current frame, or last good frame during transient loss
  const activeImageUri = frameUrl || lastGoodFrameUrl;

  // Only show fallback overlay if there is NO image loaded at all
  const showFallback =
    !activeImageUri &&
    (cameraState === 'unavailable' ||
      cameraState === 'offline' ||
      cameraState === 'connecting');

  // Compute exact letterboxed image rect inside container
  const imageRect: ContainedImageRect = getContainedImageRect(
    containerSize.width,
    containerSize.height,
    frameWidth,
    frameHeight
  );

  return (
    <View style={styles.container}>
      {/* 4:3 Camera Frame Container */}
      <View
        style={[styles.frame, { aspectRatio: cameraAspectRatio }]}
        onLayout={onLayout}
      >
        {/* Native Live Camera Image via expo-image */}
        {activeImageUri ? (
          <View style={styles.imageContainer}>
            <ExpoImage
              source={{ uri: activeImageUri }}
              contentFit="contain"
              cachePolicy="none"
              priority="high"
              transition={null}
              onLoad={onFrameLoaded}
              onError={onFrameError}
              style={styles.cameraImage}
              accessibilityLabel="Live camera feed from ELO"
            />

            {/* Target Detection Overlay (letterbox-aware) */}
            {containerSize.width > 0 && containerSize.height > 0 && (
              <DetectionOverlay
                targets={targets}
                stagedTargetId={stagedTargetId}
                lockedTargetId={lockedTargetId}
                targetLockState={targetLockState}
                imageRect={imageRect}
                onTargetPress={onTargetPress}
              />
            )}
          </View>
        ) : null}

        {/* Fallback & Initial Connecting States */}
        {showFallback && (
          <Animated.View style={[styles.fallbackContent, { opacity: pulseAnim }]}>
            {cameraState === 'offline' ? (
              <>
                <Text style={styles.fallbackTitle}>ELO OFFLINE</Text>
                <Text style={styles.fallbackSub}>Camera unavailable</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={onRetry}
                  activeOpacity={0.7}
                  accessibilityLabel="Retry camera connection"
                  accessibilityRole="button"
                >
                  <Text style={styles.retryText}>Reconnect</Text>
                </TouchableOpacity>
              </>
            ) : cameraState === 'unavailable' ? (
              <>
                <Text style={styles.fallbackTitle}>NO CAMERA</Text>
                <Text style={styles.fallbackSub}>Camera sensor not responding</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={onRetry}
                  activeOpacity={0.7}
                  accessibilityLabel="Retry camera sensor"
                  accessibilityRole="button"
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fallbackTitle}>CAMERA</Text>
                <Text style={styles.fallbackSub}>Connecting to ELO vision…</Text>
              </>
            )}
          </Animated.View>
        )}

        {/* Status Indicator Badge (LIVE only after frame renders) */}
        <View style={styles.statusBadge} pointerEvents="none">
          <CameraStatusIndicator state={cameraState} isFallback={false} />
        </View>

        {/* Local watermark when live */}
        {cameraState === 'live' && (
          <View style={styles.localBadge} pointerEvents="none">
            <Text style={styles.localText}>LOCAL</Text>
          </View>
        )}
      </View>

      {/* Development Instrumentation Diagnostics Line */}
      {__DEV__ && (
        <View style={styles.devDiagnostics}>
          <Text style={styles.devDiagnosticsText}>
            Frame: {cameraState.toUpperCase()} | {frameWidth}x{frameHeight} | {fps.toFixed(1)} FPS
          </Text>
          <Text style={styles.devDiagnosticsText}>
            Targets: {targets.length} | Selected: {stagedTargetId ?? 'none'} | Locked:{' '}
            {lockedTargetId ?? 'none'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  frame: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  imageContainer: {
    ...StyleSheet.absoluteFill,
  },
  cameraImage: {
    width: '100%',
    height: '100%',
  },
  fallbackContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  fallbackSub: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 20,
  },
  localBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 20,
  },
  localText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  devDiagnostics: {
    marginTop: 6,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devDiagnosticsText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
});
