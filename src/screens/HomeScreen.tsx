import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';

// Components
import { EloIdentityHeader } from '../components/EloIdentityHeader';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { RobotStateBadge } from '../components/RobotStateBadge';
import { TargetSelector } from '../components/TargetSelector';
import { SafetyStatusCard } from '../components/SafetyStatusCard';
import { CommandButtons } from '../components/CommandButtons';
import { SessionTimeIndicator } from '../components/SessionTimeIndicator';
import { PrivacyCard } from '../components/PrivacyCard';
import { SubsystemStatusBar } from '../components/SubsystemStatusBar';
import { RootTabParamList } from '../types';

type HomeScreenNavProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavProp>();
  const {
    // Legacy / general state
    robotMode,
    modeUpdatedAt,
    isConnected,
    isUnreachable,
    retryConnection,

    // Phase C states & commands
    eloOnline,
    eloState,
    selectedTargetId,
    targets,
    obstacleDetected,
    obstacleDetail,
    aiConnected,
    audioReady,
    commandPending,
    commandError,
    clearCommandError,
    selectTarget,
    requestFollow,
    requestInteract,
    requestStop,
  } = useELO();

  const [refreshing, setRefreshing] = useState(false);

  // Entrance animations for sections
  const animHeader = useRef(new Animated.Value(0)).current;
  const animHero = useRef(new Animated.Value(0)).current;
  const animControls = useRef(new Animated.Value(0)).current;
  const animSecondary = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(animHeader, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(animHero, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(animControls, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(animSecondary, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

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

  // Find label of confirmed selected target
  const confirmedTarget = targets.find((t) => t.id === selectedTargetId);
  const targetLabel = confirmedTarget ? confirmedTarget.label : selectedTargetId ? `Target #${selectedTargetId}` : null;

  // Effective robot state (prefer Phase C eloState, fallback to robotMode)
  const currentEffectiveState = eloOnline ? eloState : robotMode;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 1. Identity Header */}
      <Animated.View style={{ opacity: animHeader }}>
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
        {/* Connection banner if offline */}
        <ConnectionBanner onPressSettings={handleOpenSettings} />

        {/* Command Error Alert (if any rejected command) */}
        {commandError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={styles.errorBannerText}>{commandError}</Text>
            <TouchableOpacity onPress={clearCommandError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 2. Hero: Robot State Badge */}
        <Animated.View style={{ opacity: animHero }}>
          <RobotStateBadge
            mode={currentEffectiveState}
            updatedAt={modeUpdatedAt}
            isConnected={isConnected}
            targetLabel={targetLabel}
            commandPending={commandPending}
          />
        </Animated.View>

        {/* 3. Subsystem Status Bar (AI & Audio) */}
        <Animated.View style={{ opacity: animHero }}>
          <SubsystemStatusBar
            aiConnected={aiConnected}
            audioReady={audioReady}
            isConnected={isConnected}
          />
        </Animated.View>

        {/* 4. Controls Section: Target Selector, Safety Card, Command Buttons */}
        <Animated.View style={{ opacity: animControls }}>
          {/* Target Selector */}
          <TargetSelector
            targets={targets}
            selectedTargetId={selectedTargetId}
            commandPending={commandPending}
            isConnected={isConnected}
            onSelectTarget={selectTarget}
          />

          {/* Safety & Obstacle Card */}
          <SafetyStatusCard
            obstacleDetected={obstacleDetected}
            obstacleDetail={obstacleDetail}
            robotState={currentEffectiveState}
          />

          {/* Primary Command Buttons: FOLLOW, INTERACT, STOP */}
          <CommandButtons
            currentMode={currentEffectiveState}
            commandPending={commandPending}
            isConnected={isConnected}
            selectedTargetId={selectedTargetId}
            onRequestFollow={requestFollow}
            onRequestInteract={requestInteract}
            onRequestStop={requestStop}
          />
        </Animated.View>

        {/* 5. Secondary Information & Controls */}
        <Animated.View style={{ opacity: animSecondary }}>
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },
});
