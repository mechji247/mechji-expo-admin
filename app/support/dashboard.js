import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import SupportGate from '../../components/support/SupportGate';
import { Badge, Button, Chip, ErrorBanner, Field, Input, SectionTitle, Select, Sheet, StateView, TONES } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { duration, humanize, labelFrom, timeAgo } from '../../lib/support/format';
import { supportApi, supportErrorMessage } from '../../lib/support/supportApi';

// Support operations dashboard. Every number is aggregated on the server
// (GET /admin/support/analytics); the app never downloads tickets to count.
//
// Layout: a fixed toolbar (period chips + Filters button + removable pills for
// active filters) above a scrolling body. All filter fields live in a bottom
// sheet with a draft state, so nothing refetches until the agent taps Apply.
const RANGES = [
  { value: 'today', label: 'Today', short: 'Today' },
  { value: '7d', label: 'Last 7 days', short: '7 days' },
  { value: '30d', label: 'Last 30 days', short: '30 days' },
  { value: 'custom', label: 'Custom range', short: 'Custom' },
];
const DEFAULT_FILTERS = { range: '7d', from: '', to: '', category: '', agent: '', audience: '', priority: '', status: '', team: '' };
// Filters counted on the Filters button / shown as pills (the period has its own chips).
const FILTER_KEYS = ['audience', 'category', 'priority', 'status', 'team', 'agent'];
const AUDIENCES = [{ value: 'user', label: 'Users' }, { value: 'vendor', label: 'Vendors' }];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const optionLabel = (list, v) => (list || []).find((o) => (o.value ?? o.id) === v)?.label || humanize(v);

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function shortDate(s) {
  if (!isRealDate(s)) return s;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function rangeLabel(f) {
  if (f.range === 'custom') return isRealDate(f.from) && isRealDate(f.to) ? `${shortDate(f.from)} – ${shortDate(f.to)}` : 'Custom range';
  return RANGES.find((r) => r.value === f.range)?.label || 'Last 7 days';
}

function rangeError(f) {
  if (f.range !== 'custom') return null;
  if (!DATE_RE.test(f.from) || !DATE_RE.test(f.to)) return 'Enter both dates as YYYY-MM-DD.';
  if (!isRealDate(f.from) || !isRealDate(f.to)) return 'One of the dates is not a real calendar date.';
  if (f.from > f.to) return 'The start date must be on or before the end date.';
  return null;
}

const valueColor = (value, tone) => {
  if (!value) return colors.textMuted;
  return tone === 'neutral' ? colors.text : (TONES[tone] || TONES.neutral).fg;
};

/* ---------- presentational pieces ---------- */

function Tile({ title, value, note, tone = 'neutral', icon, onPress, big }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}: ${value ?? '—'}${note ? `, ${note}` : ''}`}
      style={({ pressed }) => [styles.tile, big && styles.tileBig, pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        {icon ? <View style={[styles.tileIcon, { backgroundColor: t.bg }]}><Ionicons name={icon} size={15} color={t.fg} /></View> : null}
        <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
      </View>
      <Text style={[styles.tileValue, big && styles.tileValueBig, { color: valueColor(value, tone) }]} numberOfLines={1}>{value ?? '—'}</Text>
      {note ? <Text style={styles.tileNote} numberOfLines={1}>{note}</Text> : null}
    </Pressable>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {subtitle ? <Text style={styles.panelSub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function QueueRow({ label, note, value, tone = 'neutral', onPress, last }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value ?? '—'}${note ? `, ${note}` : ''}`}
      style={({ pressed }) => [styles.qRow, !last && styles.divider, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.qLabel} numberOfLines={1}>{label}</Text>
        {note ? <Text style={styles.qNote} numberOfLines={1}>{note}</Text> : null}
      </View>
      <Text style={[styles.qValue, { color: valueColor(value, tone) }]}>{value ?? '—'}</Text>
      <Ionicons name="chevron-forward" size={16} color={onPress ? colors.textMuted : 'transparent'} />
    </Pressable>
  );
}

