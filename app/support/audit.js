import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import SupportGate from '../../components/support/SupportGate';
import { Badge, Button, Input, Select, Sheet, StateView, Field } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { dateTime, humanize } from '../../lib/support/format';
import { supportApi, supportErrorMessage } from '../../lib/support/supportApi';

// Append-only support audit trail (supervisors and above). Entries cannot be
// edited or deleted — the server rejects any change to an audit record.
const RESOURCES = ['ticket', 'dispute', 'refund', 'config', 'agent', 'canned_reply', 'message'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function Audit({ caps }) {
  const router = useRouter();
  const [applied, setApplied] = useState({ resourceType: '', action: '', from: '', to: '' });
  const [draft, setDraft] = useState(applied);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({ cursor: null, hasMore: false });
  const [state, setState] = useState({ loading: true, error: null, more: false });
  const allowed = caps.has('audit.read');

  const load = useCallback(async (cursor) => {
    setState({ loading: !cursor, error: null, more: Boolean(cursor) });
    try {
      const params = Object.fromEntries(Object.entries({ ...applied, cursor }).filter(([, v]) => v));
      if (params.to) params.to = `${params.to}T23:59:59`;
      const r = await supportApi.audit(params);
      setRows((list) => (cursor ? [...list, ...r.entries] : r.entries));
      setPage({ cursor: r.nextCursor, hasMore: r.hasMore });
      setState({ loading: false, error: null, more: false });
    } catch (e) {
      setState({ loading: false, error: supportErrorMessage(e), more: false });
    }
  }, [applied]);
  useEffect(() => { if (allowed) load(null); }, [load, allowed]);

  if (!allowed) return <StateView empty title="The audit log is for supervisors and managers" text="Each ticket's own activity is in its Activity tab." />;
  const badDate = (draft.from && !DATE_RE.test(draft.from)) || (draft.to && !DATE_RE.test(draft.to));
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.bar}><Button size="sm" icon="options-outline" label="Filters" onPress={() => { setDraft(applied); setFiltersOpen(true); }} /></View>
      <FlatList
        data={rows}
        keyExtractor={(e) => e._id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        onEndReached={() => { if (page.hasMore && !state.more && !state.loading) load(page.cursor); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item: e }) => (
          <View style={styles.row}>
            <View style={styles.pills}>
              <Badge tone={/refund|override|merge|escalat/.test(e.action) ? 'warning' : 'neutral'}>{e.action}</Badge>
              <Text style={styles.muted}>{dateTime(e.at)}</Text>
            </View>
            <Text style={styles.body}>{e.actorName || humanize(e.actorType)}{e.actorRole ? ` · ${humanize(e.actorRole)}` : ''} · {humanize(e.resourceType)}</Text>
            {e.ticketNumber ? (
              <Pressable onPress={() => router.push(`/support/${e.ticketId}`)} accessibilityRole="link"><Text style={styles.link}>{e.ticketNumber}</Text></Pressable>
            ) : null}
            {e.previous ? <Text style={styles.mono}>− {JSON.stringify(e.previous)}</Text> : null}
            {e.next ? <Text style={styles.mono}>+ {JSON.stringify(e.next)}</Text> : null}
            {e.correlationId ? <Text style={styles.muted}>{e.correlationId}</Text> : null}
          </View>
        )}
        ListEmptyComponent={state.loading ? <StateView loading /> : state.error ? <StateView error={state.error} onRetry={() => load(null)} /> : <StateView empty title="No audit entries match" />}
        ListFooterComponent={state.more ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : null}
      />
      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Audit filters"
        footer={<><Button label="Reset" variant="ghost" onPress={() => setDraft({ resourceType: '', action: '', from: '', to: '' })} /><Button label="Apply" variant="primary" disabled={badDate} onPress={() => { setApplied({ ...draft, action: draft.action.trim() }); setFiltersOpen(false); }} /></>}>
        <Field label="Resource"><Select label="Resource" value={draft.resourceType} onChange={(v) => setDraft((d) => ({ ...d, resourceType: v }))} placeholder="Any resource" options={RESOURCES.map((r) => ({ value: r, label: humanize(r) }))} /></Field>
        <Field label="Action" hint="e.g. refund.approved"><Input value={draft.action} autoCapitalize="none" onChangeText={(v) => setDraft((d) => ({ ...d, action: v }))} /></Field>
        <Field label="From (YYYY-MM-DD)"><Input value={draft.from} onChangeText={(v) => setDraft((d) => ({ ...d, from: v }))} /></Field>
        <Field label="To (YYYY-MM-DD)"><Input value={draft.to} onChangeText={(v) => setDraft((d) => ({ ...d, to: v }))} /></Field>
      </Sheet>
    </View>
  );
}

export default function SupportAuditScreen() {
  return <SupportGate title="Support audit log">{(meta, caps) => <Audit caps={caps} />}</SupportGate>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md },
  row: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  body: { fontSize: 13, color: colors.text },
  muted: { fontSize: 11, color: colors.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  mono: { fontSize: 10, color: colors.textMuted },
});
