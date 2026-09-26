// Resolves an admin inbox notification (AdminNotificationInbox row, fetched
// from /admin/notifications/inbox) to a screen in this app, if one exists.
// Deliberately keyed off `data.navigate` (the schema field the backend
// always sets — see adminNotification.model.js), NOT `data.type`/eventType:
// that's a different shape used only by the raw push-notification payload
// and already handled separately by EVENT_ROUTE_MAP in app/_layout.js (the
// tap-to-open-app path). This resolver is for rows rendered inside the
// in-app inbox list itself.
//
// A `navigate` value with no real destination screen yet resolves to null
// so the caller can fall back to "no destination, just mark as read"
// instead of pushing a route that doesn't exist.
export function resolveAdminNotificationHref(notification) {
  const navigate = notification?.data?.navigate;
  const targetId = notification?.data?.targetId;
  if (!navigate) return null;

  switch (navigate) {
    case 'VendorDetail':
      return targetId ? `/vendors/${targetId}` : '/vendors';
    case 'ProductDetail':
      return targetId ? `/products/${targetId}` : '/products';
    case 'ServiceDetail':
      return targetId ? `/services/${targetId}` : '/services';
    case 'SupportTicketDetail':
      return targetId ? `/support/${targetId}` : '/support';
    case 'ReportDetail':
      // No report detail screen exists yet — land on the list rather than a dead route.
      return '/trust-safety';
    default:
      return null;
  }
}
