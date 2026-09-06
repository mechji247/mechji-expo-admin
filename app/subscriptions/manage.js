import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  fetchSubscriptionPlans,
  selectPlanActionLoading,
  selectSubscriptionPlans,
  selectSubscriptionPlansError,
  selectSubscriptionPlansLoading,
  updateSubscriptionPlan,
} from '../../store/slices/subscriptionsSlice';

const TIERS = ['free', 'small', 'medium', 'large', 'ultra'];

const emptyFeature = () => ({ key: `${Date.now()}_${Math.random()}`, name: '', description: '', enabled: true });

const emptyPlan = (tier = '') => ({
  tier,
  razorpayPlanId: '',
  displayName: '',
  limits: { maxProducts: '', maxServices: '' },
  pricing: {
    amount: '',
    currency: 'USD',
    billingCycle: 'yearly',
    originalPrice: '',
    annualDiscount: '',
    savingsAmount: '',
  },
  commission: { flatRate: '', percentageRate: '', productThreshold: '1000' },
  features: [emptyFeature()],
  isActive: true,
  sortOrder: '',
});

const planToForm = (plan) => ({
  tier: plan.tier,
  razorpayPlanId: plan.razorpayPlanId || '',
  displayName: plan.displayName || '',
  limits: {
    maxProducts: String(plan.limits?.maxProducts ?? ''),
    maxServices: String(plan.limits?.maxServices ?? ''),
  },
  pricing: {
    amount: String(plan.pricing?.amount ?? ''),
    currency: String(plan.pricing?.currency || 'USD').toUpperCase(),
    billingCycle: plan.pricing?.billingCycle || 'yearly',
    originalPrice: plan.pricing?.originalPrice == null ? '' : String(plan.pricing.originalPrice),
    annualDiscount: String(plan.pricing?.annualDiscount ?? ''),
    savingsAmount: String(plan.pricing?.savingsAmount ?? ''),
  },
  commission: {
    flatRate: String(plan.commission?.flatRate ?? ''),
    percentageRate: String(plan.commission?.percentageRate ?? ''),
    productThreshold: String(plan.commission?.productThreshold ?? 1000),
  },
  features: plan.features?.length
    ? plan.features.map((feature) => ({ key: `${Date.now()}_${Math.random()}`, name: feature.name || '', description: feature.description || '', enabled: feature.enabled !== false }))
    : [emptyFeature()],
  isActive: plan.isActive !== false,
  sortOrder: String(plan.sortOrder ?? ''),
});

const isNonNegativeNumber = (value) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

const validate = (form, isEdit) => {
  if (!isEdit && !form.tier) return 'Choose a plan tier.';
  if (!form.displayName.trim()) return 'Display name is required.';
  if (!isNonNegativeNumber(form.limits.maxProducts) || !isNonNegativeNumber(form.limits.maxServices)) return 'Product and service limits must be zero or greater.';
  if (!isNonNegativeNumber(form.pricing.amount)) return 'Plan price must be zero or greater.';
  if (!isNonNegativeNumber(form.commission.flatRate)) return 'Flat commission must be zero or greater.';
  if (!isNonNegativeNumber(form.commission.percentageRate) || Number(form.commission.percentageRate) > 100) return 'Percentage commission must be between 0 and 100.';
  if (form.commission.productThreshold !== '' && !isNonNegativeNumber(form.commission.productThreshold)) return 'Order threshold must be zero or greater.';
  if (form.pricing.annualDiscount !== '' && (!isNonNegativeNumber(form.pricing.annualDiscount) || Number(form.pricing.annualDiscount) > 100)) return 'Annual discount must be between 0 and 100.';
  return null;
};

const buildPayload = (form) => ({
  tier: form.tier,
  razorpayPlanId: form.razorpayPlanId.trim(),
  displayName: form.displayName.trim(),
  limits: {
    maxProducts: Number(form.limits.maxProducts),
    maxServices: Number(form.limits.maxServices),
  },
  pricing: {
    amount: Number(form.pricing.amount),
    currency: String(form.pricing.currency || 'USD').toUpperCase(),
    billingCycle: form.pricing.billingCycle,
    originalPrice: form.pricing.originalPrice === '' ? null : Number(form.pricing.originalPrice),
    annualDiscount: form.pricing.annualDiscount === '' ? 0 : Number(form.pricing.annualDiscount),
    savingsAmount: form.pricing.savingsAmount === '' ? 0 : Number(form.pricing.savingsAmount),
  },
  commission: {
    flatRate: Number(form.commission.flatRate),
    percentageRate: Number(form.commission.percentageRate),
    ...(form.commission.productThreshold === '' ? {} : { productThreshold: Number(form.commission.productThreshold) }),
  },
  features: form.features
    .filter((feature) => feature.name.trim())
    .map(({ name, description, enabled }) => ({ name: name.trim(), description: description.trim(), enabled })),
  isActive: form.isActive,
  sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
});

