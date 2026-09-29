import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

// Existing components
import { EloIdentityHeader } from '../components/EloIdentityHeader';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { RobotStateBadge } from '../components/RobotStateBadge';
import { SafetyStatusCard } from '../components/SafetyStatusCard';
import { CommandButtons } from '../components/CommandButtons';
import { SessionTimeIndicator } from '../components/SessionTimeIndicator';
import { PrivacyCard } from '../components/PrivacyCard';
import { SubsystemStatusBar } from '../components/SubsystemStatusBar';

// Phase D: camera
import { LiveCameraSelector } from '../components/camera/LiveCameraSelector';

// Phase D: ELO robot hero
import { EloRobotHero } from '../components/EloRobotHero';

import { RootTabParamList } from '../types';

type HomeScreenNavProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavProp>();
  const isFocused = useIsFocused();

  const {
    baseUrl,
    robotMode,
    modeUpdatedAt,
    isConnected,
    isUnreachable,
    retryConnection,
    eloOnline,
    eloState,
    selectedTargetId,
    targets,
    obstacleDetected,
    obstacleDetail,
    aiConnected,
    audioReady,
    displayConnected,
    commandPending,
    commandError,
    clearCommandError,
    requestFollow,
    requestInteract,
    requestStop,
    stagedTargetId,
    stageTarget,
    clearStagedTarget,
    lockedTargetId,
    targetLockState,
    lockTarget,
    clearTargetLock,
    setCameraActive,
  } = useELO();

  const [refreshing, setRefreshing] = useState(false);

  // Staggered entrance animations
  const anims = Array.from({ length: 7 }, () => useRef(new Animated.Value(0)).current);
  const [a0, a1, a2, a3, a4, a5, a6] = anims;

  useEffect(() => {
    Animated.stagger(
      70,
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  useEffect(() => {
    setCameraActive(isFocused);
  }, [isFocused, setCameraActive]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await retryConnection();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenSettings = () => {
    navigation.navigate('Settings');
  };

  const currentState = eloOnline ? eloState : robotMode;
  const lockedTarget = targets.find((t) => t.id === lockedTargetId);
  const targetLabel = lockedTarget?.label ?? null;
  const targetDistance = lockedTarget?.distance ?? null;

  const fadeSlide = (anim: Animated.Value, delay = 0) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <Animated.View style={fadeSlide(a0)}>
        <EloIdentityHeader
          isOnline={isConnected && eloOnline}
          lastUpdated={modeUpdatedAt}
        />
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Connection banner */}
        <Animated.View style={fadeSlide(a1)}>
          <ConnectionBanner onPressSettings={handleOpenSettings} />
        </Animated.View>

        {/* Command error */}
        {commandError ? (
          <View style={styles.errorBanner} accessibilityLiveRegion="assertive">
            <Ionicons name="alert-circle-outline" size={16} color={colors.accent} style={{ marginRight: spacing.xs + 2 }} />
            <Text style={styles.errorText}>{commandError}</Text>
            <TouchableOpacity
              onPress={clearCommandError}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Dismiss error"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── ELO Robot Hero (centrepiece) ── */}
        <Animated.View style={[styles.heroSection, fadeSlide(a1)]}>
          <EloRobotHero
            mode={currentState}
            isConnected={isConnected}
            obstacleDetected={obstacleDetected}
            commandPending={commandPending}
          />
        </Animated.View>

        {/* ── State badge ── */}
        <Animated.View style={fadeSlide(a2)}>
          <RobotStateBadge
            mode={currentState}
            updatedAt={modeUpdatedAt}
            isConnected={isConnected}
            targetLabel={targetLabel}
            targetDistance={targetDistance}
            commandPending={commandPending}
          />
        </Animated.View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* ── Subsystem bar ── */}
        <Animated.View style={fadeSlide(a3)}>
          <SubsystemStatusBar
            aiConnected={aiConnected}
            audioReady={audioReady}
            isConnected={isConnected}
            displayConnected={displayConnected}
          />
        </Animated.View>

        {/* ── Live Camera + Target Selector ── */}
        <Animated.View style={fadeSlide(a3)}>
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
        </Animated.View>

        {/* ── Safety Card ── */}
        <Animated.View style={fadeSlide(a4)}>
          <SafetyStatusCard
            obstacleDetected={obstacleDetected}
            obstacleDetail={obstacleDetail}
            robotState={currentState}
          />
        </Animated.View>

        {/* ── Command Buttons ── */}
        <Animated.View style={fadeSlide(a5)}>
          <CommandButtons
            currentMode={currentState}
            commandPending={commandPending}
            isConnected={isConnected}
            targetLockState={targetLockState}
            lockedTargetId={lockedTargetId}
            onRequestFollow={requestFollow}
            onRequestInteract={requestInteract}
            onRequestStop={requestStop}
          />
        </Animated.View>

        {/* ── Secondary ── */}
        <Animated.View style={fadeSlide(a6)}>
          <SessionTimeIndicator />
          <PrivacyCard />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },
});
