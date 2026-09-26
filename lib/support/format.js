// Display helpers for the Support Management section. Labels for business
// values (outcomes, reasons, teams…) always come from GET /support/meta —
// these only format dates, durations, money and map states to colour tones.

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const fmt = (v, u) => (diff >= 0 ? `${v}${u} ago` : `in ${v}${u}`);
  if (mins < 1) return diff >= 0 ? "Just now" : "Now";
  if (mins < 60) return fmt(mins, "m");
  const hours = Math.round(mins / 60);
  if (hours < 48) return fmt(hours, "h");
  const days = Math.round(hours / 24);
  if (days < 14) return fmt(days, "d");
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function dateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function duration(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = mins / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function money(amount, currency = "INR") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export const humanize = (value) => {
  if (!value) return "—";
  const s = String(value).replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const labelFrom = (list, id) => list?.find?.((x) => x.id === id)?.label || humanize(id);

export function statusTone(status) {
  switch (status) {
    case "open": case "reopened": return "warning";
    case "assigned": case "in_progress": return "info";
    case "waiting_for_customer": return "neutral";
    case "waiting_for_support": return "warning";
    case "resolved": return "success";
    case "closed": return "neutral";
    default: return "neutral";
  }
}

export const priorityTone = (p) => ({ urgent: "error", high: "warning", normal: "info", low: "neutral" }[p] || "neutral");
export const slaTone = (s) => ({ breached: "error", at_risk: "warning", on_time: "success", met: "success" }[s] || "neutral");
export const slaLabel = (s) => ({ breached: "SLA breached", at_risk: "Approaching SLA", on_time: "On time", met: "SLA met", none: "No SLA" }[s] || "—");

export const channelLabel = (channel, ticket) => {
  if (channel === "internal") return "Internal note";
  if (channel === "shared") return "Shared with all parties";
  if (channel === "counterparty") return `Private · ${ticket?.counterparty?.type === "vendor" ? "store" : "customer"}`;
  return `Private · ${ticket?.customerType === "vendor" ? "store" : "customer"}`;
};

export function fillPlaceholders(body, values) {
  return String(body || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (values[k] != null && values[k] !== "" ? String(values[k]) : m));
}
