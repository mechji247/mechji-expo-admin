import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/constants/theme';

// No promotions/banners endpoint exists yet — this renders the mockup's
// sample campaigns as static placeholder data. Swap in a real fetch (and
// wire the "+" button to a real create flow) once that endpoint exists.
const PROMOTIONS = [
  {
    id: '1',
    title: 'Festive Sale — Home Category',
    placement: 'Home feed banner',
    vendor: 'Copperleaf Interiors',
    dateRange: '30 Aug – 7 Sep',
    status: 'active',
    stat: '42.1k views · 1.9k clicks',
    color: colors.primary,
  },
  {
    id: '2',
    title: 'Verified Electricians Spotlight',
    placement: 'Search top placement',
    vendor: 'Voltage Fix Electricians',
    dateRange: 'Starts 5 Sep',
    status: 'scheduled',
    stat: '₹4,500 budget',
    color: colors.info,
  },
  {
    id: '3',
    title: 'Studio Rentals Weekend Promo',
    placement: 'Category tile',
    vendor: 'Pixel Frame Studios',
    dateRange: '18 Aug – 25 Aug',
    status: 'ended',
    stat: '18.4k views · 610 clicks',
    color: colors.warning,
  },
];

const STATUS_STYLES = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  scheduled: { bg: colors.infoMuted, fg: colors.info, label: 'Scheduled' },
  ended: { bg: colors.background, fg: colors.textMuted, label: 'Ended' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { bg: colors.background, fg: colors.textMuted, label: status };
  return (
    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.statusBadgeText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

function PromoCard({ promo, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.banner, { backgroundColor: promo.color }]}>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          {promo.title}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardBodyLeft}>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {promo.placement} · {promo.vendor}
          </Text>
          <Text style={styles.cardDate}>{promo.dateRange}</Text>
        </View>
        <View style={styles.cardBodyRight}>
          <StatusBadge status={promo.status} />
          <Text style={styles.cardStat}>{promo.stat}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function PromotionsScreen() {
  const router = useRouter();

  const handleCreate = () => Alert.alert('New promotion', 'Creating a promotion is coming soon.');
  const handleOpen = (promo) =>
    Alert.alert(promo.title, 'Viewing full promotion details is coming soon.');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Promotions</Text>
              <Text style={styles.headerSubtitle}>On-platform ads & banners</Text>
            </View>
          </View>
          <Pressable style={styles.addButton} onPress={handleCreate}>
            <Ionicons name="add" size={20} color={colors.surface} />
          </Pressable>
        </View>

        <FlatList
          data={PROMOTIONS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <PromoCard promo={item} onPress={() => handleOpen(item)} />}
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
  listContent: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  bannerTitle: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  cardBodyLeft: { flex: 1, marginRight: spacing.sm },
  cardBodyRight: { alignItems: 'flex-end' },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  cardDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardStat: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  statusBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});