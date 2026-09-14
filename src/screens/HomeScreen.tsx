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
import { colors, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { RobotStateBadge } from '../components/RobotStateBadge';
import { ModeToggleButton } from '../components/ModeToggleButton';
import { PrivacyCard } from '../components/PrivacyCard';
import { SessionTimeIndicator } from '../components/SessionTimeIndicator';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { RootTabParamList } from '../types';

type HomeScreenNavProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavProp>();
  const {
    robotMode,
    modeUpdatedAt,
    isModeChanging,
    toggleRobotMode,
    isConnected,
    isUnreachable,
    retryConnection,
  } = useELO();

  const [refreshing, setRefreshing] = useState(false);

  // Staggered fade-in for sections
  const section1 = useRef(new Animated.Value(0)).current;
  const section2 = useRef(new Animated.Value(0)).current;
  const section3 = useRef(new Animated.Value(0)).current;
  const section4 = useRef(new Animated.Value(0)).current;

  // Pulse animation for status dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered entrance
    const anims = [section1, section2, section3, section4];
    anims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: i * 100,
        useNativeDriver: true,
      }).start();
    });

    // Pulse loop for status dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Minimal top bar — just the status dot */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Control</Text>
        <TouchableOpacity onPress={handleOpenSettings} activeOpacity={0.6}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: isConnected
                  ? colors.dotOnline
                  : isUnreachable
                  ? colors.dotOffline
                  : colors.dotSyncing,
                opacity: isConnected ? pulseAnim : 1,
              },
            ]}
          />
        </TouchableOpacity>
      </View>

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
        <ConnectionBanner onPressSettings={handleOpenSettings} />

        {/* Section 1: Robot State Badge */}
        <Animated.View style={{ opacity: section1 }}>
          <RobotStateBadge
            mode={robotMode}
            updatedAt={modeUpdatedAt}
            isConnected={isConnected}
          />
        </Animated.View>

        {/* Section 2: Mode Toggle */}
        <Animated.View style={{ opacity: section2 }}>
          <ModeToggleButton
            currentMode={robotMode}
            isPending={isModeChanging}
            onToggle={toggleRobotMode}
            disabled={!isConnected}
          />
        </Animated.View>

        {/* Section 3: Session time */}
        <Animated.View style={{ opacity: section3 }}>
          <SessionTimeIndicator />
        </Animated.View>

        {/* Section 4: Privacy toggles */}
        <Animated.View style={{ opacity: section4 }}>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
});
