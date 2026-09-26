import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDispatch } from 'react-redux';
import SupportGate from '../../components/support/SupportGate';
import { EscalationPill, PriorityPill, SlaPill, StatusPill, TypePill } from '../../components/support/badges';
import { ChannelFilter, Composer, MessageList } from '../../components/support/Conversation';
import {
  ActivityPanel, DetailsPanel, DisputePanel, RefundsPanel, RelatedPanel, TransactionPanel, useLoader,
} from '../../components/support/TicketPanels';
import {
  AssignDialog, CloseDialog, ConfirmDialog, EscalateDialog, MergeDialog, OpenDisputeDialog, PriorityDialog,
  ReopenDialog, ResolveDialog, ResolveEscalationDialog, StatusDialog,
} from '../../components/support/TicketDialogs';
import { Badge, Button, ErrorBanner, Segmented, Sheet, StateView, useKeyboardOverlap } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { labelFrom, timeAgo } from '../../lib/support/format';
import { supportApi, supportErrorCode, supportErrorMessage } from '../../lib/support/supportApi';
import { joinTicket, leaveTicket, onConnectionChange, onSupportEvent } from '../../lib/support/supportSocket';
import { fetchInboxCounts, ticketSummaryReceived } from '../../store/slices/supportDeskSlice';

// One ticket, worked by an agent — the mobile counterpart of the web desk's
// TicketWorkspace: live conversation across channels, the actions the
// agent's role allows (`permissions`, computed by the server), presence of
// other agents, and the investigation panels.
//
// Concurrency: every state-changing action sends the ticket's `rev`; if
// another agent changed the ticket first the server answers STALE_TICKET /
// ASSIGNMENT_CONFLICT and we reload instead of overwriting their change.

const ACTIVE = ['open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'reopened'];
const WIDE = 900;
const mergeMessages = (list, incoming) => {
  const byId = new Map(list.map((m) => [m._id, m]));
  for (const m of incoming) byId.set(m._id, { ...byId.get(m._id), ...m });
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a._id < b._id ? -1 : 1));
};

