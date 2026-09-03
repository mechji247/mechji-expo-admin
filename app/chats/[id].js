import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getAvatarColor, spacing } from '../../lib/constants/theme';
import { MOCK_CHATS } from '../../lib/constants/mockChats';

// Read-only: admins can see the conversation for context but can't send
// messages in it (there's no send-as-admin endpoint, and product-wise
// this is meant to stay a customer↔vendor channel). See
// lib/constants/mockChats.js for why this is static placeholder data.
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function MessageBubble({ message }) {
  const isVendor = message.from === 'vendor';
  return (
    <View style={[styles.bubbleRow, isVendor && styles.bubbleRowRight]}>
      <View style={[styles.bubble, isVendor ? styles.bubbleVendor : styles.bubbleCustomer]}>
        <Text style={[styles.bubbleText, isVendor && styles.bubbleTextVendor]}>{message.text}</Text>
      </View>
      <Text style={[styles.bubbleCaption, isVendor && styles.bubbleCaptionRight]}>
        {message.name} · {message.time}
      </Text>
    </View>
  );
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const chat = MOCK_CHATS.find((c) => String(c.id) === String(id));

  if (!chat) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitleOnly}>Conversation</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(chat.id || chat.customerName) }]}>
          <Text style={styles.avatarText}>{getInitials(chat.customerName)}</Text>
        </View>
        <View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chat.customerName} ↔ {chat.vendorName}
          </Text>
          {!!chat.orderCode && <Text style={styles.headerSubtitle}>Order {chat.orderCode}</Text>}
        </View>
      </View>

      <View style={styles.readOnlyPillWrap}>
        <View style={styles.readOnlyPill}>
          <Text style={styles.readOnlyPillText}>Admin view · read only</Text>
        </View>
      </View>

      {chat.messages.length ? (
        <ScrollView contentContainerStyle={styles.messagesContent}>
          {chat.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No message history to preview for this conversation yet.</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.disabledInput}
          editable={false}
          placeholder="Admins can view but not send messages"
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: { marginRight: spacing.sm, padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitleOnly: { fontSize: 16, fontWeight: '700', color: colors.text },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarText: { fontSize: 13, fontWeight: '700', color: colors.surface },
  headerTitle: { fontSize: 15, fontWeight: '700', color: colors.text, maxWidth: 240 },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  readOnlyPillWrap: { alignItems: 'center', marginBottom: spacing.sm },
  readOnlyPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  readOnlyPillText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  messagesContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  bubbleRow: { marginBottom: spacing.md, alignItems: 'flex-start', maxWidth: '80%' },
  bubbleRowRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleCustomer: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleVendor: { backgroundColor: colors.primary },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  bubbleTextVendor: { color: colors.surface },
  bubbleCaption: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  bubbleCaptionRight: { textAlign: 'right' },
  inputBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  disabledInput: {
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 13,
    color: colors.textMuted,
  },
});