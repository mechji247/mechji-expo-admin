import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/constants/theme';

export default function SubscriptionsScreen() {
  const router = useRouter();

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

        <View style={styles.manageCard}>
          <View style={styles.manageIcon}>
            <Ionicons name="card-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.manageTitle}>Subscription plan management</Text>
          <Text style={styles.manageCopy}>
            Create, edit, activate, or retire vendor plans. Plan pricing uses the backend’s base currency; each plan sets one commission percentage for products and services.
          </Text>
          <Pressable style={styles.manageButton} onPress={() => router.push('/subscriptions/manage')}>
            <Text style={styles.manageButtonText}>Manage subscription plans</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.surface} />
          </Pressable>
        </View>
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
  manageCard: { marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg },
  manageIcon: { alignSelf: 'flex-start', padding: spacing.sm, borderRadius: 12, backgroundColor: colors.primaryMuted, marginBottom: spacing.md },
  manageTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  manageCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  manageButton: { marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12 },
  manageButtonText: { color: colors.surface, fontWeight: '800', fontSize: 14 },
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