const formatMoney = (amount, currency = 'USD') => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
};

export default function ManageSubscriptionPlansScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const plans = useSelector(selectSubscriptionPlans);
  const loading = useSelector(selectSubscriptionPlansLoading);
  const error = useSelector(selectSubscriptionPlansError);
  const actionLoading = useSelector(selectPlanActionLoading);
  const [modal, setModal] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [form, setForm] = useState(emptyPlan());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchSubscriptionPlans());
  }, [dispatch]);

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [plans]);
  const availableTiers = useMemo(() => TIERS.filter((tier) => !plans.some((plan) => plan.tier === tier)), [plans]);

  const openCreate = () => {
    setActivePlan(null);
    setForm(emptyPlan(availableTiers[0] || ''));
    setFormError('');
    setModal('create');
  };

  const openEdit = (plan) => {
    setActivePlan(plan);
    setForm(planToForm(plan));
    setFormError('');
    setModal('edit');
  };

  const closeModal = () => {
    if (!saving) setModal(null);
  };

  const update = (path, value) => {
    setForm((current) => {
      const next = { ...current, limits: { ...current.limits }, pricing: { ...current.pricing }, commission: { ...current.commission } };
      const [group, key] = path.split('.');
      if (key) next[group][key] = value;
      else next[group] = value;
      return next;
    });
  };

  const submit = async () => {
    const validationError = validate(form, modal === 'edit');
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = buildPayload(form);
      if (modal === 'create') {
        await dispatch(createSubscriptionPlan(payload)).unwrap();
      } else {
        const { tier, ...updatePayload } = payload;
        await dispatch(updateSubscriptionPlan({ planId: activePlan._id, payload: updatePayload })).unwrap();
      }
      setModal(null);
      await dispatch(fetchSubscriptionPlans()).unwrap();
    } catch (requestError) {
      setFormError(typeof requestError === 'string' ? requestError : 'Unable to save this subscription plan.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (plan) => {
    Alert.alert(
      `Delete ${plan.displayName}?`,
      'This cannot be undone. Plans with subscribed vendors must be deactivated instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteSubscriptionPlan(plan._id)).unwrap();
            } catch (requestError) {
              Alert.alert('Could not delete plan', typeof requestError === 'string' ? requestError : 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (plan) => {
    try {
      await dispatch(updateSubscriptionPlan({ planId: plan._id, payload: { isActive: !plan.isActive } })).unwrap();
    } catch (requestError) {
      Alert.alert('Could not update plan', typeof requestError === 'string' ? requestError : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Manage plans</Text>
          <Text style={styles.subtitle}>Pricing, limits and commission rules</Text>
        </View>
        <Pressable onPress={openCreate} disabled={!availableTiers.length} style={[styles.addButton, !availableTiers.length && styles.disabled]}>
          <Ionicons name="add" size={19} color={colors.surface} />
          <Text style={styles.addButtonText}>Plan</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => dispatch(fetchSubscriptionPlans())}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {sortedPlans.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>No subscription plans</Text><Text style={styles.emptyText}>Create the first plan to make it available to vendors.</Text></View>
          ) : sortedPlans.map((plan) => (
            <PlanCard
              key={plan._id}
              plan={plan}
              busy={Boolean(actionLoading[plan._id])}
              onEdit={() => openEdit(plan)}
              onDelete={() => confirmDelete(plan)}
              onToggle={() => toggleActive(plan)}
            />
          ))}
        </ScrollView>
      )}

      <PlanFormModal
        visible={Boolean(modal)}
        mode={modal}
        form={form}
        setForm={setForm}
        update={update}
        availableTiers={availableTiers}
        formError={formError}
        saving={saving}
        onClose={closeModal}
        onSave={submit}
      />
    </SafeAreaView>
  );
}

function PlanCard({ plan, busy, onEdit, onDelete, onToggle }) {
  const currency = plan.pricing?.currency || 'USD';
  return (
    <View style={[styles.card, !plan.isActive && styles.inactiveCard]}>
      <View style={styles.cardTop}>
        <View><Text style={styles.tier}>{String(plan.tier || '').toUpperCase()}</Text><Text style={styles.planName}>{plan.displayName}</Text></View>
        <View style={[styles.status, { backgroundColor: plan.isActive ? colors.successMuted : colors.warningMuted }]}><Text style={{ color: plan.isActive ? colors.success : colors.warning, fontWeight: '700', fontSize: 11 }}>{plan.isActive ? 'ACTIVE' : 'INACTIVE'}</Text></View>
      </View>
      <Text style={styles.price}>{formatMoney(plan.pricing?.amount, currency)} <Text style={styles.cycle}>/ {plan.pricing?.billingCycle === 'monthly' ? 'month' : 'year'}</Text></Text>
      <Text style={styles.detail}>{plan.limits?.maxProducts ?? 0} products · {plan.limits?.maxServices ?? 0} services</Text>
      <Text style={styles.detail}>Commission: {formatMoney(plan.commission?.flatRate, currency)} above {formatMoney(plan.commission?.productThreshold, currency)} · {plan.commission?.percentageRate ?? 0}% otherwise</Text>
      <View style={styles.cardActions}>
        <Pressable disabled={busy} onPress={onToggle}><Text style={styles.secondaryAction}>{busy ? 'Updating…' : plan.isActive ? 'Deactivate' : 'Activate'}</Text></Pressable>
        <View style={styles.rightActions}>
          <Pressable disabled={busy} onPress={onEdit} style={styles.smallButton}><Ionicons name="create-outline" size={18} color={colors.primary} /></Pressable>
          <Pressable disabled={busy} onPress={onDelete} style={styles.smallButton}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
        </View>
      </View>
    </View>
  );
}

function PlanFormModal({ visible, mode, form, setForm, update, availableTiers, formError, saving, onClose, onSave }) {
  const editing = mode === 'edit';
  const updateFeature = (key, field, value) => setForm((current) => ({ ...current, features: current.features.map((feature) => feature.key === key ? { ...feature, [field]: value } : feature) }));
  const addFeature = () => setForm((current) => ({ ...current, features: [...current.features, emptyFeature()] }));
  const removeFeature = (key) => setForm((current) => ({ ...current, features: current.features.filter((feature) => feature.key !== key) }));
  const currency = form.pricing.currency || 'USD';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}><Pressable onPress={onClose} disabled={saving} style={styles.iconButton}><Ionicons name="close" size={24} color={colors.text} /></Pressable><Text style={styles.modalTitle}>{editing ? 'Edit plan' : 'New plan'}</Text><View style={styles.headerSpacer} /></View>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            {formError ? <View style={styles.errorBanner}><Text style={styles.errorText}>{formError}</Text></View> : null}
            <Label text="Tier" />
            <View style={styles.tierRow}>{(editing ? [form.tier] : availableTiers).map((tier) => <Pressable key={tier} disabled={editing} onPress={() => update('tier', tier)} style={[styles.tierChip, form.tier === tier && styles.tierChipSelected]}><Text style={[styles.tierChipText, form.tier === tier && styles.tierChipTextSelected]}>{tier}</Text></Pressable>)}</View>
            <Input label="Display name" value={form.displayName} onChangeText={(value) => update('displayName', value)} placeholder="Growing Business" />
            <Input label="Razorpay plan ID" value={form.razorpayPlanId} onChangeText={(value) => update('razorpayPlanId', value)} placeholder="Leave blank when not used" />
            <Section title="Limits" />
            <Input label="Maximum products" value={form.limits.maxProducts} onChangeText={(value) => update('limits.maxProducts', value)} keyboardType="numeric" />
            <Input label="Maximum services" value={form.limits.maxServices} onChangeText={(value) => update('limits.maxServices', value)} keyboardType="numeric" />
            <Section title={`Base pricing (${currency})`} />
            <Input label="Plan price" value={form.pricing.amount} onChangeText={(value) => update('pricing.amount', value)} keyboardType="decimal-pad" />
            <View style={styles.cycleRow}>{['yearly', 'monthly'].map((cycle) => <Pressable key={cycle} onPress={() => update('pricing.billingCycle', cycle)} style={[styles.cycleButton, form.pricing.billingCycle === cycle && styles.cycleButtonSelected]}><Text style={[styles.cycleText, form.pricing.billingCycle === cycle && styles.cycleTextSelected]}>{cycle === 'yearly' ? 'Yearly' : 'Monthly'}</Text></Pressable>)}</View>
            <Input label="Original price (optional)" value={form.pricing.originalPrice} onChangeText={(value) => update('pricing.originalPrice', value)} keyboardType="decimal-pad" />
            <Input label="Annual discount %" value={form.pricing.annualDiscount} onChangeText={(value) => update('pricing.annualDiscount', value)} keyboardType="decimal-pad" />
            <Input label="Savings amount" value={form.pricing.savingsAmount} onChangeText={(value) => update('pricing.savingsAmount', value)} keyboardType="decimal-pad" />
            <Section title={`Commission (${currency})`} />
            <Text style={styles.help}>The same threshold rule applies to products and services.</Text>
            <Input label="Flat rate" value={form.commission.flatRate} onChangeText={(value) => update('commission.flatRate', value)} keyboardType="decimal-pad" />
            <Input label="Percentage rate" value={form.commission.percentageRate} onChangeText={(value) => update('commission.percentageRate', value)} keyboardType="decimal-pad" />
            <Input label="Order threshold" value={form.commission.productThreshold} onChangeText={(value) => update('commission.productThreshold', value)} keyboardType="decimal-pad" />
            <Section title="Features" />
            {form.features.map((feature) => <View key={feature.key} style={styles.featureBox}><View style={styles.featureTop}><Text style={styles.featureTitle}>Feature</Text><Pressable onPress={() => removeFeature(feature.key)}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable></View><Input label="Name" value={feature.name} onChangeText={(value) => updateFeature(feature.key, 'name', value)} /><Input label="Description" value={feature.description} onChangeText={(value) => updateFeature(feature.key, 'description', value)} /><View style={styles.switchRow}><Text style={styles.inputLabel}>Enabled</Text><Switch value={feature.enabled} onValueChange={(value) => updateFeature(feature.key, 'enabled', value)} trackColor={{ false: colors.border, true: colors.primary }} /></View></View>)}
            <Pressable onPress={addFeature} style={styles.addFeature}><Ionicons name="add" size={18} color={colors.primary} /><Text style={styles.addFeatureText}>Add feature</Text></Pressable>
            <Input label="Sort order" value={form.sortOrder} onChangeText={(value) => update('sortOrder', value)} keyboardType="numeric" />
            <View style={styles.switchRow}><View><Text style={styles.inputLabel}>Active</Text><Text style={styles.help}>Visible to vendors</Text></View><Switch value={form.isActive} onValueChange={(value) => update('isActive', value)} trackColor={{ false: colors.border, true: colors.primary }} /></View>
          </ScrollView>
          <View style={styles.footer}><Pressable onPress={onClose} disabled={saving} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={onSave} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveText}>{editing ? 'Save changes' : 'Create plan'}</Text>}</Pressable></View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title }) { return <Text style={styles.sectionTitle}>{title}</Text>; }
