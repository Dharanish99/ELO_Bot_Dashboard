import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { SettingsStackParamList } from '../types';

const ELO_IMAGE = require('../../assets/elo-robot.png');
const APP_VERSION = '1.0.0';

type SettingsNavProp = NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>;

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon, label, value, onPress, showChevron = true, disabled = false,
}) => (
  <TouchableOpacity
    style={[styles.row, disabled && styles.rowDisabled]}
    onPress={onPress}
    disabled={disabled || !onPress}
    activeOpacity={0.6}
    accessibilityLabel={label}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
  >
    <View style={styles.rowLeft}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <View style={styles.rowRight}>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </View>
  </TouchableOpacity>
);

export const SettingsMainScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNavProp>();
  const { baseUrl, isConnected, eloOnline } = useELO();

  const piShortUrl = baseUrl.replace('http://', '').replace('https://', '');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <Text style={styles.headerSub}>Customize your ELO</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ELO Product Card */}
        <View style={styles.productCard}>
          <Image
            source={ELO_IMAGE}
            style={styles.productImage}
            resizeMode="contain"
            accessibilityLabel="ELO robot"
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName}>ELO</Text>
            <Text style={styles.productVersion}>v{APP_VERSION}</Text>
            <Text style={styles.productTagline}>Your child's AI companion</Text>
            <View style={styles.productStatusRow}>
              <View style={[styles.productStatusDot, { backgroundColor: isConnected && eloOnline ? colors.dotOnline : colors.dotOffline }]} />
              <Text style={styles.productStatusText}>
                {isConnected && eloOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Pi address indicator */}
        <View style={styles.piAddressRow}>
          <Ionicons name="wifi" size={12} color={colors.textMuted} />
          <Text style={styles.piAddressText}>{piShortUrl}</Text>
        </View>

        {/* Settings rows */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONNECTIVITY</Text>
          <View style={styles.card}>
            <SettingsRow
              icon="hardware-chip-outline"
              label="Pi Connection"
              value={isConnected ? 'Connected' : 'Disconnected'}
              onPress={() => navigation.navigate('PiConnection')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ROBOT</Text>
          <View style={styles.card}>
            <SettingsRow
              icon="search-circle-outline"
              label="Diagnostics"
              onPress={() => navigation.navigate('Diagnostics')}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="volume-medium-outline"
              label="Robot Voice"
              value="Default (Friendly)"
              disabled
              showChevron={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APP</Text>
          <View style={styles.card}>
            <SettingsRow
              icon="settings-outline"
              label="App Preferences"
              disabled
              onPress={undefined}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="information-circle-outline"
              label="About ELO"
              disabled
              onPress={undefined}
            />
            <View style={styles.rowDivider} />
            <SettingsRow
              icon="help-circle-outline"
              label="Help & Support"
              disabled
              onPress={undefined}
            />
          </View>
        </View>

        <Text style={styles.versionFooter}>ELO Dashboard v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  productImage: {
    width: 72,
    height: 72,
    marginRight: spacing.lg,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  productVersion: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  productTagline: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  productStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  productStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  productStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  piAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  piAddressText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace' as any,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  rowIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  versionFooter: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
