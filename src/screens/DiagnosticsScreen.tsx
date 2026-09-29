import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { api } from '../api/client';

const ELO_IMAGE = require('../../assets/elo-robot.png');

type SystemStatus = 'online' | 'offline' | 'degraded' | 'unknown';

interface SystemItem {
  id: string;
  label: string;
  status: SystemStatus;
  detail?: string;
}

const statusColor = (s: SystemStatus) => {
  switch (s) {
    case 'online': return colors.dotOnline;
    case 'offline': return colors.dotOffline;
    case 'degraded': return colors.stateUnknown;
    default: return colors.textMuted;
  }
};

const statusLabel = (s: SystemStatus) => {
  switch (s) {
    case 'online': return 'Online';
    case 'offline': return 'Offline';
    case 'degraded': return 'Degraded';
    default: return 'Unknown';
  }
};

/** Thin horizontal callout line with label at one end */
const CalloutLine: React.FC<{
  label: string;
  status: SystemStatus;
  side: 'left' | 'right';
  style?: any;
}> = ({ label, status, side, style }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'online') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status]);

  const dot = (
    <Animated.View
      style={[
        styles.calloutDot,
        { backgroundColor: statusColor(status), opacity: status === 'online' ? pulseAnim : 1 },
      ]}
    />
  );

  const line = <View style={styles.calloutLineLine} />;
  const textEl = (
    <View style={styles.calloutLabelGroup}>
      <Text style={styles.calloutLabel}>{label}</Text>
      <Text style={[styles.calloutStatus, { color: statusColor(status) }]}>
        {statusLabel(status)}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.calloutRow,
        side === 'right' ? styles.calloutRowRight : styles.calloutRowLeft,
        style,
      ]}
    >
      {side === 'left' ? (
        <>
          {textEl}
          {line}
          {dot}
        </>
      ) : (
        <>
          {dot}
          {line}
          {textEl}
        </>
      )}
    </View>
  );
};

