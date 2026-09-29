import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { HomeStackParamList } from '../types';

import { LiveCameraSelector } from '../components/camera/LiveCameraSelector';
import { CommandButtons } from '../components/CommandButtons';
import { SafetyStatusCard } from '../components/SafetyStatusCard';

const ELO_IMAGE = require('../../assets/elo-robot.png');

type ControlNavProp = NativeStackNavigationProp<HomeStackParamList, 'Control'>;

export const ControlScreen: React.FC = () => {
  const navigation = useNavigation<ControlNavProp>();
  const isFocused = useIsFocused();

  const {
    baseUrl,
    isConnected,
    eloOnline,
    eloState,
    robotMode,
    targets,
    obstacleDetected,
    obstacleDetail,
    commandPending,
    commandError,
    clearCommandError,
    requestFollow,
    requestInteract,
    requestStop,
    stagedTargetId,
    stageTarget,
    lockedTargetId,
    targetLockState,
    lockTarget,
    clearTargetLock,
    setCameraActive,
  } = useELO();

  const currentState = eloOnline ? eloState : robotMode;
  const lockedTarget = targets.find((t) => lockedTargetId != null && String(t.id) === String(lockedTargetId));

  const handleInteract = useCallback(async (): Promise<boolean> => {
    navigation.navigate('Voice');
    return true;
  }, [navigation]);

  // Camera active only when this screen is focused
  useEffect(() => {
    setCameraActive(isFocused);
    return () => setCameraActive(false);
  }, [isFocused, setCameraActive]);

  const targetCount = targets.length;
  const targetCountLabel = targetCount === 0
    ? 'No people detected'
    : targetCount === 1
    ? '1 person detected · Tap to select'
    : `${targetCount} people detected · Tap to select`;

  const isReacquiring = targetLockState === 'reacquiring' || targetLockState === 'lost';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>CONTROL</Text>
          <Text style={styles.headerSub}>Move. Track. Explore.</Text>
        </View>

        {/* Live status */}
        <View style={styles.liveIndicator}>
          <View style={[
            styles.liveDot,
            { backgroundColor: isConnected ? colors.dotOnline : colors.dotOffline },
          ]} />
          <Text style={styles.liveText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Camera + target selection */}
        <LiveCameraSelector
          baseUrl={baseUrl}
          targets={targets}
          stagedTargetId={stagedTargetId}
          lockedTargetId={lockedTargetId}
          targetLockState={targetLockState}
          isConnected={isConnected}
          isActive={isFocused}
          onStageTarget={stageTarget}
          onLockTarget={lockTarget}
          onClearSelection={clearTargetLock}
        />

        {/* Detection count */}
        {targetCount > 0 && targetLockState === 'none' && (
          <Text style={styles.detectionHint}>{targetCountLabel}</Text>
        )}

        {/* Selected / locked target info */}
        {lockedTarget && (targetLockState === 'locked' || isReacquiring) && (
          <View style={styles.lockedTargetRow}>
            <View style={styles.lockedRobotAvatarWrap}>
              <Image
                source={ELO_IMAGE}
                style={styles.lockedRobotAvatar}
                resizeMode="contain"
                accessibilityLabel="ELO tracker avatar"
              />
            </View>
            <View style={styles.lockedTargetInfo}>
              <Text style={styles.lockedTargetName}>{lockedTarget.label}</Text>
              <View style={styles.lockedTargetMeta}>
                {lockedTarget.distance != null && (
                  <Text style={styles.lockedTargetMetaText}>{lockedTarget.distance.toFixed(1)}m away</Text>
                )}
                {lockedTarget.confidence != null && (
                  <Text style={styles.lockedTargetMetaText}>
                    {Math.round(lockedTarget.confidence * 100)}% match
                  </Text>
                )}
              </View>
            </View>
            <View style={[
              styles.lockedBadge,
              isReacquiring && { backgroundColor: 'rgba(245, 196, 0, 0.15)' },
            ]}>
              <Ionicons
                name={isReacquiring ? 'search' : 'checkmark-circle'}
                size={14}
                color={isReacquiring ? colors.wheelAmber : colors.dotOnline}
              />
              <Text style={[
                styles.lockedBadgeText,
                isReacquiring && { color: colors.wheelAmber },
              ]}>
                {isReacquiring ? 'Reacquiring' : 'Locked'}
              </Text>
            </View>
          </View>
        )}

        {/* Error */}
        {commandError ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{commandError}</Text>
            <TouchableOpacity onPress={clearCommandError} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Safety */}
        <SafetyStatusCard
          obstacleDetected={obstacleDetected}
          obstacleDetail={obstacleDetail}
          robotState={currentState}
        />

        {/* Commands */}
        <CommandButtons
          currentMode={currentState}
          commandPending={commandPending}
          isConnected={isConnected}
          targetLockState={targetLockState}
          lockedTargetId={lockedTargetId}
          onRequestFollow={requestFollow}
          onRequestInteract={handleInteract}
          onRequestStop={requestStop}
        />
      </View>
    </View>
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
    width: 36,
    height: 36,
    alignItems: 'center',
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 60,
    justifyContent: 'flex-end',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.xxxl,
  },
  detectionHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.xs,
    letterSpacing: 0.2,
  },
  lockedTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  lockedRobotAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginRight: spacing.sm,
  },
  lockedRobotAvatar: {
    width: 28,
    height: 30,
  },
  lockedTargetInfo: {
    flex: 1,
    gap: 2,
  },
  lockedTargetName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  lockedTargetMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lockedTargetMetaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dotOnline,
    letterSpacing: 0.5,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.accent,
  },
});
