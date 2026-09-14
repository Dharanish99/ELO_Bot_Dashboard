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

type ReportsScreenNavProp = NativeStackNavigationProp<ReportsStackParamList, 'ReportsList'>;

// Animated report card row
const ReportRow: React.FC<{
  item: SessionReportSummary;
  index: number;
  onPress: () => void;
}> = ({ item, index, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const summary = `${item.questionsAsked} question${item.questionsAsked === 1 ? '' : 's'}${
    item.moodCheckIn ? ` · ${item.moodCheckIn.toLowerCase()}` : ''
  }`;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.6}
        onPress={onPress}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.durationText}>{item.durationMinutes}m</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ReportsScreen: React.FC = () => {
  const navigation = useNavigation<ReportsScreenNavProp>();
  const { baseUrl } = useELO();

  const [reports, setReports] = useState<SessionReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await api.getSessionReports(baseUrl, 15);
      setReports(data || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load reports');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

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
              onPress={() =>
                navigation.navigate('ReportDetail', {
                  reportId: item.id,
                })
              }
            />
          )}
          contentContainerStyle={
            reports.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No sessions yet</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: colors.accent,
  },
});
