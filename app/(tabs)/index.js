import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import { selectAdminInfo } from '../../store/slices/adminSlice';
import {
  fetchDashboardBootstrap,
  selectDashboardActivity,
  selectDashboardErrors,
  selectDashboardLastFetchedAt,
  selectDashboardLoading,
  selectDashboardOverview,
} from '../../store/slices/adminDashboardSlice';

const STAT_CARDS = [
  {
    key: 'users',
    label: 'Users',
    accent: colors.primary,
    getPrimary: (o) => o.users.total,
    getSecondary: (o) => `${o.users.active} active · ${o.users.blocked} blocked`,
  },
  {
    key: 'vendors',
    label: 'Vendors',
    accent: colors.success,
    getPrimary: (o) => o.vendors.total,
    getSecondary: (o) => `${o.vendors.verified} verified · ${o.vendors.pending} pending`,
  },
  {
    key: 'admins',
    label: 'Admins',
    accent: colors.warning,
    getPrimary: (o) => o.admins.total,
    getSecondary: () => 'Team members',
  },
  {
    key: 'products',
    label: 'Products',
    accent: colors.primary,
    getPrimary: (o) => o.products.total,
    getSecondary: (o) => `${o.products.active} active`,
  },
  {
    key: 'services',
    label: 'Services',
    accent: colors.success,
    getPrimary: (o) => o.services.total,
    getSecondary: (o) => `${o.services.active} active`,
  },
  {
    key: 'productOrders',
    label: 'Product Orders',
    accent: colors.primary,
    getPrimary: (o) => o.productOrders.total,
    getSecondary: (o) => `${o.productOrders.pending} pending`,
  },
  {
    key: 'serviceBookings',
    label: 'Service Bookings',
    accent: colors.success,
    getPrimary: (o) => o.serviceBookings.total,
    getSecondary: (o) => `${o.serviceBookings.pending} pending`,
  },
  {
    key: 'reports',
    label: 'Reports',
    accent: colors.danger,
    getPrimary: (o) => o.reports.total,
    getSecondary: (o) => `${o.reports.open} open`,
  },
  {
    key: 'commissionPayments',
    label: 'Commission Payments',
    accent: colors.warning,
    getPrimary: (o) => o.commissionPayments.total,
    getSecondary: (o) => `${o.commissionPayments.pending} pending`,
  },
  {
    key: 'legalDocuments',
    label: 'Legal Documents',
    accent: colors.textMuted,
    getPrimary: (o) => o.legalDocuments.total,
    getSecondary: (o) => `${o.legalDocuments.published} published`,
  },
];

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function StatCard({ label, value, secondary, accent }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: accent }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statSecondary}>{secondary}</Text>
    </View>
  );
}

function ActivityRow({ item }) {
  const title = item.label || item.title || item.type || 'Activity';
  const time = formatTimestamp(item.createdAt || item.timestamp || item.date);
  const meta = [item.actor, item.status].filter(Boolean).join(' · ');

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityDot} />
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle}>{title}</Text>
        {!!meta && <Text style={styles.activityMeta}>{meta}</Text>}
        {!!time && <Text style={styles.activityTime}>{time}</Text>}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const dispatch = useDispatch();
  const adminInfo = useSelector(selectAdminInfo);
  const overview = useSelector(selectDashboardOverview);
  const activity = useSelector(selectDashboardActivity);
  const loading = useSelector(selectDashboardLoading);
  const errors = useSelector(selectDashboardErrors);
  const lastFetchedAt = useSelector(selectDashboardLastFetchedAt);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadDashboard = useCallback(() => {
    dispatch(fetchDashboardBootstrap()).finally(() => setHasLoadedOnce(true));
  }, [dispatch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const isInitialLoading = loading.bootstrap && !hasLoadedOnce;

  if (isInitialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading.bootstrap && hasLoadedOnce}
          onRefresh={loadDashboard}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Welcome{adminInfo?.fullName ? `, ${adminInfo.fullName}` : ''}
        </Text>
        {!!lastFetchedAt && (
          <Text style={styles.lastUpdated}>
            Updated {formatTimestamp(lastFetchedAt)}
          </Text>
        )}
      </View>

      {!!errors.bootstrap && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errors.bootstrap}</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={card.getPrimary(overview)}
            secondary={card.getSecondary(overview)}
            accent={card.accent}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {activity.length === 0 ? (
          <Text style={styles.emptyText}>No recent activity</Text>
        ) : (
          <View style={styles.activityList}>
            {activity.slice(0, 10).map((item, index) => (
              <ActivityRow key={`${item.type}-${item.actorId || index}`} item={item} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  lastUpdated: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statSecondary: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textMuted,
  },
  section: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  activityList: {
    gap: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    color: colors.text,
  },
  activityMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});