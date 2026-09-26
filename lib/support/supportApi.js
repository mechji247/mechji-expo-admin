import adminApi from "../services/adminApi";

// Thin wrappers over /api/admin/support and /api/admin/disputes. Every
// permission, visibility and business rule is enforced by the server; these
// only move data. Errors keep the server's friendly message + code.
const data = (res) => res?.data?.data;

export function supportErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.message || (error?.message === "Network Error" ? "You appear to be offline." : null) || fallback;
}
export const supportErrorCode = (error) => error?.response?.data?.error || null;

const idKey = () => `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
export const newClientId = idKey;

const S = "/support";
const D = "/disputes";
const enc = encodeURIComponent;

export const supportApi = {
  me: () => adminApi.get(`${S}/me`).then(data),
  meta: () => adminApi.get(`${S}/meta`).then(data),
  setAvailability: (isAvailable) => adminApi.patch(`${S}/me/availability`, { isAvailable }).then(data),
  inboxCounts: () => adminApi.get(`${S}/inbox/counts`).then(data),
  listTickets: (params) => adminApi.get(`${S}/tickets`, { params }).then(data),
  getTicket: (id) => adminApi.get(`${S}/tickets/${enc(id)}`).then(data),
  listMessages: (id, params) => adminApi.get(`${S}/tickets/${enc(id)}/messages`, { params }).then(data),
  postMessage: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/messages`, body).then(data),
  addNote: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/internal-notes`, body).then(data),
  requestInformation: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/request-information`, body).then(data),
  setStatus: (id, body) => adminApi.patch(`${S}/tickets/${enc(id)}/status`, body).then(data),
  setPriority: (id, body) => adminApi.patch(`${S}/tickets/${enc(id)}/priority`, body).then(data),
  assign: (id, body) => adminApi.patch(`${S}/tickets/${enc(id)}/assign`, body).then(data),
  assignments: (id) => adminApi.get(`${S}/tickets/${enc(id)}/assignments`).then(data),
  escalate: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/escalate`, body).then(data),
  resolveEscalation: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/escalation/resolve`, body).then(data),
  resolve: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/resolve`, body).then(data),
  close: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/close`, body).then(data),
  reopen: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/reopen`, body).then(data),
  markRead: (id) => adminApi.patch(`${S}/tickets/${enc(id)}/read`).then(data),
  context: (id) => adminApi.get(`${S}/tickets/${enc(id)}/context`).then(data),
  related: (id) => adminApi.get(`${S}/tickets/${enc(id)}/related`).then(data),
  merge: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/merge`, body).then(data),
  ticketAudit: (id, params) => adminApi.get(`${S}/tickets/${enc(id)}/audit`, { params }).then(data),
  openDispute: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/dispute`, body).then(data),
  // `file` is a picked document: { uri, name, mimeType }. React Native's
  // FormData streams the file from its local uri.
  uploadAttachment: (id, file) => {
    const form = new FormData();
    form.append("file", { uri: file.uri, name: file.name || "attachment", type: file.mimeType || "application/octet-stream" });
    return adminApi.post(`${S}/tickets/${enc(id)}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }).then(data);
  },
  listRefunds: (id) => adminApi.get(`${S}/tickets/${enc(id)}/refunds`).then(data),
  requestRefund: (id, body) => adminApi.post(`${S}/tickets/${enc(id)}/refunds`, { ...body, idempotencyKey: body.idempotencyKey || idKey() }).then(data),
  approveRefund: (refundId) => adminApi.post(`${S}/refunds/${enc(refundId)}/approve`).then(data),
  rejectRefund: (refundId, reason) => adminApi.post(`${S}/refunds/${enc(refundId)}/reject`, { reason }).then(data),
  cancelRefund: (refundId) => adminApi.post(`${S}/refunds/${enc(refundId)}/cancel`).then(data),
  reconcileRefund: (refundId) => adminApi.post(`${S}/refunds/${enc(refundId)}/reconcile`).then(data),
  confirmRefund: (refundId, transactionRef) => adminApi.post(`${S}/refunds/${enc(refundId)}/confirm`, { transactionRef }).then(data),
  analytics: (params) => adminApi.get(`${S}/analytics`, { params }).then(data),
  agents: () => adminApi.get(`${S}/agents`).then(data),
  updateAgent: (adminId, body) => adminApi.patch(`${S}/agents/${enc(adminId)}`, body).then(data),
  cannedReplies: (params) => adminApi.get(`${S}/canned-replies`, { params }).then(data),
  createCanned: (body) => adminApi.post(`${S}/canned-replies`, body).then(data),
  updateCanned: (id, body) => adminApi.patch(`${S}/canned-replies/${enc(id)}`, body).then(data),
  deleteCanned: (id) => adminApi.delete(`${S}/canned-replies/${enc(id)}`).then(data),
  useCanned: (id) => adminApi.post(`${S}/canned-replies/${enc(id)}/use`).then(data),
  policies: () => adminApi.get(`${S}/policies`).then(data),
  updatePolicies: (body) => adminApi.put(`${S}/policies`, body).then(data),
  audit: (params) => adminApi.get(`${S}/audit`, { params }).then(data),
  contactConfig: () => adminApi.get(`${S}/config`).then(data),
  updateContactConfig: (body) => adminApi.put(`${S}/config`, body).then(data),

  disputes: (params) => adminApi.get(D, { params }).then(data),
  dispute: (id) => adminApi.get(`${D}/${enc(id)}`).then(data),
  disputeTimeline: (id) => adminApi.get(`${D}/${enc(id)}/timeline`).then(data),
  disputeEvidence: (id) => adminApi.get(`${D}/${enc(id)}/evidence`).then(data),
  addEvidence: (id, body) => adminApi.post(`${D}/${enc(id)}/evidence`, body).then(data),
  addCounterparty: (id, summary) => adminApi.post(`${D}/${enc(id)}/participants`, { summary }).then(data),
  removeCounterparty: (id, reason) => adminApi.delete(`${D}/${enc(id)}/participants/counterparty`, { data: { reason } }).then(data),
  setSharedThread: (id, enabled) => adminApi.patch(`${D}/${enc(id)}/shared-thread`, { enabled }).then(data),
};