function Label({ text }) { return <Text style={styles.inputLabel}>{text}</Text>; }
function Input({ label, ...props }) { return <View style={styles.inputGroup}><Label text={label} /><TextInput {...props} style={styles.input} placeholderTextColor={colors.textMuted} /></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconButton: { padding: spacing.sm, marginLeft: -spacing.sm }, headerCopy: { flex: 1, marginLeft: spacing.sm }, title: { fontSize: 21, fontWeight: '800', color: colors.text }, subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10 }, addButtonText: { color: colors.surface, fontWeight: '800', fontSize: 13 }, disabled: { opacity: 0.5 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBanner: { backgroundColor: colors.dangerMuted, padding: spacing.sm, margin: spacing.md, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, errorText: { color: colors.danger, flex: 1, fontSize: 13 }, retryText: { color: colors.danger, fontWeight: '800' },
  empty: { marginTop: spacing.xl, padding: spacing.lg, alignItems: 'center' }, emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 17 }, emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md }, inactiveCard: { opacity: 0.7 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, tier: { color: colors.primary, fontWeight: '800', fontSize: 10, letterSpacing: 0.7 }, planName: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 }, status: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start' }, price: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.md }, cycle: { color: colors.textMuted, fontSize: 12, fontWeight: '500' }, detail: { color: colors.textMuted, fontSize: 12, marginTop: 5, lineHeight: 18 }, cardActions: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, secondaryAction: { color: colors.primary, fontWeight: '800', fontSize: 13 }, rightActions: { flexDirection: 'row', gap: spacing.xs }, smallButton: { padding: spacing.xs },
  modalRoot: { flex: 1, backgroundColor: colors.background }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }, modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' }, headerSpacer: { width: 32 }, formContent: { padding: spacing.md, paddingBottom: spacing.xl }, sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginTop: spacing.md, marginBottom: spacing.sm }, inputGroup: { marginBottom: spacing.sm }, inputLabel: { color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 }, input: { backgroundColor: colors.surface, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }, help: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }, tierChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 }, tierChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted }, tierChipText: { color: colors.textMuted, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }, tierChipTextSelected: { color: colors.primary }, cycleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }, cycleButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10 }, cycleButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted }, cycleText: { color: colors.textMuted, fontWeight: '700' }, cycleTextSelected: { color: colors.primary },
  featureBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surface }, featureTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }, featureTitle: { color: colors.text, fontWeight: '800', fontSize: 13 }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm }, addFeature: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingVertical: spacing.sm, marginBottom: spacing.sm }, addFeatureText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, cancelButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12 }, cancelText: { color: colors.text, fontWeight: '800' }, saveButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12 }, saveText: { color: colors.surface, fontWeight: '800' },
});
