import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../lib/constants/theme';
import { resolveAdminNotificationHref } from '../lib/utils/adminNotificationNav';
import {
  fetchNotifications,
  fetchMoreNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  selectAdminNotifications,
  selectAdminNotificationUnreadCount,
  selectAdminNotificationFilter,
  selectAdminNotificationLoading,
  selectAdminNotificationRefreshing,
  selectAdminNotificationLoadingMore,
  selectAdminNotificationHasMore,
  selectAdminNotificationError,
  selectAdminNotificationMarkingAllAsRead,
} from '../store/slices/adminNotificationInboxSlice';

// The admin's OWN notification feed — what they personally received
// (operational alerts, admin-composed broadcasts). Sending/composing a
// broadcast to users/vendors/the admin team is a separate screen, still at
// app/notifications.js (reachable here via the header's "Broadcasts" link,
// and from the More tab).

const CATEGORY_META = {
  operational: { icon: 'construct-outline', color: colors.info, bg: colors.infoMuted, label: 'Operational' },
  broadcast: { icon: 'megaphone-outline', color: colors.primary, bg: colors.primaryMuted, label: 'Broadcast' },
  security: { icon: 'shield-checkmark-outline', color: colors.danger, bg: colors.dangerMuted, label: 'Security' },
  subscription: { icon: 'card-outline', color: colors.warning, bg: colors.warningMuted, label: 'Subscription' },
  system: { icon: 'settings-outline', color: colors.textMuted, bg: colors.background, label: 'System' },
  account: { icon: 'person-outline', color: colors.info, bg: colors.infoMuted, label: 'Account' },
  promotional: { icon: 'pricetag-outline', color: colors.primary, bg: colors.primaryMuted, label: 'Promotional' },
};

function categoryMeta(category) {
  return CATEGORY_META[category] || { icon: 'notifications-outline', color: colors.textMuted, bg: colors.background, label: category || 'General' };
}

function formatRelativeTime(isoDate) {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Today / Yesterday / Earlier — grouped over whatever page of results is
// already loaded, never re-sorted or re-fetched, so it never conflicts
// with cursor pagination: a section just keeps growing as more pages load.
function buildSections(notifications) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const buckets = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of notifications) {
    const created = new Date(n.createdAt);
    if (created >= startOfToday) buckets.Today.push(n);
    else if (created >= startOfYesterday) buckets.Yesterday.push(n);
    else buckets.Earlier.push(n);
  }
  return ['Today', 'Yesterday', 'Earlier']
    .filter((title) => buckets[title].length > 0)
    .map((title) => ({ title, data: buckets[title] }));
}

function NotificationRow({ item, onOpen, onDelete }) {
  const meta = categoryMeta(item.category);
  return (
    <Pressable style={styles.card} onPress={() => onOpen(item)}>
      {!item.isRead ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
      <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardMeta}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.cardText} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.cardCategory}>{meta.label}</Text>
      </View>
      <Pressable hitSlop={8} style={styles.deleteButton} onPress={() => onDelete(item)}>
        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

export default function AdminNotificationInboxScreen() {
  const router = useRouter();
  const dispatch = useDispatch();

  const notifications = useSelector(selectAdminNotifications);
  const unreadCount = useSelector(selectAdminNotificationUnreadCount);
  const filter = useSelector(selectAdminNotificationFilter);
  const loading = useSelector(selectAdminNotificationLoading);
  const refreshing = useSelector(selectAdminNotificationRefreshing);
  const loadingMore = useSelector(selectAdminNotificationLoadingMore);
  const hasMore = useSelector(selectAdminNotificationHasMore);
  const error = useSelector(selectAdminNotificationError);
  const markingAllAsRead = useSelector(selectAdminNotificationMarkingAllAsRead);

  useEffect(() => {
    dispatch(fetchNotifications({ unreadOnly: false }));
  }, [dispatch]);

  const handleFilterChange = (unreadOnly) => {
    if ((unreadOnly && filter === 'unread') || (!unreadOnly && filter === 'all')) return;
    dispatch(fetchNotifications({ unreadOnly }));
  };

  const handleRefresh = () => dispatch(fetchNotifications({ unreadOnly: filter === 'unread', refresh: true }));
  const handleLoadMore = useCallback(() => dispatch(fetchMoreNotifications()), [dispatch]);

  const handleOpen = (item) => {
    if (!item.isRead) dispatch(markNotificationAsRead(item._id));
    const href = resolveAdminNotificationHref(item);
    if (href) router.push(href);
  };

  const handleDelete = (item) => {
    Alert.alert('Delete notification', 'Remove this notification from your inbox?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteNotification(item._id)) },
    ]);
  };

  const handleMarkAllAsRead = () => { if (unreadCount > 0) dispatch(markAllNotificationsAsRead()); };

  const sections = buildSections(notifications);
  const showInitialLoading = loading && notifications.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Alerts and updates sent to you</Text>
            </View>
          </View>
          <Pressable style={styles.composeLink} onPress={() => router.push('/notifications')}>
            <Text style={styles.composeLinkText}>Broadcasts</Text>
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {[{ key: 'all', label: 'All' }, { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` }].map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => handleFilterChange(tab.key === 'unread')}
              style={[styles.chip, filter === tab.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === tab.key && styles.chipTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAllAsRead}
            style={[styles.markAllButton, (unreadCount === 0 || markingAllAsRead) && styles.markAllButtonDisabled]}
          >
            <Text style={styles.markAllText}>{markingAllAsRead ? 'Marking…' : 'Mark all read'}</Text>
          </Pressable>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {showInitialLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <NotificationRow item={item} onOpen={handleOpen} onDelete={handleDelete} />}
            renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            onEndReachedThreshold={0.4}
            onEndReached={hasMore ? handleLoadMore : undefined}
            ListFooterComponent={loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="notifications-off-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>
                  {filter === 'unread' ? 'No unread notifications' : "You're all caught up"}
                </Text>
                <Text style={styles.emptyText}>
                  New notifications will appear here when there's something that needs your attention.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: spacing.sm, padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  composeLink: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  composeLinkText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
  markAllButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  markAllButtonDisabled: { opacity: 0.4 },
  markAllText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { fontSize: 12, color: colors.danger },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  listContent: { paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.xs,
  },
  unreadDotSpacer: { width: 7, marginRight: spacing.xs },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: spacing.xs },
  cardTitleUnread: { fontWeight: '700' },
  cardMeta: { fontSize: 11, color: colors.textMuted },
  cardText: { fontSize: 13, color: colors.text, marginTop: 2 },
  cardCategory: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontWeight: '600' },
  deleteButton: { padding: spacing.xs, marginLeft: spacing.xs },
  footerLoading: { paddingVertical: spacing.md, alignItems: 'center' },
  emptyState: { paddingVertical: spacing.xl * 1.5, alignItems: 'center', paddingHorizontal: spacing.lg },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