function Workspace({ ticketId, meta, caps }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgState, setMsgState] = useState({ hasMore: false, cursor: null, loadingOlder: false, error: null });
  const [filter, setFilter] = useState('all');
  const [viewers, setViewers] = useState([]);
  const [typing, setTyping] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState(wide ? 'details' : 'conversation');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const reloadTimer = useRef(null);
  const typingTimer = useRef(null);
  const revRef = useRef(0);
  // Keyboard: the area under the ticket header is padded by exactly the part
  // the keyboard covers (see useKeyboardOverlap) — works on iOS and on
  // Android edge-to-edge, where adjustResize/KeyboardAvoidingView don't.
  const bodyRef = useRef(null);
  const kb = useKeyboardOverlap(bodyRef);
  const me = meta.me;

  const ticket = data?.ticket;
  const id = ticket?._id || ticketId;
  const related = useLoader(() => supportApi.related(id), [id, ticket?.rev]);

  const loadTicket = useCallback(async () => {
    try {
      const d = await supportApi.getTicket(ticketId);
      setData(d);
      setViewers(d.viewers || []);
      setLoadError(null);
      revRef.current = d.ticket.rev || 0;
      dispatch(ticketSummaryReceived({ ticket: d.ticket }));
      return d;
    } catch (e) {
      setLoadError(supportErrorMessage(e, 'Could not load this ticket.'));
      return null;
    }
  }, [ticketId, dispatch]);

  const loadMessages = useCallback(async (older) => {
    try {
      if (older) setMsgState((s) => ({ ...s, loadingOlder: true }));
      const r = await supportApi.listMessages(ticketId, older ? { before: older } : { limit: 50 });
      setMessages((list) => mergeMessages(list, r.messages));
      setMsgState((s) => ({ hasMore: older || !s.cursor ? r.hasMore : s.hasMore, cursor: older || !s.cursor ? r.nextCursor : s.cursor, loadingOlder: false, error: null }));
    } catch (e) {
      setMsgState((s) => ({ ...s, loadingOlder: false, error: supportErrorMessage(e, 'Could not load messages.') }));
    }
  }, [ticketId]);

  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => { loadTicket(); }, 250);
  }, [loadTicket]);

  // Initial load + room membership (presence).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await loadTicket();
      if (cancelled || !d) return;
      await loadMessages(null);
      const ack = await joinTicket(d.ticket._id);
      if (ack?.viewers) setViewers(ack.viewers);
      if (d.ticket.unreadCount) supportApi.markRead(d.ticket._id).then(() => dispatch(fetchInboxCounts())).catch(() => {});
    })();
    return () => { cancelled = true; clearTimeout(reloadTimer.current); leaveTicket(ticketId); };
  }, [ticketId, loadTicket, loadMessages, dispatch]);

  // Live updates for this ticket.
  useEffect(() => {
    const mine = (tid) => tid && (tid === id || tid === ticketId);
    const offs = [
      onSupportEvent('support:message:new', ({ message, ticket: t } = {}) => {
        if (!message || !mine(message.ticketId)) return;
        setMessages((list) => mergeMessages(list, [message]));
        if (message.senderType === 'customer') setTyping(null);
        if (t?.rev != null && t.rev !== revRef.current) scheduleReload();
        if (message.senderType === 'customer' && AppState.currentState === 'active') supportApi.markRead(id).catch(() => {});
      }),
      ...['support:ticket:updated', 'support:status_updated', 'support:assigned', 'support:escalated', 'support:resolved'].map((ev) => onSupportEvent(ev, (p = {}) => {
        if (!mine(p.ticket?._id)) return;
        if ((p.ticket.rev ?? -1) !== revRef.current) scheduleReload();
      })),
      onSupportEvent('support:presence', (p = {}) => { if (mine(p.ticketId)) setViewers(p.viewers || []); }),
      onSupportEvent('support:typing', (p = {}) => {
        if (!mine(p.ticketId) || (p.who === 'agent' && p.adminId === me.adminId)) return;
        clearTimeout(typingTimer.current);
        if (!p.typing) { setTyping(null); return; }
        setTyping(p.who === 'agent' ? `${p.name || 'An agent'} is writing${p.channel === 'internal' ? ' a note' : ' a reply'}…`
          : p.who === 'counterparty' ? 'The other party is typing…' : 'The customer is typing…');
        typingTimer.current = setTimeout(() => setTyping(null), 5000);
      }),
      onSupportEvent('support:read', (p = {}) => {
        if (!mine(p.ticketId) || p.reader === 'support') return;
        const channel = p.reader === 'counterparty' ? 'counterparty' : 'owner';
        setMessages((list) => list.map((m) => (m.senderType === 'agent' && !m.isInternal && !m.readAt && (m.channel === channel || m.channel === 'shared') ? { ...m, readAt: p.readAt } : m)));
      }),
    ];
    // After a reconnect, fetch anything missed while offline.
    let wasConnected = null;
    offs.push(onConnectionChange((connected) => {
      if (connected && wasConnected === false) { loadMessages(null); loadTicket(); }
      wasConnected = connected;
    }));
    return () => { offs.forEach((off) => off()); clearTimeout(typingTimer.current); };
  }, [id, ticketId, me.adminId, scheduleReload, loadMessages, loadTicket]);

  /** Runs an action with the current revision; reloads on success or conflict. */
  const run = useCallback(async (call) => {
    try {
      const result = await call(revRef.current);
      await loadTicket();
      dispatch(fetchInboxCounts());
      return result;
    } catch (e) {
      const code = supportErrorCode(e);
      if (['STALE_TICKET', 'ASSIGNMENT_CONFLICT', 'STATUS_CONFLICT', 'ALREADY_MERGED'].includes(code)) {
        setNotice(supportErrorMessage(e));
        await loadTicket();
      }
      throw e;
    }
  }, [loadTicket, dispatch]);

  const quick = async (key, call) => {
    setBusy(key);
    try { await run(call); } catch (e) { setNotice(supportErrorMessage(e)); } finally { setBusy(null); }
  };

  const counts = useMemo(() => {
    const c = {};
    for (const m of messages) if (m.senderType !== 'system') c[m.channel] = (c[m.channel] || 0) + 1;
    return c;
  }, [messages]);

  if (loadError && !data) return <StateView error={loadError} onRetry={loadTicket} />;
  if (!data) return <StateView loading />;

  const { permissions: p, dispute } = data;
  const active = ACTIVE.includes(ticket.status);
  const others = viewers.filter((v) => v.adminId !== me.adminId);
  const placeholderValues = {
    customerName: (ticket.requester?.name || ticket.customerName || '').split(' ')[0] || undefined,
    ticketNumber: ticket.ticketNumber,
    orderNumber: ticket.context?.orderNumber,
    bookingNumber: ticket.context?.bookingNumber,
  };
  const close = () => setDialog(null);
  const common = { ticket, meta, caps, run, onClose: close };

  // Actions this agent may take right now (server-computed permissions).
  const actions = [
    p.canTake && !ticket.mergedInto && { id: 'take', label: 'Assign to me', icon: 'person-add-outline' },
    p.canAssign && !ticket.mergedInto && { id: 'assign', label: ticket.assignedAgent ? 'Reassign' : 'Assign', icon: 'people-outline' },
    p.canAssign && ticket.assignedAgent && !ticket.mergedInto && { id: 'unassign', label: 'Unassign', icon: 'person-remove-outline' },
    p.canPriority && active && { id: 'priority', label: 'Change priority', icon: 'flag-outline' },
    p.canWork && active && { id: 'status', label: 'Change status', icon: 'swap-horizontal-outline' },
    p.canEscalate && active && { id: 'escalate', label: ticket.escalation?.active ? 'Escalate further' : 'Escalate', icon: 'arrow-up-circle-outline' },
    p.canResolveEscalation && { id: 'resolveEscalation', label: 'Resolve escalation', icon: 'checkmark-done-outline' },
    p.canOpenDispute && active && !ticket.mergedInto && { id: 'dispute', label: 'Open dispute', icon: 'git-compare-outline' },
    p.canMerge && active && ticket.type !== 'dispute' && !ticket.mergedInto && { id: 'merge', label: 'Merge into another ticket', icon: 'git-merge-outline' },
    p.canResolve && (active || (ticket.status === 'resolved' && caps.has('dispute.override'))) && { id: 'resolve', label: ticket.status === 'resolved' ? 'Override decision' : ticket.type === 'dispute' ? 'Record decision' : 'Resolve', icon: 'checkmark-circle-outline' },
    p.canClose && ticket.status !== 'closed' && !ticket.mergedInto && { id: 'close', label: 'Close ticket', icon: 'lock-closed-outline', danger: true },
    p.canReopen && ['resolved', 'closed'].includes(ticket.status) && !ticket.mergedInto && { id: 'reopen', label: 'Reopen', icon: 'lock-open-outline' },
  ].filter(Boolean);
  const pickAction = (a) => {
    setActionsOpen(false);
    if (a.id === 'take') quick('take', (rev) => supportApi.assign(ticket._id, { adminId: me.adminId, expectedRev: rev }));
    else setTimeout(() => setDialog(a.id), 250); // let the actions sheet close first
  };

  const panelTabs = [
    { id: 'details', label: 'Details' },
    { id: 'transaction', label: 'Transaction' },
    ...(dispute ? [{ id: 'dispute', label: 'Dispute', count: dispute.evidenceCount }] : []),
    { id: 'refunds', label: 'Refunds' },
    { id: 'related', label: 'Related', count: related.data?.possibleDuplicates?.length || 0 },
    { id: 'activity', label: 'Activity' },
  ];
  const tabs = wide ? panelTabs : [{ id: 'conversation', label: 'Conversation', count: ticket.unreadCount || 0 }, ...panelTabs];
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const panelProps = { ticket, dispute, meta, caps, me, permissions: p, run, onChanged: loadTicket };
  const panel = (which) => (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {which === 'details' ? <DetailsPanel ticket={ticket} meta={meta} /> : null}
      {which === 'transaction' ? <TransactionPanel ticket={ticket} /> : null}
      {which === 'dispute' && dispute ? <DisputePanel {...panelProps} /> : null}
      {which === 'refunds' ? <RefundsPanel {...panelProps} /> : null}
      {which === 'related' ? <RelatedPanel related={related} /> : null}
      {which === 'activity' ? <ActivityPanel ticket={ticket} /> : null}
    </ScrollView>
  );
  const conversation = (
    <View style={{ flex: 1 }}>
      <ChannelFilter ticket={ticket} value={filter} onChange={setFilter} counts={counts} />
      <MessageList ticket={ticket} messages={messages} hasMore={msgState.hasMore} loadingOlder={msgState.loadingOlder}
        onLoadOlder={() => loadMessages(msgState.cursor)} filter={filter} typing={typing}
        error={!messages.length ? msgState.error : null} onRetry={() => loadMessages(null)} />
      <Composer ticket={ticket} permissions={p} meta={meta} me={me} placeholderValues={placeholderValues}
        onSent={(r) => { if (r?.message) setMessages((list) => mergeMessages(list, [r.message])); if (r?.ticket?.rev !== revRef.current) scheduleReload(); }} />
    </View>
  );
  // On phones, while the keyboard is up, fold the header down to the subject
  // line + Actions so the conversation keeps enough room to read.
  const compact = !wide && kb.visible;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        {compact ? null : (
          <View style={styles.pills}>
            <Text style={styles.number}>{ticket.ticketNumber}</Text>
            <TypePill ticket={ticket} /><StatusPill ticket={ticket} /><PriorityPill priority={ticket.priority} /><SlaPill sla={ticket.sla} /><EscalationPill escalation={ticket.escalation} />
            {ticket.sharedThread ? <Badge tone="info">Shared thread open</Badge> : null}
          </View>
        )}
        <View style={[styles.titleRow, compact && { alignItems: 'center' }]}>
          <Text style={[styles.subject, compact && styles.subjectCompact]} numberOfLines={compact ? 1 : 2}>
            {compact ? `${ticket.ticketNumber} · ` : ''}{ticket.subject}
          </Text>
          <Button size="sm" variant="primary" icon="ellipsis-horizontal" label="Actions" busy={busy === 'take'} onPress={() => setActionsOpen(true)}
            accessibilityLabel={`Ticket actions, ${actions.length} available`} />
        </View>
        {compact ? null : (
          <Text style={styles.meta} numberOfLines={2}>
            {ticket.requester?.name || ticket.customerName} · {ticket.customerType === 'vendor' ? 'Store' : 'User'} · {labelFrom(meta.categories[ticket.customerType], ticket.category)}
            {ticket.counterparty ? ` · vs ${ticket.counterparty.name || ticket.counterparty.type}${ticket.counterparty.active ? '' : ' (not in case)'}` : ''}
            {' · '}{ticket.assignedAgentName ? `Assigned to ${ticket.assignedAgentName}` : 'Unassigned'} · opened {timeAgo(ticket.createdAt)}
          </Text>
        )}
        {others.length ? (
          <View style={styles.viewingRow} accessibilityLiveRegion="polite">
            <Ionicons name="eye-outline" size={14} color={colors.warning} style={{ marginTop: 1 }} />
            <Text style={styles.viewing} numberOfLines={2}>
              Also viewing: {others.map((v) => `${v.name}${v.active ? '' : ' (away)'}`).join(', ')}
              {ticket.assignedAgent && ticket.assignedAgent !== me.adminId ? ' — coordinate before replying.' : ''}
            </Text>
          </View>
        ) : null}
        {ticket.mergedInto ? (
          <Pressable onPress={() => router.replace(`/support/${ticket.mergedInto.ticketId}`)} accessibilityRole="link">
            <Text style={styles.merged}>Merged into {ticket.mergedInto.ticketNumber} — tap to open it.</Text>
          </Pressable>
        ) : null}
        <ErrorBanner message={notice} onDismiss={() => setNotice(null)} />
      </View>

      <View ref={bodyRef} collapsable={false} onLayout={kb.onLayout} style={{ flex: 1, paddingBottom: kb.overlap }}>
        {wide ? (
          <View style={styles.columns}>
            <View style={[styles.column, { flex: 1.5 }]}>{conversation}</View>
            <View style={{ flex: 1 }}>
              <Segmented tabs={tabs} value={current} onChange={setTab} />
              {panel(current)}
            </View>
          </View>
        ) : (
          <>
            {compact ? null : <Segmented tabs={tabs} value={current} onChange={setTab} />}
            {current === 'conversation' ? conversation : panel(current)}
          </>
        )}
      </View>

      <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Ticket actions">
        {actions.length ? actions.map((a) => (
          <Pressable key={a.id} style={styles.actionRow} onPress={() => pickAction(a)} accessibilityRole="button">
            <Ionicons name={a.icon} size={20} color={a.danger ? colors.danger : colors.primary} />
            <Text style={[styles.actionLabel, a.danger && { color: colors.danger }]}>{a.label}</Text>
          </Pressable>
        )) : <Text style={styles.meta}>No actions are available to your role on this ticket.</Text>}
        <Pressable style={styles.actionRow} onPress={() => { setActionsOpen(false); loadTicket(); loadMessages(null); related.reload(); }} accessibilityRole="button">
          <Ionicons name="refresh" size={20} color={colors.textMuted} />
          <Text style={styles.actionLabel}>Refresh</Text>
        </Pressable>
      </Sheet>

      <AssignDialog {...common} open={dialog === 'assign'} />
      <ConfirmDialog open={dialog === 'unassign'} onClose={close} title="Unassign this ticket?" message="It returns to the team queue and the SLA keeps running." confirmLabel="Unassign"
        onConfirm={() => run((rev) => supportApi.assign(ticket._id, { adminId: null, expectedRev: rev }))} />
      <PriorityDialog {...common} open={dialog === 'priority'} />
      <StatusDialog {...common} open={dialog === 'status'} />
      <EscalateDialog {...common} open={dialog === 'escalate'} />
      <ResolveEscalationDialog {...common} open={dialog === 'resolveEscalation'} />
      <ResolveDialog {...common} dispute={dispute} open={dialog === 'resolve'} defaultCurrency={meta.policies?.refund?.currency} />
      <CloseDialog {...common} open={dialog === 'close'} />
      <ReopenDialog {...common} open={dialog === 'reopen'} />
      <MergeDialog {...common} related={related.data} open={dialog === 'merge'} />
      <OpenDisputeDialog {...common} open={dialog === 'dispute'} />
    </View>
  );
}

export default function SupportTicketScreen() {
  const params = useLocalSearchParams();
  const ticketId = String(Array.isArray(params.id) ? params.id[0] : params.id || '');
  return (
    <SupportGate title="Support ticket" edges={['top', 'bottom']}>
      {(meta, caps) => <Workspace key={ticketId} ticketId={ticketId} meta={meta} caps={caps} />}
    </SupportGate>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  number: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  subject: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  subjectCompact: { fontSize: 15 },
  meta: { fontSize: 12, color: colors.textMuted },
  viewingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  viewing: { flex: 1, fontSize: 12, color: colors.warning, fontWeight: '600' },
  merged: { fontSize: 13, color: colors.info, fontWeight: '700' },
  columns: { flex: 1, flexDirection: 'row' },
  column: { borderRightWidth: 1, borderRightColor: colors.border },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
