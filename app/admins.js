import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors, getAvatarColor, spacing } from '../lib/constants/theme';
import { selectAdminId } from '../store/slices/adminSlice';
import {
  ADMIN_ROLES,
  clearAdminIdReset,
  clearManageAdminsMessages,
  clearPasswordReset,
  createAdmin,
  deleteAdmin,
  fetchAdmins,
  getAdminRecordId,
  resetAdminLoginId,
  resetAdminPassword,
  selectManageAdminsCreateError,
  selectManageAdminsCreateLoading,
  selectManageAdminsFilters,
  selectManageAdminsLastAdminIdReset,
  selectManageAdminsLastPasswordReset,
  selectManageAdminsList,
  selectManageAdminsListError,
  selectManageAdminsListStatus,
  selectManageAdminsPagination,
  selectManageAdminsRowActions,
  selectManageAdminsRowErrors,
  setAdminsFilters,
  updateAdminRole,
  updateAdminStatus,
} from '../store/slices/manageAdminsSlice';

const STATUS_FILTERS = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const ROLE_FILTERS = [{ label: 'All roles', value: '' }, ...ADMIN_ROLES.map((r) => ({ label: r, value: r }))];

const ROW_ACTION_LABELS = {
  role: 'Updating role…',
  status: 'Updating status…',
  delete: 'Deleting…',
  resetPassword: 'Resetting password…',
  resetAdminId: 'Resetting admin ID…',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function RoleBadge({ role }) {
  return (
    <View style={styles.roleBadge}>
      <Text style={styles.roleBadgeText}>{role || 'Admin'}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const active = status !== 'inactive';
  return (
    <View style={[styles.statusBadge, active ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
      <Text style={[styles.statusBadgeText, active ? styles.statusTextActive : styles.statusTextInactive]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// Bottom-sheet-style action list — Alert.alert's button count/order isn't
// reliable across platforms once you're past two or three actions, so this
// is a small hand-rolled sheet instead.
function ActionSheet({ visible, onClose, title, actions }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
          {!!title && <Text style={styles.sheetTitle}>{title}</Text>}
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

function RolePickerSheet({ visible, onClose, currentRole, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Change role</Text>
          {ADMIN_ROLES.map((role) => (
            <Pressable key={role} style={styles.sheetRow} onPress={() => onSelect(role)}>
              <Text style={styles.sheetRowText}>{role}</Text>
              {role === currentRole && <Text style={styles.sheetRowCheck}>✓</Text>}
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

// Shows a one-time reset result (new temp password / new admin ID) in a
// selectable text box so it can be copied via the OS's native long-press
// menu — no clipboard dependency needed for that.
function ResetResultModal({ visible, label, value, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{label}</Text>
          <Text style={styles.resultHint}>
            Share this with the admin now — it won't be shown again.
          </Text>
          <View style={styles.resultValueBox}>
            <Text selectable style={styles.resultValueText}>
              {value || '—'}
            </Text>
          </View>
          <Pressable style={styles.resultDoneButton} onPress={onClose}>
            <Text style={styles.resultDoneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CreateAdminModal({ visible, onClose, onSubmit, loading, error }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ADMIN_ROLES[1] || ADMIN_ROLES[0]);
  const [touched, setTouched] = useState(false);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const isValid = trimmedName.length > 0 && trimmedEmail.length > 0 && password.length >= 8;

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole(ADMIN_ROLES[1] || ADMIN_ROLES[0]);
    setTouched(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!isValid || loading) return;
    onSubmit({ name: trimmedName, email: trimmedEmail, password, role }, reset);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.centerBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.formCard}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.formTitle}>New admin</Text>
            <Text style={styles.formSubtitle}>
              The admin ID and initial sign-in link are assigned automatically.
            </Text>

            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              editable={!loading}
            />
            {touched && trimmedName.length === 0 && (
              <Text style={styles.fieldError}>Name is required</Text>
            )}

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {touched && trimmedEmail.length === 0 && (
              <Text style={styles.fieldError}>Email is required</Text>
            )}

            <Text style={styles.fieldLabel}>Temporary password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              editable={!loading}
            />
            {touched && password.length < 8 && (
              <Text style={styles.fieldError}>Password must be at least 8 characters</Text>
            )}

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleOptionsRow}>
              {ADMIN_ROLES.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleOption, role === r && styles.roleOptionActive]}
                  onPress={() => setRole(r)}
                  disabled={loading}
                >
                  <Text style={[styles.roleOptionText, role === r && styles.roleOptionTextActive]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formButtonRow}>
              <Pressable style={styles.formCancelButton} onPress={handleClose} disabled={loading}>
                <Text style={styles.formCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.formSubmitButton, (!isValid || loading) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={!isValid || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.formSubmitText}>Create admin</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// "Active X ago" and MFA on/off aren't fields the admin list endpoint is
// confirmed to return yet — each renders only when present rather than
// showing a fabricated placeholder.
function formatRelativeTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  return `${diffDay} days ago`;
}

function MfaPill({ enabled }) {
  if (enabled === undefined || enabled === null) return null;
  return (
    <View style={[styles.mfaPill, enabled ? styles.mfaPillOn : styles.mfaPillOff]}>
      <Text style={[styles.mfaPillText, enabled ? styles.mfaTextOn : styles.mfaTextOff]}>
        MFA {enabled ? 'on' : 'off'}
      </Text>
    </View>
  );
}

function AdminRow({ admin, rowAction, rowError, isSelf, onOpenActions }) {
  const id = getAdminRecordId(admin);
  const busy = !!rowAction;
  const activeLine = formatRelativeTime(admin?.lastActiveAt);

  return (
    <Pressable style={styles.row} onPress={() => onOpenActions(admin)} disabled={!id || busy}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(id || admin?.name) }]}>
        <Text style={styles.avatarText}>{getInitials(admin?.name)}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {admin?.name || 'Unnamed admin'}
          {isSelf && <Text style={styles.selfTag}>  (you)</Text>}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {admin?.role || 'Admin'}
          {activeLine ? ` · Active ${activeLine}` : ''}
        </Text>
        {!!rowError && <Text style={styles.rowErrorText}>{rowError}</Text>}
      </View>

      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={styles.rowRight}>
          <StatusBadge status={admin?.status} />
          <MfaPill enabled={admin?.mfaEnabled} />
        </View>
      )}
    </Pressable>
  );
}

export default function AdminsScreen() {
  const dispatch = useDispatch();

  const currentAdminId = useSelector(selectAdminId);
  const admins = useSelector(selectManageAdminsList);
  const listStatus = useSelector(selectManageAdminsListStatus);
  const listError = useSelector(selectManageAdminsListError);
  const pagination = useSelector(selectManageAdminsPagination);
  const filters = useSelector(selectManageAdminsFilters);
  const createLoading = useSelector(selectManageAdminsCreateLoading);
  const createError = useSelector(selectManageAdminsCreateError);
  const rowActions = useSelector(selectManageAdminsRowActions);
  const rowErrors = useSelector(selectManageAdminsRowErrors);
  const lastPasswordReset = useSelector(selectManageAdminsLastPasswordReset);
  const lastAdminIdReset = useSelector(selectManageAdminsLastAdminIdReset);

  const [searchText, setSearchText] = useState(filters.search || '');
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [actionsTarget, setActionsTarget] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);

  useEffect(() => {
    dispatch(fetchAdmins({ page: 1, ...filters }));
    return () => {
      dispatch(clearManageAdminsMessages());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const runFetch = useCallback(
    (nextFilters, page = 1) => {
      dispatch(fetchAdmins({ page, ...nextFilters }));
    },
    [dispatch]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchAdmins({ page: 1, ...filters }));
    setRefreshing(false);
  }, [dispatch, filters]);

  const handleSearchSubmit = () => {
    const next = { ...filters, search: searchText.trim() };
    dispatch(setAdminsFilters({ search: searchText.trim() }));
    runFetch(next, 1);
  };

  const handleStatusFilter = (value) => {
    const next = { ...filters, status: value };
    dispatch(setAdminsFilters({ status: value }));
    runFetch(next, 1);
  };

  const handleRoleFilter = (value) => {
    const next = { ...filters, role: value };
    dispatch(setAdminsFilters({ role: value }));
    runFetch(next, 1);
  };

  const handleLoadMore = () => {
    if (listStatus === 'loading') return;
    if (pagination.page >= pagination.totalPages) return;
    runFetch(filters, pagination.page + 1);
  };

  const handleCreateSubmit = (payload, resetForm) => {
    dispatch(createAdmin(payload)).then((result) => {
      if (createAdmin.fulfilled.match(result)) {
        resetForm();
        setCreateVisible(false);
      }
    });
  };

  const openActionsFor = (admin) => setActionsTarget(admin);
  const closeActions = () => setActionsTarget(null);

  const confirmAndDispatch = (title, message, onConfirm) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const handleToggleStatus = (admin) => {
    const id = getAdminRecordId(admin);
    const nextStatus = admin?.status === 'inactive' ? 'active' : 'inactive';
    const verb = nextStatus === 'inactive' ? 'Deactivate' : 'Activate';
    confirmAndDispatch(
      `${verb} ${admin?.name || 'this admin'}?`,
      nextStatus === 'inactive'
        ? 'They will no longer be able to sign in until reactivated.'
        : 'They will be able to sign in again.',
      () => dispatch(updateAdminStatus({ id, status: nextStatus }))
    );
  };

  const handleDelete = (admin) => {
    const id = getAdminRecordId(admin);
    confirmAndDispatch(
      `Delete ${admin?.name || 'this admin'}?`,
      'This permanently removes their admin account. This cannot be undone.',
      () => dispatch(deleteAdmin(id))
    );
  };

  const handleResetPassword = (admin) => {
    const id = getAdminRecordId(admin);
    confirmAndDispatch(
      'Reset password?',
      `A new temporary password will be generated for ${admin?.name || 'this admin'}.`,
      () => dispatch(resetAdminPassword(id))
    );
  };

  const handleResetAdminId = (admin) => {
    const id = getAdminRecordId(admin);
    confirmAndDispatch(
      'Reset admin ID?',
      `${admin?.name || 'This admin'} will need their new admin ID to sign in.`,
      () => dispatch(resetAdminLoginId(id))
    );
  };

  const actionsForTarget = actionsTarget
    ? [
        {
          key: 'role',
          label: 'Change role',
          onPress: () => setRoleTarget(actionsTarget),
        },
        {
          key: 'status',
          label: actionsTarget.status === 'inactive' ? 'Activate' : 'Deactivate',
          onPress: () => handleToggleStatus(actionsTarget),
        },
        {
          key: 'resetPassword',
          label: 'Reset password',
          onPress: () => handleResetPassword(actionsTarget),
        },
        {
          key: 'resetAdminId',
          label: 'Reset admin ID',
          onPress: () => handleResetAdminId(actionsTarget),
        },
        {
          key: 'delete',
          label: 'Delete admin',
          danger: true,
          onPress: () => handleDelete(actionsTarget),
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Admin team</Text>
          <Text style={styles.headerSubtitle}>
            {pagination.total || admins.length} internal accounts
          </Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => setCreateVisible(true)}>
          <Ionicons name="add" size={20} color={colors.surface} />
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={handleSearchSubmit}
        placeholder="Search by name, email, or admin ID"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.value || 'all-status'}
            label={f.label}
            active={filters.status === f.value}
            onPress={() => handleStatusFilter(f.value)}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {ROLE_FILTERS.map((f) => (
          <FilterChip
            key={f.value || 'all-role'}
            label={f.label}
            active={filters.role === f.value}
            onPress={() => handleRoleFilter(f.value)}
          />
        ))}
      </ScrollView>

      {!!listError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{listError}</Text>
        </View>
      )}

      <FlatList
        data={admins}
        keyExtractor={(item, index) => getAdminRecordId(item) || String(index)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        renderItem={({ item }) => {
          const id = getAdminRecordId(item);
          return (
            <AdminRow
              admin={item}
              rowAction={rowActions[id]}
              rowError={rowErrors[id]}
              isSelf={!!currentAdminId && id === currentAdminId}
              onOpenActions={openActionsFor}
            />
          );
        }}
        ListEmptyComponent={
          listStatus === 'loading' ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No admins found.</Text>
            </View>
          )
        }
        ListFooterComponent={
          <>
            {listStatus === 'loading' && admins.length > 0 && (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            <Pressable style={styles.inviteRow} onPress={() => setCreateVisible(true)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.inviteRowText}>Invite admin</Text>
            </Pressable>
          </>
        }
      />

      <ActionSheet
        visible={!!actionsTarget}
        onClose={closeActions}
        title={actionsTarget?.name}
        actions={actionsForTarget}
      />

      <RolePickerSheet
        visible={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        currentRole={roleTarget?.role}
        onSelect={(role) => {
          const id = getAdminRecordId(roleTarget);
          setRoleTarget(null);
          dispatch(updateAdminRole({ id, role }));
        }}
      />

      <CreateAdminModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSubmit={handleCreateSubmit}
        loading={createLoading}
        error={createError}
      />

      <ResetResultModal
        visible={!!lastPasswordReset}
        label="New temporary password"
        value={lastPasswordReset?.tempPassword}
        onClose={() => dispatch(clearPasswordReset())}
      />

      <ResetResultModal
        visible={!!lastAdminIdReset}
        label="New admin ID"
        value={lastAdminIdReset?.newAdminId}
        onClose={() => dispatch(clearAdminIdReset())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.xs,
  },
  inviteRowText: {
    marginLeft: spacing.xs,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipRow: {
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  selfTag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  mfaPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  mfaPillOn: {
    backgroundColor: colors.successMuted,
  },
  mfaPillOff: {
    backgroundColor: colors.dangerMuted,
  },
  mfaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mfaTextOn: {
    color: colors.success,
  },
  mfaTextOff: {
    color: colors.danger,
  },
  rowErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.warningMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadgeActive: {
    backgroundColor: colors.successMuted,
  },
  statusBadgeInactive: {
    backgroundColor: colors.dangerMuted,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextInactive: {
    color: colors.danger,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  footerLoading: {
    paddingVertical: spacing.md,
  },

  // Bottom sheets
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
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  sheetRowCheck: {
    color: colors.primary,
    fontWeight: '700',
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

  // Centered modals (create form, reset result)
  centerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  formCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  formSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  fieldError: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.danger,
  },
  roleOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  roleOptionActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  roleOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  roleOptionTextActive: {
    color: colors.primary,
  },
  formButtonRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  formCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  formCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  formSubmitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  formSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  resultCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  resultHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  resultValueBox: {
    marginTop: spacing.md,
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  resultValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  resultDoneButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  resultDoneText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
});