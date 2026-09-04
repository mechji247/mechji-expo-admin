import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import { adminLogout, selectAdminInfo, selectAdminLoading } from '../../store/slices/adminSlice';
import log from '../../lib/utils/logger';

const COMMERCE_ROWS = [
  { key: 'orders', label: 'Orders', icon: 'receipt-outline', route: '/orders' },
  { key: 'bookings', label: 'Service bookings', icon: 'calendar-outline', route: '/orders?tab=service' },
  { key: 'products', label: 'Products', icon: 'reader-outline', route: '/products' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'card-outline', route: '/subscriptions' },
  { key: 'promotions', label: 'Promotions', icon: 'pricetag-outline', route: '/promotions' },
];
 
const PEOPLE_ROWS = [
  { key: 'vendorStaff', label: 'Vendor staff', icon: 'people-outline', route: '/staff' },
  { key: 'adminTeam', label: 'Admin team', icon: 'person-add-outline', route: '/admins' },
  { key: 'reviews', label: 'Reviews', icon: 'star-outline', route: '/reviews' },
  { key: 'chats', label: 'Chats', icon: 'chatbubble-outline', route: '/chats' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', route: '/notifications' },
  { key: 'trustSafety', label: 'Trust & safety reports', icon: 'time-outline', route: '/trust-safety' },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function MoreRow({ label, icon, onPress }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIconCircle}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const adminInfo = useSelector(selectAdminInfo);
  const loading = useSelector(selectAdminLoading);

  const displayName = adminInfo?.name || adminInfo?.fullName || adminInfo?.email || 'Admin';

  const handleRowPress = (row) => {
    if (row.route) {
      router.push(row.route);
      return;
    }
    Alert.alert(row.label, `${row.label} is coming soon.`);
  };

  const handleAvatarPress = () => {
    if (adminInfo?.email) {
      Alert.alert(displayName, adminInfo.email);
    }
  };

  const handleLogout = async () => {
        try {
         await dispatch(adminLogout());
        } catch (error) {
          console.error("Logout error", error)
        }finally{
          router.replace("login");
        }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSubtitle}>Everything else you manage</Text>
        </View>
        <Pressable style={styles.avatar} onPress={handleAvatarPress}>
          <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>COMMERCE</Text>
      <View style={styles.card}>
        {COMMERCE_ROWS.map((row, index) => (
          <View key={row.key}>
            <MoreRow label={row.label} icon={row.icon} onPress={() => handleRowPress(row)} />
            {index < COMMERCE_ROWS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>PEOPLE & CONTENT</Text>
      <View style={styles.card}>
        {PEOPLE_ROWS.map((row, index) => (
          <View key={row.key}>
            <MoreRow label={row.label} icon={row.icon} onPress={() => handleRowPress(row)} />
            {index < PEOPLE_ROWS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.logoutButton, loading && styles.logoutButtonDisabled]}
        onPress={() => handleLogout()}
        disabled={loading}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>{loading ? 'Signing out…' : 'Log out'}</Text>
      </Pressable>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 34 + spacing.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerMuted,
    borderRadius: 12,
    paddingVertical: spacing.sm + 4,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    marginLeft: spacing.xs,
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});