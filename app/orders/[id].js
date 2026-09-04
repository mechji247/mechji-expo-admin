import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import {
  fetchBookingById,
  fetchOrderById,
  selectCurrentOrder,
  selectCurrentOrderError,
  selectCurrentOrderLoading,
  selectProductOrders,
  selectServiceBookings,
  updateBookingStatus,
  updateOrderStatus,
} from '../../store/slices/ordersSlice';

// Backed by GET /admin/orders/order/:id and /admin/orders/booking/:id.
// While that request is in flight (or if it 404s — the backend doesn't
// track every historical field on the list endpoint), this screen falls
// back to whatever the Orders list already loaded into ordersSlice, so
// opening a row you just tapped still shows something immediately.
const STAGES = ['placed', 'confirmed', 'shipped', 'delivered'];
const STAGE_LABELS = { placed: 'Placed', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered' };

function normalizeStatus(status) {
  return String(status || '').toLowerCase().replace(/[^a-z]/g, '');
}

function getOrderId(order) {
  return order?._id || order?.id || null;
}

function getOrderCode(order) {
  return order?.orderId || order?.orderNumber || order?.code || getOrderId(order) || '—';
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function Stepper({ statusKey }) {
  const activeIndex = STAGES.indexOf(statusKey);
  return (
    <View style={styles.stepperCard}>
      <View style={styles.stepperRow}>
        {STAGES.map((stage, index) => {
          const isDone = activeIndex >= 0 && index < activeIndex;
          const isCurrent = index === activeIndex;
          const isFilled = isDone || isCurrent;
          const lineFilled = activeIndex >= 0 && index < activeIndex;
          return (
            <View key={stage} style={styles.stepItem}>
              <View style={styles.stepDotRow}>
                <View
                  style={[
                    styles.stepDot,
                    isFilled && (isCurrent ? styles.stepDotCurrent : styles.stepDotDone),
                  ]}
                >
                  {isFilled && <Ionicons name="checkmark" size={12} color={colors.surface} />}
                </View>
                {index < STAGES.length - 1 && (
                  <View style={[styles.stepLine, lineFilled && styles.stepLineFilled]} />
                )}
              </View>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>
                {STAGE_LABELS[stage]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function InfoRow({ label, value, isLast }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id, type } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const isService = type === 'service';

  const productOrders = useSelector(selectProductOrders);
  const serviceBookings = useSelector(selectServiceBookings);
  const current = useSelector(selectCurrentOrder);
  const currentLoading = useSelector(selectCurrentOrderLoading);
  const currentError = useSelector(selectCurrentOrderError);

  useEffect(() => {
    if (!id) return;
    dispatch(isService ? fetchBookingById(id) : fetchOrderById(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isService]);

  const listMatch = (isService ? serviceBookings : productOrders).find(
    (o) => String(getOrderId(o)) === String(id)
  );
  // The fetched detail record wins once it's in and actually matches this
  // screen's id — otherwise (still loading, or the fetch failed) fall
  // back to whatever the list already has so the screen isn't blank.
  const order = current && String(getOrderId(current)) === String(id) ? current : listMatch;

  const statusKey = normalizeStatus(order?.status);
  const isCancelled = statusKey === 'cancelled';

  const customer = order?.customerName || order?.customer?.name || order?.user?.name || '—';
  const vendor = order?.vendorName || order?.vendor?.businessName || order?.vendor?.name || '—';
  const items = order?.items || [];

  const pricing = order?.pricing || {};
  const subtotal = pricing.subtotal ?? order?.subtotal;
  const delivery = pricing.delivery ?? order?.deliveryFee;
  const discount = pricing.discount ?? order?.platformDiscount;
  const total = pricing.total ?? order?.totalAmount ?? order?.total ?? order?.amount;

  const handleUpdateStatus = () => {
    const nextIndex = STAGES.indexOf(statusKey) + 1;
    const nextStatus = STAGES[nextIndex];
    if (!nextStatus) {
      Alert.alert('Update order status', 'This order is already at its final stage.');
      return;
    }
    const thunk = isService ? updateBookingStatus : updateOrderStatus;
    const arg = isService
      ? { bookingId: id, status: nextStatus }
      : { orderId: id, status: nextStatus };
    dispatch(thunk(arg))
      .unwrap()
      .catch((message) => Alert.alert('Update failed', message || 'Could not update status.'));
  };
  const handleContactCustomer = () =>
    Alert.alert('Contact customer', 'Messaging customers directly is coming soon.');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Order {getOrderCode(order)}</Text>
          {!!(order?.placedAt || order?.createdAt) && (
            <Text style={styles.headerSubtitle}>
              Placed {formatDateTime(order?.placedAt || order?.createdAt)}
            </Text>
          )}
        </View>
      </View>

      {!order ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {currentLoading
              ? 'Loading order…'
              : currentError || 'Order not found. Open it from the Orders list to view its details.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {isCancelled ? (
            <View style={styles.cancelledBanner}>
              <Ionicons name="close-circle" size={16} color={colors.danger} />
              <Text style={styles.cancelledText}>This order was cancelled.</Text>
            </View>
          ) : (
            <Stepper statusKey={statusKey} />
          )}

          <Text style={styles.sectionLabel}>ITEMS</Text>
          <View style={styles.card}>
            {items.length ? (
              items.map((item, index) => (
                <View
                  key={item?._id || item?.id || index}
                  style={[styles.itemRow, index < items.length - 1 && styles.infoRowDivider]}
                >
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item?.name || item?.title || 'Item'}
                    {item?.quantity ? ` ×${item.quantity}` : ''}
                  </Text>
                  <Text style={styles.itemPrice}>{formatAmount(item?.price ?? item?.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyCardText}>Item details aren't available for this order yet.</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>PRICING</Text>
          <View style={styles.card}>
            <InfoRow label="Subtotal" value={formatAmount(subtotal)} />
            <InfoRow label="Delivery" value={formatAmount(delivery)} />
            <InfoRow
              label="Platform discount"
              value={
                discount !== undefined && discount !== null && discount !== ''
                  ? `−${formatAmount(discount)}`
                  : '—'
              }
            />
            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatAmount(total)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <InfoRow label="Customer" value={customer} />
            <InfoRow label="Vendor" value={vendor} isLast />
          </View>

          {!isCancelled && (
            <Pressable style={styles.primaryButton} onPress={handleUpdateStatus}>
              <Text style={styles.primaryButtonText}>
                {STAGES[STAGES.indexOf(statusKey) + 1]
                  ? `Mark as ${STAGE_LABELS[STAGES[STAGES.indexOf(statusKey) + 1]]}`
                  : 'Update order status'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={handleContactCustomer}>
            <Text style={styles.secondaryButtonText}>Contact customer</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepperCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  stepperRow: {
    flexDirection: 'row',
  },
  stepItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  stepDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotCurrent: {
    backgroundColor: colors.info,
    borderColor: colors.info,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLineFilled: {
    backgroundColor: colors.success,
  },
  stepLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 6,
  },
  stepLabelCurrent: {
    color: colors.info,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerMuted,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cancelledText: {
    marginLeft: spacing.xs,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginRight: spacing.sm,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  emptyCardText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
});