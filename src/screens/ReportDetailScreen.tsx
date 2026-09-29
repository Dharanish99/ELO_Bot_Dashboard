import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { api } from '../api/client';
import { ReportsStackParamList, SessionReport } from '../types';

type DetailRouteProp = RouteProp<ReportsStackParamList, 'ReportDetail'>;

type DetailTab = 'Summary' | 'Transcript' | 'Movement';
const TABS: DetailTab[] = ['Summary', 'Transcript', 'Movement'];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function formatDuration(mins: number) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} min`;
}

export const ReportDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<DetailRouteProp>();
  const { baseUrl } = useELO();
  const { reportId } = route.params;

  const [report, setReport] = useState<SessionReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('Summary');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchReport = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getSessionReportDetail(baseUrl, reportId);
      setReport(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } catch (err: any) {
      setError(err.message || 'Unable to load session');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, reportId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const renderSummary = () => {
    if (!report) return null;
    return (
      <View style={styles.tabContent}>
        {/* Duration */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryIcon}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>SESSION</Text>
            <Text style={styles.summaryValue}>{formatDuration(report.durationMinutes)}</Text>
          </View>
        </View>

        {/* Questions */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryIcon}>
            <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>QUESTIONS</Text>
            <Text style={styles.summaryValue}>
              {report.questionsAsked > 0 ? `${report.questionsAsked} asked` : 'None recorded'}
            </Text>
          </View>
        </View>

        {/* Vocabulary */}
        {report.vocabularyLearned?.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="book-outline" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>VOCABULARY</Text>
              <View style={styles.chipRow}>
                {report.vocabularyLearned.map((word: string) => (
                  <View key={word} style={styles.chip}>
                    <Text style={styles.chipText}>{word}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Topics */}
        {report.vocabularyLearned?.length === 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="school-outline" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>TOPICS</Text>
              <Text style={styles.summaryValue}>No topics recorded</Text>
            </View>
          </View>
        )}

        {/* Emotion */}
        {report.moodCheckIn && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="heart-outline" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>EMOTION</Text>
              <Text style={styles.summaryValue}>{report.moodCheckIn}</Text>
            </View>
          </View>
        )}

        {/* Breathing */}
        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <View style={styles.summaryIcon}>
            <Ionicons name="leaf-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>BREATHING EXERCISE</Text>
            <Text style={styles.summaryValue}>
              {report.breathingExerciseCompleted ? 'Completed' : 'Not completed'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTranscript = () => {
    if (!report?.transcript?.length) {
      return (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyTabText}>No transcript available for this session.</Text>
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        <Text style={styles.transcriptNote}>
          Conversation record · {report.transcript.length} exchanges
        </Text>
        {report.transcript.map((entry: any, i: number) => (
          <View
            key={i}
            style={[styles.transcriptEntry, entry.speaker === 'elo' ? styles.transcriptElo : styles.transcriptChild]}
          >
            <Text style={styles.transcriptSpeaker}>
              {entry.speaker === 'elo' ? 'ELO' : 'Child'}
              {entry.timestamp ? `  ·  ${entry.timestamp}` : ''}
            </Text>
            <Text style={styles.transcriptText}>{entry.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderMovement = () => {
    if (!report) return null;
    return (
      <View style={styles.tabContent}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryIcon}>
            <Ionicons name="navigate-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>DISTANCE FOLLOWED</Text>
            <Text style={styles.summaryValue}>
              {report.distanceFollowedMeters != null
                ? `${report.distanceFollowedMeters.toFixed(1)}m`
                : 'Not recorded'}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <View style={styles.summaryIcon}>
            <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>OBSTACLES AVOIDED</Text>
            <Text style={styles.summaryValue}>
              {report.obstaclesAvoided != null
                ? report.obstaclesAvoided > 0
                  ? `${report.obstaclesAvoided} obstacle${report.obstaclesAvoided !== 1 ? 's' : ''}`
                  : 'Path was clear'
                : 'Not recorded'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isLoading ? 'Loading…' : report ? formatDate(report.date) : 'Session'}
          </Text>
          {report && (
            <Text style={styles.headerDuration}>{formatDuration(report.durationMinutes)}</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchReport} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                accessibilityLabel={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            style={{ opacity: fadeAnim }}
          >
            {activeTab === 'Summary' && renderSummary()}
            {activeTab === 'Transcript' && renderTranscript()}
            {activeTab === 'Movement' && renderMovement()}
          </Animated.ScrollView>
        </>
      )}
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
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  headerTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  headerDuration: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textInverse },
  scrollContent: { paddingBottom: spacing.xxxl },
  tabContent: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  summaryIcon: { width: 24, alignItems: 'center', marginTop: 1 },
  summaryText: { flex: 1 },
  summaryLabel: {
    fontSize: 9, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1.5, marginBottom: spacing.xs,
  },
  summaryValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  transcriptNote: {
    fontSize: 11,
    color: colors.textMuted,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    fontStyle: 'italic',
  },
  transcriptEntry: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  transcriptElo: { backgroundColor: colors.surface },
  transcriptChild: { backgroundColor: colors.surfaceElevated },
  transcriptSpeaker: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 1, marginBottom: spacing.xs,
  },
  transcriptText: { fontSize: 14, color: colors.textPrimary, lineHeight: 21 },
  emptyTab: {
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  emptyTabText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { fontSize: 14, color: colors.accent, textAlign: 'center' },
  retryBtn: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderStrong,
  },
  retryText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
});
