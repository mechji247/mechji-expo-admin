import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, getAvatarColor, spacing } from '../../lib/constants/theme';
import {
  approveVendor,
  clearAdminVendor,
  fetchVendorAdminView,
  reinstateVendor,
  restoreVendor,
  selectAdminVendor,
  selectAdminVendorActionError,
  selectAdminVendorActionLoading,
  selectAdminVendorError,
  selectAdminVendorStatus,
  softDeleteVendor,
  suspendVendor,
} from '../../store/slices/adminVendorSlice';

// The real /vendors/vendor/:id response shape isn't confirmed yet, so
// every field below reads through a fallback chain and this screen
// degrades to "—" rather than crashing on a field name that turns out
// to differ once the backend contract is confirmed.
function normalizeVendorStatus(vendor) {
  const raw = vendor?.storeStatus?.status || vendor?.status || '';
  return String(raw).toLowerCase().replace(/[^a-z]/g, '');
}

const STATUS_STYLES = {
  verified: { bg: colors.successMuted, fg: colors.success, label: 'Verified' },
  approved: { bg: colors.successMuted, fg: colors.success, label: 'Verified' },
  active: { bg: colors.successMuted, fg: colors.success, label: 'Verified' },
  pending: { bg: colors.warningMuted, fg: colors.warning, label: 'Pending verification' },
  pendingverification: { bg: colors.warningMuted, fg: colors.warning, label: 'Pending verification' },
  underreview: { bg: colors.infoMuted, fg: colors.info, label: 'Under review' },
  suspended: { bg: colors.dangerMuted, fg: colors.danger, label: 'Suspended' },
  blacklisted: { bg: colors.dangerMuted, fg: colors.danger, label: 'Suspended' },
  closed: { bg: colors.dangerMuted, fg: colors.danger, label: 'Suspended' },
  rejected: { bg: colors.dangerMuted, fg: colors.danger, label: 'Rejected' },
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

// Backend may already send a formatted string ("₹3.2L") or a raw number
// — show the string as-is, or fall back to a plain rupee-formatted
// number if it's numeric.
function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoRow({ label, value, isLast, valueNode }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      {valueNode || <Text style={styles.infoValue}>{value}</Text>}
    </View>
  );
}

