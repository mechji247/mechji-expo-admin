import { Badge } from './ui';
import { priorityTone, slaLabel, slaTone, statusTone, timeAgo } from '../../lib/support/format';

export function StatusPill({ ticket }) {
  return <Badge tone={statusTone(ticket.status)}>{ticket.statusLabel || ticket.status}</Badge>;
}

export function PriorityPill({ priority }) {
  return <Badge tone={priorityTone(priority)}>{priority === 'urgent' ? '⚑ ' : ''}{priority}</Badge>;
}

export function SlaPill({ sla }) {
  if (!sla || sla.state === 'none') return null;
  const due = sla.nextDeadlineAt && ['on_time', 'at_risk'].includes(sla.state) ? ` · due ${timeAgo(sla.nextDeadlineAt)}` : '';
  return <Badge tone={slaTone(sla.state)}>{slaLabel(sla.state)}{due}</Badge>;
}

export function EscalationPill({ escalation }) {
  if (!escalation?.active) return null;
  return <Badge tone="error">▲ Escalated</Badge>;
}

export function TypePill({ ticket }) {
  if (ticket.type !== 'dispute') return null;
  return <Badge tone="warning">Dispute</Badge>;
}
