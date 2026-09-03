import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/constants/theme';

// No list-plans/list-vendor-subscriptions endpoint exists yet — only a
// per-vendor cancelVendorSubscription action does (adminVendorSlice).
// This renders the mockup's sample plans/subscriptions as static
// placeholder data; swap in a real fetch once a billing endpoint exists.
const PLANS = [
  { id: 'basic', name: 'Basic', price: '₹499/mo', vendorCount: 22 },
  { id: 'pro', name: 'Pro', price: '₹1,499/mo', vendorCount: 19, highlighted: true },
  { id: 'elite', name: 'Elite', price: '₹3,999/mo', vendorCount: 5 },
];

const VENDOR_SUBSCRIPTIONS = [
  { id: '1', vendor: 'Copperleaf Interiors', plan: 'Pro', detail: 'renews 14 Sep', status: 'active' },
  { id: '2', vendor: 'Voltage Fix Electricians', plan: 'Basic', detail: 'renews 4 Sep', status: 'expiring' },
  { id: '3', vendor: 'Terra Clay Pottery', plan: 'Basic', detail: 'lapsed 28 Aug', status: 'expired' },
];

const STATUS_STYLES = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  expiring: { bg: colors.warningMuted, fg: colors.warning, label: 'Expiring' },
  expired: { bg: colors.dangerMuted, fg: colors.danger, label: 'Expired' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { bg: colors.background, fg: colors.textMuted, label: status };
  return (
    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.statusBadgeText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

function PlanRow({ plan, onPress }) {
  return (
    <Pressable style={[styles.planRow, plan.highlighted && styles.planRowHighlighted]} onPress={onPress}>
      <View>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planMeta}>
          {plan.price} · {plan.vendorCount} vendors
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={colors.text} />
    </Pressable>
  );
}

function VendorSubscriptionRow({ sub }) {
  return (
    <View style={styles.subRow}>
      <View style={styles.subBody}>
        <Text style={styles.subVendor} numberOfLines={1}>
          {sub.vendor}
        </Text>
        <Text style={styles.subMeta}>
          {sub.plan} · {sub.detail}
        </Text>
      </View>
      <StatusBadge status={sub.status} />
    </View>
  );
}

export default function SubscriptionsScreen() {
  const router = useRouter();

  const handlePlanPress = (plan) =>
    Alert.alert(plan.name, 'Editing plan pricing and limits is coming soon.');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Subscriptions</Text>
            <Text style={styles.headerSubtitle}>Vendor plan billing</Text>
          </View>
        </View>

        <FlatList
          data={VENDOR_SUBSCRIPTIONS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <Text style={styles.sectionLabel}>PLANS</Text>
              {PLANS.map((plan) => (
                <PlanRow key={plan.id} plan={plan} onPress={() => handlePlanPress(plan)} />
              ))}
              <Text style={styles.sectionLabel}>VENDOR SUBSCRIPTIONS</Text>
            </>
          }
          renderItem={({ item }) => <VendorSubscriptionRow sub={item} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  backButton: { marginRight: spacing.sm, padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  listContent: { paddingBottom: spacing.xl },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  planRowHighlighted: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  planName: { fontSize: 15, fontWeight: '700', color: colors.text },
  planMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  subBody: { flex: 1, marginRight: spacing.sm },
  subVendor: { fontSize: 14, fontWeight: '700', color: colors.text },
  subMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});