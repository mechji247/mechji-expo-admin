import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import SupportGate from '../../components/support/SupportGate';
import { EscalationPill, PriorityPill, SlaPill, StatusPill, TypePill } from '../../components/support/badges';
import { Badge, Button, Chip, Field, Input, Select, Sheet, StateView } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { labelFrom, timeAgo } from '../../lib/support/format';
import { fetchInbox, fetchInboxCounts, selectInbox, selectInboxCounts } from '../../store/slices/supportDeskSlice';

// Support inbox — the same server-side views, filters, sorting, search and
// keyset pagination as the web desk (GET /admin/support/tickets). Rows update
// live from the /support-agents socket via SupportLiveBridge.
const SECTIONS = [
  { href: '/support/dashboard', label: 'Dashboard', icon: 'stats-chart-outline', cap: 'analytics.read' },
  { href: '/support/disputes', label: 'Disputes', icon: 'git-compare-outline' },
  { href: '/support/canned-replies', label: 'Canned replies', icon: 'chatbox-ellipses-outline' },
  { href: '/support/settings', label: 'Settings', icon: 'settings-outline' },
  { href: '/support/audit', label: 'Audit log', icon: 'document-text-outline', cap: 'audit.read' },
];
const FILTER_KEYS = ['priority', 'audience', 'category', 'team', 'sla', 'type'];

function TicketRow({ t, meta, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, t.unreadCount > 0 && styles.rowUnread, pressed && { opacity: 0.85 }]}
      accessibilityRole="button" accessibilityLabel={`${t.ticketNumber}, ${t.subject}, ${t.statusLabel}${t.unreadCount ? `, ${t.unreadCount} new` : ''}`}>
      <View style={styles.rowTop}>
        <Text style={styles.number}>{t.ticketNumber}</Text>
        <TypePill ticket={t} />
        <EscalationPill escalation={t.escalation} />
        {t.unreadCount ? <Badge tone="info">{`${t.unreadCount} new`}</Badge> : null}
        <Text style={styles.time}>{timeAgo(t.lastActivityAt)}</Text>
      </View>
      <Text style={[styles.subject, t.unreadCount > 0 && { fontWeight: '800' }]} numberOfLines={1}>{t.subject}</Text>
      {t.lastMessagePreview ? <Text style={styles.preview} numberOfLines={1}>{t.lastMessageBy === 'agent' ? 'Support: ' : ''}{t.lastMessagePreview}</Text> : null}
      <Text style={styles.meta} numberOfLines={1}>
        {t.customerName || '—'} · {t.customerType === 'vendor' ? 'Vendor' : 'User'} · {labelFrom(meta.categories[t.customerType], t.category)}
        {' · '}{t.assignedAgentName || 'Unassigned'}
      </Text>
      <View style={styles.pills}>
        <StatusPill ticket={t} />
        <PriorityPill priority={t.priority} />
        <SlaPill sla={t.sla} />
      </View>
    </Pressable>
  );
}

