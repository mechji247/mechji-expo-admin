import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../lib/constants/theme';

// No reviews endpoint exists yet — this renders the mockup's sample
// reviews as static placeholder data, split by the two tabs shown.
// Swap in a real fetch once a reviews endpoint exists.
const PRODUCT_REVIEWS = [
  {
    id: '1',
    rating: 2,
    text: 'Item arrived damaged and the packaging was reused — feels like a returned product.',
    reviewer: 'Simran Oberoi',
    subject: 'Terracotta Planter',
    vendor: 'Terra Clay Pottery',
    status: 'flagged',
  },
  {
    id: '2',
    rating: 5,
    text: 'Beautiful table runner, exactly as pictured. Fast shipping too.',
    reviewer: 'Ishita Bhalla',
    subject: 'Jute Table Runner',
    vendor: 'Copperleaf Interiors',
    status: null,
  },
  {
    id: '3',
    rating: 1,
    text: 'Overpriced for what it is, would not order again.',
    reviewer: 'Rohan Vats',
    subject: 'Cold Brew Concentrate',
    vendor: 'Basil & Bloom Cafe Supplies',
    status: 'underreview',
  },
];

const SERVICE_REVIEWS = [];

const STATUS_STYLES = {
  flagged: { bg: colors.dangerMuted, fg: colors.danger, label: 'Flagged' },
  underreview: { bg: colors.warningMuted, fg: colors.warning, label: 'Under review' },
};

function StatusBadge({ status }) {
  if (!status) return null;
  const style = STATUS_STYLES[status];
  if (!style) return null;
  return (
    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.statusBadgeText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

function StarRow({ rating }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={14}
          color={n <= rating ? colors.warning : colors.border}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}

function ReviewCard({ review }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <StarRow rating={review.rating} />
        <StatusBadge status={review.status} />
      </View>
      <Text style={styles.reviewText}>&ldquo;{review.text}&rdquo;</Text>
      <Text style={styles.reviewMeta} numberOfLines={1}>
        {review.reviewer} · {review.subject} · {review.vendor}
      </Text>
    </View>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('product');
  const isProduct = tab === 'product';
  const data = isProduct ? PRODUCT_REVIEWS : SERVICE_REVIEWS;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Reviews</Text>
            <Text style={styles.headerSubtitle}>18 flagged this week</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, isProduct && styles.tabButtonActive]} onPress={() => setTab('product')}>
            <Text style={[styles.tabText, isProduct && styles.tabTextActive]}>Product reviews</Text>
          </Pressable>
          <Pressable style={[styles.tabButton, !isProduct && styles.tabButtonActive]} onPress={() => setTab('service')}>
            <Text style={[styles.tabText, !isProduct && styles.tabTextActive]}>Service reviews</Text>
          </Pressable>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No service reviews yet.</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  backButton: { marginRight: spacing.sm, padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: 9 },
  tabButtonActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.surface },
  listContent: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  starRow: { flexDirection: 'row' },
  reviewText: { fontSize: 14, color: colors.text, marginBottom: spacing.xs, lineHeight: 19 },
  reviewMeta: { fontSize: 12, color: colors.textMuted },
  statusBadge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
});