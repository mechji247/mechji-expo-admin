import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../lib/constants/theme';
import {
  fetchNotifications,
  selectNotificationsLists,
  selectNotificationsLoading,
} from '../store/slices/notificationsSlice';

const AUDIENCE_TABS = [
  { label: 'Users', value: 'users' },
  { label: 'Vendors', value: 'vendors' },
  { label: 'Admins', value: 'admins' },
];

// Icon/color per event type — 'admins' tab items are either a manual
// admin-composed broadcast (no eventType) or a system-triggered alert
// (server/push_notifications/handlers/adminAlerts).
const EVENT_STYLE = {
  vendor_registration: { icon: 'storefront-outline', color: colors.info, bg: colors.infoMuted },
  new_product: { icon: 'cube-outline', color: colors.info, bg: colors.infoMuted },
  new_service: { icon: 'construct-outline', color: colors.info, bg: colors.infoMuted },
  new_report: { icon: 'flag-outline', color: colors.danger, bg: colors.dangerMuted },
  default: { icon: 'megaphone-outline', color: colors.primary, bg: colors.infoMuted },
};

const formatRelativeTime = (isoDate) => {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

function NotificationCard({ item, onPress }) {
  const style = EVENT_STYLE[item.eventType] || EVENT_STYLE.default;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
        <Ionicons name={style.icon} size={18} color={style.color} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardText}>{item.body}</Text>
        <Text style={styles.cardMeta}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [audience, setAudience] = useState('admins');
  const [refreshing, setRefreshing] = useState(false);
  const lists = useSelector(selectNotificationsLists);
  const loadingByAudience = useSelector(selectNotificationsLoading);

  const items = lists[audience] || [];
  const loading = loadingByAudience[audience] && !items.length;

  useEffect(() => {
    dispatch(fetchNotifications({ audience }));
  }, [audience, dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchNotifications({ audience }));
    setRefreshing(false);
  };

  const handleCompose = () => Alert.alert('New notification', 'Sending a broadcast is coming soon.');

  const handleItemPress = (item) => {
    if (!item.navigate || !item.targetId) return;
    // trust-safety/vendor/product screens each own their route shape —
    // reuse the same event-type → route mapping the push tap handler uses.
    if (item.eventType === 'vendor_registration') router.push(`/vendors/${item.targetId}`);
    else if (item.eventType === 'new_product') router.push(`/products/${item.targetId}`);
    else if (item.eventType === 'new_report') router.push('/trust-safety');
  };

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
              <Text style={styles.headerSubtitle}>Broadcast & system alerts</Text>
            </View>
          </View>
          <Pressable style={styles.addButton} onPress={handleCompose}>
            <Ionicons name="add" size={20} color={colors.surface} />
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {AUDIENCE_TABS.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setAudience(t.value)}
              style={[styles.chip, audience === t.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, audience === t.value && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <NotificationCard item={item} onPress={() => handleItemPress(item)} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No notifications for {audience} yet.</Text>
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', marginBottom: spacing.sm },
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
  listContent: { paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardText: { fontSize: 13, color: colors.text, marginTop: 2 },
  cardMeta: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
});