import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { api } from '../api/client';
import { ReportsStackParamList, SessionReportSummary } from '../types';

type ReportsNavProp = NativeStackNavigationProp<ReportsStackParamList, 'ReportsList'>;

const FILTER_TABS = ['All', 'Learning', 'Play', 'Interaction'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDuration(mins: number) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} min`;
}

const ReportRow: React.FC<{
  item: SessionReportSummary;
  index: number;
  onPress: () => void;
}> = ({ item, index, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, delay: index * 55, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, delay: index * 55, useNativeDriver: true }),
    ]).start();
  }, []);

  const preview = [
    item.questionsAsked > 0 && `${item.questionsAsked} question${item.questionsAsked !== 1 ? 's' : ''}`,
    item.vocabularyLearned?.length > 0 && `${item.vocabularyLearned.length} new word${item.vocabularyLearned.length !== 1 ? 's' : ''}`,
    item.obstaclesAvoided > 0 && `${item.obstaclesAvoided} obstacle${item.obstaclesAvoided !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ');

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.6}
        onPress={onPress}
        accessibilityLabel={`Session on ${formatDate(item.date)}, ${formatDuration(item.durationMinutes)}`}
        accessibilityRole="button"
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            {preview ? <Text style={styles.previewText}>{preview}</Text> : null}
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.durationBadge}>{formatDuration(item.durationMinutes)}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        </View>
        {item.moodCheckIn ? (
          <Text style={styles.moodText}>"{item.moodCheckIn}"</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ReportsScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNavProp>();
  const { baseUrl } = useELO();

  const [reports, setReports] = useState<SessionReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

  const fetchReports = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await api.getSessionReports(baseUrl, 20);
      setReports(data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load reports');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Stats derived only from real data
  const totalSessions = reports.length;
  const totalMinutes = reports.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalHours = totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}m`;

  // "This week" sessions
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const thisWeek = reports.filter((r) => new Date(r.date) >= weekAgo).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>REPORTS</Text>
        <Text style={styles.headerSub}>A log of ELO's journey</Text>
      </View>

      {/* Stats row — only shown if real data exists */}
      {!isLoading && totalSessions > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalHours}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{thisWeek}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.tabsRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityLabel={`Filter: ${tab}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent sessions label */}
      {!isLoading && reports.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
        </View>
      )}

      {errorMessage && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ReportRow
              item={item}
              index={index}
              onPress={() => navigation.navigate('ReportDetail', { reportId: item.id })}
            />
          )}
          contentContainerStyle={
            reports.length === 0 ? styles.emptyContent : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptyBody}>ELO's journey will appear here.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchReports(); }}
              tintColor={colors.textMuted}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: 2,
  },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '600', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textInverse },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5,
  },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl },
  emptyContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: spacing.md },
  dateText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  previewText: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  durationBadge: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  moodText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  emptyContainer: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  emptyBody: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  errorText: { fontSize: 13, color: colors.accent },
});