function ActionSheet({ visible, onClose, actions }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              style={styles.sheetRow}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            >
              <Text style={[styles.sheetRowText, action.danger && styles.sheetRowTextDanger]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={[styles.sheetRow, styles.sheetCancelRow]} onPress={onClose}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const vendor = useSelector(selectAdminVendor);
  const fetchStatus = useSelector(selectAdminVendorStatus);
  const fetchError = useSelector(selectAdminVendorError);
  const actionLoading = useSelector(selectAdminVendorActionLoading);
  const actionError = useSelector(selectAdminVendorActionError);

  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchVendorAdminView(id));
    return () => {
      dispatch(clearAdminVendor());
    };
  }, [dispatch, id]);

  const businessName = vendor?.businessName || vendor?.name || 'Vendor';
  const category = vendor?.category || vendor?.businessCategory || '';
  const city = vendor?.city || vendor?.address?.city || '';
  const metaLine = [category, city].filter(Boolean).join('  ·  ');

  const statusKey = normalizeVendorStatus(vendor);
  const statusStyle = STATUS_STYLES[statusKey] || {
    bg: colors.background,
    fg: colors.textMuted,
    label: vendor?.storeStatus?.status || vendor?.status || 'Unknown',
  };
  const isPending = statusKey === 'pending' || statusKey === 'pendingverification' || statusKey === 'underreview';
  const isSuspended = statusKey === 'suspended' || statusKey === 'blacklisted' || statusKey === 'closed';
  const isDeleted = Boolean(vendor?.isDeleted);

  const isBusy = Object.values(actionLoading || {}).some(Boolean);

  const confirmAndDispatch = (title, message, action) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: action },
    ]);
  };

  const handleApprove = () => dispatch(approveVendor(id));
  const handleReinstate = () => dispatch(reinstateVendor(id));
  const handleSuspend = () =>
    confirmAndDispatch(
      'Suspend vendor?',
      `${businessName} will be taken off the marketplace until reinstated.`,
      () => dispatch(suspendVendor({ vendorId: id }))
    );
  const handleEdit = () =>
    Alert.alert('Edit vendor details', 'Editing vendor details is coming soon.');
  const handleDelete = () =>
    confirmAndDispatch(
      'Delete vendor?',
      `This removes ${businessName} from the marketplace. This can be undone from this menu.`,
      () => dispatch(softDeleteVendor(id))
    );
  const handleRestore = () => dispatch(restoreVendor(id));

  const menuActions = isDeleted
    ? [{ key: 'restore', label: 'Restore vendor', onPress: handleRestore }]
    : [{ key: 'delete', label: 'Delete vendor', danger: true, onPress: handleDelete }];

  const isInitialLoading = fetchStatus === 'loading' && !vendor;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vendor</Text>
        <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
        </Pressable>
      </View>

      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !vendor ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{fetchError || 'Vendor not found.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(id || businessName) }]}>
            <Text style={styles.avatarText}>{getInitials(businessName)}</Text>
          </View>
          <Text style={styles.name}>{businessName}</Text>
          {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}

          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusStyle.fg }]} />
            <Text style={[styles.statusText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
          </View>

          {!!fetchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          )}
          {!!actionError && Object.values(actionError).some(Boolean) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {Object.values(actionError).find(Boolean)}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Revenue (90d)</Text>
              <Text style={styles.statValue}>
                {formatMoney(vendor?.analytics?.revenue90d ?? vendor?.revenue90d)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Products listed</Text>
              <Text style={styles.statValue}>
                {vendor?.productsCount ?? vendor?.analytics?.productsListed ?? '—'}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <InfoRow label="Vendor ID" value={vendor?.vendorId || vendor?._id || vendor?.id || '—'} />
            <InfoRow label="Owner" value={vendor?.ownerName || vendor?.owner?.name || '—'} />
            <InfoRow
              label="KYC documents"
              valueNode={
                vendor?.kyc?.uploaded !== undefined && vendor?.kyc?.required !== undefined ? (
                  <View style={styles.kycPill}>
                    <Text style={styles.kycPillText}>
                      {vendor.kyc.uploaded} of {vendor.kyc.required} uploaded
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.infoValue}>—</Text>
                )
              }
            />
            <InfoRow
              label="Applied on"
              value={formatDate(vendor?.appliedAt || vendor?.createdAt)}
              isLast
            />
          </View>

          {isPending && (
            <Pressable
              style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
              onPress={handleApprove}
              disabled={isBusy}
            >
              {actionLoading?.approve ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={colors.surface} />
                  <Text style={styles.primaryButtonText}>Approve vendor</Text>
                </>
              )}
            </Pressable>
          )}

          {isSuspended && (
            <Pressable
              style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
              onPress={handleReinstate}
              disabled={isBusy}
            >
              {actionLoading?.reinstate ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={colors.surface} />
                  <Text style={styles.primaryButtonText}>Reinstate vendor</Text>
                </>
              )}
            </Pressable>
          )}

          <Pressable style={styles.secondaryButton} onPress={handleEdit} disabled={isBusy}>
            <Text style={styles.secondaryButtonText}>Edit vendor details</Text>
          </Pressable>

          {!isSuspended && (
            <Pressable
              style={[styles.dangerButton, isBusy && styles.buttonDisabled]}
              onPress={handleSuspend}
              disabled={isBusy}
            >
              {actionLoading?.suspend ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.dangerButtonText}>Suspend vendor</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}

      <ActionSheet visible={menuVisible} onClose={() => setMenuVisible(false)} actions={menuActions} />
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: '700',
  },
  name: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    width: '100%',
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
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
  kycPill: {
    backgroundColor: colors.warningMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  kycPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    textAlign: 'right',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    marginLeft: spacing.xs,
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dangerButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerMuted,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    marginTop: spacing.sm,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetRow: {
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetRowText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  sheetRowTextDanger: {
    color: colors.danger,
  },
  sheetCancelRow: {
    borderBottomWidth: 0,
    marginTop: spacing.xs,
  },
  sheetCancelText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
});