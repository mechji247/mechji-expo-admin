import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { colors, getAvatarColor, spacing } from '../../lib/constants/theme';
import {
  clearCurrentService,
  clearCurrentServiceMessage,
  fetchServiceAdminView,
  removeService,
  restoreService,
  selectCurrentService,
  selectCurrentServiceError,
  selectCurrentServiceStatus,
  selectCurrentServiceSuccessMessage,
  selectServiceActionError,
  selectServiceActionLoading,
  updateServiceDetails,
  updateServiceStatus,
} from '../../store/slices/servicesSlice';

// Field paths below match the real Service schema exactly
// (server/newSchemaModels/schemas/service/serviceSchema.js) and what
// GET /admin/services/service/:serviceId returns. Two status dimensions
// exist here (unlike Product): the top-level `status` (draft/pending/
// active/inactive/in_progress/rejected), which is what every list/filter
// reads and what "Verify"/"Reject" below change, and verificationStatus
// (pending/verified/rejected/none + timestamps + rejectionReason) — the
// backend keeps both in sync on every status change, so it's shown here
// as the audit trail rather than a second independent control.

const TONE_STYLES = {
  success: { bg: colors.successMuted, fg: colors.success },
  error: { bg: colors.dangerMuted, fg: colors.danger },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  info: { bg: colors.infoMuted, fg: colors.info },
  neutral: { bg: colors.background, fg: colors.textMuted },
};

function toneForStatus(status) {
  switch (status) {
    case 'active':
    case 'verified':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending':
    case 'draft':
      return 'warning';
    case 'in_progress':
      return 'info';
    case 'inactive':
    case 'none':
    default:
      return 'neutral';
  }
}

function formatLabel(value) {
  if (!value) return '—';
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value, currency) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  if (currency && currency !== '₹' && currency.length === 3) {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      // fall through to the ₹ formatting below
    }
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

// Minutes-from-midnight -> "HH:MM", matches the schema's own
// serviceSchema.methods.minutesToTime (server-side only — this is the
// client-side read-only equivalent for display).
function minutesToTime(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function Badge({ label, tone = 'neutral' }) {
  if (!label) return null;
  const style = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: style.fg }]} />
      <Text style={[styles.badgeText, { color: style.fg }]}>{formatLabel(label)}</Text>
    </View>
  );
}

