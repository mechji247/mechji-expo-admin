import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, CheckRow, ErrorBanner, Input, Sheet, StateView } from './ui';
import { colors, spacing } from '../../lib/constants/theme';
import { newClientId, supportApi, supportErrorMessage } from '../../lib/support/supportApi';
import { sendTyping, socketSendMessage } from '../../lib/support/supportSocket';
import { channelLabel, dateTime, fillPlaceholders, humanize } from '../../lib/support/format';

// Agent conversation: every channel of a ticket in one timeline, with a
// filter per channel. Internal notes are visually distinct and never leave
// the support team (enforced by the server; the UI just makes it obvious).

const CHANNEL_STYLE = {
  internal: { borderColor: colors.warning, backgroundColor: colors.warningMuted, borderStyle: 'dashed' },
  shared: { borderColor: colors.info, backgroundColor: colors.infoMuted },
  counterparty: { borderColor: colors.border, backgroundColor: '#EEF0F4' },
  owner: { borderColor: colors.border, backgroundColor: colors.surface },
};

function senderLabel(m, ticket) {
  if (m.senderType === 'agent') return `${m.senderName || 'Support'}${m.isInternal ? '' : ' (Support)'}`;
  if (m.senderType === 'system') return 'System';
  if (m.senderParty === 'counterparty') return `${ticket.counterpartyDetail?.name || ticket.counterparty?.name || 'Other party'} (${ticket.counterparty?.type === 'vendor' ? 'store' : 'customer'})`;
  return `${ticket.requester?.name || ticket.customerName || 'Customer'} (${ticket.customerType === 'vendor' ? 'store' : 'customer'})`;
}

export function Attachments({ items }) {
  if (!items?.length) return null;
  return (
    <View style={styles.files}>
      {items.map((a) => (
        <Pressable key={a.attachmentId} disabled={!a.url} onPress={() => a.url && Linking.openURL(a.url)} style={styles.file}
          accessibilityRole="link" accessibilityLabel={`Open ${a.fileName}`}>
          <Ionicons name={a.isImage ? 'image-outline' : 'document-outline'} size={14} color={colors.primary} />
          <Text style={styles.fileName} numberOfLines={1}>{a.fileName}</Text>
          {a.evidenceKind ? <Badge tone="warning">{humanize(a.evidenceKind)}</Badge> : null}
        </Pressable>
      ))}
    </View>
  );
}

function Message({ m, ticket }) {
  if (m.messageType === 'system' || m.senderType === 'system') {
    return <Text style={[styles.system, m.channel === 'internal' && { backgroundColor: colors.warningMuted }]}>{m.body} · {dateTime(m.createdAt)}</Text>;
  }
  const fromSupport = m.senderType === 'agent';
  return (
    <View style={[styles.bubble, CHANNEL_STYLE[m.channel] || CHANNEL_STYLE.owner, fromSupport ? styles.right : styles.left]}
      accessible accessibilityLabel={`${senderLabel(m, ticket)}, ${channelLabel(m.channel, ticket)}: ${m.body}`}>
      <View style={styles.msgHead}>
        <Text style={styles.sender}>{senderLabel(m, ticket)}</Text>
        <Badge tone={m.channel === 'internal' ? 'warning' : m.channel === 'shared' ? 'info' : 'neutral'}>{channelLabel(m.channel, ticket)}</Badge>
        {m.messageType === 'request_info' ? <Badge tone="info">Information requested</Badge> : null}
        {m.messageType === 'evidence' ? <Badge tone="warning">Evidence</Badge> : null}
      </View>
      {m.body ? <Text style={styles.body} selectable>{m.body}</Text> : null}
      <Attachments items={m.attachments} />
      <Text style={styles.stamp}>{dateTime(m.createdAt)}{fromSupport && !m.isInternal ? ` · ${m.readAt ? 'Read' : 'Delivered'}` : ''}</Text>
    </View>
  );
}

