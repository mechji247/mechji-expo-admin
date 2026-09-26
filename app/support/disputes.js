import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import SupportGate from '../../components/support/SupportGate';
import { EscalationPill, PriorityPill, SlaPill, StatusPill } from '../../components/support/badges';
import { Badge, Select, StateView } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { humanize, labelFrom, timeAgo } from '../../lib/support/format';
import { supportApi, supportErrorMessage } from '../../lib/support/supportApi';
import { onSupportEvent } from '../../lib/support/supportSocket';

// Dispute cases the agent can see (same visibility scope as tickets).
function Disputes({ meta }) {
  const router = useRouter();
  const [filters, setFilters] = useState({ status: '', kind: '' });
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({ cursor: null, hasMore: false });
  const [state, setState] = useState({ loading: true, error: null, more: false });

  const load = useCallback(async (cursor) => {
    setState({ loading: !cursor, error: null, more: Boolean(cursor) });
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, cursor }).filter(([, v]) => v));
      const r = await supportApi.disputes(params);
      setRows((list) => (cursor ? [...list, ...r.disputes] : r.disputes));
      setPage({ cursor: r.nextCursor, hasMore: r.hasMore });
      setState({ loading: false, error: null, more: false });
    } catch (e) {
      setState({ loading: false, error: supportErrorMessage(e, 'Could not load disputes.'), more: false });
    }
  }, [filters]);

  useEffect(() => { load(null); }, [load]);
  useEffect(() => onSupportEvent('support:ticket:updated', ({ ticket } = {}) => {
    if (ticket?.type !== 'dispute') return;
    setRows((list) => list.map((r) => (r.ticket._id === ticket._id ? { ...r, ticket: { ...r.ticket, ...ticket } } : r)));
  }), []);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filters}>
        <View style={{ flex: 1 }}><Select label="Case status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} placeholder="Any status" options={meta.disputeStatuses.map((s) => ({ value: s, label: humanize(s) }))} /></View>
        <View style={{ flex: 1 }}><Select label="Dispute kind" value={filters.kind} onChange={(v) => setFilters((f) => ({ ...f, kind: v }))} placeholder="Any kind" options={meta.disputeKinds} /></View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.ticket._id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(null)} tintColor={colors.primary} />}
        onEndReached={() => { if (page.hasMore && !state.more && !state.loading) load(page.cursor); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item: { ticket: t, dispute: d } }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/support/${t._id}`)} accessibilityRole="button" accessibilityLabel={`${t.ticketNumber}, ${d?.kindLabel || 'dispute'}`}>
            <View style={styles.pills}>
              <Text style={styles.muted}>{t.ticketNumber}</Text>
              <EscalationPill escalation={t.escalation} />
              {t.unreadCount ? <Badge tone="info">{`${t.unreadCount} new`}</Badge> : null}
              <Text style={[styles.muted, { marginLeft: 'auto' }]}>{timeAgo(t.lastActivityAt)}</Text>
            </View>
            <Text style={styles.subject} numberOfLines={1}>{t.subject}</Text>
            <Text style={styles.muted}>{d?.kindLabel || '—'} · {t.customerName || '—'} ({t.customerType}) vs {t.counterparty?.name || '—'}{t.counterparty && !t.counterparty.active ? ' (not invited)' : ''}{t.sharedThread ? ' · shared thread' : ''}</Text>
            <View style={styles.pills}>
              <Badge tone={d?.status === 'resolved' || d?.status === 'closed' ? 'success' : 'warning'}>{humanize(d?.status)}</Badge>
              <StatusPill ticket={t} /><PriorityPill priority={t.priority} /><SlaPill sla={t.sla} />
              <Badge>{`${d?.evidenceCount ?? 0} evidence`}</Badge>
            </View>
            {d?.resolution ? <Text style={styles.muted}>Decision: {labelFrom(meta.resolutionOutcomes, d.resolution.outcome)}</Text> : null}
            <Text style={styles.muted}>{t.assignedAgentName || 'Unassigned'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={state.loading ? <StateView loading /> : state.error ? <StateView error={state.error} onRetry={() => load(null)} />
          : <StateView empty title="No disputes" text="Open a dispute from a ticket when a user and a store disagree about an order, booking or payment." />}
        ListFooterComponent={state.more ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : state.error && rows.length ? <StateView error={state.error} onRetry={() => load(page.cursor)} /> : null}
      />
    </View>
  );
}

export default function SupportDisputesScreen() {
  return <SupportGate title="Disputes">{(meta) => <Disputes meta={meta} />}</SupportGate>;
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  row: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  subject: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
});
