import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import { selectAdminInfo } from '../../store/slices/adminSlice';
import {
  fetchDashboardBootstrap,
  selectDashboardErrors,
  selectDashboardLoading,
  selectDashboardOverview,
} from '../../store/slices/adminDashboardSlice';
import { StatusBar } from 'expo-status-bar';

// Each Home operations tile links to a management area that doesn't have
// a screen yet — same "coming soon" treatment as the More menu's rows
// for anything not yet built, rather than a route that doesn't exist.
const OPERATIONS = [
  { key: 'orders', label: 'Orders', icon: 'cube-outline' },
  { key: 'subscription', label: 'Subscription', icon: 'card-outline' },
  { key: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
  { key: 'reports', label: 'Reports', icon: 'flag-outline' },
  { key: 'payments', label: 'Payments', icon: 'cash-outline' },
  { key: 'legal', label: 'Legal', icon: 'document-text-outline' },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function StatCard({ label, value, dotColor }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statLabelRow}>
        <View style={[styles.statDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
    </View>
  );
}

function HighlightRow({ label, value, isLast }) {
  return (
    <View style={[styles.highlightRow, !isLast && styles.highlightRowDivider]}>
      <Text style={styles.highlightLabel}>{label}</Text>
      <Text style={styles.highlightValue}>{formatNumber(value)}</Text>
    </View>
  );
}

function OperationTile({ label, icon, onPress }) {
  return (
    <Pressable style={styles.opTile} onPress={onPress}>
      <View style={styles.opIconCircle}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.opLabel}>{label}</Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const dispatch = useDispatch();
  const adminInfo = useSelector(selectAdminInfo);
  const overview = useSelector(selectDashboardOverview);
  const loading = useSelector(selectDashboardLoading);
  const errors = useSelector(selectDashboardErrors);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadDashboard = useCallback(() => {
    dispatch(fetchDashboardBootstrap()).finally(() => setHasLoadedOnce(true));
  }, [dispatch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const isInitialLoading = loading.bootstrap && !hasLoadedOnce;
  const displayName = adminInfo?.name || adminInfo?.fullName || adminInfo?.email || 'Admin';

  const handleComingSoon = (label) => {
    Alert.alert(label, `${label} management is coming soon.`);
  };

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
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
        <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <View>
            <Text style={styles.greetingSmall}>{getGreeting()}</Text>
            <Text style={styles.greetingName}>{displayName}</Text>
          </View>
        </View>
        <Pressable
          style={styles.bellButton}
          onPress={() => handleComingSoon('Notifications')}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <Pressable
        style={styles.searchBar}
        onPress={() => handleComingSoon('Global search')}
      >
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <Text style={styles.searchPlaceholder}>Search users, vendors, orders…</Text>
      </Pressable>

      {!!errors.bootstrap && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errors.bootstrap}</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard label="Users" value={overview.users.total} dotColor={colors.primary} />
        <StatCard label="Verified" value={overview.vendors.verified} dotColor={colors.success} />
        <StatCard label="Pending" value={overview.vendors.pending} dotColor={colors.warning} />
        <StatCard label="Suspended" value={overview.vendors.suspended} dotColor={colors.danger} />
      </View>

      <View style={styles.highlightsCard}>
        <Text style={styles.highlightsTitle}>HIGHLIGHTS</Text>
        <HighlightRow label="Pending vendors" value={overview.vendors.pending} />
        <HighlightRow label="Blocked users" value={overview.users.blocked} />
        <HighlightRow label="Total orders" value={overview.productOrders.total} isLast />
      </View>

      <Text style={styles.sectionLabel}>OPERATIONS</Text>
      <View style={styles.opsGrid}>
        {OPERATIONS.map((op) => (
          <OperationTile
            key={op.key}
            label={op.label}
            icon={op.icon}
            onPress={() => handleComingSoon(op.label)}
          />
        ))}
      </View>
      </ScrollView>
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
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  greetingSmall: {
    fontSize: 12,
    color: colors.textMuted,
  },
  greetingName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  searchPlaceholder: {
    marginLeft: spacing.sm,
    fontSize: 13,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  highlightsCard: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  highlightsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  highlightRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(122,46,73,0.12)',
  },
  highlightLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  highlightValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  opsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  opTile: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  opIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  opLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
});