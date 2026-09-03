import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import {
  fetchDashboardActivity,
  selectDashboardActivity,
  selectDashboardErrors,
  selectDashboardLoading,
} from '../../store/slices/adminDashboardSlice';

// The real activity "type" enum from the backend isn't known yet, so this
// matches on keywords found in the title/type text instead of an exact
// value — it degrades to a neutral dot for anything unrecognized rather
// than guessing wrong.
const EVENT_STYLES = [
  { test: /approv/i, icon: 'checkmark-circle', bg: colors.successMuted, fg: colors.success },
  { test: /block|suspend|ban/i, icon: 'ban', bg: colors.dangerMuted, fg: colors.danger },
  { test: /application|new vendor|submitted/i, icon: 'cube', bg: colors.warningMuted, fg: colors.warning },
  { test: /lift|restore|unblock|reinstate/i, icon: 'person', bg: colors.successMuted, fg: colors.success },
  { test: /flag|review/i, icon: 'flag', bg: colors.infoMuted, fg: colors.info },
  { test: /reject|decline/i, icon: 'close-circle', bg: colors.dangerMuted, fg: colors.danger },
];

const DEFAULT_EVENT_STYLE = { icon: 'ellipse', bg: colors.background, fg: colors.textMuted };

function getEventStyle(item) {
  const haystack = `${item?.type || ''} ${item?.title || ''}`;
  const match = EVENT_STYLES.find((s) => s.test.test(haystack));
  return match || DEFAULT_EVENT_STYLE;
}

function getEventFields(item) {
  return {
    title: item?.title || item?.label || item?.action || item?.type || 'Activity',
    subtitle: item?.subtitle || item?.actor || item?.entityName || item?.actorName || '',
    date: item?.createdAt || item?.timestamp || item?.date || null,
  };
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(date) {
  if (!date) return 'Earlier';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Earlier';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupActivityByDay(items) {
  const order = [];
  const map = {};
  items.forEach((item) => {
    const { date } = getEventFields(item);
    const label = dayLabel(date);
    if (!map[label]) {
      map[label] = [];
      order.push(label);
    }
    map[label].push(item);
  });
  return order.map((label) => ({ title: label, data: map[label] }));
}

function ActivityRow({ item }) {
  const { title, subtitle, date } = getEventFields(item);
  const style = getEventStyle(item);

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
        <Ionicons name={style.icon} size={18} color={style.fg} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.rowTime}>{formatTime(date)}</Text>
    </View>
  );
}

export default function ActivityScreen() {
  const dispatch = useDispatch();
  const activity = useSelector(selectDashboardActivity);
  const loading = useSelector(selectDashboardLoading);
  const errors = useSelector(selectDashboardErrors);

  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadActivity = useCallback(() => {
    dispatch(fetchDashboardActivity()).finally(() => setHasLoadedOnce(true));
  }, [dispatch]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchDashboardActivity());
    setRefreshing(false);
  };

  const sections = groupActivityByDay(activity);
  const isInitialLoading = loading.activity && !hasLoadedOnce;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Activity</Text>
        <Text style={styles.headerSubtitle}>Platform events and account changes</Text>
      </View>

      {!!errors.activity && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errors.activity}</Text>
        </View>
      )}

      {isInitialLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item?._id || item?.id || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title.toUpperCase()}</Text>
          )}
          renderItem={({ item }) => <ActivityRow item={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent activity.</Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerRow: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});