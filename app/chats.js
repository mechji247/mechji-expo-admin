import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, getAvatarColor, spacing } from '../lib/constants/theme';
import { MOCK_CHATS } from '../lib/constants/mockChats';

// Placeholder data — there's no chat API/slice in the backend yet. See
// lib/constants/mockChats.js (shared with app/chats/[id].js so the list
// and detail screen agree on the same conversations). Once a real
// endpoint exists, swap the data source here for a thunk + selector
// pair (same shape as adminDashboardSlice) — the layout shouldn't need
// to change.

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function ChatRow({ chat, onPress }) {
  const hasUnread = chat.unread;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(chat.id || chat.customerName) }]}>
        <Text style={styles.avatarText}>{getInitials(chat.customerName)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {chat.customerName}
        </Text>
        <Text style={styles.rowVendor} numberOfLines={1}>
          ↔ {chat.vendorName}
        </Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {chat.previewPrefix ? `${chat.previewPrefix} ` : ''}
          &ldquo;{chat.lastMessage}&rdquo;
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowTime}>{chat.time}</Text>
        {hasUnread && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return MOCK_CHATS;
    return MOCK_CHATS.filter(
      (c) => c.customerName.toLowerCase().includes(q) || c.vendorName.toLowerCase().includes(q)
    );
  }, [searchText]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Chats</Text>
        <Text style={styles.headerSubtitle}>User ↔ vendor conversations</Text>
      </View>

      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search conversations"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatRow chat={item} onPress={() => router.push(`/chats/${item.id}`)} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No conversations found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  headerRow: { marginBottom: spacing.md },
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
  listContent: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.surface },
  rowBody: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowVendor: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowPreview: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  rowRight: { alignItems: 'flex-end' },
  rowTime: { fontSize: 11, color: colors.textMuted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  empty: { paddingTop: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
});