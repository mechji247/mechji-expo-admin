import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, CheckRow, ErrorBanner, Field, Input, Select, Sheet } from './ui';
import { colors } from '../../lib/constants/theme';
import { supportApi, supportErrorMessage } from '../../lib/support/supportApi';
import { humanize, labelFrom } from '../../lib/support/format';

// Sheets for sensitive ticket actions — the same forms as the web desk.
// Each collects input and calls `run(apiCall)` from the ticket screen, which
// adds the ticket's revision (optimistic concurrency), refreshes the ticket
// and maps conflicts. The server validates everything again.

function useDialogState(open) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setBusy(false); setError(null); } }, [open]);
  const submit = async (fn, onClose) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(supportErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function useAgents(open) {
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    if (!open) return;
    supportApi.agents().then((r) => setAgents(r.agents || [])).catch(() => setAgents([]));
  }, [open]);
  return agents;
}

const Footer = ({ onClose, busy, label = 'Save', variant = 'primary', disabled, onSubmit }) => (
  <>
    <Button label="Cancel" onPress={onClose} disabled={busy} />
    <Button label={label} variant={variant} busy={busy} disabled={disabled} onPress={onSubmit} />
  </>
);
const Note = ({ children }) => <Text style={{ fontSize: 13, color: colors.textMuted }}>{children}</Text>;

export function AssignDialog({ open, onClose, ticket, meta, run }) {
  const agents = useAgents(open);
  const [adminId, setAdminId] = useState('');
  const [team, setTeam] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) { setAdminId(ticket.assignedAgent || ''); setTeam(ticket.assignedTeam || ''); } }, [open, ticket.assignedAgent, ticket.assignedTeam]);
  const onSubmit = () => {
    const body = {};
    if ((adminId || null) !== (ticket.assignedAgent || null)) body.adminId = adminId || null;
    if ((team || null) !== (ticket.assignedTeam || null)) body.team = team || null;
    if (!Object.keys(body).length) return onClose();
    return submit(() => run((rev) => supportApi.assign(ticket._id, { ...body, expectedRev: rev })), onClose);
  };
  return (
    <Sheet visible={open} onClose={onClose} title="Assign ticket" footer={<Footer onClose={onClose} busy={busy} label="Save assignment" onSubmit={onSubmit} />}>
      <ErrorBanner message={error} />
      <Field label="Support agent" hint="Leave empty to unassign.">
        <Select label="Support agent" value={adminId} onChange={setAdminId} placeholder="Unassigned"
          options={agents.map((a) => ({ value: a.adminId, label: `${a.name} · ${a.supportRoleLabel}${a.isAvailable === false ? ' · away' : ''} (${a.openTickets} open)` }))} />
      </Field>
      <Field label="Team queue"><Select label="Team queue" value={team} onChange={setTeam} placeholder="No team" options={meta.teams} /></Field>
    </Sheet>
  );
}

