import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../lib/constants/theme';
import {
  fetchProductOrders,
  fetchServiceBookings,
  selectProductOrders,
  selectProductOrdersError,
  selectProductOrdersLoading,
  selectServiceBookings,
  selectServiceBookingsError,
  selectServiceBookingsLoading,
} from '../store/slices/ordersSlice';
import { selectDashboardOverview } from '../store/slices/adminDashboardSlice';

// The real order/booking status enum isn't confirmed yet — these are the
// four states the mockup shows. Anything else falls back to a neutral
// badge rather than being hidden or crashing.
const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Placed', value: 'placed' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_STYLES = {
  placed: { bg: colors.warningMuted, fg: colors.warning, label: 'Placed' },
  confirmed: { bg: colors.infoMuted, fg: colors.info, label: 'Confirmed' },
  shipped: { bg: colors.infoMuted, fg: colors.info, label: 'Shipped' },
  delivered: { bg: colors.successMuted, fg: colors.success, label: 'Delivered' },
  cancelled: { bg: colors.dangerMuted, fg: colors.danger, label: 'Cancelled' },
};

function normalizeStatus(status) {
  return String(status || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getOrderId(order) {
  return order?._id || order?.id || null;
}

function getOrderCode(order) {
  return order?.orderId || order?.orderNumber || order?.code || getOrderId(order) || '—';
}

function formatShortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function StatusBadge({ status }) {
  const key = normalizeStatus(status);
  const style = STATUS_STYLES[key] || { bg: colors.background, fg: colors.textMuted, label: status || '—' };
  return (
    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.statusBadgeText, { color: style.fg }]}>{style.label}</Text>
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

function OrderRow({ order, kind, onPress }) {
  const code = getOrderCode(order);
  const customer = order?.customerName || order?.customer?.name || order?.user?.name || 'Customer';
  const vendor = order?.vendorName || order?.vendor?.businessName || order?.vendor?.name || 'Vendor';
  const itemsCount = order?.itemsCount ?? order?.items?.length;
  const placed = formatShortDate(order?.placedAt || order?.createdAt);
  const amount = formatAmount(order?.totalAmount ?? order?.total ?? order?.amount);

  const metaParts = [];
  if (itemsCount !== undefined && itemsCount !== null) {
    metaParts.push(`${itemsCount} item${itemsCount === 1 ? '' : 's'}`);
  }
  if (placed) metaParts.push(`placed ${placed}`);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.rowCode} numberOfLines={1}>
          {code}
        </Text>
        <StatusBadge status={order?.status} />
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {customer} → {vendor}
      </Text>
      <View style={styles.rowBottom}>
        {!!metaParts.length && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {metaParts.join('  ·  ')}
          </Text>
        )}
        <Text style={styles.rowAmount}>{amount}</Text>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useLocalSearchParams();

  const productOrders = useSelector(selectProductOrders);
  const productLoading = useSelector(selectProductOrdersLoading);
  const productError = useSelector(selectProductOrdersError);
  const serviceBookings = useSelector(selectServiceBookings);
  const serviceLoading = useSelector(selectServiceBookingsLoading);
  const serviceError = useSelector(selectServiceBookingsError);
  const overview = useSelector(selectDashboardOverview);

  const [tab, setTab] = useState(params?.tab === 'service' ? 'service' : 'product');
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const isProductTab = tab === 'product';
  const items = isProductTab ? productOrders : serviceBookings;
  const isLoading = isProductTab ? productLoading : serviceLoading;
  const errorMessage = isProductTab ? productError : serviceError;
  const total = isProductTab ? overview.productOrders.total : overview.serviceBookings.total;

  // Explicit params on every call rather than relying on the slice's
  // shared filters.search/status — that field is shared across every
  // dashboard list, so a value set here could otherwise leak into
  // another tab's fetch.
  const runFetch = useCallback(
    (nextTab, nextStatus) => {
      const thunk = nextTab === 'service' ? fetchServiceBookings : fetchProductOrders;
      dispatch(thunk({ page: 1, limit: 50, status: nextStatus }));
    },
    [dispatch]
  );

  useEffect(() => {
    runFetch(tab, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setStatus('');
  };
  const handleStatusFilter = (value) => {
    setStatus(value);
    runFetch(tab, value);
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    const thunk = isProductTab ? fetchProductOrders : fetchServiceBookings;
    await dispatch(thunk({ page: 1, limit: 50, status }));
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
            <Text style={styles.headerTitle}>Orders</Text>
            <Text style={styles.headerSubtitle}>
              {total.toLocaleString('en-IN')} {isProductTab ? 'product orders' : 'service bookings'}
            </Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, isProductTab && styles.tabButtonActive]}
            onPress={() => handleTabChange('product')}
          >
            <Text style={[styles.tabText, isProductTab && styles.tabTextActive]}>Product orders</Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, !isProductTab && styles.tabButtonActive]}
            onPress={() => handleTabChange('service')}
          >
            <Text style={[styles.tabText, !isProductTab && styles.tabTextActive]}>Service bookings</Text>
          </Pressable>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(f) => f.value || 'all'}
          style={styles.chipList}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item: f }) => (
            <FilterChip label={f.label} active={status === f.value} onPress={() => handleStatusFilter(f.value)} />
          )}
        />

        {!!errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <FlatList
          data={items}
          keyExtractor={(item, index) => getOrderId(item) || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              kind={tab}
              onPress={() => {
                const orderId = getOrderId(item);
                if (orderId) router.push(`/orders/${orderId}?type=${tab}`);
              }}
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No {isProductTab ? 'orders' : 'bookings'} found.
                </Text>
              </View>
            )
          }
        />
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
    paddingTop: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.surface,
  },
  chipList: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  chipRow: {
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.surface,
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
  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowCode: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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