import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import SupportGate from '../../components/support/SupportGate';
import { ConfirmDialog } from '../../components/support/TicketDialogs';
import { Badge, Button, CheckRow, ErrorBanner, Field, Input, Sheet, StateView } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { labelFrom } from '../../lib/support/format';
import { supportApi, supportErrorMessage } from '../../lib/support/supportApi';

// Canned replies are templates only: an agent inserts one into the composer,
// edits it and sends it themselves — nothing is ever sent automatically.
const EMPTY = { title: '', slug: '', body: '', teams: [], audience: ['user', 'vendor'], isActive: true };

function Editor({ open, onClose, initial, meta, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setF(initial ? { ...EMPTY, ...initial } : EMPTY); setError(null); } }, [open, initial]);
  const toggle = (key, value) => setF((x) => ({ ...x, [key]: x[key].includes(value) ? x[key].filter((v) => v !== value) : [...x[key], value] }));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const body = { title: f.title, body: f.body, teams: f.teams, audience: f.audience, isActive: f.isActive, ...(initial ? {} : { slug: f.slug || undefined }) };
      if (initial) await supportApi.updateCanned(initial._id, body); else await supportApi.createCanned(body);
      onSaved();
      onClose();
    } catch (e) { setError(supportErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={open} onClose={onClose} title={initial ? 'Edit canned reply' : 'New canned reply'}
      footer={<><Button label="Cancel" onPress={onClose} disabled={busy} /><Button label="Save" variant="primary" busy={busy} disabled={!f.title.trim() || !f.body.trim() || !f.audience.length} onPress={save} /></>}>
      <ErrorBanner message={error} />
      <Field label="Title" required><Input value={f.title} onChangeText={(v) => setF((x) => ({ ...x, title: v }))} maxLength={120} /></Field>
      {!initial ? <Field label="Slug" hint="Optional; generated from the title."><Input value={f.slug} autoCapitalize="none" onChangeText={(v) => setF((x) => ({ ...x, slug: v }))} maxLength={80} /></Field> : null}
      <Field label="Message" required hint={`Placeholders: ${meta.cannedPlaceholders.map((p) => `{{${p}}}`).join(', ')} — filled in when inserted; the agent reviews before sending.`}>
        <Input multiline value={f.body} onChangeText={(v) => setF((x) => ({ ...x, body: v }))} maxLength={4000} style={{ minHeight: 140 }} />
      </Field>
      <Text style={styles.label}>Teams (none = everyone)</Text>
      {meta.teams.map((t) => <CheckRow key={t.id} label={t.label} checked={f.teams.includes(t.id)} onToggle={() => toggle('teams', t.id)} />)}
      <Text style={styles.label}>For</Text>
      <CheckRow label="Users" checked={f.audience.includes('user')} onToggle={() => toggle('audience', 'user')} />
      <CheckRow label="Vendors" checked={f.audience.includes('vendor')} onToggle={() => toggle('audience', 'vendor')} />
      <CheckRow label="Active" checked={f.isActive} onToggle={() => setF((x) => ({ ...x, isActive: !x.isActive }))} />
    </Sheet>
  );
}

function Canned({ meta, caps }) {
  const manage = caps.has('canned.manage');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const load = useCallback(() => {
    setError(null);
    supportApi.cannedReplies(manage ? { includeInactive: 'true' } : {}).then((r) => setItems(r.cannedReplies)).catch((e) => setError(supportErrorMessage(e)));
  }, [manage]);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      {manage ? <View style={styles.bar}><Button label="New reply" icon="add" variant="primary" size="sm" onPress={() => setEditing({})} /></View> : null}
      <FlatList
        data={items || []}
        keyExtractor={(c) => c._id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item: c }) => (
          <View style={styles.row}>
            <View style={styles.pills}>
              <Text style={styles.title}>{c.title}</Text>
              {!c.isActive ? <Badge>Inactive</Badge> : null}
              {c.teams.map((t) => <Badge key={t} tone="info">{labelFrom(meta.teams, t)}</Badge>)}
              <Text style={styles.muted}>used {c.usageCount}×</Text>
            </View>
            <Text style={styles.body}>{c.body}</Text>
            {manage ? (
              <View style={styles.pills}>
                <Button size="sm" label="Edit" onPress={() => setEditing(c)} />
                <Button size="sm" variant="ghost" label="Delete" onPress={() => setDeleting(c)} />
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={error ? <StateView error={error} onRetry={load} /> : !items ? <StateView loading /> : <StateView empty title="No canned replies yet" />}
        ListFooterComponent={!manage ? <Text style={styles.muted}>Only support managers can change canned replies.</Text> : null}
      />
      <Editor open={Boolean(editing)} onClose={() => setEditing(null)} initial={editing?._id ? editing : null} meta={meta} onSaved={load} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Delete “${deleting?.title || ''}”?`} message="Agents will no longer be able to insert it. Consider deactivating it instead." confirmLabel="Delete" variant="danger"
        onConfirm={async () => { await supportApi.deleteCanned(deleting._id); load(); }} />
    </View>
  );
}

export default function SupportCannedRepliesScreen() {
  return <SupportGate title="Canned replies">{(meta, caps) => <Canned meta={meta} caps={caps} />}</SupportGate>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md },
  row: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  muted: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});