export function PriorityDialog({ open, onClose, ticket, meta, run }) {
  const [priority, setPriority] = useState(ticket.priority);
  const [reason, setReason] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) { setPriority(ticket.priority); setReason(''); } }, [open, ticket.priority]);
  return (
    <Sheet visible={open} onClose={onClose} title="Change priority"
      footer={<Footer onClose={onClose} busy={busy} disabled={priority === ticket.priority}
        onSubmit={() => submit(() => run((rev) => supportApi.setPriority(ticket._id, { priority, reason: reason.trim() || undefined, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      {ticket.priorityReason ? <Note>Current: {ticket.priority} — {ticket.priorityReason}</Note> : null}
      <Field label="Priority"><Select label="Priority" value={priority} placeholder={null} onChange={setPriority} options={meta.priorities.map((p) => ({ value: p, label: humanize(p) }))} /></Field>
      <Field label="Reason" hint="Recorded in the audit log."><Input value={reason} onChangeText={setReason} maxLength={300} /></Field>
    </Sheet>
  );
}

const WORKING = ['assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support'];
export function StatusDialog({ open, onClose, ticket, meta, run }) {
  const targets = WORKING.filter((s) => s !== ticket.status && (meta.agentTransitions[s] || []).includes(ticket.status));
  const [status, setStatus] = useState('');
  const [party, setParty] = useState('owner');
  const [note, setNote] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) { setStatus(''); setParty('owner'); setNote(''); } }, [open]);
  return (
    <Sheet visible={open} onClose={onClose} title="Change status"
      footer={<Footer onClose={onClose} busy={busy} disabled={!status}
        onSubmit={() => submit(() => run((rev) => supportApi.setStatus(ticket._id, { status, party, note: note.trim() || undefined, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      {targets.length ? (
        <Field label="New status" required><Select label="New status" value={status} onChange={setStatus} options={targets.map((s) => ({ value: s, label: labelFrom(meta.statuses, s) }))} /></Field>
      ) : <Note>No working-status change is available from “{ticket.statusLabel}”. Use Resolve, Close or Reopen instead.</Note>}
      {status === 'waiting_for_customer' && ticket.counterparty?.active ? (
        <Field label="Waiting for">
          <Select label="Waiting for" value={party} placeholder={null} onChange={setParty}
            options={[{ value: 'owner', label: `Ticket owner (${ticket.customerType})` }, { value: 'counterparty', label: `Other party (${ticket.counterparty.type})` }]} />
        </Field>
      ) : null}
      <Field label="Internal note" hint="Optional. Not shown to the customer."><Input multiline value={note} onChangeText={setNote} maxLength={400} /></Field>
    </Sheet>
  );
}

export function EscalateDialog({ open, onClose, ticket, meta, run }) {
  const agents = useAgents(open);
  const [reason, setReason] = useState('');
  const [toTeam, setToTeam] = useState('');
  const [toAdminId, setToAdminId] = useState('');
  const [note, setNote] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) { setReason(''); setToTeam(''); setToAdminId(''); setNote(''); } }, [open]);
  const pickReason = (id) => {
    setReason(id);
    const r = meta.escalationReasons.find((x) => x.id === id);
    setToTeam(r?.team || ticket.assignedTeam || '');
  };
  const seniors = agents.filter((a) => ['senior_agent', 'supervisor', 'manager'].includes(a.supportRole));
  return (
    <Sheet visible={open} onClose={onClose} title={ticket.escalation?.active ? 'Escalate further' : 'Escalate ticket'}
      footer={<Footer onClose={onClose} busy={busy} label="Escalate" variant="danger" disabled={!reason || note.trim().length < 5}
        onSubmit={() => submit(() => run((rev) => supportApi.escalate(ticket._id, { reason, toTeam: toTeam || null, toAdminId: toAdminId || undefined, note, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      <Field label="Reason" required><Select label="Reason" value={reason} onChange={pickReason} options={meta.escalationReasons} /></Field>
      <Field label="To team"><Select label="To team" value={toTeam} onChange={setToTeam} placeholder="Supervisors (no team)" options={meta.teams} /></Field>
      <Field label="To person" hint="Optional."><Select label="To person" value={toAdminId} onChange={setToAdminId} placeholder="Anyone in the team" options={seniors.map((a) => ({ value: a.adminId, label: `${a.name} · ${a.supportRoleLabel}` }))} /></Field>
      <Field label="What needs attention?" required hint="Internal — the team is notified with this note."><Input multiline value={note} onChangeText={setNote} maxLength={2000} /></Field>
    </Sheet>
  );
}

export function ResolveEscalationDialog({ open, onClose, ticket, run }) {
  const [text, setText] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) setText(''); }, [open]);
  return (
    <Sheet visible={open} onClose={onClose} title="Resolve escalation"
      footer={<Footer onClose={onClose} busy={busy} label="Resolve escalation" disabled={text.trim().length < 5}
        onSubmit={() => submit(() => run((rev) => supportApi.resolveEscalation(ticket._id, { resolution: text, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      <Note>Escalated for {humanize(ticket.escalation?.reason)}. The ticket stays open for the assigned agent to finish.</Note>
      <Field label="How was it resolved?" required><Input multiline value={text} onChangeText={setText} maxLength={2000} /></Field>
    </Sheet>
  );
}

const AMOUNT_ADJUSTMENTS = ['refund', 'partial_refund', 'settlement_correction'];
export function ResolveDialog({ open, onClose, ticket, dispute, meta, caps, run, defaultCurrency }) {
  const isDispute = ticket.type === 'dispute';
  const override = ticket.status === 'resolved' || Boolean(dispute?.resolution?.outcome);
  const outcomes = meta.resolutionOutcomes.filter((o) => isDispute || !o.disputeOnly);
  const [f, setF] = useState({});
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => {
    if (open) setF({ outcome: '', customerSummary: '', counterpartySummary: '', internalSummary: '', actions: '', responsibleParty: '', adjustmentType: '', amount: '', currency: defaultCurrency || 'INR', overrideReason: '' });
  }, [open, defaultCurrency]);
  const outcome = outcomes.find((o) => o.id === f.outcome);
  const adjType = f.adjustmentType || outcome?.adjustments?.[0] || 'none';
  const needsParty = isDispute || outcome?.requiresResponsibleParty;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const onSubmit = () => {
    const body = {
      outcome: f.outcome,
      customerSummary: f.customerSummary,
      counterpartySummary: f.counterpartySummary || undefined,
      internalSummary: f.internalSummary || undefined,
      actionsTaken: String(f.actions || '').split('\n').map((s) => s.trim()).filter(Boolean),
      responsibleParty: f.responsibleParty || undefined,
      adjustment: { type: adjType, ...(AMOUNT_ADJUSTMENTS.includes(adjType) ? { amount: Number(f.amount), currency: f.currency } : {}) },
      override: override || undefined,
      overrideReason: override ? f.overrideReason : undefined,
    };
    submit(() => run((rev) => supportApi.resolve(ticket._id, { ...body, expectedRev: rev })), onClose);
  };
  if (override && isDispute && !caps.has('dispute.override')) {
    return (
      <Sheet visible={open} onClose={onClose} title="Decision already recorded" footer={<Button label="Close" onPress={onClose} />}>
        <Note>A decision was already recorded for this dispute. Only a supervisor can override it — escalate for supervisor review if it needs to change.</Note>
      </Sheet>
    );
  }
  return (
    <Sheet visible={open} onClose={onClose} title={override ? 'Override decision' : isDispute ? 'Record dispute decision' : 'Resolve ticket'}
      footer={<Footer onClose={onClose} busy={busy} label={override ? 'Override' : 'Resolve'} disabled={!f.outcome || String(f.customerSummary || '').trim().length < 10} onSubmit={onSubmit} />}>
      <ErrorBanner message={error} />
      <Field label="Outcome" required><Select label="Outcome" value={f.outcome || ''} onChange={(v) => setF((x) => ({ ...x, outcome: v, adjustmentType: '' }))} options={outcomes} /></Field>
      <Field label="Responsible party" required={needsParty}>
        <Select label="Responsible party" value={f.responsibleParty || ''} onChange={set('responsibleParty')} placeholder={needsParty ? 'Choose…' : 'Not applicable'} options={meta.responsibleParties.map((p) => ({ value: p, label: humanize(p) }))} />
      </Field>
      {outcome && outcome.adjustments.length > 1 ? (
        <Field label="Adjustment"><Select label="Adjustment" value={adjType} placeholder={null} onChange={set('adjustmentType')} options={outcome.adjustments.map((a) => ({ value: a, label: humanize(a) }))} /></Field>
      ) : null}
      {AMOUNT_ADJUSTMENTS.includes(adjType) ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Amount" required hint="Needs an approved refund on this ticket first (Refunds tab)."><Input keyboardType="decimal-pad" value={f.amount} onChangeText={set('amount')} /></Field></View>
          <View style={{ width: 90 }}><Field label="Currency" required><Input value={f.currency} autoCapitalize="characters" maxLength={3} onChangeText={(v) => set('currency')(v.toUpperCase())} /></Field></View>
        </View>
      ) : null}
      <Field label={`Summary for the ${ticket.customerType === 'vendor' ? 'store' : 'customer'}`} required hint="Shown to the ticket owner. At least 10 characters.">
        <Input multiline value={f.customerSummary} onChangeText={set('customerSummary')} maxLength={2000} />
      </Field>
      {ticket.counterparty?.active ? (
        <Field label={`Summary for the other party (${ticket.counterparty.type})`} hint="Optional; otherwise they get the neutral decision notice.">
          <Input multiline value={f.counterpartySummary} onChangeText={set('counterpartySummary')} maxLength={2000} />
        </Field>
      ) : null}
      <Field label="Internal summary" required={isDispute} hint="Only visible to support staff."><Input multiline value={f.internalSummary} onChangeText={set('internalSummary')} maxLength={4000} /></Field>
      <Field label="Actions taken" required={isDispute} hint="One per line."><Input multiline value={f.actions} onChangeText={set('actions')} /></Field>
      {override ? <Field label="Reason for override" required><Input value={f.overrideReason} onChangeText={set('overrideReason')} maxLength={500} /></Field> : null}
    </Sheet>
  );
}

export function CloseDialog({ open, onClose, ticket, run }) {
  const [note, setNote] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) setNote(''); }, [open]);
  return (
    <Sheet visible={open} onClose={onClose} title={`Close ${ticket.ticketNumber}?`}
      footer={<Footer onClose={onClose} busy={busy} label="Close ticket" variant="danger"
        onSubmit={() => submit(() => run((rev) => supportApi.close(ticket._id, { note: note.trim() || undefined, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      <Note>The customer can no longer reply to a closed ticket; it can be reopened within the reopen window.</Note>
      <Field label="Closing note" hint="Optional. Shown to the customer."><Input multiline value={note} onChangeText={setNote} maxLength={2000} /></Field>
    </Sheet>
  );
}

export function ReopenDialog({ open, onClose, ticket, run }) {
  const [reason, setReason] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) setReason(''); }, [open]);
  return (
    <Sheet visible={open} onClose={onClose} title={`Reopen ${ticket.ticketNumber}`}
      footer={<Footer onClose={onClose} busy={busy} label="Reopen" disabled={reason.trim().length < 5}
        onSubmit={() => submit(() => run((rev) => supportApi.reopen(ticket._id, { reason, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      <Field label="Reason" required hint="Recorded in the audit log."><Input multiline value={reason} onChangeText={setReason} maxLength={1000} /></Field>
    </Sheet>
  );
}

export function MergeDialog({ open, onClose, ticket, related, run }) {
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) { setTarget(''); setNote(''); } }, [open]);
  const candidates = (related?.possibleDuplicates || []).filter((t) => !t.mergedInto && t.type !== 'dispute');
  return (
    <Sheet visible={open} onClose={onClose} title={`Merge ${ticket.ticketNumber}`}
      footer={<Footer onClose={onClose} busy={busy} label="Merge" variant="danger" disabled={!target.trim()}
        onSubmit={() => submit(() => run((rev) => supportApi.merge(ticket._id, { targetTicketId: target.trim(), note: note.trim() || undefined, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      <Note>This ticket will be closed and point to the target. All messages, files and history stay on this ticket. Only tickets from the same customer or store can be merged; disputes cannot be merged.</Note>
      {candidates.length ? (
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>Possible duplicates</Text>
          {candidates.map((t) => (
            <Pressable key={t._id} onPress={() => setTarget(t.ticketNumber)} accessibilityRole="radio" accessibilityState={{ checked: target === t.ticketNumber }}
              style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: target === t.ticketNumber ? colors.primary : colors.border, backgroundColor: colors.surface }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{t.ticketNumber}</Text>
              <Text style={{ fontSize: 14, color: colors.text }} numberOfLines={1}>{t.subject}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label="Target ticket number" required><Input value={target} onChangeText={setTarget} autoCapitalize="characters" placeholder="MJ-SUP-2026-000123" /></Field>
      <Field label="Note" hint="Optional, internal."><Input value={note} onChangeText={setNote} maxLength={500} /></Field>
    </Sheet>
  );
}

export function OpenDisputeDialog({ open, onClose, ticket, meta, run }) {
  const [kind, setKind] = useState('');
  const [addCounterparty, setAddCounterparty] = useState(true);
  const [summary, setSummary] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) { setKind(''); setAddCounterparty(true); setSummary(''); } }, [open]);
  const has = { order: Boolean(ticket.orderId), booking: Boolean(ticket.serviceBookingId), payment: Boolean(ticket.paymentId) };
  const kinds = meta.disputeKinds.filter((k) => !k.context || has[k.context]);
  return (
    <Sheet visible={open} onClose={onClose} title="Open a dispute case"
      footer={<Footer onClose={onClose} busy={busy} label="Open dispute" disabled={!kind || (addCounterparty && summary.trim().length < 10)}
        onSubmit={() => submit(() => run((rev) => supportApi.openDispute(ticket._id, { kind, addCounterparty, counterpartySummary: addCounterparty ? summary : undefined, expectedRev: rev })), onClose)} />}>
      <ErrorBanner message={error} />
      <Note>The ticket becomes a dispute with its own evidence register and timeline. Conversations with each party stay private unless you open the shared thread.</Note>
      <Field label="What is disputed?" required hint={kinds.length < meta.disputeKinds.length ? 'Some kinds need a linked order, booking or payment.' : undefined}>
        <Select label="What is disputed?" value={kind} onChange={setKind} options={kinds} />
      </Field>
      <CheckRow label={`Invite the other party (${ticket.customerType === 'vendor' ? 'the customer' : 'the store'}) into a private conversation`} checked={addCounterparty} onToggle={() => setAddCounterparty((v) => !v)} />
      {addCounterparty ? (
        <Field label="Neutral case summary for the other party" required hint="They see this instead of the owner's own description. Don't include personal details.">
          <Input multiline value={summary} onChangeText={setSummary} maxLength={1000} />
        </Field>
      ) : null}
    </Sheet>
  );
}

export function CounterpartyDialog({ open, onClose, ticket, dispute, run }) {
  const active = Boolean(ticket.counterparty?.active);
  const [text, setText] = useState('');
  const { busy, error, submit } = useDialogState(open);
  useEffect(() => { if (open) setText(''); }, [open]);
  return (
    <Sheet visible={open} onClose={onClose} title={active ? 'Remove the other party' : 'Invite the other party'}
      footer={<Footer onClose={onClose} busy={busy} label={active ? 'Remove' : 'Invite'} variant={active ? 'danger' : 'primary'} disabled={text.trim().length < (active ? 5 : 10)}
        onSubmit={() => submit(() => run(() => (active ? supportApi.removeCounterparty(dispute._id, text) : supportApi.addCounterparty(dispute._id, text))), onClose)} />}>
      <ErrorBanner message={error} />
      {active ? <Note>They lose access to this case and the shared thread closes. Their earlier messages stay in the record.</Note> : null}
      <Field label={active ? 'Reason' : 'Neutral case summary'} required><Input multiline value={text} onChangeText={setText} maxLength={1000} /></Field>
    </Sheet>
  );
}

/** Generic confirmation for one-tap sensitive operations. */
export function ConfirmDialog({ open, onClose, title, message, confirmLabel = 'Confirm', variant = 'primary', onConfirm, children }) {
  const { busy, error, submit } = useDialogState(open);
  return (
    <Sheet visible={open} onClose={onClose} title={title}
      footer={<><Button label="Cancel" onPress={onClose} disabled={busy} /><Button label={confirmLabel} variant={variant} busy={busy} onPress={() => submit(onConfirm, onClose)} /></>}>
      <ErrorBanner message={error} />
      {message ? <Note>{message}</Note> : null}
      {children}
    </Sheet>
  );
}