export function ChannelFilter({ ticket, value, onChange, counts }) {
  const options = [
    { id: 'all', label: 'Everything' },
    { id: 'owner', label: ticket.customerType === 'vendor' ? 'Store (owner)' : 'Customer (owner)' },
    ...(ticket.counterparty ? [{ id: 'counterparty', label: 'Other party' }] : []),
    ...(ticket.type === 'dispute' ? [{ id: 'shared', label: 'Shared' }] : []),
    { id: 'internal', label: 'Internal notes' },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterRow} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="tab" accessibilityState={{ selected: value === o.id }}
          style={[styles.filter, value === o.id && styles.filterActive]}>
          <Text style={[styles.filterText, value === o.id && { color: colors.primary }]}>{o.label}{counts?.[o.id] ? ` · ${counts[o.id]}` : ''}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function MessageList({ ticket, messages, hasMore, loadingOlder, onLoadOlder, filter, typing, error, onRetry }) {
  const shown = useMemo(() => {
    const list = filter === 'all' ? messages : messages.filter((m) => m.channel === filter || (m.senderType === 'system' && filter !== 'internal' && m.channel !== 'internal'));
    return [...list].reverse();
  }, [messages, filter]);
  return (
    <FlatList
      style={{ flex: 1 }}
      data={shown}
      inverted
      keyExtractor={(m) => m._id}
      renderItem={({ item }) => <Message m={item} ticket={ticket} />}
      contentContainerStyle={{ padding: spacing.sm, gap: 8, flexGrow: 1 }}
      onEndReached={() => { if (hasMore && !loadingOlder) onLoadOlder(); }}
      onEndReachedThreshold={0.3}
      ListHeaderComponent={typing ? <Text style={styles.typing} accessibilityLiveRegion="polite">{typing}</Text> : null}
      ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} style={{ margin: 12 }} /> : null}
      // Both states sit in the flipped wrapper — otherwise the error state
      // renders upside down in the inverted list.
      ListEmptyComponent={<View style={styles.emptyFlip}>{error ? <StateView error={error} onRetry={onRetry} /> : <StateView empty title="No messages in this conversation yet" />}</View>}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      accessibilityLabel="Conversation"
    />
  );
}

