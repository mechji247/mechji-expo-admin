import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../../lib/constants/theme';
import { connectSupportSocket, disconnectSupportSocket, onSupportEvent } from '../../lib/support/supportSocket';
import {
  fetchInboxCounts, fetchSupportMeta, notificationDismissed, notificationReceived, selectSupportMetaStatus,
  selectSupportNotifications, supportDeskReset, ticketCreatedReceived, ticketSummaryReceived,
} from '../../store/slices/supportDeskSlice';

// Mounted once in the root layout while an admin is signed in. For admins
// with support access it keeps one live connection to the support desk so
// the open app gets in-app alerts (new/assigned/escalated tickets, replies,
// SLA warnings, approvals) — the server only sends device push to agents who
// are not connected. Admins without support access get a 403 on the meta
// request and nothing else happens.
const TOAST_MS = 6000;

export default function SupportLiveBridge({ active }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metaStatus = useSelector(selectSupportMetaStatus);
  const notifications = useSelector(selectSupportNotifications);
  const countsTimer = useRef(null);

  useEffect(() => {
    if (!active) {
      disconnectSupportSocket();
      dispatch(supportDeskReset());
      return;
    }
    dispatch(fetchSupportMeta());
  }, [active, dispatch]);

  useEffect(() => {
    if (!active || metaStatus !== 'succeeded') return undefined;
    connectSupportSocket();
    dispatch(fetchInboxCounts());
    const refreshCounts = () => {
      clearTimeout(countsTimer.current);
      countsTimer.current = setTimeout(() => dispatch(fetchInboxCounts()), 800);
    };
    const offs = [
      onSupportEvent('support:notification', (p) => { dispatch(notificationReceived(p)); refreshCounts(); }),
      onSupportEvent('support:ticket:new', (p) => { dispatch(ticketCreatedReceived(p)); refreshCounts(); }),
      ...['support:ticket:updated', 'support:assigned', 'support:escalated', 'support:resolved', 'support:status_updated', 'support:sla', 'support:message:new']
        .map((e) => onSupportEvent(e, (p) => { dispatch(ticketSummaryReceived(p)); refreshCounts(); })),
    ];
    return () => { offs.forEach((off) => off()); clearTimeout(countsTimer.current); };
  }, [active, metaStatus, dispatch]);

  const latest = notifications[0];
  const latestId = latest?.id;
  useEffect(() => {
    if (!latestId) return undefined;
    const timer = setTimeout(() => dispatch(notificationDismissed(latestId)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [latestId, dispatch]);

  if (!active || !latest) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]} accessibilityLiveRegion="polite">
      <Pressable
        style={styles.toast}
        accessibilityRole="button"
        accessibilityHint="Opens the support ticket"
        onPress={() => { dispatch(notificationDismissed(latest.id)); router.push(`/support/${latest.ticketId}`); }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{latest.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{latest.body}</Text>
        </View>
        <Pressable onPress={() => dispatch(notificationDismissed(latest.id))} hitSlop={10} accessibilityLabel="Dismiss">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 10 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  body: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  close: { fontSize: 14, color: colors.textMuted },
});