export const DiagnosticsScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    isConnected,
    eloOnline,
    aiConnected,
    audioReady,
    displayConnected,
    pingMs,
  } = useELO();

  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const { baseUrl } = useELO();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const cs = await api.getCameraStatus(baseUrl);
      setCameraAvailable(cs.available);
    } catch {
      setCameraAvailable(isConnected ? false : null);
    } finally {
      setIsRefreshing(false);
    }
  }, [baseUrl, isConnected]);

  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected]);

  const cameraStatus: SystemStatus = cameraAvailable === true ? 'online' : cameraAvailable === false ? 'offline' : 'unknown';

  // Derive system statuses
  const systems: SystemItem[] = [
    { id: 'pi', label: 'Raspberry Pi', status: isConnected && eloOnline ? 'online' : 'offline', detail: pingMs != null ? `${pingMs}ms` : undefined },
    { id: 'ai', label: 'AI Engine', status: aiConnected ? 'online' : isConnected ? 'offline' : 'unknown' },
    { id: 'audio', label: 'Audio', status: audioReady ? 'online' : isConnected ? 'offline' : 'unknown' },
    { id: 'display', label: 'Display', status: displayConnected ? 'online' : isConnected ? 'offline' : 'unknown' },
    { id: 'camera', label: 'Camera', status: cameraStatus },
    { id: 'motors', label: 'Motors', status: isConnected && eloOnline ? 'online' : isConnected ? 'degraded' : 'unknown' },
    { id: 'sensors', label: 'Sensors', status: isConnected && eloOnline ? 'online' : isConnected ? 'unknown' : 'unknown' },
  ];

  const allOnline = systems.every((s) => s.status === 'online');
  const hasIssue = systems.some((s) => s.status === 'offline' || s.status === 'degraded');

  // Callout layout: left side = Camera, Display, Audio (top→bottom)
  // Right side = Sensors, Motors (bottom→top)
  // Bottom band = Raspberry Pi, AI Engine
  const leftCallouts: SystemItem[] = [
    systems.find((s) => s.id === 'camera')!,
    systems.find((s) => s.id === 'display')!,
    // Audio MUST point to center hole — positioned carefully
    systems.find((s) => s.id === 'audio')!,
  ];
  const rightCallouts: SystemItem[] = [
    systems.find((s) => s.id === 'motors')!,
    systems.find((s) => s.id === 'sensors')!,
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>DIAGNOSTICS</Text>
          <Text style={styles.headerSub}>Check your robot's systems</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={refresh}
          disabled={isRefreshing}
          accessibilityLabel="Refresh diagnostics"
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh"
            size={18}
            color={isRefreshing ? colors.textMuted : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Robot diagram with callout lines */}
        <Animated.View style={[styles.diagramContainer, { opacity: fadeAnim }]}>
          {/* Left callouts: Camera / Display / Audio */}
          <View style={styles.leftCallouts}>
            <CalloutLine
              label={leftCallouts[0].label}
              status={leftCallouts[0].status}
              side="left"
              style={{ marginBottom: spacing.md }}
            />
            <CalloutLine
              label={leftCallouts[1].label}
              status={leftCallouts[1].status}
              side="left"
              style={{ marginBottom: spacing.md }}
            />
            {/* Audio — positioned to point at center hole of robot */}
            <CalloutLine
              label={leftCallouts[2].label}
              status={leftCallouts[2].status}
              side="left"
              style={{ marginTop: spacing.lg }}
            />
          </View>

          {/* Robot image */}
          <Image
            source={ELO_IMAGE}
            style={styles.robotImage}
            resizeMode="contain"
            accessibilityLabel="ELO robot diagram"
          />

          {/* Right callouts: Motors / Sensors */}
          <View style={styles.rightCallouts}>
            <CalloutLine
              label={rightCallouts[0].label}
              status={rightCallouts[0].status}
              side="right"
              style={{ marginBottom: spacing.xl }}
            />
            <CalloutLine
              label={rightCallouts[1].label}
              status={rightCallouts[1].status}
              side="right"
              style={{ marginTop: spacing.xxl }}
            />
          </View>
        </Animated.View>

        {/* Pi + AI Engine row */}
        <View style={styles.coreRow}>
          {[systems[0], systems[1]].map((s) => (
            <View key={s.id} style={styles.coreItem}>
              <View style={[styles.coreDot, { backgroundColor: statusColor(s.status) }]} />
              <Text style={styles.coreLabel}>{s.label}</Text>
              <Text style={[styles.coreStatus, { color: statusColor(s.status) }]}>
                {s.status === 'online' && s.detail ? `Online · ${s.detail}` : statusLabel(s.status)}
              </Text>
            </View>
          ))}
        </View>

        {/* Overall status */}
        <View style={[
          styles.overallStatus,
          hasIssue ? styles.overallStatusIssue : allOnline ? styles.overallStatusGood : styles.overallStatusUnknown,
        ]}>
          <Ionicons
            name={hasIssue ? 'alert-circle' : allOnline ? 'checkmark-circle' : 'help-circle'}
            size={18}
            color={hasIssue ? colors.accent : allOnline ? colors.dotOnline : colors.textMuted}
          />
          <View style={styles.overallStatusText}>
            <Text style={[
              styles.overallStatusTitle,
              { color: hasIssue ? colors.accent : allOnline ? colors.dotOnline : colors.textMuted },
            ]}>
              {hasIssue ? 'CHECK REQUIRED' : allOnline ? 'ALL SYSTEMS OPERATIONAL' : 'STATUS UNKNOWN'}
            </Text>
            <Text style={styles.overallStatusSub}>
              {hasIssue
                ? 'One or more systems need attention.'
                : allOnline
                ? 'ELO is ready to go!'
                : 'Connect to ELO to see system status.'}
            </Text>
          </View>
        </View>

        {/* All systems detail list */}
        <View style={styles.systemsList}>
          <Text style={styles.systemsListLabel}>SYSTEMS</Text>
          <View style={styles.systemsCard}>
            {systems.map((s, i) => (
              <React.Fragment key={s.id}>
                <View style={styles.systemsRow} accessibilityLabel={`${s.label}: ${statusLabel(s.status)}`}>
                  <Text style={styles.systemsItemLabel}>{s.label}</Text>
                  <View style={styles.systemsItemRight}>
                    <View style={[styles.systemsDot, { backgroundColor: statusColor(s.status) }]} />
                    <Text style={[styles.systemsItemStatus, { color: statusColor(s.status) }]}>
                      {s.detail ? `${statusLabel(s.status)} · ${s.detail}` : statusLabel(s.status)}
                    </Text>
                  </View>
                </View>
                {i < systems.length - 1 && <View style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, letterSpacing: 2 },
  headerSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },

  // Diagram
  diagramContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  leftCallouts: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
    justifyContent: 'center',
  },
  rightCallouts: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
    justifyContent: 'center',
  },
  robotImage: {
    width: 140,
    height: 160,
  },

  // Callout
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calloutRowLeft: { justifyContent: 'flex-end' },
  calloutRowRight: { justifyContent: 'flex-start' },
  calloutLabelGroup: { alignItems: 'flex-end', marginHorizontal: 4 },
  calloutLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  calloutStatus: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  calloutLineLine: {
    width: 20,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  calloutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Core row
  coreRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  coreItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  coreDot: { width: 8, height: 8, borderRadius: 4 },
  coreLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.3 },
  coreStatus: { fontSize: 11, fontWeight: '600' },

  // Overall status
  overallStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  overallStatusGood: {
    backgroundColor: 'rgba(52, 199, 89, 0.06)',
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  overallStatusIssue: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  overallStatusUnknown: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  overallStatusText: { flex: 1 },
  overallStatusTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  overallStatusSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Systems list
  systemsList: { marginHorizontal: spacing.lg },
  systemsListLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1.5, marginBottom: spacing.sm,
  },
  systemsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  systemsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  systemsItemLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  systemsItemRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  systemsDot: { width: 6, height: 6, borderRadius: 3 },
  systemsItemStatus: { fontSize: 13, fontWeight: '600' },
  rowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});
