import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { HomeStackParamList } from '../types';

import { EloIdentityHeader } from '../components/EloIdentityHeader';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { EloRobotHero } from '../components/EloRobotHero';
import { RobotStateBadge } from '../components/RobotStateBadge';
import { SafetyStatusCard } from '../components/SafetyStatusCard';
import { CommandButtons } from '../components/CommandButtons';
import { SessionTimeIndicator } from '../components/SessionTimeIndicator';
import { PrivacyCard } from '../components/PrivacyCard';
import { SubsystemStatusBar } from '../components/SubsystemStatusBar';

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

export const HomeMainScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavProp>();
  const isFocused = useIsFocused();

  const {
    baseUrl,
    robotMode,
    modeUpdatedAt,
    isConnected,
    retryConnection,
    eloOnline,
    eloState,
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
    lockedTargetId,
    targetLockState,
    setCameraActive,
  } = useELO();

  const [refreshing, setRefreshing] = useState(false);

  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    Animated.stagger(
      65,
      anims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  // Camera active only when focused — but camera is on ControlScreen now
  useEffect(() => {
    setCameraActive(false); // home doesn't use camera
  }, [setCameraActive]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await retryConnection();
    } finally {
      setRefreshing(false);
    }
  };

  const handleInteract = useCallback(async (): Promise<boolean> => {
    navigation.navigate('Voice');
    return true;
  }, [navigation]);

  const currentState = eloOnline ? eloState : robotMode;
  const lockedTarget = targets.find((t) => t.id === lockedTargetId);
  const targetLabel = lockedTarget?.label ?? null;
  const targetDistance = lockedTarget?.distance ?? null;

  const fadeSlide = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  });

  // State-based card copy
  const getHeroCard = () => {
    if (!isConnected) {
      return { title: 'ELO is offline', sub: 'Check your Wi-Fi connection and Pi power.' };
    }
    switch (currentState) {
      case 'moving':
        return {
          title: `Following ${targetLabel ?? 'target'}`,
          sub: targetDistance ? `${targetDistance.toFixed(1)}m away · ELO is on the move.` : 'ELO is following.',
        };
      case 'interacting':
        return { title: 'Talking with ELO', sub: 'ELO is in conversation mode.' };
      case 'stopped':
        return { title: 'Stopped', sub: 'ELO is standing by. Ready for your command.' };
      default:
        return { title: 'Ready to explore', sub: 'ELO is online and waiting for your command.' };
    }
  };

  const heroCard = getHeroCard();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.View style={fadeSlide(anims[0])}>
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
        <Animated.View style={fadeSlide(anims[0])}>
          <ConnectionBanner onPressSettings={() => navigation.getParent()?.navigate('Settings')} />
        </Animated.View>

        {/* Command error */}
        {commandError ? (
          <View style={styles.errorBanner} accessibilityLiveRegion="assertive">
            <Ionicons name="alert-circle-outline" size={16} color={colors.accent} />
            <Text style={styles.errorText}>{commandError}</Text>
            <TouchableOpacity
              onPress={clearCommandError}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Dismiss error"
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── ELO Robot Hero ── */}
        <Animated.View style={[styles.heroSection, fadeSlide(anims[1])]}>
          <EloRobotHero
            mode={currentState}
            isConnected={isConnected}
            obstacleDetected={obstacleDetected}
            commandPending={commandPending}
          />
        </Animated.View>

        {/* ── State badge ── */}
        <Animated.View style={fadeSlide(anims[2])}>
          <RobotStateBadge
            mode={currentState}
            updatedAt={modeUpdatedAt}
            isConnected={isConnected}
            targetLabel={targetLabel}
            targetDistance={targetDistance}
            commandPending={commandPending}
          />
        </Animated.View>

        {/* ── Hero action card ── */}
        <Animated.View style={[styles.heroCardWrapper, fadeSlide(anims[2])]}>
          <View style={styles.heroCard}>
            <View style={styles.heroCardText}>
              <Text style={styles.heroCardTitle}>{heroCard.title}</Text>
              <Text style={styles.heroCardSub}>{heroCard.sub}</Text>
            </View>
            <TouchableOpacity
              style={styles.heroCardCta}
              onPress={() => navigation.navigate('Control')}
              activeOpacity={0.7}
              accessibilityLabel="Open ELO Control screen"
              accessibilityRole="button"
            >
              <Text style={styles.heroCardCtaText}>CONTROL</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Quick action buttons ── */}
        <Animated.View style={[styles.quickRow, fadeSlide(anims[2])]}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('Control')}
            activeOpacity={0.7}
            accessibilityLabel="Open camera control"
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickBtnLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('Voice')}
            activeOpacity={0.7}
            accessibilityLabel="Open voice screen"
            accessibilityRole="button"
          >
            <Ionicons name="mic-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickBtnLabel}>Voice</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* ── Subsystem bar ── */}
        <Animated.View style={fadeSlide(anims[3])}>
          <SubsystemStatusBar
            aiConnected={aiConnected}
            audioReady={audioReady}
            isConnected={isConnected}
            displayConnected={displayConnected}
          />
        </Animated.View>

        {/* ── Safety ── */}
        <Animated.View style={fadeSlide(anims[3])}>
          <SafetyStatusCard
            obstacleDetected={obstacleDetected}
            obstacleDetail={obstacleDetail}
            robotState={currentState}
          />
        </Animated.View>

        {/* ── Commands ── */}
        <Animated.View style={fadeSlide(anims[4])}>
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
        </Animated.View>

        {/* ── Secondary ── */}
        <Animated.View style={fadeSlide(anims[5])}>
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
    paddingBottom: spacing.xs,
  },
  heroCardWrapper: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCardText: {
    flex: 1,
    marginRight: spacing.md,
  },
  heroCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  heroCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 17,
  },
  heroCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroCardCtaText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  quickRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  quickBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.2,
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
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },
});