function SectionHead({ title, meta }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.h2} accessibilityRole="header">{title}</Text>
      {meta ? <Text style={styles.sectionMeta} numberOfLines={1}>{meta}</Text> : null}
    </View>
  );
}

/* ---------- screen ---------- */

function Dashboard({ meta, caps }) {
  const router = useRouter();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [draftError, setDraftError] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [agents, setAgents] = useState([]);
  const [reload, setReload] = useState(0);
  const allowed = caps.has('analytics.read');

  useEffect(() => { if (allowed) supportApi.agents().then((r) => setAgents(r.agents || [])).catch(() => {}); }, [allowed]);
  useEffect(() => {
    if (!allowed) return undefined;
    if (rangeError(filters)) return undefined;
    let cancelled = false;
    setLoading(true); setError(null);
    const params = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && (filters.range === 'custom' || !['from', 'to'].includes(k))));
    supportApi.analytics(params)
      .then((d) => { if (!cancelled) { setData(d); setUpdatedAt(Date.now()); } })
      .catch((e) => { if (!cancelled) setError(supportErrorMessage(e, 'Could not load support analytics.')); })
      .finally(() => { if (!cancelled) { setLoading(false); setPulling(false); } });
    return () => { cancelled = true; };
  }, [filters, allowed, reload]);

  const categories = useMemo(() => ['user', 'vendor'].flatMap((aud) => (meta.categories[aud] || []).map((c) => ({ value: `${aud}:${c.id}`, label: `${aud === 'user' ? 'User' : 'Vendor'} · ${c.label}` }))), [meta]);
  const agentOptions = useMemo(() => agents.map((a) => ({ value: a.adminId, label: a.name })), [agents]);

  if (!allowed) return <StateView empty title="The dashboard is for senior agents and above" text="Your role can work tickets from the inbox." />;

  const go = (q) => router.push(`/support?${q}`);
  const refresh = () => { setPulling(true); setReload((n) => n + 1); };

  // Sheet (draft) handlers — nothing is fetched until Apply.
  const openSheet = (overrides = {}) => { setDraft({ ...filters, ...overrides }); setDraftError(null); setSheetOpen(true); };
  const setD = (k) => (v) => { setDraftError(null); setDraft((d) => ({ ...d, [k]: v })); };
  const applyDraft = () => {
    const err = rangeError(draft);
    if (err) { setDraftError(err); return; }
    setFilters(draft);
    setSheetOpen(false);
  };
  const resetDraft = () => { setDraft(DEFAULT_FILTERS); setDraftError(null); };

  // On-screen summary of what's applied.
  const pillLabel = (k) => {
    switch (k) {
      case 'audience': return optionLabel(AUDIENCES, filters.audience);
      case 'category': return labelFrom(meta.categories[filters.audience], filters.category);
      case 'priority': return `${humanize(filters.priority)} priority`;
      case 'status': return optionLabel(meta.statuses, filters.status);
      case 'team': return optionLabel(meta.teams, filters.team);
      case 'agent': return agentOptions.find((a) => a.value === filters.agent)?.label || 'Agent';
      default: return humanize(filters[k]);
    }
  };
  const activeKeys = FILTER_KEYS.filter((k) => filters[k]);
  const removeFilter = (k) => setFilters((f) => ({ ...f, [k]: '', ...(k === 'audience' ? { category: '' } : {}) }));
  const clearFilters = () => setFilters((f) => ({ ...DEFAULT_FILTERS, range: f.range, from: f.from, to: f.to }));

  const c = data?.current || {};
  const p = data?.period || {};
  const q = data?.quality || {};
  const byCategory = [...(data?.byCategory || [])].sort((a, b) => b.count - a.count);
  const maxCategory = Math.max(1, ...byCategory.map((r) => r.count || 0));
  const byAgent = data?.byAgent || [];
  const draftCategories = draft.audience ? categories.filter((o) => o.value.startsWith(`${draft.audience}:`)) : categories;

  const queue = [
    { label: 'In progress', note: 'Being worked', value: c.inProgress, tone: 'info', onPress: () => go('view=in_progress') },
    { label: 'Assigned', note: 'Active with an agent', value: c.assigned, tone: 'info' },
    { label: 'Waiting for support', note: 'We owe a reply', value: c.waitingSupport, tone: c.waitingSupport ? 'warning' : 'success', onPress: () => go('view=waiting_support') },
    { label: 'Waiting for user', note: 'Customer to reply', value: c.waitingUser, onPress: () => go('view=waiting_user') },
    { label: 'Waiting for vendor', note: 'Store to reply', value: c.waitingVendor, onPress: () => go('view=waiting_vendor') },
    { label: 'High priority', note: 'High + urgent', value: c.highPriority, tone: c.highPriority ? 'error' : 'success', onPress: () => go('sort=priority') },
    { label: 'Disputed', note: 'Active disputes', value: c.disputed, tone: 'warning', onPress: () => router.push('/support/disputes') },
    { label: 'Reopened', note: 'Reopened right now', value: c.reopened, tone: 'warning' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed toolbar: period quick-picks, Filters button, active filter pills */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.periodRow}>
            {RANGES.map((r) => (
              <Chip
                key={r.value}
                label={r.value === 'custom' && filters.range === 'custom' ? rangeLabel(filters) : r.short}
                active={filters.range === r.value}
                onPress={() => (r.value === 'custom' ? openSheet({ range: 'custom' }) : setFilters((f) => ({ ...f, range: r.value })))}
              />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => openSheet()}
            accessibilityRole="button"
            accessibilityLabel={activeKeys.length ? `Filters, ${activeKeys.length} applied` : 'Filters'}
            style={({ pressed }) => [styles.filterBtn, activeKeys.length > 0 && styles.filterBtnActive, pressed && styles.pressed]}
          >
            <Ionicons name="options-outline" size={16} color={activeKeys.length ? colors.primary : colors.text} />
            <Text style={[styles.filterText, activeKeys.length > 0 && { color: colors.primary }]}>Filters</Text>
            {activeKeys.length ? <View style={styles.countBubble}><Text style={styles.countText}>{activeKeys.length}</Text></View> : null}
          </Pressable>
        </View>
        {activeKeys.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {activeKeys.map((k) => (
              <Pressable key={k} onPress={() => removeFilter(k)} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                accessibilityRole="button" accessibilityLabel={`Remove filter ${pillLabel(k)}`}>
                <Text style={styles.pillText} numberOfLines={1}>{pillLabel(k)}</Text>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
            <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear all filters">
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pulling && loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {!data ? (
          loading ? <StateView loading /> : error ? <StateView error={error} onRetry={() => setReload((n) => n + 1)} /> : null
        ) : (
          <>
            {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
            <View style={[styles.body, loading && !pulling && styles.stale]}>
              {/* Right now */}
              <SectionHead title="Right now" meta={loading ? 'Updating…' : updatedAt ? `Updated ${timeAgo(new Date(updatedAt).toISOString()).toLowerCase()}` : null} />
              <View style={styles.grid}>
                <Tile big icon="file-tray-full-outline" title="Open" value={c.open} note="Open, assigned, reopened" tone="warning" onPress={() => go('view=open')} />
                <Tile big icon="person-add-outline" title="Unassigned" value={c.unassigned} note="Needs an owner" tone={c.unassigned ? 'warning' : 'success'} onPress={() => go('view=unassigned')} />
                <Tile big icon="trending-up-outline" title="Escalated" value={c.escalated} note="Open escalations" tone={c.escalated ? 'error' : 'success'} onPress={() => go('view=escalated')} />
                <Tile big icon="timer-outline" title="SLA breached" value={c.slaBreached} note={`${c.slaAtRisk ?? 0} approaching`} tone={c.slaBreached ? 'error' : 'success'} onPress={() => go('sla=breached')} />
              </View>
              <Panel title="Queue">
                {queue.map((row, i) => <QueueRow key={row.label} {...row} last={i === queue.length - 1} />)}
              </Panel>

              {/* Selected period */}
              <SectionHead title={rangeLabel(filters)} meta={activeKeys.length ? `${activeKeys.length} filter${activeKeys.length > 1 ? 's' : ''} applied` : 'All tickets'} />
              <View style={styles.grid}>
                <Tile title="Created" value={p.created} tone="info" />
                <Tile title="Resolved" value={p.resolved} tone="success" />
                <Tile title="Closed" value={p.closed} />
                <Tile title="Reopened" value={p.reopened} tone="warning" />
                <Tile title="SLA breaches" value={p.slaBreached} tone={p.slaBreached ? 'error' : 'success'} />
              </View>
              <View style={styles.grid}>
                <Tile big icon="chatbubble-ellipses-outline" title="Avg first response" value={duration(p.avgFirstResponseMs)} note={`${p.respondedCount || 0} answered`} tone="info" />
                <Tile big icon="hourglass-outline" title="Avg resolution" value={duration(p.avgResolutionMs)} note={`${p.resolvedCount || 0} resolved`} tone="info" />
              </View>

              <Panel title="By category" subtitle={byCategory.length ? `${byCategory.reduce((s, r) => s + (r.count || 0), 0)} tickets` : null}>
                {byCategory.length ? byCategory.map((r, i) => (
                  <View key={`${r.audience}-${r.category}`} style={[styles.barRow, i < byCategory.length - 1 && styles.divider]}>
                    <View style={styles.barTop}>
                      <Badge tone={r.audience === 'vendor' ? 'brand' : 'info'}>{r.audience === 'vendor' ? 'Vendor' : 'User'}</Badge>
                      <Text style={styles.barLabel} numberOfLines={1}>{labelFrom(meta.categories[r.audience], r.category)}</Text>
                      <Text style={styles.barValue}>{r.count}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(3, Math.round(((r.count || 0) / maxCategory) * 100))}%` }]} />
                    </View>
                  </View>
                )) : <StateView empty title="No tickets in this period" />}
              </Panel>

              <Panel title="By agent">
                {byAgent.length ? (
                  <>
                    <View style={styles.thRow}>
                      <Text style={[styles.th, { flex: 1 }]}>Agent</Text>
                      <Text style={[styles.th, styles.numCol]}>Assigned</Text>
                      <Text style={[styles.th, styles.numCol]}>Resolved</Text>
                    </View>
                    {byAgent.map((r, i) => (
                      <View key={r.adminId || i} style={[styles.tdRow, i < byAgent.length - 1 && styles.divider]}>
                        <Text style={styles.tdName} numberOfLines={1}>{r.name || 'Unknown agent'}</Text>
                        <Text style={[styles.tdNum, styles.numCol]}>{r.assigned ?? 0}</Text>
                        <Text style={[styles.tdNum, styles.numCol, { color: r.resolved ? colors.success : colors.textMuted }]}>{r.resolved ?? 0}</Text>
                      </View>
                    ))}
                  </>
                ) : <StateView empty title="No assigned tickets in this period" />}
              </Panel>

              <Panel title="Quality">
                <View style={styles.qualityGrid}>
                  {[
                    ['Attachments rejected', q.attachmentsRejected, 'warning'],
                    ['Upload failures', q.attachmentUploadFailures, 'error'],
                    ['FAQ helpful', q.faqHelpful, 'success'],
                    ['FAQ not helpful', q.faqNotHelpful, 'warning'],
                  ].map(([label, value, tone]) => (
                    <View key={label} style={styles.qualityCell}>
                      <Text style={[styles.qualityValue, { color: valueColor(value, tone) }]}>{value ?? 0}</Text>
                      <Text style={styles.qualityLabel} numberOfLines={1}>{label}</Text>
                    </View>
                  ))}
                </View>
              </Panel>
            </View>
          </>
        )}
      </ScrollView>

      {/* Filters modal */}
      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Dashboard filters"
        footer={<><Button label="Reset" variant="ghost" onPress={resetDraft} /><Button label="Apply" variant="primary" onPress={applyDraft} /></>}
      >
        <SectionTitle>Period</SectionTitle>
        <View style={styles.chipWrap}>
          {RANGES.map((r) => <Chip key={r.value} label={r.label} active={draft.range === r.value} onPress={() => setD('range')(r.value)} />)}
        </View>
        {draft.range === 'custom' ? (
          <View style={styles.grid2}>
            <View style={{ flex: 1 }}>
              <Field label="From" hint="YYYY-MM-DD">
                <Input value={draft.from} onChangeText={setD('from')} placeholder="2026-09-01" maxLength={10} keyboardType="numbers-and-punctuation" autoCorrect={false} accessibilityLabel="From date" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="To" hint="YYYY-MM-DD">
                <Input value={draft.to} onChangeText={setD('to')} placeholder="2026-09-25" maxLength={10} keyboardType="numbers-and-punctuation" autoCorrect={false} accessibilityLabel="To date" />
              </Field>
            </View>
          </View>
        ) : null}
        {draftError ? <ErrorBanner message={draftError} /> : null}

        <SectionTitle>Tickets</SectionTitle>
        <Field label="Customer type">
          <Select label="Customer type" value={draft.audience} placeholder="Users and vendors" options={AUDIENCES}
            onChange={(v) => setDraft((d) => ({ ...d, audience: v, category: '' }))} />
        </Field>
        <Field label="Category">
          <Select label="Category" value={draft.category && draft.audience ? `${draft.audience}:${draft.category}` : ''} placeholder="All categories" options={draftCategories}
            onChange={(v) => { const [aud, cat] = String(v).split(':'); setDraft((d) => (cat ? { ...d, audience: aud, category: cat } : { ...d, category: '' })); }} />
        </Field>
        <Field label="Priority">
          <Select label="Priority" value={draft.priority} placeholder="All priorities" options={meta.priorities.map((x) => ({ value: x, label: humanize(x) }))} onChange={setD('priority')} />
        </Field>
        <Field label="Status">
          <Select label="Status" value={draft.status} placeholder="All statuses" options={meta.statuses} onChange={setD('status')} />
        </Field>

        <SectionTitle>Ownership</SectionTitle>
        <Field label="Team">
          <Select label="Team" value={draft.team} placeholder="All teams" options={meta.teams} onChange={setD('team')} />
        </Field>
        <Field label="Support agent">
          <Select label="Support agent" value={draft.agent} placeholder="All agents" options={agentOptions} onChange={setD('agent')} />
        </Field>
      </Sheet>
    </View>
  );
}

export default function SupportDashboardScreen() {
  return (
    <SupportGate title="Support dashboard">
      {(meta, caps) => <Dashboard meta={meta} caps={caps} />}
    </SupportGate>
  );
}

const styles = StyleSheet.create({
  // toolbar
  toolbarWrap: { backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  periodRow: { gap: 6, paddingRight: spacing.xs },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.text },
  countBubble: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800', color: colors.surface },
  pillRow: { alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingLeft: 10, paddingRight: 7, paddingVertical: 5 },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text, maxWidth: 180 },
  clearAll: { fontSize: 12, fontWeight: '700', color: colors.primary, paddingHorizontal: 4 },
  pressed: { opacity: 0.7 },

  // body
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  body: { gap: spacing.md },
  stale: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  h2: { fontSize: 17, fontWeight: '800', color: colors.text },
  sectionMeta: { flexShrink: 1, fontSize: 12, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // tiles
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  tileBig: { flexBasis: '45%', minWidth: 140, padding: 14, gap: 6 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tileValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileValueBig: { fontSize: 28 },
  tileNote: { fontSize: 11, color: colors.textMuted },

  // panels
  panel: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  panelTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  panelSub: { fontSize: 12, color: colors.textMuted },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },

  // queue rows
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  qLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  qNote: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  qValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },

  // category bars
  barRow: { paddingHorizontal: spacing.md, paddingVertical: 10, gap: 8 },
  barTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { flex: 1, fontSize: 13, color: colors.text },
  barValue: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.background, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },

  // agent table
  thRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.background },
  th: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  tdRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 11 },
  tdName: { flex: 1, fontSize: 14, color: colors.text },
  tdNum: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  numCol: { width: 76, textAlign: 'right' },

  // quality
  qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  qualityCell: { flexBasis: '50%', flexGrow: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 2 },
  qualityValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  qualityLabel: { fontSize: 12, color: colors.textMuted },

  // sheet
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid2: { flexDirection: 'row', gap: spacing.sm },
});
