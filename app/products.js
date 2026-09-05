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
  fetchProducts,
  selectProductsError,
  selectProductsList,
  selectProductsLoading,
} from '../store/slices/productsSlice';
import { selectDashboardOverview } from '../store/slices/adminDashboardSlice';

// Matches the Product schema's real `status` enum exactly
// (server/newSchemaModels/schemas/product/productSchema.js) — this is
// what getProductsList's `status` query param actually filters on.
// 'live' was never a real value here.
const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Draft', value: 'draft' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Out of stock', value: 'outOfStock' },
];

const STATUS_STYLES = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  pending: { bg: colors.warningMuted, fg: colors.warning, label: 'Pending' },
  draft: { bg: colors.warningMuted, fg: colors.warning, label: 'Draft' },
  rejected: { bg: colors.dangerMuted, fg: colors.danger, label: 'Rejected' },
  inactive: { bg: colors.background, fg: colors.textMuted, label: 'Inactive' },
  outofstock: { bg: colors.dangerMuted, fg: colors.danger, label: 'Out of stock' },
};

function normalizeStatus(status) {
  return String(status || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getProductId(product) {
  return product?._id || product?.id || null;
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

// Matches the real list projection from getProductsList/mapProduct
// (server/controllers/admin/adminController.js): title, sku,
// categoryPrimary/categorySecondary, brand, stock, price, status,
// createdAt. There's no vendor name in that projection (only a bare
// vendorId), so the row shows category/brand/SKU instead of a vendor.
function ProductRow({ product, onPress }) {
  const id = getProductId(product);
  const name = product?.title || 'Unnamed product';
  const meta = [product?.categoryPrimary, product?.brand].filter(Boolean).join('  ·  ');

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
        <Text style={styles.rowPrice}>{formatAmount(product?.price)}</Text>
      </View>
      <StatusBadge status={product?.status} />
    </Pressable>
  );
}

export default function ProductsScreen() {
  const dispatch = useDispatch();
  const router = useRouter();

  const list = useSelector(selectProductsList);
  const loading = useSelector(selectProductsLoading);
  const error = useSelector(selectProductsError);
  const overview = useSelector(selectDashboardOverview);

  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const runFetch = useCallback(
    (nextSearch, nextStatus) => {
      dispatch(fetchProducts({ page: 1, limit: 50, search: nextSearch, status: nextStatus }));
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
    await dispatch(fetchProducts({ page: 1, limit: 50, search: searchText.trim(), status }));
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
            <Text style={styles.headerTitle}>Products</Text>
            <Text style={styles.headerSubtitle}>
              {overview.products.total.toLocaleString('en-IN')} catalog listings
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
            placeholder="Search products or SKU"
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
          keyExtractor={(item, index) => getProductId(item) || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onPress={() => {
                const productId = getProductId(item);
                if (productId) router.push(`/products/${productId}`);
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
                <Text style={styles.emptyText}>No products found.</Text>
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
});