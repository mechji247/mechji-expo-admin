import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getAvatarColor, spacing } from '../lib/constants/theme';

// There's no vendor-staff endpoint in the backend yet (no slice, no
// thunk) — this renders the mockup's sample roster as static placeholder
// data so the screen can be reviewed, and search/filter run against it
// client-side. Swap MOCK_STAFF for a real fetch (e.g. a
// fetchDashboardStaff thunk following adminDashboardSlice's pattern)
// once that endpoint exists; the layout below shouldn't need to change.
const MOCK_STAFF = [
  { id: '1', name: 'Rakesh Meena', role: 'Delivery agent', vendor: 'Northline Auto Care', duty: 'on' },
  { id: '2', name: 'Ananya Shetty', role: 'Store manager', vendor: 'Copperleaf Interiors', duty: 'off' },
  { id: '3', name: 'Vikram Pillai', role: 'Service technician', vendor: 'Voltage Fix Electricians', duty: 'on' },
  { id: '4', name: 'Naveen Kutty', role: 'Delivery agent', vendor: 'Basil & Bloom Cafe Supplies', duty: 'kyc' },
  { id: '5', name: 'Priyal Jain', role: 'Store manager', vendor: 'Pixel Frame Studios', duty: 'off' },
];

const DUTY_FILTERS = [
  { label: 'All', value: '' },
  { label: 'On duty', value: 'on' },
  { label: 'Off duty', value: 'off' },
  { label: 'KYC pending', value: 'kyc' },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DutyIndicator({ duty }) {
  if (duty === 'kyc') {
    return <Text style={styles.kycText}>KYC{'\n'}pending</Text>;
  }
  const isOn = duty === 'on';
  return (
    <View style={[styles.dutyPill, isOn ? styles.dutyPillOn : styles.dutyPillOff]}>
      {isOn && <View style={styles.dutyDot} />}
      <Text style={[styles.dutyText, isOn && styles.dutyTextOn]}>{isOn ? 'On\nduty' : 'Off\nduty'}</Text>
    </View>
  );
}

function StaffRow({ staff }) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(staff.id || staff.name) }]}>
        <Text style={styles.avatarText}>{getInitials(staff.name)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {staff.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {staff.role} · {staff.vendor}
        </Text>
      </View>
      <DutyIndicator duty={staff.duty} />
    </View>
  );
}

export default function VendorStaffScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [duty, setDuty] = useState('');

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return MOCK_STAFF.filter((s) => {
      if (duty && s.duty !== duty) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q);
    });
  }, [searchText, duty]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Vendor staff</Text>
            <Text style={styles.headerSubtitle}>211 delivery & service agents</Text>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search staff by name or vendor"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
        </View>

        <View style={styles.chipRow}>
          {DUTY_FILTERS.map((f) => (
            <FilterChip key={f.value || 'all'} label={f.label} active={duty === f.value} onPress={() => setDuty(f.value)} />
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <StaffRow staff={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No staff found.</Text>
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
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 4, fontSize: 14, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
  listContent: { paddingBottom: spacing.xl },
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
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarText: { color: colors.surface, fontWeight: '700', fontSize: 13 },
  rowBody: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dutyPillOn: { backgroundColor: colors.successMuted },
  dutyPillOff: { backgroundColor: colors.background },
  dutyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 4 },
  dutyText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'right' },
  dutyTextOn: { color: colors.success },
  kycText: { fontSize: 11, fontWeight: '700', color: colors.warning, textAlign: 'right' },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
});