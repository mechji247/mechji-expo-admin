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
  clearCurrentAdminUser,
  getAdminUserById,
  restoreAdminUser,
  selectAdminCurrentUserDeleteLoading,
  selectAdminCurrentUserError,
  selectAdminCurrentUserLoading,
  selectAdminCurrentUserRestoreLoading,
  selectAdminCurrentUserUpdateLoading,
  selectCurrentAdminUser,
  softDeleteAdminUser,
  updateAdminUserStatus,
} from '../../store/slices/userAdminSlice';

// The real /users/user/:id response shape isn't confirmed yet, so every
// field below reads through a fallback chain and this screen degrades to
// "—" rather than crashing on a field name that turns out to differ once
// the backend contract is confirmed.
function normalizeUserStatus(user) {
  const raw = user?.accountStatus || user?.status || '';
  return String(raw).toLowerCase().replace(/[^a-z]/g, '');
}

const STATUS_STYLES = {
  active: { bg: colors.successMuted, fg: colors.success, label: 'Active' },
  review: { bg: colors.warningMuted, fg: colors.warning, label: 'Review' },
  underreview: { bg: colors.warningMuted, fg: colors.warning, label: 'Review' },
  blocked: { bg: colors.dangerMuted, fg: colors.danger, label: 'Blocked' },
  restricted: { bg: colors.dangerMuted, fg: colors.danger, label: 'Blocked' },
  suspended: { bg: colors.dangerMuted, fg: colors.danger, label: 'Blocked' },
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoRow({ label, value, isLast }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const user = useSelector(selectCurrentAdminUser);
  const loading = useSelector(selectAdminCurrentUserLoading);
  const updateLoading = useSelector(selectAdminCurrentUserUpdateLoading);
  const deleteLoading = useSelector(selectAdminCurrentUserDeleteLoading);
  const restoreLoading = useSelector(selectAdminCurrentUserRestoreLoading);
  const error = useSelector(selectAdminCurrentUserError);

  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (id) dispatch(getAdminUserById(id));
    return () => {
      dispatch(clearCurrentAdminUser());
    };
  }, [dispatch, id]);

  const name = user?.name || user?.fullName || 'User';
  const meta = [user?.email, user?.city].filter(Boolean).join('  ·  ');

  const statusKey = normalizeUserStatus(user);
  const statusStyle = STATUS_STYLES[statusKey] || {
    bg: colors.background,
    fg: colors.textMuted,
    label: user?.accountStatus || user?.status || 'Unknown',
  };
  const isBlocked = statusKey === 'blocked' || statusKey === 'restricted' || statusKey === 'suspended';
  const isDeleted = Boolean(user?.isDeleted);

  const isBusy = updateLoading || deleteLoading || restoreLoading;

  const confirmAndDispatch = (title, message, action) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: action },
    ]);
  };

  const handleOrderHistory = () =>
    Alert.alert('Order history', 'Viewing order history is coming soon.');
  const handleEdit = () => Alert.alert('Edit details', 'Editing user details is coming soon.');
  const handleRestrict = () =>
    confirmAndDispatch(
      'Restrict account?',
      `${name} will lose access to the app until reactivated.`,
      () => dispatch(updateAdminUserStatus({ userId: id, accountStatus: 'blocked' }))
    );
  const handleReactivate = () =>
    dispatch(updateAdminUserStatus({ userId: id, accountStatus: 'active' }));
  const handleDelete = () =>
    confirmAndDispatch(
      'Delete user?',
      `This removes ${name} from the platform. This can be undone from this menu.`,
      () => dispatch(softDeleteAdminUser(id))
    );
  const handleRestore = () => dispatch(restoreAdminUser(id));

  const menuActions = isDeleted
    ? [{ key: 'restore', label: 'Restore user', onPress: handleRestore }]
    : [{ key: 'delete', label: 'Delete user', danger: true, onPress: handleDelete }];

  const isInitialLoading = loading && !user;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>User</Text>
        <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
        </Pressable>
      </View>

      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !user ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{error || 'User not found.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(id || name) }]}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          {!!meta && <Text style={styles.meta}>{meta}</Text>}

          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusStyle.fg }]} />
            <Text style={[styles.statusText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
          </View>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Orders placed</Text>
              <Text style={styles.statValue}>
                {user?.ordersCount ?? user?.analytics?.ordersPlaced ?? '—'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Joined</Text>
              <Text style={styles.statValue}>{formatDate(user?.createdAt || user?.joinedAt)}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <InfoRow label="User ID" value={user?.userId || user?._id || user?.id || '—'} />
            <InfoRow label="City" value={user?.city || user?.address?.city || '—'} />
            <InfoRow label="Phone" value={user?.phone || user?.phoneNumber || '—'} isLast />
          </View>

          <Pressable
            style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
            onPress={handleOrderHistory}
            disabled={isBusy}
          >
            <Ionicons name="receipt-outline" size={18} color={colors.surface} />
            <Text style={styles.primaryButtonText}>View order history</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleEdit} disabled={isBusy}>
            <Text style={styles.secondaryButtonText}>Edit details</Text>
          </Pressable>

          <Pressable
            style={[styles.dangerButton, isBusy && styles.buttonDisabled]}
            onPress={isBlocked ? handleReactivate : handleRestrict}
            disabled={isBusy}
          >
            {updateLoading ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={styles.dangerButtonText}>
                {isBlocked ? 'Reactivate account' : 'Restrict account'}
              </Text>
            )}
          </Pressable>
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
    borderRadius: 40,
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
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: colors.primary,
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