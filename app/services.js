import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, getAvatarColor, spacing } from '../lib/constants/theme';
import {
  fetchServices,
  selectServicesError,
  selectServicesHasMore,
  selectServicesList,
  selectServicesLoading,
  selectServicesLoadingMore,
  selectServicesPagination,
} from '../store/slices/servicesSlice';

const PAGE_SIZE = 20;

// Matches the Service schema's real `status` enum
// (server/newSchemaModels/schemas/service/serviceSchema.js) — this is
// what getServicesList's `status` query param actually filters on. Draft
// and in_progress are real values too, but weren't asked for as a filter
// chip here — "All" still surfaces them in the unfiltered list.
const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Inactive', value: 'inactive' },
];

const STATUS_STYLES = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  pending: { bg: colors.warningMuted, fg: colors.warning, label: 'Pending' },
  draft: { bg: colors.warningMuted, fg: colors.warning, label: 'Draft' },
  inprogress: { bg: colors.infoMuted, fg: colors.info, label: 'In progress' },
  rejected: { bg: colors.dangerMuted, fg: colors.danger, label: 'Rejected' },
  inactive: { bg: colors.background, fg: colors.textMuted, label: 'Inactive' },
};

function normalizeStatus(status) {
  return String(status || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getServiceId(service) {
  return service?._id || service?.id || null;
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

// Matches the real list projection from getServicesList/mapService
// (server/controllers/admin/adminController.js): serviceName, category,
// subcategory, pricing.basePrice, status, createdAt. There's no vendor
// name in that projection (only a bare vendorId), so the row shows
// category/subcategory instead of a vendor — same tradeoff the Products
// row makes.
function ServiceRow({ service, onPress }) {
  const id = getServiceId(service);
  const name = service?.serviceName || 'Unnamed service';
  const meta = [service?.category, service?.subcategory].filter(Boolean).join('  ·  ');

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.thumb, { backgroundColor: getAvatarColor(id || name) }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        {!!meta && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
        <Text style={styles.rowPrice}>{formatAmount(service?.price)}</Text>
      </View>
      <StatusBadge status={service?.status} />
    </Pressable>
  );
}

export default function ServicesScreen() {
  const dispatch = useDispatch();
  const router = useRouter();

  const list = useSelector(selectServicesList);
  const loading = useSelector(selectServicesLoading);
  const loadingMore = useSelector(selectServicesLoadingMore);
  const hasMore = useSelector(selectServicesHasMore);
  const pagination = useSelector(selectServicesPagination);
  const error = useSelector(selectServicesError);

  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Fresh list — page 1, replaces `list`. Used on mount, search submit,
  // filter change and pull-to-refresh.
  const runFetch = useCallback(
    (nextSearch, nextStatus) => {
      dispatch(fetchServices({ page: 1, limit: PAGE_SIZE, search: nextSearch, status: nextStatus }));
    },
    [dispatch]
  );

  useEffect(() => {
    runFetch('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = () => runFetch(searchText.trim(), status);
  const handleStatusFilter = (value) => {
    setStatus(value);
    runFetch(searchText.trim(), value);
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchServices({ page: 1, limit: PAGE_SIZE, search: searchText.trim(), status }));
    setRefreshing(false);
  };
  // "Load more" button — appends the next page onto the existing list
  // rather than an infinite-scroll trigger, per how this screen was asked
  // for.
  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    dispatch(
      fetchServices({
        page: pagination.page + 1,
        limit: PAGE_SIZE,
        search: searchText.trim(),
        status,
        append: true,
      })
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Services</Text>
            <Text style={styles.headerSubtitle}>
              {pagination.total.toLocaleString('en-IN')} listed services
            </Text>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search services or category"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
        </View>

        <View style={styles.chipRow}>
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.value || 'all'}
              label={f.label}
              active={status === f.value}
              onPress={() => handleStatusFilter(f.value)}
            />
          ))}
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={list}
          keyExtractor={(item, index) => getServiceId(item) || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <ServiceRow
              service={item}
              onPress={() => {
                const serviceId = getServiceId(item);
                if (serviceId) router.push(`/services/${serviceId}`);
              }}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No services found.</Text>
              </View>
            )
          }
          ListFooterComponent={
            list.length > 0 ? (
              hasMore ? (
                <Pressable
                  style={[styles.loadMoreButton, loadingMore && styles.buttonDisabled]}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.endOfListText}>You've reached the end.</Text>
              )
            ) : null
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
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    fontSize: 14,
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: spacing.sm,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
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
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    marginTop: spacing.xs,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  endOfListText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
