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
import { colors, getAvatarColor, spacing } from '../../lib/constants/theme';
import {
  fetchDashboardUsers,
  selectDashboardErrors,
  selectDashboardLists,
  selectDashboardLoading,
  selectDashboardOverview,
} from '../../store/slices/adminDashboardSlice';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Review', value: 'review' },
  { label: 'Blocked', value: 'blocked' },
];

// Backend status value -> badge color/label. Falls back to a neutral
// style for any value not in this list rather than guessing.
const STATUS_STYLES = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  review: { bg: colors.warningMuted, fg: colors.warning, label: 'Review' },
  blocked: { bg: colors.dangerMuted, fg: colors.danger, label: 'Blocked' },
};

function getUserId(user) {
  return user?._id || user?.id || null;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { bg: colors.background, fg: colors.textMuted, label: status || '—' };
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

function UserRow({ user, onPress }) {
  const id = getUserId(user);
  const meta = [user?.email, user?.city].filter(Boolean).join('  ·  ');
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(id || user?.name) }]}>
        <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {user?.name || 'Unnamed user'}
        </Text>
        {!!meta && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      <StatusBadge status={user?.status} />
    </Pressable>
  );
}

export default function UsersScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const lists = useSelector(selectDashboardLists);
  const loading = useSelector(selectDashboardLoading);
  const errors = useSelector(selectDashboardErrors);
  const overview = useSelector(selectDashboardOverview);

  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Explicit params on every call rather than relying on the slice's
  // shared filters.search/userStatus — that field is shared across every
  // dashboard list (users/vendors/products/…), so a value set here could
  // otherwise leak into another tab's fetch.
  const runFetch = useCallback(
    (nextSearch, nextStatus) => {
      dispatch(fetchDashboardUsers({ page: 1, limit: 50, search: nextSearch, status: nextStatus }));
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
    await dispatch(fetchDashboardUsers({ page: 1, limit: 50, search: searchText.trim(), status }));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Users</Text>
        <Text style={styles.headerSubtitle}>{overview.users.total} total</Text>
      </View>

      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearchSubmit}
          placeholder="Search by name, ID, email, city"
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

      {!!errors.users && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errors.users}</Text>
        </View>
      )}

      <FlatList
        data={lists.users}
        keyExtractor={(item, index) => getUserId(item) || String(index)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onPress={() => {
              const userId = getUserId(item);
              if (userId) router.push(`/users/${userId}`);
            }}
          />
        )}
        ListEmptyComponent={
          loading.users ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No users found.</Text>
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
    paddingTop: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 13,
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