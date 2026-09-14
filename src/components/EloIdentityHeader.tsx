import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface EloIdentityHeaderProps {
  isOnline: boolean;
  lastUpdated?: string | null;
}

export const EloIdentityHeader: React.FC<EloIdentityHeaderProps> = ({
  isOnline,
  lastUpdated,
}) => {
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return null;
    }
  };

  const formattedTime = formatTime(lastUpdated);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.brandTitle}>ELO</Text>
          <Text style={styles.brandSubtitle}>Your child's AI companion</Text>
        </View>

        <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? colors.dotOnline : colors.dotOffline },
            ]}
          />
          <Text style={styles.statusText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {formattedTime ? (
        <Text style={styles.lastUpdatedText}>Last sync: {formattedTime}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeOnline: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: spacing.xs + 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
});
