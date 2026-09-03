import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/constants/theme';

// No broadcast-notifications endpoint exists yet — this renders the
// mockup's sample alerts as static placeholder data, split by audience
// tab. Swap in a real fetch (and wire the "+" button to a real send
// flow) once that endpoint exists.
const NOTIFICATIONS = {
  users: [
    {
      id: '1',
      icon: 'cube-outline',
      iconColor: colors.info,
      iconBg: colors.infoMuted,
      title: 'Festive sale live now',
      body: '"Up to 40% off across 200+ vendors this weekend."',
      meta: 'Sent to all users · Sent today, 9:00 am · 128,340 delivered',
    },
    {
      id: '2',
      icon: 'checkmark',
      iconColor: colors.success,
      iconBg: colors.successMuted,
      title: 'Order delivered',
      body: '"Your order ORD-88207 has been delivered."',
      meta: 'Auto-notification · Sent yesterday · triggered by system',
    },
    {
      id: '3',
      icon: 'phone-portrait-outline',
      iconColor: colors.danger,
      iconBg: colors.dangerMuted,
      title: 'Account restriction notice',
      body: '"Your account has limited access — contact support."',
      meta: 'Sent to Simran Oberoi · Sent 2 days ago · triggered by Sameer Dutta',
    },
  ],
  vendors: [],
  admins: [],
};

const AUDIENCE_TABS = [
  { label: 'Users', value: 'users' },
  { label: 'Vendors', value: 'vendors' },
  { label: 'Admins', value: 'admins' },
];

function NotificationCard({ item }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardText}>{item.body}</Text>
        <Text style={styles.cardMeta}>{item.meta}</Text>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [audience, setAudience] = useState('users');

  const handleCompose = () => Alert.alert('New notification', 'Sending a broadcast is coming soon.');

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

        <FlatList
          data={NOTIFICATIONS[audience]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <NotificationCard item={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No notifications sent to {audience} yet.</Text>
            </View>
          }
        />
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