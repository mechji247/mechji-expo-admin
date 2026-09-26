import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ErrorBanner, Field, Input, KeyValue, SectionTitle, Segmented, Select, Sheet, StateView } from './ui';
import { ConfirmDialog, CounterpartyDialog } from './TicketDialogs';
import { EscalationPill, PriorityPill, StatusPill, TypePill } from './badges';
import { Attachments } from './Conversation';
import { colors, spacing } from '../../lib/constants/theme';
import { newClientId, supportApi, supportErrorMessage } from '../../lib/support/supportApi';
import { dateTime, humanize, labelFrom, money, slaLabel, timeAgo } from '../../lib/support/format';

// Investigation panels for a ticket (same data as the web desk's side panel).
// Everything is read-only except the explicit dispute and refund actions,
// which go through confirmation sheets and are re-authorised on the server.

export function useLoader(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((e) => { if (!cancelled) setState({ data: null, error: supportErrorMessage(e), loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: useCallback(() => setN((x) => x + 1), []) };
}

const Muted = ({ children }) => <Text style={styles.muted}>{children}</Text>;
const LinkText = ({ label, onPress }) => <Text style={styles.link} onPress={onPress} accessibilityRole="link">{label}</Text>;

// ── Details ─────────────────────────────────────────────────────────────────
export function DetailsPanel({ ticket, meta }) {
  const router = useRouter();
  const r = ticket.requester;
  const sla = ticket.sla || {};
  return (
    <View style={styles.panel}>
      <Card title={ticket.customerType === 'vendor' ? 'Store' : 'Customer'}>
        <KeyValue rows={[
          ['Name', r?.name],
          r?.raisedBy ? ['Raised by', r.raisedBy] : null,
          ['Email', r?.email],
          ['Phone', r?.phone],
          ['Profile', r?.type === 'vendor' ? <LinkText key="v" label="Open store" onPress={() => router.push(`/vendors/${r.vendorId}`)} />
            : r?.userId ? <LinkText key="u" label="Open user" onPress={() => router.push(`/users/${r.userId}`)} /> : null],
        ]} />
        {r?.masked ? <Muted>Contact details are masked for your role.</Muted> : null}
      </Card>
      {ticket.counterpartyDetail ? (
        <Card title="Other party">
          <KeyValue rows={[
            ['Name', ticket.counterpartyDetail.name],
            ['Type', ticket.counterpartyDetail.type === 'vendor' ? 'Store' : 'Customer'],
            ['In the case', ticket.counterpartyDetail.active ? `Yes, since ${dateTime(ticket.counterpartyDetail.addedAt)}` : 'No'],
            ['Case summary shown', ticket.counterpartyDetail.summary],
            ['Unread by them', String(ticket.counterpartyDetail.unreadCount ?? 0)],
          ]} />
        </Card>
      ) : null}
      <Card title="Ticket">
        <KeyValue rows={[
          ['Category', labelFrom(meta.categories[ticket.customerType], ticket.category)],
          ticket.subCategory ? ['Sub-category', humanize(ticket.subCategory)] : null,
          ['Team', ticket.assignedTeam ? labelFrom(meta.teams, ticket.assignedTeam) : '—'],
          ['Agent', ticket.assignedAgentName || 'Unassigned'],
          ['Priority', `${ticket.priority}${ticket.priorityReason ? ` — ${ticket.priorityReason}` : ''}`],
          ['Created', dateTime(ticket.createdAt)],
          ['First response', ticket.firstResponseAt ? dateTime(ticket.firstResponseAt) : 'Not yet'],
          ['SLA', `${slaLabel(sla.state)}${sla.breaches?.length ? ` (breached: ${sla.breaches.join(', ')})` : ''}`],
          sla.firstResponseDueAt && !ticket.firstResponseAt ? ['First response due', `${dateTime(sla.firstResponseDueAt)} (${timeAgo(sla.firstResponseDueAt)})`] : null,
          sla.nextResponseDueAt ? ['Next reply due', `${dateTime(sla.nextResponseDueAt)} (${timeAgo(sla.nextResponseDueAt)})`] : null,
          sla.resolutionDueAt ? ['Resolution due', `${dateTime(sla.resolutionDueAt)} (${timeAgo(sla.resolutionDueAt)})`] : null,
          ['Reopened', ticket.reopenCount ? `${ticket.reopenCount}×` : 'No'],
          ticket.context?.title ? ['About', ticket.context.title] : null,
          ticket.source?.platform ? ['Source', `${ticket.source.platform}${ticket.source.appVersion ? ` · v${ticket.source.appVersion}` : ''}`] : null,
        ]} />
      </Card>
      {ticket.fields && Object.keys(ticket.fields).length ? (
        <Card title="Form answers">
          <KeyValue rows={Object.entries(ticket.fields).map(([k, v]) => [humanize(k), typeof v === 'object' ? JSON.stringify(v) : String(v)])} />
        </Card>
      ) : null}
      {ticket.escalationDetail ? (
        <Card title="Escalation">
          <KeyValue rows={[
            ['Status', ticket.escalationDetail.active ? 'Open' : 'Resolved'],
            ['Reason', labelFrom(meta.escalationReasons, ticket.escalationDetail.reason)],
            ['By', ticket.escalationDetail.escalatedByName],
            ['At', dateTime(ticket.escalationDetail.escalatedAt)],
            ['To', [ticket.escalationDetail.toAdminName, ticket.escalationDetail.toTeam && labelFrom(meta.teams, ticket.escalationDetail.toTeam)].filter(Boolean).join(' · ') || 'Supervisors'],
            ['Note', ticket.escalationDetail.note],
            ticket.escalationDetail.resolvedAt ? ['Resolved', `${dateTime(ticket.escalationDetail.resolvedAt)} — ${ticket.escalationDetail.resolution || ''}`] : null,
          ]} />
        </Card>
      ) : null}
      {ticket.resolution?.outcome || ticket.resolution?.customerSummary ? (
        <Card title="Resolution">
          <KeyValue rows={[
            ['Outcome', labelFrom(meta.resolutionOutcomes, ticket.resolution.outcome)],
            ['Customer summary', ticket.resolution.customerSummary],
            ticket.resolution.internalSummary ? ['Internal summary', ticket.resolution.internalSummary] : null,
            ticket.resolution.actionsTaken?.length ? ['Actions', ticket.resolution.actionsTaken.join('; ')] : null,
            ticket.resolution.responsibleParty ? ['Responsible', humanize(ticket.resolution.responsibleParty)] : null,
            ticket.resolution.adjustment?.type && ticket.resolution.adjustment.type !== 'none' ? ['Adjustment', `${humanize(ticket.resolution.adjustment.type)}${ticket.resolution.adjustment.amount ? ` · ${money(ticket.resolution.adjustment.amount, ticket.resolution.adjustment.currency)}` : ''}`] : null,
            ['Resolved', dateTime(ticket.resolution.resolvedAt)],
          ]} />
        </Card>
      ) : null}
      {ticket.mergedFrom?.length ? (
        <Card title="Merged into this ticket">
          {ticket.mergedFrom.map((m) => <LinkText key={m.ticketId} label={`${m.ticketNumber} · ${dateTime(m.at)}`} onPress={() => router.push(`/support/${m.ticketId}`)} />)}
        </Card>
      ) : null}
      <Card title="Description"><Text style={styles.body} selectable>{ticket.description}</Text></Card>
      {ticket.attachments?.length ? (
        <Card title={`All files (${ticket.attachments.length})`}>
          {ticket.attachments.map((a) => (
            <View key={a.attachmentId} style={styles.fileRow}>
              <Text style={[styles.link, { flex: 1 }]} numberOfLines={1} onPress={() => a.url && Linking.openURL(a.url)}>{a.fileName}</Text>
              <Badge tone={a.channel === 'internal' ? 'warning' : 'neutral'}>{a.channel}</Badge>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

// ── Transaction context ─────────────────────────────────────────────────────
export function TransactionPanel({ ticket }) {
  const router = useRouter();
  const { data, error, loading, reload } = useLoader(() => supportApi.context(ticket._id), [ticket._id]);
  if (loading && !data) return <StateView loading />;
  if (error) return <StateView error={error} onRetry={reload} />;
  const { order, booking, payment, vendor, links } = data;
  if (!order && !booking && !payment && !vendor) return <StateView empty title="No linked transaction" text="This ticket is not linked to an order, booking or payment." />;
  const cur = (c) => c || 'INR';
  return (
    <View style={styles.panel}>
      {order ? (
        <Card title={`Order ${order.orderNumber}`} right={<LinkText label="Open orders" onPress={() => router.push('/orders')} />}>
          <KeyValue rows={[
            ['Status', order.statusLabel],
            ['Placed', dateTime(order.placedAt)],
            ['Total', order.amount != null ? money(order.amount, cur(order.currency)) : '—'],
            ['Payment', [order.payment.method, order.payment.status].filter(Boolean).map(humanize).join(' · ')],
            order.payment.collectedAt ? ['Collected', `${money(order.payment.collectedAmount, cur(order.currency))} · ${dateTime(order.payment.collectedAt)}`] : null,
            order.payment.transactionRef ? ['Payment ref', order.payment.transactionRef] : null,
            order.refund ? ['Refund', `${humanize(order.refund.status)}${order.refund.amount != null ? ` · ${money(order.refund.amount, cur(order.currency))}` : ''}${order.refund.transactionRef ? ` · ref ${order.refund.transactionRef}` : ''}`] : null,
            order.cancellation ? ['Cancelled', `${humanize(order.cancellation.by)} · ${order.cancellation.reason || ''} · ${dateTime(order.cancellation.at)}`] : null,
            ['Delivery', `${humanize(order.delivery.type)}${order.delivery.deliveredAt ? ` · delivered ${dateTime(order.delivery.deliveredAt)}` : ''}${order.delivery.otpVerified ? ' · OTP verified' : ''}`],
            order.delivery.agent ? ['Delivery by', [order.delivery.agent.name, order.delivery.agent.courierName, order.delivery.agent.trackingNumber, order.delivery.agent.phone].filter(Boolean).join(' · ')] : null,
            order.delivery.attempts?.length ? ['Attempts', String(order.delivery.attempts.length)] : null,
          ]} />
          {order.items.map((i) => <Muted key={i.itemId}>{i.quantity}× {i.title}{i.total != null ? ` — ${money(i.total, cur(order.currency))}` : ''}{i.returnStatus ? ` · return ${humanize(i.returnStatus)}` : ''}</Muted>)}
        </Card>
      ) : null}
      {booking ? (
        <Card title={`Booking ${booking.bookingNumber}`} right={<LinkText label="Open bookings" onPress={() => router.push('/orders?tab=service')} />}>
          <KeyValue rows={[
            ['Service', booking.service],
            ['Status', booking.statusLabel],
            ['Booked', dateTime(booking.bookedAt)],
            ['Scheduled', `${dateTime(booking.scheduledFor)}${booking.scheduledTime ? ` · ${booking.scheduledTime}` : ''}`],
            ['Started', booking.startedAt ? `${dateTime(booking.startedAt)}${booking.otp.startVerified ? ' · OTP verified' : ''}` : '—'],
            ['Finished', booking.completedAt ? `${dateTime(booking.completedAt)}${booking.otp.completionVerified ? ' · OTP verified' : ''}` : '—'],
            booking.durationMinutes != null ? ['Duration', `${booking.durationMinutes} min`] : null,
            ['Price', `${humanize(booking.pricing.type)} · ${money(booking.pricing.total, cur(booking.pricing.currency))}`],
            ['Payment', [booking.payment.method, booking.payment.status].filter(Boolean).map(humanize).join(' · ') + (booking.payment.confirmedByStore ? ' · confirmed by store' : '')],
            booking.provider ? ['Provider', [booking.provider.name, humanize(booking.provider.type), booking.provider.phone].filter(Boolean).join(' · ')] : null,
            booking.cancellation ? ['Cancelled', `${humanize(booking.cancellation.by)} · ${booking.cancellation.reason || ''}`] : null,
            booking.reschedules ? ['Rescheduled', `${booking.reschedules}×`] : null,
          ]} />
        </Card>
      ) : null}
      {payment ? (
        <Card title={`${humanize(payment.kind)} payment`}>
          <KeyValue rows={[
            ['Status', humanize(payment.status)],
            ['Amount', money(payment.amount, payment.currency)],
            payment.capturedAmount != null ? ['Captured', `${money(payment.capturedAmount, payment.capturedCurrency || payment.currency)} · ${dateTime(payment.capturedAt)}`] : null,
            ['Method', humanize(payment.method)],
            ['Gateway order', payment.razorpayOrderId],
            ['Gateway payment', payment.razorpayPaymentId],
            payment.failure ? ['Failure', `${payment.failure.code}${payment.failure.reason ? ` — ${payment.failure.reason}` : ''}`] : null,
            payment.needsReconciliation ? ['Reconciliation', 'Needs reconciliation'] : null,
            ['Payer', [payment.payerEmail, payment.payerContact].filter(Boolean).join(' · ')],
          ]} />
          {payment.refunds?.map((r, i) => <Muted key={i}>Refund {money(r.amount, r.currency)} · {humanize(r.status)}{r.providerRefundId ? ` · ${r.providerRefundId}` : ''}</Muted>)}
          {payment.webhooks?.length ? <SectionTitle>Webhook events</SectionTitle> : null}
          {payment.webhooks?.map((w, i) => <Muted key={`w${i}`}>{w.eventType} · {w.status} · {dateTime(w.at)}{w.attempts > 1 ? ` · ${w.attempts} attempts` : ''}</Muted>)}
        </Card>
      ) : null}
      {vendor ? (
        <Card title="Store" right={<LinkText label="Open" onPress={() => router.push(`/vendors/${vendor._id}`)} />}>
          <KeyValue rows={[['Name', vendor.name], ['Verification', `${humanize(vendor.verificationStatus)}${vendor.isVerified ? ' ✓' : ''}`], ['Store status', humanize(vendor.storeStatus)], ['Plan', [vendor.plan, humanize(vendor.subscriptionStatus)].filter(Boolean).join(' · ')]]} />
        </Card>
      ) : null}
      {links.user ? <LinkText label="Open customer profile" onPress={() => router.push(links.user.replace('/user/', '/users/'))} /> : null}
      {data.contactMasked ? <Muted>Phone numbers and emails are masked for your role.</Muted> : null}
    </View>
  );
}

// ── Dispute ─────────────────────────────────────────────────────────────────
function EvidenceUpload({ dispute, meta, onDone }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const choose = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: meta.limits.attachmentMimeTypes, copyToCacheDirectory: true });
      if (!r.canceled && r.assets?.[0]) setFile(r.assets[0]);
    } catch { setError('Could not open the file picker.'); }
  };
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const { attachment } = await supportApi.uploadAttachment(dispute.ticketId, file);
      await supportApi.addEvidence(dispute._id, { kind, note: note || undefined, attachmentIds: [attachment.attachmentId], clientMessageId: newClientId() });
      setOpen(false); setKind(''); setNote(''); setFile(null);
      onDone();
    } catch (e) { setError(supportErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <Button size="sm" label="Add evidence" icon="add" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Add support evidence"
        footer={<><Button label="Cancel" onPress={() => setOpen(false)} disabled={busy} /><Button label="Add" variant="primary" busy={busy} disabled={!kind || !file} onPress={submit} /></>}>
        <ErrorBanner message={error} />
        <Muted>Evidence added by support is filed internally; neither party sees it unless you share it in a reply.</Muted>
        <Field label="Kind" required><Select label="Kind" value={kind} onChange={setKind} options={meta.evidenceKinds} /></Field>
        <Field label="File" required hint="JPG, PNG, WebP or PDF."><Button label={file ? file.name : 'Choose file'} icon="document-attach-outline" onPress={choose} /></Field>
        <Field label="Note"><Input value={note} onChangeText={setNote} maxLength={500} /></Field>
      </Sheet>
    </>
  );
}

const SOURCE_TONE = { record: 'info', support: 'neutral', party: 'warning' };
export function DisputePanel({ ticket, dispute, meta, caps, permissions, run, onChanged }) {
  const router = useRouter();
  const [sub, setSub] = useState('timeline');
  const [cpOpen, setCpOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const timeline = useLoader(() => (sub === 'timeline' ? supportApi.disputeTimeline(dispute._id) : Promise.resolve(null)), [dispute._id, sub, dispute.rev, ticket.rev]);
  const evidence = useLoader(() => (sub === 'evidence' ? supportApi.disputeEvidence(dispute._id) : Promise.resolve(null)), [dispute._id, sub, dispute.evidenceCount]);
  return (
    <View style={styles.panel}>
      <Card title="Case">
        <KeyValue rows={[
          ['Case', dispute.kindLabel],
          ['Case status', humanize(dispute.status)],
          ['Opened by', `${dispute.openedByName || '—'} · ${dateTime(dispute.createdAt)}`],
          ['Evidence', String(dispute.evidenceCount)],
          ['Shared thread', ticket.sharedThread ? 'Open' : 'Closed'],
        ]} />
        {dispute.resolution ? (
          <Muted>Decision: {labelFrom(meta.resolutionOutcomes, dispute.resolution.outcome)} · by {dispute.resolution.decidedByName || '—'} · {dateTime(dispute.resolution.decidedAt)}{dispute.resolution.overrides?.length ? ` · overridden ${dispute.resolution.overrides.length}×` : ''}</Muted>
        ) : null}
      </Card>
      <Card title="Participants">
        {dispute.participants.map((p, i) => (
          <View key={i} style={styles.participant}>
            <Badge tone={p.party === 'owner' ? 'info' : p.party === 'counterparty' ? 'warning' : 'neutral'}>{humanize(p.role)}</Badge>
            <Text style={styles.body}>{p.name || '—'}</Text>
            {p.party ? <Muted>({p.party === 'owner' ? 'raised the case' : 'other party'})</Muted> : null}
            {p.vendorId ? <LinkText label="store" onPress={() => router.push(`/vendors/${p.vendorId}`)} /> : p.userId && p.role === 'user' ? <LinkText label="profile" onPress={() => router.push(`/users/${p.userId}`)} /> : null}
          </View>
        ))}
      </Card>
      {permissions.canManageDispute ? (
        <View style={styles.actions}>
          <Button size="sm" label={ticket.counterparty?.active ? 'Remove other party' : 'Invite other party'} onPress={() => setCpOpen(true)} />
          {permissions.canSharedThread && ticket.counterparty?.active ? <Button size="sm" label={ticket.sharedThread ? 'Close shared thread' : 'Open shared thread'} onPress={() => setSharedOpen(true)} /> : null}
          <EvidenceUpload dispute={dispute} meta={meta} onDone={() => { evidence.reload(); onChanged(); }} />
        </View>
      ) : <Muted>You can view this dispute but not manage it.</Muted>}
      <Segmented value={sub} onChange={setSub} tabs={[{ id: 'timeline', label: 'Timeline' }, { id: 'evidence', label: 'Evidence', count: dispute.evidenceCount }]} />
      {sub === 'timeline' ? (
        timeline.loading && !timeline.data ? <StateView loading /> : timeline.error ? <StateView error={timeline.error} onRetry={timeline.reload} /> : (
          <View style={styles.timeline}>
            {(timeline.data?.items || []).map((it, i) => (
              <View key={i} style={styles.tlItem}>
                <View style={styles.tlDot} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.participant}>
                    <Text style={styles.tlLabel}>{it.label}</Text>
                    <Badge tone={SOURCE_TONE[it.source]}>{it.source === 'record' ? 'System record' : it.source === 'party' ? 'Party' : 'Support'}</Badge>
                    {it.internal ? <Badge tone="warning">Internal</Badge> : null}
                  </View>
                  <Muted>{dateTime(it.at)}{it.actor ? ` · ${it.actor}` : ''}{it.detail ? ` · ${it.detail}` : ''}</Muted>
                </View>
              </View>
            ))}
          </View>
        )
      ) : evidence.loading && !evidence.data ? <StateView loading /> : evidence.error ? <StateView error={evidence.error} onRetry={evidence.reload} /> : (
        evidence.data?.evidence?.length ? evidence.data.evidence.map((e) => (
          <Card key={e._id}>
            <View style={styles.participant}>
              <Badge tone="warning">{labelFrom(meta.evidenceKinds, e.kind)}</Badge>
              <Badge tone={e.party === 'support' ? 'neutral' : 'info'}>{e.party === 'owner' ? 'Raised by owner' : e.party === 'counterparty' ? 'Other party' : 'Support'}</Badge>
              <Badge tone={e.channel === 'internal' ? 'warning' : 'neutral'}>{e.channel}</Badge>
            </View>
            <Attachments items={[e]} />
            <Muted>{dateTime(e.submittedAt)}{e.note ? ` · ${e.note}` : ''}</Muted>
          </Card>
        )) : <StateView empty title="No evidence yet" text="Files either party attaches in the case are registered here automatically." />
      )}
      <CounterpartyDialog open={cpOpen} onClose={() => setCpOpen(false)} ticket={ticket} dispute={dispute} run={run} />
      <ConfirmDialog open={sharedOpen} onClose={() => setSharedOpen(false)}
        title={ticket.sharedThread ? 'Close the shared thread?' : 'Open a shared thread?'}
        message={ticket.sharedThread ? 'Both parties keep their private conversations with support; they can no longer post to the shared thread.' : 'Messages in the shared thread are visible to both parties and support. Private conversations stay private.'}
        confirmLabel={ticket.sharedThread ? 'Close thread' : 'Open thread'}
        onConfirm={() => run(() => supportApi.setSharedThread(dispute._id, !ticket.sharedThread))} />
    </View>
  );
}

// ── Refunds ─────────────────────────────────────────────────────────────────
const REFUND_TONE = { requested: 'warning', approved: 'info', processing: 'info', awaiting_vendor: 'warning', succeeded: 'success', failed: 'error', rejected: 'neutral', cancelled: 'neutral' };

function RefundRequest({ ticket, targets, onDone }) {
  const refundable = targets.filter((t) => t.refundable && t.available > 0);
  const [targetKey, setTargetKey] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(() => newClientId());
  if (!refundable.length) {
    return <Muted>{targets.length ? targets.map((t) => `${humanize(t.type)}: ${t.refundable ? 'fully refunded' : t.reason}`).join(' · ') : 'No refundable payment is linked to this ticket.'}</Muted>;
  }
  const target = refundable.find((t) => `${t.type}:${t.id}` === targetKey) || refundable[0];
  const n = Number(amount);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      // The idempotency key is kept until the request succeeds, so a retry
      // after a network error can never create a second refund.
      await supportApi.requestRefund(ticket._id, { target: { type: target.type, id: target.id }, amount: n, currency: target.currency, reason, idempotencyKey: key });
      setAmount(''); setReason(''); setKey(newClientId());
      onDone();
    } catch (e) { setError(supportErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card title="Request a refund">
      <ErrorBanner message={error} />
      {refundable.length > 1 ? (
        <Field label="Payment"><Select label="Payment" placeholder={null} value={`${target.type}:${target.id}`} onChange={setTargetKey} options={refundable.map((t) => ({ value: `${t.type}:${t.id}`, label: `${humanize(t.type)} ${t.reference || ''}` }))} /></Field>
      ) : null}
      <Muted>{humanize(target.type)} {target.reference || ''} · captured {money(target.captured, target.currency)} · refundable {money(target.available, target.currency)} · via {target.provider === 'razorpay' ? 'Razorpay' : 'the store (direct payment)'}</Muted>
      <Field label={`Amount (${target.currency})`} required><Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} /></Field>
      <Field label="Reason" required hint="Recorded on the refund and in the audit log."><Input multiline value={reason} onChangeText={setReason} maxLength={1000} /></Field>
      <Button label="Request refund" variant="primary" busy={busy} disabled={!(n > 0) || n > target.available || reason.trim().length < 5} onPress={submit} />
      <Muted>Every refund needs approval by another senior agent; high-value refunds need a supervisor.</Muted>
    </Card>
  );
}

function RefundRow({ r, me, caps, permissions, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mine = r.requestedBy === me?.adminId;
  const canApprove = permissions.canApproveRefund && !mine && (r.approval.level !== 'high' || caps.has('refund.approve_high'));
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); setDialog(null); setText(''); onChanged(); } catch (e) { setError(supportErrorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card>
      <View style={styles.participant}>
        <Text style={styles.amount}>{money(r.amount, r.currency)}</Text>
        <Badge tone={REFUND_TONE[r.status]}>{humanize(r.status)}</Badge>
        <Badge>{r.kind}</Badge>
        {r.approval.level === 'high' ? <Badge tone="error">Supervisor approval</Badge> : null}
      </View>
      <Text style={styles.body}>{r.reason}</Text>
      <Muted>
        Requested by {r.requestedByName} · {dateTime(r.createdAt)}
        {r.approval.approvedByName ? ` · approved by ${r.approval.approvedByName}` : ''}
        {r.approval.rejectionReason ? ` · rejected: ${r.approval.rejectionReason}` : ''}
        {r.execution.providerRefundId ? ` · provider ref ${r.execution.providerRefundId}` : ''}
        {r.execution.transactionRef ? ` · transfer ref ${r.execution.transactionRef}` : ''}
        {r.execution.errorMessage ? ` · ${r.execution.errorMessage}` : ''}
      </Muted>
      <ErrorBanner message={dialog ? null : error} />
      <View style={styles.actions}>
        {r.status === 'requested' && canApprove ? <Button size="sm" variant="primary" label="Approve & execute" onPress={() => setDialog('approve')} /> : null}
        {r.status === 'requested' && permissions.canApproveRefund && !mine ? <Button size="sm" label="Reject" onPress={() => setDialog('reject')} /> : null}
        {r.status === 'requested' && (mine || canApprove) ? <Button size="sm" variant="ghost" label="Cancel" busy={busy && !dialog} onPress={() => act(() => supportApi.cancelRefund(r._id))} /> : null}
        {['processing', 'failed'].includes(r.status) && permissions.canApproveRefund ? <Button size="sm" label="Check with provider" busy={busy && !dialog} onPress={() => act(() => supportApi.reconcileRefund(r._id))} /> : null}
        {r.status === 'awaiting_vendor' && permissions.canApproveRefund ? <Button size="sm" label="Confirm store transfer" onPress={() => setDialog('confirm')} /> : null}
        {r.status === 'requested' && mine ? <Muted>Waiting for another approver</Muted> : null}
      </View>
      <Sheet visible={Boolean(dialog)} onClose={() => setDialog(null)}
        title={dialog === 'approve' ? `Approve refund of ${money(r.amount, r.currency)}?` : dialog === 'reject' ? 'Reject refund' : "Confirm the store's refund transfer"}
        footer={<>
          <Button label="Cancel" onPress={() => setDialog(null)} disabled={busy} />
          <Button label={dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject' : 'Confirm'} variant={dialog === 'reject' ? 'danger' : 'primary'} busy={busy}
            disabled={(dialog === 'reject' && text.trim().length < 5) || (dialog === 'confirm' && text.trim().length < 4)}
            onPress={() => act(() => (dialog === 'approve' ? supportApi.approveRefund(r._id) : dialog === 'reject' ? supportApi.rejectRefund(r._id, text) : supportApi.confirmRefund(r._id, text)))} />
        </>}>
        <ErrorBanner message={error} />
        {dialog === 'approve' ? <Muted>{r.provider === 'razorpay' ? 'The refund is sent to Razorpay immediately after approval. The provider is checked first so an amount is never refunded twice.' : 'The store will be asked to return the money directly; confirm the transfer reference once they have paid.'}</Muted> : null}
        {dialog === 'reject' ? <Field label="Reason" required><Input multiline value={text} onChangeText={setText} /></Field> : null}
        {dialog === 'confirm' ? <Field label="Transfer reference (UPI UTR / bank ref)" required><Input value={text} onChangeText={setText} maxLength={80} /></Field> : null}
      </Sheet>
    </Card>
  );
}

export function RefundsPanel({ ticket, me, caps, permissions, onChanged }) {
  const { data, error, loading, reload } = useLoader(() => supportApi.listRefunds(ticket._id), [ticket._id, ticket.rev]);
  if (loading && !data) return <StateView loading />;
  if (error) return <StateView error={error} onRetry={reload} />;
  const changed = () => { reload(); onChanged(); };
  return (
    <View style={styles.panel}>
      {permissions.canRequestRefund ? <RefundRequest ticket={ticket} targets={data.targets} onDone={changed} /> : null}
      {data.refunds.length ? data.refunds.map((r) => <RefundRow key={r._id} r={r} me={me} caps={caps} permissions={permissions} onChanged={changed} />)
        : <StateView empty title="No refunds on this ticket" />}
      <Muted>Supervisor approval above {money(data.policy.highRiskAbove, data.policy.currency)}.</Muted>
    </View>
  );
}

// ── Related & activity ──────────────────────────────────────────────────────
function MiniTicket({ t }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/support/${t._id}`)} style={styles.mini} accessibilityRole="button">
      <View style={styles.participant}>
        <Text style={styles.muted}>{t.ticketNumber}</Text>
        <StatusPill ticket={t} /><PriorityPill priority={t.priority} /><TypePill ticket={t} /><EscalationPill escalation={t.escalation} />
      </View>
      <Text style={styles.body} numberOfLines={1}>{t.subject}</Text>
      <Muted>{timeAgo(t.createdAt)}{t.assignedAgentName ? ` · ${t.assignedAgentName}` : ''}</Muted>
    </Pressable>
  );
}

export function RelatedPanel({ related }) {
  const { data, error, loading, reload } = related;
  if (loading && !data) return <StateView loading />;
  if (error) return <StateView error={error} onRetry={reload} />;
  const groups = [
    ['Possible duplicates', data.possibleDuplicates, 'Same customer, same category, still open. Merge only after checking — nothing is merged automatically.'],
    ['Same order / booking / payment', data.sameTransaction],
    ['Previous disputes on this transaction', data.previousDisputes],
    ['Previous tickets from this customer', data.previousForCustomer],
  ];
  return (
    <View style={styles.panel}>
      {groups.map(([title, list, hint]) => (
        <View key={title} style={{ gap: 6 }}>
          <SectionTitle>{`${title} (${list.length})`}</SectionTitle>
          {hint && list.length ? <Muted>{hint}</Muted> : null}
          {list.length ? list.map((t) => <MiniTicket key={t._id} t={t} />) : <Muted>None</Muted>}
        </View>
      ))}
    </View>
  );
}

export function ActivityPanel({ ticket }) {
  const assignments = useLoader(() => supportApi.assignments(ticket._id), [ticket._id, ticket.rev]);
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, hasMore: false });
  const load = useCallback(async (after) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await supportApi.ticketAudit(ticket._id, after ? { cursor: after } : {});
      setEntries((e) => (after ? [...e, ...r.entries] : r.entries));
      setCursor(r.nextCursor);
      setState({ loading: false, error: null, hasMore: r.hasMore });
    } catch (e) {
      setState({ loading: false, error: supportErrorMessage(e), hasMore: false });
    }
  }, [ticket._id]);
  useEffect(() => { load(null); }, [load, ticket.rev]);
  return (
    <View style={styles.panel}>
      <Card title="Assignment history">
        {assignments.loading && !assignments.data ? <ActivityIndicator color={colors.primary} /> : assignments.data?.history?.length ? assignments.data.history.map((h, i) => (
          <Text key={i} style={styles.body}>
            <Text style={{ fontWeight: '700' }}>{humanize(h.action.replace('ticket.', ''))}</Text> by {h.by} · {dateTime(h.at)}
            {h.next?.agentName || h.next?.team ? ` → ${[h.next.agentName, h.next.team].filter(Boolean).join(' · ')}` : ''}
          </Text>
        )) : <Muted>Never assigned.</Muted>}
      </Card>
      <Card title="Audit trail">
        {state.error ? <StateView error={state.error} onRetry={() => load(null)} /> : entries.map((e) => (
          <View key={e._id} style={styles.audit}>
            <Text style={styles.body}><Text style={{ fontWeight: '700' }}>{e.action}</Text> · {e.actorName || e.actorType}{e.actorRole ? ` (${humanize(e.actorRole)})` : ''}</Text>
            <Muted>{dateTime(e.at)}{e.correlationId ? ` · ${e.correlationId}` : ''}</Muted>
            {e.previous || e.next ? <Text style={styles.mono}>{e.previous ? `${JSON.stringify(e.previous)} → ` : ''}{e.next ? JSON.stringify(e.next) : ''}</Text> : null}
          </View>
        ))}
        {state.loading ? <ActivityIndicator color={colors.primary} /> : state.hasMore ? <Button size="sm" label="Load more" onPress={() => load(cursor)} /> : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm, padding: spacing.md },
  muted: { fontSize: 12, color: colors.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  body: { fontSize: 13, color: colors.text, lineHeight: 19 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  participant: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeline: { borderLeftWidth: 2, borderLeftColor: colors.border, marginLeft: 6, paddingLeft: 12, gap: 12 },
  tlItem: { flexDirection: 'row', gap: 8 },
  tlDot: { position: 'absolute', left: -19, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  tlLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  amount: { fontSize: 16, fontWeight: '800', color: colors.text },
  mini: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 2 },
  audit: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, gap: 2 },
  mono: { fontSize: 10, color: colors.textMuted, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