function Inbox({ meta, caps }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const inbox = useSelector(selectInbox);
  const counts = useSelector(selectInboxCounts);
  // Deep links from the dashboard (e.g. /support?view=escalated) seed the
  // first query only; after that the filters live in local state.
  const initial = useLocalSearchParams();
  const [params, setParams] = useState(() => {
    const p = { view: typeof initial.view === 'string' ? initial.view : 'all' };
    for (const k of ['sort', 'sla', 'priority', 'type', 'q']) if (typeof initial[k] === 'string' && initial[k]) p[k] = initial[k];
    return p;
  });
  const [query, setQuery] = useState(() => params.q || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const key = JSON.stringify(params);

  useEffect(() => { dispatch(fetchInbox({ params: JSON.parse(key) })); dispatch(fetchInboxCounts()); }, [dispatch, key]);
  const refresh = useCallback(() => { dispatch(fetchInbox({ params: JSON.parse(key) })); dispatch(fetchInboxCounts()); }, [dispatch, key]);
  const update = (changes) => setParams((p) => {
    const next = { ...p, ...changes };
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    if (!next.view) next.view = 'all';
    return next;
  });

  const categories = useMemo(() => ['user', 'vendor'].flatMap((aud) => (meta.categories[aud] || []).map((c) => ({ value: `${aud}:${c.id}`, label: `${aud === 'user' ? 'User' : 'Vendor'} · ${c.label}` }))), [meta]);
  const filterCount = FILTER_KEYS.filter((k) => params[k]).length + (params.sort ? 1 : 0);
  const sections = SECTIONS.filter((s) => !s.cap || caps.has(s.cap));

  const openFilters = () => { setDraft({ ...params }); setFiltersOpen(true); };
  const applyFilters = () => { setParams({ ...draft, view: params.view, q: params.q }); setFiltersOpen(false); };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <Input value={query} onChangeText={setQuery} placeholder="Ticket no., order ID, name, email, phone" returnKeyType="search" maxLength={80}
          onSubmitEditing={() => update({ q: query.trim() })} style={{ flex: 1 }} accessibilityLabel="Search tickets" />
        <Button icon="options-outline" label={filterCount ? String(filterCount) : undefined} onPress={openFilters} accessibilityLabel="Filters and sort" />
        <Button icon="grid-outline" onPress={() => setMenuOpen(true)} accessibilityLabel="Support sections" />
      </View>
      {params.q ? (
        <View style={styles.searchTag}>
          <Text style={styles.meta}>Results for “{params.q}”</Text>
          <Button size="sm" variant="ghost" label="Clear" onPress={() => { setQuery(''); update({ q: '' }); }} />
        </View>
      ) : null}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.views}>
          {meta.views.map((v) => (
            <Chip key={v.id} label={v.label} count={counts[v.id]} active={params.view === v.id}
              tone={v.id === 'escalated' ? 'error' : ['unassigned', 'waiting_support'].includes(v.id) ? 'warning' : undefined}
              onPress={() => update({ view: v.id })} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={inbox.tickets}
        keyExtractor={(t) => t._id}
        renderItem={({ item }) => <TicketRow t={item} meta={meta} onPress={() => router.push(`/support/${item._id}`)} />}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={inbox.status === 'loading' && inbox.tickets.length > 0} onRefresh={refresh} tintColor={colors.primary} />}
        onEndReached={() => { if (inbox.hasMore && inbox.status === 'succeeded') dispatch(fetchInbox({ params, more: true })); }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          inbox.status === 'loading' ? <StateView loading />
            : inbox.status === 'failed' ? <StateView error={inbox.error} onRetry={refresh} />
            : <StateView empty title={params.q ? 'No tickets match your search' : 'No tickets in this view'} text={params.q ? 'Search matches exact ticket numbers and IDs, names, emails and phone numbers.' : 'New tickets appear here automatically.'} />
        }
        ListFooterComponent={inbox.status === 'loadingMore' ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />
          : inbox.status === 'failed' && inbox.tickets.length ? <StateView error={inbox.error} onRetry={() => dispatch(fetchInbox({ params, more: true }))} /> : null}
      />

      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters and sort"
        footer={<><Button label="Reset" variant="ghost" onPress={() => setDraft({})} /><Button label="Apply" variant="primary" onPress={applyFilters} /></>}>
        <Field label="Sort"><Select label="Sort" value={draft.sort || 'last_activity'} placeholder={null} options={meta.sorts} onChange={(v) => setDraft((d) => ({ ...d, sort: v === 'last_activity' ? '' : v }))} /></Field>
        <Field label="Priority"><Select label="Priority" value={draft.priority || ''} placeholder="Any priority" options={meta.priorities.map((p) => ({ value: p, label: p }))} onChange={(v) => setDraft((d) => ({ ...d, priority: v }))} /></Field>
        <Field label="Customer type"><Select label="Customer type" value={draft.audience || ''} placeholder="Users and vendors" options={[{ value: 'user', label: 'Users' }, { value: 'vendor', label: 'Vendors' }]} onChange={(v) => setDraft((d) => ({ ...d, audience: v, category: '' }))} /></Field>
        <Field label="Category">
          <Select label="Category" value={draft.category && draft.audience ? `${draft.audience}:${draft.category}` : ''} placeholder="Any category" options={categories}
            onChange={(v) => { const [aud, cat] = String(v).split(':'); setDraft((d) => (cat ? { ...d, audience: aud, category: cat } : { ...d, category: '' })); }} />
        </Field>
        <Field label="Team"><Select label="Team" value={draft.team || ''} placeholder="Any team" options={meta.teams} onChange={(v) => setDraft((d) => ({ ...d, team: v }))} /></Field>
        <Field label="SLA"><Select label="SLA" value={draft.sla || ''} placeholder="Any SLA state" options={meta.slaStates.filter((s) => s !== 'none').map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} onChange={(v) => setDraft((d) => ({ ...d, sla: v }))} /></Field>
        <Field label="Type"><Select label="Type" value={draft.type || ''} placeholder="Tickets and disputes" options={[{ value: 'support', label: 'Support tickets' }, { value: 'dispute', label: 'Disputes' }]} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} /></Field>
      </Sheet>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={`${meta.me?.name || 'Support'} · ${meta.me?.supportRoleLabel || ''}`}>
        {sections.map((s) => (
          <Pressable key={s.href} style={styles.menuRow} accessibilityRole="button" onPress={() => { setMenuOpen(false); router.push(s.href); }}>
            <Ionicons name={s.icon} size={20} color={colors.primary} />
            <Text style={styles.menuLabel}>{s.label}</Text>
            {s.href === '/support/disputes' && counts.disputed ? <Badge tone="warning">{String(counts.disputed)}</Badge> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

export default function SupportInboxScreen() {
  return (
    <SupportGate title="Support inbox">
      {(meta, caps) => <Inbox meta={meta} caps={caps} />}
    </SupportGate>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  searchTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 4 },
  views: { gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  row: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  rowUnread: { borderColor: colors.info },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  number: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  time: { marginLeft: 'auto', fontSize: 11, color: colors.textMuted },
  subject: { fontSize: 15, fontWeight: '700', color: colors.text },
  preview: { fontSize: 13, color: colors.textMuted },
  meta: { fontSize: 12, color: colors.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
});
