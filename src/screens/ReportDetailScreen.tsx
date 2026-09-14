import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useELO } from '../context/ELOContext';
import { api } from '../api/client';
import { ReportsStackParamList, SessionReportDetail } from '../types';

type ReportDetailRouteProp = RouteProp<ReportsStackParamList, 'ReportDetail'>;

export const ReportDetailScreen: React.FC = () => {
  const route = useRoute<ReportDetailRouteProp>();
  const navigation = useNavigation();
  const { baseUrl } = useELO();
  const { reportId } = route.params;

  const [report, setReport] = useState<SessionReportDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await api.getSessionReportDetail(baseUrl, reportId);
      setReport(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load report');
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, reportId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (report) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [report]);

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      ) : errorMessage || !report ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMessage || 'Not found'}</Text>
          <TouchableOpacity onPress={fetchDetail} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date & Duration */}
          <View style={styles.topInfo}>
            <Text style={styles.dateText}>{formatDate(report.date)}</Text>
            <Text style={styles.durationText}>{report.durationMinutes} min</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {report.distanceFollowedMeters != null
                  ? `${report.distanceFollowedMeters}m`
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{report.obstaclesAvoided}</Text>
              <Text style={styles.statLabel}>Avoided</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{report.questionsAsked}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
          </View>

          {/* Wellbeing — minimal */}
          <View style={styles.section}>
            {report.moodCheckIn && (
              <Text style={styles.infoLine}>{report.moodCheckIn}</Text>
            )}
            <Text style={styles.infoLine}>
              {report.breathingExerciseCompleted ? '✓ Breathing exercise' : '— Breathing exercise'}
            </Text>
          </View>

          {/* Vocabulary */}
          {report.vocabularyLearned && report.vocabularyLearned.length > 0 && (
            <View style={styles.section}>
              <View style={styles.tagRow}>
                {report.vocabularyLearned.map((word, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{word}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Transcript */}
          {report.transcript && report.transcript.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {report.transcript.length} messages
              </Text>
              <View style={styles.transcriptList}>
                {report.transcript.map((item, index) => {
                  const isElo = item.speaker === 'elo';
                  return (
                    <View
                      key={index}
                      style={[
                        styles.bubbleRow,
                        isElo ? styles.bubbleRowLeft : styles.bubbleRowRight,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          isElo ? styles.bubbleElo : styles.bubbleChild,
                        ]}
                      >
                        <Text style={styles.bubbleText}>{item.text}</Text>
                        {item.timestamp && (
                          <Text style={styles.bubbleTime}>{item.timestamp}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </Animated.ScrollView>
      )}
    </SafeAreaView>
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  topInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  durationText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  infoLine: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  transcriptList: {
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleElo: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: spacing.xs,
  },
  bubbleChild: {
    backgroundColor: colors.surfaceElevated,
    borderBottomRightRadius: spacing.xs,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});