function CannedPicker({ visible, audience, team, onPick, onClose }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!visible || items) return;
    supportApi.cannedReplies({ audience }).then((r) => setItems(r.cannedReplies || [])).catch((e) => setError(supportErrorMessage(e)));
  }, [visible, audience, items]);
  const list = (items || [])
    .filter((c) => !q || `${c.title} ${c.body}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.teams.includes(team)) - Number(a.teams.includes(team)));
  return (
    <Sheet visible={visible} onClose={onClose} title="Canned replies">
      <Input value={q} onChangeText={setQ} placeholder="Search canned replies…" accessibilityLabel="Search canned replies" />
      {error ? <ErrorBanner message={error} /> : !items ? <ActivityIndicator color={colors.primary} /> : !list.length ? <StateView empty title="No canned replies" /> : null}
      {list.map((c) => (
        <Pressable key={c._id} onPress={() => onPick(c)} style={styles.canned} accessibilityRole="button">
          <Text style={styles.cannedTitle}>{c.title}</Text>
          <Text style={styles.cannedBody} numberOfLines={3}>{c.body}</Text>
        </Pressable>
      ))}
      <Text style={styles.hint}>A canned reply is inserted into your message — review and edit it before sending.</Text>
    </Sheet>
  );
}

export function Composer({ ticket, permissions, meta, me, placeholderValues, onSent }) {
  const channels = useMemo(() => {
    const list = [];
    if (permissions.canReply) {
      list.push({ value: 'owner', label: ticket.customerType === 'vendor' ? 'Store' : 'Customer' });
      if (ticket.counterparty?.active) list.push({ value: 'counterparty', label: 'Other party' });
      if (ticket.sharedThread && ticket.counterparty?.active) list.push({ value: 'shared', label: 'Shared' });
    }
    if (permissions.canNote) list.push({ value: 'internal', label: 'Internal note' });
    return list;
  }, [permissions.canReply, permissions.canNote, ticket.customerType, ticket.counterparty, ticket.sharedThread]);

  const [channel, setChannel] = useState(channels[0]?.value || 'internal');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [requestInfo, setRequestInfo] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const typingAt = useRef(0);

  useEffect(() => { if (!channels.some((c) => c.value === channel)) setChannel(channels[0]?.value || 'internal'); }, [channels, channel]);
  useEffect(() => () => sendTyping(ticket._id, false), [ticket._id]);

  if (!channels.length) {
    return <Text style={styles.readonly}>{ticket.mergedInto ? `This ticket was merged into ${ticket.mergedInto.ticketNumber}.` : 'You can view this ticket but not reply. Assign it to yourself or ask the assignee.'}</Text>;
  }
  const internal = channel === 'internal';
  const closed = ticket.status === 'closed';
  const limits = meta.limits;

  const onType = (value) => {
    setBody(value);
    const now = Date.now();
    if (now - typingAt.current > 2000) { typingAt.current = now; sendTyping(ticket._id, true, channel); }
  };

  const pickFiles = async () => {
    setError(null);
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: limits.attachmentMimeTypes, multiple: true, copyToCacheDirectory: true });
    } catch {
      setError('Could not open the file picker.');
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    for (const asset of result.assets.slice(0, Math.max(0, limits.attachmentsPerMessage - files.length))) {
      if (asset.mimeType && !limits.attachmentMimeTypes.includes(asset.mimeType)) { setError(`${asset.name}: only JPG, PNG, WebP and PDF files are allowed.`); continue; }
      if (asset.size && asset.size > limits.attachmentMaxBytes) { setError(`${asset.name} is larger than ${Math.round(limits.attachmentMaxBytes / 1048576)} MB.`); continue; }
      const key = newClientId();
      setFiles((f) => [...f, { key, fileName: asset.name, uploading: true }]);
      try {
        const { attachment } = await supportApi.uploadAttachment(ticket._id, asset);
        setFiles((f) => f.map((x) => (x.key === key ? { ...attachment, key } : x)));
      } catch (e) {
        setFiles((f) => f.filter((x) => x.key !== key));
        setError(supportErrorMessage(e, `${asset.name} could not be uploaded.`));
      }
    }
  };

  const send = async () => {
    const text = body.trim();
    const attachmentIds = files.filter((f) => f.attachmentId).map((f) => f.attachmentId);
    if ((!text && !attachmentIds.length) || sending || files.some((f) => f.uploading)) return;
    setSending(true);
    setError(null);
    const clientMessageId = newClientId();
    const payload = { ticketId: ticket._id, body: text, attachmentIds, clientMessageId, channel, isInternal: internal, requestInfo: requestInfo && !internal };
    try {
      // Socket first (instant), REST fallback with the same clientMessageId —
      // the server de-duplicates, so a retry never posts twice.
      let result = internal ? null : await socketSendMessage(payload);
      if (!result) {
        const { ticketId, ...rest } = payload;
        result = internal ? await supportApi.addNote(ticketId, { body: text, attachmentIds, clientMessageId }) : await supportApi.postMessage(ticketId, rest);
      }
      setBody('');
      setFiles([]);
      setRequestInfo(false);
      sendTyping(ticket._id, false, channel);
      onSent?.(result);
    } catch (e) {
      setError(supportErrorMessage(e, 'Your message was not sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const pickCanned = (c) => {
    setShowCanned(false);
    const filled = fillPlaceholders(c.body, { agentName: me?.name?.split(' ')[0], ...placeholderValues });
    setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${filled}` : filled));
    supportApi.useCanned(c._id).catch(() => {});
  };

  const canSend = (body.trim() || files.some((f) => f.attachmentId)) && !files.some((f) => f.uploading) && !(closed && !internal);
  return (
    <View style={[styles.composer, internal && { backgroundColor: colors.warningMuted }]}>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <View style={styles.channelRow} accessibilityRole="radiogroup" accessibilityLabel="Send to">
        {channels.map((c) => (
          <Pressable key={c.value} onPress={() => setChannel(c.value)} accessibilityRole="radio" accessibilityState={{ checked: channel === c.value }}
            style={[styles.filter, channel === c.value && styles.filterActive]}>
            <Text style={[styles.filterText, channel === c.value && { color: colors.primary }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {internal ? <Text style={styles.internalNote}>Internal — never shown to users or vendors</Text>
        : <CheckRow label="Request information (waits for their reply)" checked={requestInfo} onToggle={() => setRequestInfo((v) => !v)} />}
      {closed && !internal ? <Text style={[styles.hint, { color: colors.warning }]}>This ticket is closed. Reopen it to reply.</Text> : null}
      {files.length ? (
        <View style={styles.files}>
          {files.map((f) => (
            <View key={f.key} style={styles.file}>
              {f.uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="attach" size={14} color={colors.primary} />}
              <Text style={styles.fileName} numberOfLines={1}>{f.fileName}</Text>
              {!f.uploading ? <Pressable onPress={() => setFiles((x) => x.filter((y) => y.key !== f.key))} hitSlop={8} accessibilityLabel={`Remove ${f.fileName}`}><Ionicons name="close" size={14} color={colors.textMuted} /></Pressable> : null}
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <Pressable onPress={() => setShowCanned(true)} hitSlop={6} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Insert a canned reply">
          <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={pickFiles} disabled={files.length >= limits.attachmentsPerMessage} hitSlop={6} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Attach files">
          <Ionicons name="attach" size={22} color={files.length >= limits.attachmentsPerMessage ? colors.border : colors.textMuted} />
        </Pressable>
        <TextInput
          value={body}
          onChangeText={onType}
          placeholder={internal ? 'Write an internal note…' : 'Write a reply…'}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={limits.messageMax}
          style={styles.textInput}
          accessibilityLabel="Message"
        />
        <Pressable onPress={send} disabled={!canSend || sending} style={[styles.sendBtn, (!canSend || sending) && { opacity: 0.4 }]}
          accessibilityRole="button" accessibilityLabel={internal ? 'Add note' : requestInfo ? 'Send request' : 'Send reply'}>
          {sending ? <ActivityIndicator color={colors.surface} size="small" /> : <Ionicons name={internal ? 'document-text' : 'send'} size={18} color={colors.surface} />}
        </Pressable>
      </View>
      <CannedPicker visible={showCanned} audience={ticket.customerType} team={ticket.assignedTeam} onPick={pickCanned} onClose={() => setShowCanned(false)} />
    </View>
  );
}


const styles = StyleSheet.create({
  system: { alignSelf: 'center', fontSize: 11, color: colors.textMuted, backgroundColor: '#EEF0F4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, textAlign: 'center', maxWidth: '90%' },
  bubble: { maxWidth: '88%', borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  msgHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sender: { fontSize: 12, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.text },
  stamp: { fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end' },
  files: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surface, maxWidth: 240 },
  fileName: { fontSize: 12, color: colors.text, flexShrink: 1 },
  emptyFlip: { flex: 1, justifyContent: 'center', transform: [{ scaleY: -1 }] },
  typing: { fontSize: 12, fontStyle: 'italic', color: colors.textMuted, padding: 4 },
  // flexGrow: 0 keeps the channel bar at its content height (see ui.js Segmented).
  filterBar: { flexGrow: 0, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  filterRow: { gap: 6, alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 6 },
  filter: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  canned: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: colors.surface, gap: 2 },
  cannedTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cannedBody: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textMuted },
  readonly: { padding: spacing.md, fontSize: 13, color: colors.textMuted, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  composer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.sm, gap: 6 },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  internalNote: { fontSize: 12, fontWeight: '700', color: colors.warning },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  iconBtn: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  textInput: { flex: 1, maxHeight: 140, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