function InfoRow({ label, value, isLast, valueNode }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      {valueNode || <Text style={styles.infoValue} numberOfLines={3}>{value ?? '—'}</Text>}
    </View>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      <View style={styles.sectionBody}>{children}</View>
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

// RN's Alert.prompt is iOS-only, so Reject (which needs a typed reason)
// gets its own cross-platform text-input modal instead.
function ReasonModal({ visible, title, description, placeholder, confirmLabel, danger, loading, onCancel, onConfirm }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.reasonCard}>
          <Text style={styles.reasonTitle}>{title}</Text>
          {!!description && <Text style={styles.reasonDescription}>{description}</Text>}
          <TextInput
            style={styles.reasonInput}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
          <View style={styles.reasonButtonRow}>
            <Pressable style={styles.reasonCancelButton} onPress={onCancel} disabled={loading}>
              <Text style={styles.reasonCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.reasonConfirmButton, danger && styles.reasonConfirmButtonDanger, loading && styles.buttonDisabled]}
              onPress={() => onConfirm(text.trim())}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={styles.reasonConfirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({ label, value, onChangeText, placeholder, multiline, keyboardType }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function FormSwitch({ label, value, onValueChange }) {
  return (
    <View style={styles.formSwitchRow}>
      <Text style={styles.formLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primaryMuted }}
        thumbColor={value ? colors.primary : colors.surface}
      />
    </View>
  );
}

const emptyEditForm = () => ({
  serviceName: '',
  category: '',
  subcategory: '',
  description: '',
  termsAndConditions: '',
  specialInstructions: '',
  tags: '',
  basePrice: '',
  discountedPrice: '',
  priceType: 'fixed',
  allowInstantBooking: true,
  requiresApproval: false,
  warrantyAvailable: false,
  warrantyType: '',
  warrantyDescription: '',
  isFeatured: false,
  visibility: 'public',
});

function serviceToEditForm(service) {
  const pricing = service?.pricing || {};
  const bookingConfig = service?.bookingConfig || {};
  const warranty = service?.warranty || {};
  return {
    serviceName: service?.serviceName || '',
    category: service?.category || '',
    subcategory: service?.subcategory || '',
    description: service?.description || '',
    termsAndConditions: service?.termsAndConditions || '',
    specialInstructions: service?.specialInstructions || '',
    tags: Array.isArray(service?.tags) ? service.tags.join(', ') : '',
    basePrice: pricing.basePrice != null ? String(pricing.basePrice) : '',
    discountedPrice: pricing.discountedPrice != null ? String(pricing.discountedPrice) : '',
    priceType: pricing.priceType || 'fixed',
    allowInstantBooking: bookingConfig.allowInstantBooking !== false,
    requiresApproval: !!bookingConfig.requiresApproval,
    warrantyAvailable: !!warranty.available,
    warrantyType: warranty.type || '',
    warrantyDescription: warranty.description || '',
    isFeatured: !!service?.isFeatured,
    visibility: service?.visibility || 'public',
  };
}

// Matches updateServiceDetails' accepted payload shape on the backend
// (server/controllers/admin/adminServicesControllers.js) — deliberately
// scoped to detail fields; images/availability/coverage-area keep their
// own dedicated editors later, same "quick edit form" scope decision the
// product admin detail page made.
function buildServiceUpdatePayload(form) {
  return {
    serviceName: form.serviceName,
    category: form.category,
    subcategory: form.subcategory,
    description: form.description,
    termsAndConditions: form.termsAndConditions,
    specialInstructions: form.specialInstructions,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    pricing: {
      basePrice: Number(form.basePrice) || 0,
      discountedPrice: form.discountedPrice ? Number(form.discountedPrice) : undefined,
      priceType: form.priceType === 'hourly' ? 'hourly' : 'fixed',
    },
    bookingConfig: {
      allowInstantBooking: form.allowInstantBooking,
      requiresApproval: form.requiresApproval,
    },
    warranty: {
      available: form.warrantyAvailable,
      type: form.warrantyType,
      description: form.warrantyDescription,
    },
    isFeatured: form.isFeatured,
    visibility: form.visibility === 'private' || form.visibility === 'hidden' ? form.visibility : 'public',
  };
}

function EditServiceModal({ visible, service, loading, error, onCancel, onSave }) {
  const [form, setForm] = useState(emptyEditForm());

  useEffect(() => {
    if (visible) setForm(serviceToEditForm(service));
  }, [visible, service]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={onCancel} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit service</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.formSectionHeading}>Basics</Text>
          <FormField label="Service name" value={form.serviceName} onChangeText={set('serviceName')} placeholder="Service name" />
          <FormField label="Category" value={form.category} onChangeText={set('category')} placeholder="Category" />
          <FormField label="Subcategory" value={form.subcategory} onChangeText={set('subcategory')} placeholder="Subcategory" />
          <FormField label="Description" value={form.description} onChangeText={set('description')} placeholder="Full description" multiline />
          <FormField label="Terms & conditions" value={form.termsAndConditions} onChangeText={set('termsAndConditions')} placeholder="Terms & conditions" multiline />
          <FormField label="Special instructions" value={form.specialInstructions} onChangeText={set('specialInstructions')} placeholder="Special instructions" multiline />
          <FormField label="Tags (comma separated)" value={form.tags} onChangeText={set('tags')} placeholder="tag1, tag2" />

          <Text style={styles.formSectionHeading}>Pricing</Text>
          <FormField label="Base price" value={form.basePrice} onChangeText={set('basePrice')} placeholder="0" keyboardType="numeric" />
          <FormField label="Discounted price" value={form.discountedPrice} onChangeText={set('discountedPrice')} placeholder="0" keyboardType="numeric" />
          <FormField label="Price type (fixed / hourly)" value={form.priceType} onChangeText={set('priceType')} placeholder="fixed" />

          <Text style={styles.formSectionHeading}>Booking</Text>
          <FormSwitch label="Allow instant booking" value={form.allowInstantBooking} onValueChange={set('allowInstantBooking')} />
          <FormSwitch label="Requires approval" value={form.requiresApproval} onValueChange={set('requiresApproval')} />

          <Text style={styles.formSectionHeading}>Warranty</Text>
          <FormSwitch label="Warranty available" value={form.warrantyAvailable} onValueChange={set('warrantyAvailable')} />
          <FormField label="Warranty type" value={form.warrantyType} onChangeText={set('warrantyType')} placeholder="e.g. parts / labor" />
          <FormField label="Warranty description" value={form.warrantyDescription} onChangeText={set('warrantyDescription')} placeholder="Warranty details" multiline />

          <Text style={styles.formSectionHeading}>Visibility</Text>
          <FormSwitch label="Featured" value={form.isFeatured} onValueChange={set('isFeatured')} />
          <FormField label="Visibility (public / private / hidden)" value={form.visibility} onChangeText={set('visibility')} placeholder="public" />

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => onSave(buildServiceUpdatePayload(form))}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const service = useSelector(selectCurrentService);
  const fetchStatus = useSelector(selectCurrentServiceStatus);
  const fetchError = useSelector(selectCurrentServiceError);
  const successMessage = useSelector(selectCurrentServiceSuccessMessage);
  const actionLoadingById = useSelector(selectServiceActionLoading);
  const actionErrorById = useSelector(selectServiceActionError);

  const [menuVisible, setMenuVisible] = useState(false);
  const [reasonModal, setReasonModal] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchServiceAdminView(id));
    return () => {
      dispatch(clearCurrentService());
    };
  }, [dispatch, id]);

  const isBusy = Boolean(actionLoadingById?.[id]);
  const actionError = actionErrorById?.[id];
  const isInitialLoading = fetchStatus === 'loading' && !service;

  const pricing = service?.pricing || {};
  const bookingConfig = service?.bookingConfig || {};
  const warranty = service?.warranty || {};
  const images = Array.isArray(service?.images) ? service.images : [];
  const videos = Array.isArray(service?.videos) ? service.videos : [];
  const faqs = Array.isArray(service?.faqs) ? service.faqs : [];
  const location = service?.vendorServiceLocation || {};
  const address = location.address || {};
  const coordinates = location.coordinates || {};
  const coverageArea = service?.serviceCoverageArea || {};
  const availability = service?.availability || {};
  const weeklySchedule = Array.isArray(availability.weeklySchedule) ? availability.weeklySchedule : [];
  const bookingMetrics = service?.bookingMetrics || {};
  const verification = service?.verificationStatus || {};

  const status = service?.status;
  const isDeleted = Boolean(service?.isDeleted);
  const hasCoordinates =
    coordinates.latitude != null && coordinates.longitude != null && (coordinates.latitude !== 0 || coordinates.longitude !== 0);

  const primaryImage = images.find((img) => img?.isPrimary) || images[0];
  const title = service?.serviceName || 'Unnamed service';
  const metaLine = [service?.category, service?.subcategory].filter(Boolean).join('  ·  ');

  const handleVerify = () => dispatch(updateServiceStatus({ serviceId: id, status: 'active' }));
  const handleReject = (reason) => {
    setReasonModal(false);
    dispatch(updateServiceStatus({ serviceId: id, status: 'rejected', reason }));
  };
  const handleDeactivate = () => dispatch(updateServiceStatus({ serviceId: id, status: 'inactive' }));
  const handleDelete = () =>
    Alert.alert(
      'Delete service?',
      `This removes "${title}" from the marketplace. This can be undone from this menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(removeService(id)) },
      ]
    );
  const handleRestore = () => dispatch(restoreService(id));
  const handleSaveEdit = async (payload) => {
    const result = await dispatch(updateServiceDetails({ serviceId: id, payload }));
    if (updateServiceDetails.fulfilled.match(result)) {
      setEditVisible(false);
    }
  };
  const handleViewOnMap = () => {
    const lat = coordinates.latitude;
    const lng = coordinates.longitude;
    if (lat == null || lng == null) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() =>
      Alert.alert('Could not open map', 'No app was available to open the location.')
    );
  };

  const menuActions = isDeleted
    ? [{ key: 'restore', label: 'Restore service', onPress: handleRestore }]
    : [{ key: 'delete', label: 'Delete service', danger: true, onPress: handleDelete }];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Service</Text>
        <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
        </Pressable>
      </View>

      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !service ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{fetchError || 'Service not found.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {primaryImage?.url ? (
            <Image source={{ uri: primaryImage.url }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroImagePlaceholder, { backgroundColor: getAvatarColor(id || title) }]}>
              <Text style={styles.heroImagePlaceholderText}>{title.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.name}>{title}</Text>
          {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}
          {!!service?.serviceLocationType && <Text style={styles.meta}>{formatLabel(service.serviceLocationType)}</Text>}

          <View style={styles.badgeRow}>
            <Badge label={status || 'draft'} tone={toneForStatus(status)} />
            {verification.status && verification.status !== 'none' ? (
              <Badge label={`Verification: ${formatLabel(verification.status)}`} tone={toneForStatus(verification.status)} />
            ) : null}
            {service?.isFeatured ? <Badge label="Featured" tone="info" /> : null}
            {isDeleted ? <Badge label="Deleted" tone="error" /> : null}
          </View>

          {!!fetchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          )}
          {!!successMessage && (
            <Pressable style={styles.successBanner} onPress={() => dispatch(clearCurrentServiceMessage())}>
              <Text style={styles.successText}>{successMessage}</Text>
            </Pressable>
          )}
          {!!actionError && <View style={styles.errorBanner}><Text style={styles.errorText}>{actionError}</Text></View>}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Price</Text>
              <Text style={styles.statValue}>{formatCurrency(pricing.basePrice, pricing.currency)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total bookings</Text>
              <Text style={styles.statValue}>{bookingMetrics.totalBookings ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Avg. rating</Text>
              <Text style={styles.statValue}>{service?.averageRating != null ? Number(service.averageRating).toFixed(1) : '—'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Reviews</Text>
              <Text style={styles.statValue}>{service?.totalReviews ?? 0}</Text>
            </View>
          </View>

          {images.length > 0 ? (
            <SectionCard title="Images">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                {images.map((img, index) => (
                  <Pressable key={img?.url || index} onPress={() => img?.url && Linking.openURL(img.url)}>
                    <Image source={{ uri: img?.url }} style={styles.galleryImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </SectionCard>
          ) : null}

          {videos.length > 0 ? (
            <SectionCard title="Videos">
              {videos.map((vid, index) => (
                <Pressable
                  key={vid?.url || index}
                  style={styles.videoRow}
                  onPress={() => vid?.url && Linking.openURL(vid.url)}
                >
                  <Ionicons name="play-circle" size={20} color={colors.primary} />
                  <Text style={styles.videoRowText} numberOfLines={1}>
                    {vid?.platform ? formatLabel(vid.platform) : `Video ${index + 1}`}
                  </Text>
                </Pressable>
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Details">
            <InfoRow label="Vendor ID" value={service?.vendorId || '—'} />
            <InfoRow label="Location type" value={formatLabel(service?.serviceLocationType)} />
            <InfoRow label="Provider" value={formatLabel(service?.serviceProvider?.responsibility)} />
            <InfoRow label="Tags" value={Array.isArray(service?.tags) && service.tags.length ? service.tags.join(', ') : '—'} />
            <InfoRow label="Created" value={formatDate(service?.createdAt)} isLast />
          </SectionCard>

          {(service?.description || service?.termsAndConditions || service?.specialInstructions) ? (
            <SectionCard title="Description">
              {!!service?.description && <InfoRow label="Description" value={service.description} />}
              {!!service?.termsAndConditions && <InfoRow label="Terms" value={service.termsAndConditions} />}
              {!!service?.specialInstructions && <InfoRow label="Instructions" value={service.specialInstructions} isLast />}
            </SectionCard>
          ) : null}

          <SectionCard title="Pricing">
            <InfoRow label="Base price" value={formatCurrency(pricing.basePrice, pricing.currency)} />
            <InfoRow label="Discounted price" value={formatCurrency(pricing.discountedPrice, pricing.currency)} />
            <InfoRow label="Price type" value={formatLabel(pricing.priceType)} />
            <InfoRow label="Discount" value={pricing.discountPercentage ? `${pricing.discountPercentage}% off` : '—'} isLast />
          </SectionCard>

          <SectionCard title="Booking">
            <InfoRow label="Instant booking" value={bookingConfig.allowInstantBooking ? 'Allowed' : 'Not allowed'} />
            <InfoRow label="Requires approval" value={bookingConfig.requiresApproval ? 'Yes' : 'No'} isLast />
          </SectionCard>

          {(address.city || address.street || hasCoordinates) ? (
            <SectionCard title="Vendor location">
              <InfoRow label="Street" value={address.street || '—'} />
              <InfoRow label="Area" value={address.area || '—'} />
              <InfoRow label="City" value={address.city || '—'} />
              <InfoRow label="State" value={address.state || '—'} />
              <InfoRow label="Pincode" value={address.pincode || '—'} isLast={!hasCoordinates} />
              {hasCoordinates ? (
                <Pressable style={styles.mapButton} onPress={handleViewOnMap}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={styles.mapButtonText}>See on map</Text>
                </Pressable>
              ) : null}
            </SectionCard>
          ) : null}

          {coverageArea.enabled ? (
            <SectionCard title="Coverage area">
              <InfoRow label="Type" value={formatLabel(coverageArea.coverageType)} />
              {coverageArea.coverageType === 'radius' ? (
                <InfoRow label="Radius" value={coverageArea.radiusKm ? `${coverageArea.radiusKm} km` : '—'} isLast />
              ) : (
                <InfoRow
                  label="Locations"
                  value={
                    [...(coverageArea.cities || []), ...(coverageArea.pincodes || [])].join(', ') || '—'
                  }
                  isLast
                />
              )}
            </SectionCard>
          ) : null}

          {weeklySchedule.length > 0 ? (
            <SectionCard title="Availability" subtitle={formatLabel(availability.scheduleType)}>
              {weeklySchedule.map((day, index) => (
                <InfoRow
                  key={day?.dayOfWeek || index}
                  label={day?.dayOfWeek || `Day ${index + 1}`}
                  value={
                    day?.isAvailable === false
                      ? 'Unavailable'
                      : (day?.timeSlots || [])
                          .map((slot) => `${minutesToTime(slot?.startTime)}–${minutesToTime(slot?.endTime)}`)
                          .join(', ') || 'Available'
                  }
                  isLast={index === weeklySchedule.length - 1}
                />
              ))}
            </SectionCard>
          ) : null}

          {warranty.available ? (
            <SectionCard title="Warranty">
              <InfoRow label="Type" value={warranty.type || '—'} />
              <InfoRow
                label="Duration"
                value={warranty.duration?.value ? `${warranty.duration.value} ${warranty.duration.unit || ''}`.trim() : '—'}
              />
              <InfoRow label="Details" value={warranty.description || '—'} isLast />
            </SectionCard>
          ) : null}

          {faqs.length > 0 ? (
            <SectionCard title="FAQs" subtitle={`${faqs.length} question${faqs.length === 1 ? '' : 's'}`}>
              {faqs.map((faq, index) => (
                <InfoRow key={faq?.question || index} label={faq?.question} value={faq?.answer} isLast={index === faqs.length - 1} />
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Booking metrics">
            <InfoRow label="Total" value={bookingMetrics.totalBookings ?? 0} />
            <InfoRow label="Completed" value={bookingMetrics.completedBookings ?? 0} />
            <InfoRow label="Cancelled" value={bookingMetrics.cancelledBookings ?? 0} />
            <InfoRow label="Pending" value={bookingMetrics.pendingBooking ?? 0} isLast />
          </SectionCard>

          {status === 'rejected' && verification.rejectionReason ? (
            <SectionCard title="Rejection reason">
              <InfoRow label="Reason" value={verification.rejectionReason} isLast />
            </SectionCard>
          ) : null}

          {isDeleted ? (
            <SectionCard title="Deletion">
              <InfoRow label="Deleted at" value={formatDate(service?.deletedAt)} isLast />
            </SectionCard>
          ) : null}

          {status !== 'active' && (
            <Pressable style={[styles.primaryButton, isBusy && styles.buttonDisabled]} onPress={handleVerify} disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={colors.surface} />
                  <Text style={styles.primaryButtonText}>Verify & go live</Text>
                </>
              )}
            </Pressable>
          )}

          {status !== 'rejected' && (
            <Pressable
              style={[styles.dangerButton, isBusy && styles.buttonDisabled]}
              onPress={() => setReasonModal(true)}
              disabled={isBusy}
            >
              <Text style={styles.dangerButtonText}>Reject</Text>
            </Pressable>
          )}

          <Pressable style={styles.secondaryButton} onPress={() => setEditVisible(true)} disabled={isBusy}>
            <Text style={styles.secondaryButtonText}>Update service</Text>
          </Pressable>

          {status === 'active' && (
            <Pressable style={[styles.secondaryButton, isBusy && styles.buttonDisabled]} onPress={handleDeactivate} disabled={isBusy}>
              <Text style={styles.secondaryButtonText}>Deactivate</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <ActionSheet visible={menuVisible} onClose={() => setMenuVisible(false)} actions={menuActions} />

      <ReasonModal
        visible={reasonModal}
        title="Reject service"
        description={`Provide a reason for rejecting "${title}".`}
        placeholder="Enter rejection reason"
        confirmLabel="Reject service"
        danger
        loading={isBusy}
        onCancel={() => setReasonModal(false)}
        onConfirm={handleReject}
      />

      <EditServiceModal
        visible={editVisible}
        service={service}
        loading={isBusy}
        error={actionError}
        onCancel={() => setEditVisible(false)}
        onSave={handleSaveEdit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginTop: spacing.sm,
    backgroundColor: colors.border,
  },
  heroImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroImagePlaceholderText: { fontSize: 48, fontWeight: '700', color: colors.surface },
  name: { fontSize: 19, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: spacing.md },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.xs },
  badgeText: { fontSize: 12, fontWeight: '700' },
  errorBanner: { width: '100%', backgroundColor: colors.dangerMuted, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: colors.danger, fontSize: 13 },
  successBanner: { width: '100%', backgroundColor: colors.successMuted, borderRadius: 10, padding: spacing.sm, marginTop: spacing.md },
  successText: { color: colors.success, fontSize: 13 },
  statsRow: { flexDirection: 'row', width: '100%', marginTop: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionBody: { marginTop: spacing.xs },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2 },
  infoRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: colors.textMuted, marginRight: spacing.sm },
  infoValue: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1, textAlign: 'right' },
  imageScroll: { marginTop: spacing.xs },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: spacing.sm,
    backgroundColor: colors.border,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  videoRowText: { marginLeft: spacing.sm, fontSize: 13, color: colors.text, flex: 1 },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  mapButtonText: { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: spacing.xs },
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
  primaryButtonText: { marginLeft: spacing.xs, color: colors.surface, fontSize: 15, fontWeight: '700' },
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
  secondaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.text },
  dangerButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerMuted,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    marginTop: spacing.sm,
  },
  dangerButtonText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.lg, paddingBottom: spacing.xl },
  sheetRow: { paddingVertical: spacing.sm + 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetRowText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  sheetRowTextDanger: { color: colors.danger },
  sheetCancelRow: { borderBottomWidth: 0, marginTop: spacing.xs },
  sheetCancelText: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  reasonCard: { width: '100%', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg },
  reasonTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  reasonDescription: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reasonButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, gap: spacing.sm },
  reasonCancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  reasonCancelText: { fontSize: 14, fontWeight: '600', color: colors.text },
  reasonConfirmButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: 10, backgroundColor: colors.primary, minWidth: 100, alignItems: 'center' },
  reasonConfirmButtonDanger: { backgroundColor: colors.danger },
  reasonConfirmText: { fontSize: 14, fontWeight: '700', color: colors.surface },
  formContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  formSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  formField: { marginBottom: spacing.sm },
  formLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  formInputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  formSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
