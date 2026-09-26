import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import SupportGate from '../../components/support/SupportGate';
import { Badge, Button, Card, CheckRow, ErrorBanner, Field, Input, Segmented, Select, Sheet, StateView } from '../../components/support/ui';
import { colors, spacing } from '../../lib/constants/theme';
import { humanize, labelFrom, money } from '../../lib/support/format';
import { supportApi, supportErrorMessage } from '../../lib/support/supportApi';
import { refreshSupportMeta } from '../../store/slices/supportDeskSlice';

// Support settings — the same sections as the web desk. Everything is
// validated and permission-checked on the server; controls are disabled here
// when the agent's role cannot change them.

const Muted = ({ children }) => <Text style={styles.muted}>{children}</Text>;
const Saved = ({ show, text = 'Saved.' }) => (show ? <Text style={styles.saved} accessibilityLiveRegion="polite">{text}</Text> : null);

function MyStatus({ meta }) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const me = meta.me;
  const toggle = async () => {
    setBusy(true); setError(null);
    try { await supportApi.setAvailability(!me.isAvailable); dispatch(refreshSupportMeta()); } catch (e) { setError(supportErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card title="My support profile">
      <ErrorBanner message={error} />
      <Text style={styles.body}>Role: {me.supportRoleLabel} (admin role: {me.adminRole})</Text>
      <Text style={styles.body}>Teams: {me.teams?.length ? me.teams.map((t) => labelFrom(meta.teams, t)).join(', ') : 'All queues (generalist)'}</Text>
      <View style={styles.row}>
        <Badge tone={me.isAvailable ? 'success' : 'neutral'}>{me.isAvailable ? 'Available for new tickets' : 'Away'}</Badge>
        <Button size="sm" busy={busy} label={me.isAvailable ? 'Set away' : 'Set available'} onPress={toggle} />
      </View>
      <Text style={styles.label}>What my role can do ({me.capabilities.length})</Text>
      {me.capabilities.map((c) => <Muted key={c}>• {labelFrom(meta.capabilities, c)}</Muted>)}
    </Card>
  );
}

function Agents({ meta, caps }) {
  const dispatch = useDispatch();
  const manage = caps.has('agents.manage');
  const [agents, setAgents] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ supportRole: '', teams: [] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const load = useCallback(() => { setError(null); supportApi.agents().then((r) => setAgents(r.agents)).catch((e) => setError(supportErrorMessage(e))); }, []);
  useEffect(() => { load(); }, [load]);
  const myRank = meta.roles.findIndex((r) => r.id === meta.me.supportRole);
  const open = (a) => { setEditing(a); setForm({ supportRole: a.supportRole, teams: a.teams || [] }); setSaveError(null); };
  const save = async () => {
    setSaving(true); setSaveError(null);
    try {
      await supportApi.updateAgent(editing.adminId, form);
      if (editing.adminId === meta.me.adminId) dispatch(refreshSupportMeta());
      setEditing(null); load();
    } catch (e) { setSaveError(supportErrorMessage(e)); } finally { setSaving(false); }
  };
  if (error) return <StateView error={error} onRetry={load} />;
  if (!agents) return <StateView loading />;
  return (
    <View style={{ gap: spacing.sm }}>
      {!agents.length ? <StateView empty title="No admins have support access" text="Give an admin the Support role or support permissions in Admin team." /> : agents.map((a) => (
        <Card key={a.adminId}>
          <View style={styles.row}>
            <Text style={[styles.body, { fontWeight: '700', flex: 1 }]}>{a.name}</Text>
            <Badge tone={a.isAvailable ? 'success' : 'neutral'}>{a.isAvailable ? 'Available' : 'Away'}</Badge>
          </View>
          <Muted>{a.supportRoleLabel} · admin role {a.adminRole} · {a.openTickets} open tickets</Muted>
          <Muted>{a.teams?.length ? a.teams.map((t) => labelFrom(meta.teams, t)).join(', ') : 'Generalist'}</Muted>
          {manage ? <Button size="sm" label="Edit role & teams" onPress={() => open(a)} /> : null}
        </Card>
      ))}
      {!manage ? <Muted>Only support managers can change roles and teams.</Muted> : null}
      <Sheet visible={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${editing?.name || ''}`}
        footer={<><Button label="Cancel" onPress={() => setEditing(null)} disabled={saving} /><Button label="Save" variant="primary" busy={saving} onPress={save} /></>}>
        <ErrorBanner message={saveError} />
        <Field label="Support role" hint="You cannot grant a role above your own.">
          <Select label="Support role" value={form.supportRole} placeholder={null} onChange={(v) => setForm((f) => ({ ...f, supportRole: v }))} options={meta.roles.filter((_, i) => i <= myRank)} />
        </Field>
        <Text style={styles.label}>Teams (none = generalist, sees all unassigned tickets)</Text>
        {meta.teams.map((t) => (
          <CheckRow key={t.id} label={t.label} checked={form.teams.includes(t.id)}
            onToggle={() => setForm((f) => ({ ...f, teams: f.teams.includes(t.id) ? f.teams.filter((x) => x !== t.id) : [...f.teams, t.id] }))} />
        ))}
      </Sheet>
    </View>
  );
}

const hours = (min) => (min == null ? '' : String(Math.round((min / 60) * 100) / 100));
function Policies({ meta, caps }) {
  const dispatch = useDispatch();
  const manage = caps.has('config.manage');
  const [p, setP] = useState(null);
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => {
    setError(null);
    supportApi.policies().then((r) => {
      setP(r.policies);
      const byPriority = {};
      for (const pr of meta.priorities) {
        const o = r.policies.sla.byPriority[pr] || {};
        byPriority[pr] = { firstResponse: hours(o.firstResponse), followUp: hours(o.followUp), resolution: hours(o.resolution) };
      }
      setD({
        atRiskPercent: String(Math.round(r.policies.sla.atRiskFraction * 100)),
        byPriority,
        refund: { currency: r.policies.refund.currency, selfApproveMax: String(r.policies.refund.selfApproveMax), highRiskAbove: String(r.policies.refund.highRiskAbove) },
        reopen: { agentResolvedWindowDays: String(r.policies.reopen.agentResolvedWindowDays), agentClosedWindowDays: String(r.policies.reopen.agentClosedWindowDays) },
        routing: JSON.parse(JSON.stringify(r.policies.routing || { user: {}, vendor: {} })),
      });
    }).catch((e) => setError(supportErrorMessage(e)));
  }, [meta.priorities]);
  useEffect(() => { load(); }, [load]);
  if (error) return <StateView error={error} onRetry={load} />;
  if (!p || !d) return <StateView loading />;

  const setBy = (pr, k) => (v) => setD((x) => ({ ...x, byPriority: { ...x.byPriority, [pr]: { ...x.byPriority[pr], [k]: v } } }));
  const save = async () => {
    setSaving(true); setSaveError(null); setSaved(false);
    try {
      const toMin = (h) => Math.round(Number(h) * 60);
      const byPriority = Object.fromEntries(Object.entries(d.byPriority).map(([pr, o]) => [pr, { firstResponse: toMin(o.firstResponse), followUp: toMin(o.followUp), resolution: toMin(o.resolution) }]));
      await supportApi.updatePolicies({
        sla: { atRiskFraction: Number(d.atRiskPercent) / 100, byPriority },
        refund: { currency: d.refund.currency, selfApproveMax: Number(d.refund.selfApproveMax), highRiskAbove: Number(d.refund.highRiskAbove) },
        reopen: { agentResolvedWindowDays: Number(d.reopen.agentResolvedWindowDays), agentClosedWindowDays: Number(d.reopen.agentClosedWindowDays) },
        routing: d.routing,
      });
      setSaved(true);
      load();
      dispatch(refreshSupportMeta());
    } catch (e) { setSaveError(supportErrorMessage(e)); } finally { setSaving(false); }
  };
  const num = { keyboardType: 'decimal-pad', editable: manage };
  return (
    <View style={{ gap: spacing.sm }}>
      <ErrorBanner message={saveError} onDismiss={() => setSaveError(null)} />
      <Saved show={saved} text="Policies saved. New deadlines apply as tickets next change." />
      <Card title="Service levels (hours)">
        <View style={styles.tableHead}>
          <Text style={[styles.label, { width: 64 }]}>Priority</Text>
          {['First reply', 'Follow-up', 'Resolution'].map((h) => <Text key={h} style={[styles.label, { flex: 1 }]}>{h}</Text>)}
        </View>
        {meta.priorities.map((pr) => (
          <View key={pr} style={styles.tableRow}>
            <Text style={[styles.body, { width: 64, fontWeight: '700' }]}>{humanize(pr)}</Text>
            {['firstResponse', 'followUp', 'resolution'].map((k) => (
              <Input key={k} {...num} value={d.byPriority[pr][k]} onChangeText={setBy(pr, k)} style={{ flex: 1, paddingHorizontal: 8 }} accessibilityLabel={`${pr} ${k} hours`} />
            ))}
          </View>
        ))}
        <Field label="Warn when this % of the window remains"><Input {...num} value={d.atRiskPercent} onChangeText={(v) => setD((x) => ({ ...x, atRiskPercent: v }))} /></Field>
      </Card>
      <Card title="Refund approvals">
        <Field label="Policy currency"><Input editable={manage} autoCapitalize="characters" maxLength={3} value={d.refund.currency} onChangeText={(v) => setD((x) => ({ ...x, refund: { ...x.refund, currency: v.toUpperCase() } }))} /></Field>
        <Field label="Supervisor approval above" hint={`Currently ${money(p.refund.highRiskAbove, p.refund.currency)}. Refunds in another currency always need a supervisor.`}>
          <Input {...num} value={d.refund.highRiskAbove} onChangeText={(v) => setD((x) => ({ ...x, refund: { ...x.refund, highRiskAbove: v } }))} />
        </Field>
        <Field label="Requester may self-approve up to" hint="0 = every refund needs a second person (recommended).">
          <Input {...num} value={d.refund.selfApproveMax} onChangeText={(v) => setD((x) => ({ ...x, refund: { ...x.refund, selfApproveMax: v } }))} />
        </Field>
      </Card>
      <Card title="Reopening">
        <Field label="Agents may reopen resolved tickets within (days)"><Input {...num} value={d.reopen.agentResolvedWindowDays} onChangeText={(v) => setD((x) => ({ ...x, reopen: { ...x.reopen, agentResolvedWindowDays: v } }))} /></Field>
        <Field label="Agents may reopen closed tickets within (days)" hint="Supervisors can reopen outside these windows."><Input {...num} value={d.reopen.agentClosedWindowDays} onChangeText={(v) => setD((x) => ({ ...x, reopen: { ...x.reopen, agentClosedWindowDays: v } }))} /></Field>
      </Card>
      <Card title="Team routing by category">
        {['user', 'vendor'].map((aud) => (
          <View key={aud} style={{ gap: 6 }}>
            <Text style={styles.label}>{aud === 'user' ? 'USER TICKETS' : 'VENDOR TICKETS'}</Text>
            {meta.categories[aud].map((c) => (
              <View key={c.id} style={styles.routeRow}>
                <Text style={[styles.body, { flex: 1 }]}>{c.label}</Text>
                <View style={{ width: 150 }}>
                  <Select label={c.label} disabled={!manage} placeholder={null} value={d.routing[aud]?.[c.id] || 'general'} options={meta.teams}
                    onChange={(v) => setD((x) => ({ ...x, routing: { ...x.routing, [aud]: { ...(x.routing[aud] || {}), [c.id]: v } } }))} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </Card>
      {manage ? (
        <View style={styles.row}>
          <Button label="Discard changes" onPress={load} disabled={saving} />
          <Button label="Save policies" variant="primary" busy={saving} onPress={save} />
        </View>
      ) : <Muted>Only support managers can change these policies.</Muted>}
    </View>
  );
}

function ContactChannels() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => {
    setError(null);
    supportApi.contactConfig().then((r) => {
      const c = r.config || {};
      setCfg({
        channels: {
          inApp: { enabled: c.channels?.inApp?.enabled !== false },
          email: { enabled: Boolean(c.channels?.email?.enabled), address: c.channels?.email?.address || '' },
          phone: { enabled: Boolean(c.channels?.phone?.enabled), number: c.channels?.phone?.number || '' },
          whatsapp: { enabled: Boolean(c.channels?.whatsapp?.enabled), number: c.channels?.whatsapp?.number || '' },
        },
        businessHours: c.businessHours || '',
        responseTimeText: c.responseTimeText || '',
      });
    }).catch((e) => setError(supportErrorMessage(e, 'You need settings access to view contact channels.')));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <StateView error={error} onRetry={load} />;
  if (!cfg) return <StateView loading />;
  const setCh = (k, field, v) => setCfg((c) => ({ ...c, channels: { ...c.channels, [k]: { ...c.channels[k], [field]: v } } }));
  const save = async () => {
    setSaving(true); setSaveError(null); setSaved(false);
    try { await supportApi.updateContactConfig(cfg); setSaved(true); } catch (e) { setSaveError(supportErrorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Card title="Contact channels shown to users and vendors">
      <ErrorBanner message={saveError} />
      <Saved show={saved} />
      <CheckRow label="In-app support tickets" checked={cfg.channels.inApp.enabled} onToggle={() => setCh('inApp', 'enabled', !cfg.channels.inApp.enabled)} />
      {[['email', 'address', 'Support email', 'email-address'], ['phone', 'number', 'Support phone', 'phone-pad'], ['whatsapp', 'number', 'WhatsApp number', 'phone-pad']].map(([k, field, label, kb]) => (
        <View key={k} style={{ gap: 4 }}>
          <CheckRow label={label} checked={cfg.channels[k].enabled} onToggle={() => setCh(k, 'enabled', !cfg.channels[k].enabled)} />
          <Input value={cfg.channels[k][field]} onChangeText={(v) => setCh(k, field, v)} keyboardType={kb} autoCapitalize="none" accessibilityLabel={label} />
        </View>
      ))}
      <Field label="Business hours"><Input value={cfg.businessHours} onChangeText={(v) => setCfg((c) => ({ ...c, businessHours: v }))} maxLength={120} /></Field>
      <Field label="Response time text"><Input value={cfg.responseTimeText} onChangeText={(v) => setCfg((c) => ({ ...c, responseTimeText: v }))} maxLength={160} /></Field>
      <Button label="Save" variant="primary" busy={saving} onPress={save} />
    </Card>
  );
}

function Settings({ meta, caps }) {
  const [tab, setTab] = useState('me');
  return (
    <View style={{ flex: 1 }}>
      <Segmented value={tab} onChange={setTab} tabs={[{ id: 'me', label: 'My status' }, { id: 'agents', label: 'Agents & teams' }, { id: 'policies', label: 'SLA, refunds & routing' }, { id: 'contact', label: 'Contact channels' }]} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        {tab === 'me' ? <MyStatus meta={meta} /> : null}
        {tab === 'agents' ? <Agents meta={meta} caps={caps} /> : null}
        {tab === 'policies' ? <Policies meta={meta} caps={caps} /> : null}
        {tab === 'contact' ? <ContactChannels /> : null}
      </ScrollView>
    </View>
  );
}

export default function SupportSettingsScreen() {
  return <SupportGate title="Support settings">{(meta, caps) => <Settings meta={meta} caps={caps} />}</SupportGate>;
}

const styles = StyleSheet.create({
  muted: { fontSize: 12, color: colors.textMuted },
  saved: { fontSize: 13, color: colors.success, fontWeight: '600' },
  body: { fontSize: 13, color: colors.text },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  tableHead: { flexDirection: 'row', gap: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
