/**
 * CameraPanel.tsx
 *
 * Full-width 4:3 camera preview with:
 * - Live JPEG frame rendering
 * - Bounding box overlays (normalized coords → pixel)
 * - LIVE / PAUSED / NO CAMERA status overlay
 * - Frame-age indicator (updated every 200 ms)
 * - Tap-to-select target (normalized coords forwarded via onTapTarget)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { DisplayedFrame, V2Target } from '../types/v2';

// ─── Helper ────────────────────────────────────────────────────────────────

function labelFromTrackId(track_id: string, label?: string): string {
  if (label) return label;
  const match = track_id.match(/(\d+)$/);
  return match ? `Person ${parseInt(match[1], 10)}` : `Person ${track_id.slice(-3)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface CameraPanelProps {
  displayedFrame: DisplayedFrame | null;
  isFrameStale: boolean;
  isWsConnected: boolean;
  confirmedTargetId: string | null;
  pendingTargetId: string | null;
  onTapTarget: (x: number, y: number, frameTimestamp: number) => void;
  disabled: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const CameraPanel: React.FC<CameraPanelProps> = ({
  displayedFrame,
  isFrameStale,
  isWsConnected,
  confirmedTargetId,
  pendingTargetId,
  onTapTarget,
  disabled,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const panelWidth = screenWidth - spacing.lg * 2;
  const panelHeight = panelWidth * (3 / 4);

  // Track rendered panel size for precise coordinate mapping
  const [panelW, setPanelW] = useState(panelWidth);
  const [panelH, setPanelH] = useState(panelHeight);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setPanelW(width);
      setPanelH(height);
    }
  }, []);

  // Frame age ticker — update every 200 ms
  const [frameAge, setFrameAge] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (displayedFrame) {
        setFrameAge(Date.now() - displayedFrame.capturedAt);
      } else {
        setFrameAge(null);
      }
    }, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [displayedFrame]);

  // ── Tap handler ──────────────────────────────────────────────────────────
  const handlePress = useCallback(
    (evt: GestureResponderEvent) => {
      if (disabled || !displayedFrame) return;
      const { locationX, locationY } = evt.nativeEvent;
      const nx = clamp(locationX / panelW, 0, 1);
      const ny = clamp(locationY / panelH, 0, 1);
      onTapTarget(nx, ny, displayedFrame.frameTimestamp);
    },
    [disabled, displayedFrame, panelW, panelH, onTapTarget],
  );

  // ── Status label ─────────────────────────────────────────────────────────
  const statusLabel = !isWsConnected
    ? 'NO CAMERA'
    : !displayedFrame
    ? 'NO CAMERA'
    : isFrameStale
    ? 'PAUSED'
    : 'LIVE · LOCAL';

  const isLive = isWsConnected && !!displayedFrame && !isFrameStale;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.95}
      onPress={handlePress}
      accessibilityLabel="Camera feed — tap a person to select them"
      style={[styles.panel, { width: panelWidth, height: panelHeight }]}
      onLayout={onLayout}
    >
      {/* Frame image */}
      {displayedFrame ? (
        <Image
          source={{ uri: displayedFrame.jpegUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityLabel="Live camera feed"
          pointerEvents="none"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} pointerEvents="none">
          <Text style={styles.placeholderTitle}>NO CAMERA</Text>
          <Text style={styles.placeholderSub}>Connect Pi to see live feed</Text>
        </View>
      )}

      {/* Bounding boxes */}
      {displayedFrame?.targets.map((target: V2Target) => {
        const left = target.bbox.x * panelW;
        const top = target.bbox.y * panelH;
        const width = target.bbox.width * panelW;
        const height = target.bbox.height * panelH;

        const isConfirmed = target.track_id === confirmedTargetId;
        const isPending = target.track_id === pendingTargetId;

        const borderColor = isConfirmed
          ? '#FFFFFF'
          : isPending
          ? '#888888'
          : '#555555';
        const borderWidth = isConfirmed ? 2 : isPending ? 1.5 : 1;

        const personLabel = labelFromTrackId(target.track_id, target.label);

        return (
          <View
            key={target.track_id}
            accessibilityLabel={`${personLabel} bounding box`}
            pointerEvents="none"
            style={[
              styles.bbox,
              {
                left,
                top,
                width,
                height,
                borderColor,
                borderWidth,
              },
            ]}
          >
            {/* Label above box */}
            <View style={styles.bboxLabelContainer}>
              <Text style={[styles.bboxLabel, { color: borderColor }]}>
                {personLabel}
                {isConfirmed ? ' ✓' : isPending ? ' …' : ''}
              </Text>
            </View>

            {/* Checkmark corner for confirmed */}
            {isConfirmed && (
              <View style={styles.bboxCheckmark}>
                <Text style={styles.bboxCheckmarkText}>✓</Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Status overlay — top left */}
      <View style={styles.statusOverlay} pointerEvents="none">
        {isLive && <View style={styles.liveDot} />}
        <Text
          style={[
            styles.statusText,
            isLive
              ? styles.statusTextLive
              : isFrameStale && displayedFrame
              ? styles.statusTextPaused
              : styles.statusTextOff,
          ]}
        >
          {statusLabel}
        </Text>
      </View>

      {/* Frame age — top right */}
      {frameAge !== null && displayedFrame && (
        <View style={styles.ageOverlay} pointerEvents="none">
          <Text style={styles.ageText}>{formatAge(frameAge)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  placeholderSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  bbox: {
    position: 'absolute',
    borderRadius: 2,
  },
  bboxLabelContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 3,
  },
  bboxLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bboxCheckmark: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  bboxCheckmarkText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.dotOnline,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusTextLive: {
    color: colors.dotOnline,
  },
  statusTextPaused: {
    color: colors.textSecondary,
  },
  statusTextOff: {
    color: colors.textMuted,
  },
  ageOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  ageText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
