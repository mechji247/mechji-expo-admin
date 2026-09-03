import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../lib/constants/theme';
import {
  fetchDashboardReports,
  selectDashboardErrors,
  selectDashboardLists,
  selectDashboardLoading,
  selectDashboardOverview,
} from '../store/slices/adminDashboardSlice';

const STATUS_FILTERS = [
  { label: 'Open', value: 'open' },
  { label: 'Reviewing', value: 'reviewing' },
  { label: 'Resolved', value: 'resolved' },
];

const SEVERITY_STYLES = {
  high: { bg: colors.dangerMuted, fg: colors.danger, label: 'High severity' },
  medium: { bg: colors.warningMuted, fg: colors.warning, label: 'Medium' },
  low: { bg: colors.infoMuted, fg: colors.info, label: 'Low' },
};

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getReportId(report) {
  return report?._id || report?.id || null;
}

function formatRelativeTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function TopBadge({ report }) {
  const statusKey = normalize(report?.status);
  if (statusKey === 'resolved') {
    return (
      <View style={[styles.badge, { backgroundColor: colors.successMuted }]}>
        <Text style={[styles.badgeText, { color: colors.success }]}>Resolved</Text>
      </View>
    );
  }
  const severityKey = normalize(report?.severity);
  const style = SEVERITY_STYLES[severityKey];
  if (!style) return null;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ReportCard({ report }) {
  const code = report?.reportId || report?.code || getReportId(report) || '—';
  const title = report?.title || report?.summary || 'Report';
  const subject = report?.subjectName || report?.reportedName || '';
  const reportedBy = report?.reportedByCount
    ? `by ${report.reportedByCount} users`
    : report?.reportedBy || '';
  const statusKey = normalize(report?.status);
  const filedLine =
    statusKey === 'resolved'
      ? `Resolved ${formatRelativeTime(report?.resolvedAt)}${report?.resolvedBy ? ` by ${report.resolvedBy}` : ''}`
      : `Filed ${formatRelativeTime(report?.createdAt)}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardCode}>{code}</Text>
        <TopBadge report={report} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      {!!(subject || reportedBy) && (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[subject && `Reported: ${subject}`, reportedBy].filter(Boolean).join(' · ')}
        </Text>
      )}
      {!!filedLine && <Text style={styles.cardFiled}>{filedLine}</Text>}
    </View>
  );
}

export default function TrustSafetyScreen() {
  const dispatch = useDispatch();
  const router = useRouter();

  const lists = useSelector(selectDashboardLists);
  const loading = useSelector(selectDashboardLoading);
  const errors = useSelector(selectDashboardErrors);
  const overview = useSelector(selectDashboardOverview);

  const [status, setStatus] = useState('open');
  const [refreshing, setRefreshing] = useState(false);

  const runFetch = useCallback(
    (nextStatus) => {
      dispatch(fetchDashboardReports({ page: 1, limit: 50, status: nextStatus }));
    },
    [dispatch]
  );

  useEffect(() => {
    runFetch(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchDashboardReports({ page: 1, limit: 50, status }));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Trust & safety</Text>
            <Text style={styles.headerSubtitle}>
              {overview.reports.open.toLocaleString('en-IN')} reports open
            </Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {STATUS_FILTERS.map((f) => (
            <FilterChip key={f.value} label={f.label} active={status === f.value} onPress={() => setStatus(f.value)} />
          ))}
        </View>

        {!!errors.reports && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errors.reports}</Text>
          </View>
        )}

        <FlatList
          data={lists.reports}
          keyExtractor={(item, index) => getReportId(item) || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => <ReportCard report={item} />}
          ListEmptyComponent={
            loading.reports ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No reports found.</Text>
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  backButton: { marginRight: spacing.sm, padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
  errorBanner: { backgroundColor: colors.dangerMuted, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm },
  errorText: { color: colors.danger, fontSize: 13 },
  listContent: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  cardCode: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  cardFiled: { fontSize: 11, color: colors.textMuted },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4, marginLeft: spacing.sm },
  badgeText: { fontSize: 11, fontWeight: '700', textAlign: 'right' },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
});