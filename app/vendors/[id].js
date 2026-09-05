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
  approveVendor,
  clearAdminVendor,
  clearAdminVendorMessages,
  clearStagedDecisions,
  fetchVendorAdminView,
  reinstateVendor,
  rejectVendor,
  restoreVendor,
  selectAdminVendor,
  selectAdminVendorActionError,
  selectAdminVendorActionLoading,
  selectAdminVendorBatchSubmitError,
  selectAdminVendorBatchSubmitLoading,
  selectAdminVendorError,
  selectAdminVendorStagedVerification,
  selectAdminVendorStatus,
  selectAdminVendorSuccessMessage,
  softDeleteVendor,
  stageCoverImageDecision,
  stageCoverVideoDecision,
  submitVendorVerificationBatch,
  suspendVendor,
  unstageDecision,
  updateVendorProfile,
} from '../../store/slices/adminVendorSlice';

// Field paths below match Vendor.toAdminView() exactly
// (server/newSchemaModels/schemas/vendor/vendor.model.js), which is what
// GET /vendors/vendor/:vendorId actually returns: businessData, media,
// timing, address, reviews, status, storeStatus, performance,
// subscription, commission, monetization, analytics, financial,
// sellerType, userId, createdAt, isDeleted, deletedAt. There is no
// top-level `documents` or `legal` field in that response, so this
// screen never invents a "KYC documents" section from data the API
// doesn't send.

const TONE_STYLES = {
  success: { bg: colors.successMuted, fg: colors.success },
  error: { bg: colors.dangerMuted, fg: colors.danger },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  info: { bg: colors.infoMuted, fg: colors.info },
  neutral: { bg: colors.background, fg: colors.textMuted },
};

// Two INDEPENDENT status dimensions on the real schema — never conflate
// them into one derived key:
//   status.verificationStatus: pending | under_review | verified | rejected
//   storeStatus.status: inactive | active | paused | suspended | closed | deleted | blacklisted
function toneForStatus(status) {
  switch (status) {
    case 'verified':
    case 'active':
      return 'success';
    case 'rejected':
    case 'suspended':
    case 'blacklisted':
    case 'deleted':
      return 'error';
    case 'pending':
    case 'under_review':
    case 'paused':
      return 'warning';
    case 'closed':
    case 'inactive':
    default:
      return 'neutral';
  }
}

function formatLabel(value) {
  if (!value) return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
}

function formatAddress(address) {
  if (!address) return '—';
  const parts = [address.street, address.city, address.state, address.zip, address.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

// Converts the locally-staged media verify/reject decisions into the
// payload the batch verification endpoint expects. Mirrors
// buildStagedPayload on the web admin's vendor detail page — `documents`
// is always empty here since toAdminView() doesn't return a documents
// field for this screen to stage decisions against.
function buildStagedMediaPayload(staged) {
  const coverImages = Object.entries(staged?.coverImages || {}).map(([imageKey, entry]) => ({
    imageKey,
    decision: entry.decision,
    note: entry.note || undefined,
  }));
  const coverVideos = Object.entries(staged?.coverVideos || {}).map(([videoKey, entry]) => ({
    videoKey,
    decision: entry.decision,
    note: entry.note || undefined,
  }));
  return { documents: [], coverImages, coverVideos };
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

// One media.coverImages or media.coverVideos entry, with inline
// verify/reject staging — mirrors MediaActionTile on the web admin's
// vendor detail page. Nothing here hits the network: it only stages a
// decision locally (stageCoverImageDecision/stageCoverVideoDecision);
// PendingChangesBar's "Submit" is the one call that actually reaches
// the backend, via submitVendorVerificationBatch.
function MediaTile({ kind = 'image', item, index, itemKey, stagedDecision, onVerify, onReject, onUndo, disabled }) {
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [note, setNote] = useState('');

  const uri = item?.uri || item?.url;
  if (!uri) return null;

  const displayName = item?.name || `${kind === 'video' ? 'Cover video' : 'Cover image'} ${index + 1}`;
  const isVerified = !!item?.verificationStatus?.verified;
  const isStagedVerify = stagedDecision?.decision === 'verify';
  const isStagedReject = stagedDecision?.decision === 'reject';

  return (
    <View style={styles.mediaTile}>
      <View style={styles.mediaTileHeader}>
        <Text style={styles.mediaTileTitle} numberOfLines={1}>{displayName}</Text>
        <View style={styles.mediaBadgeRow}>
          {item?.isCover ? <Badge label="Cover" tone="info" /> : null}
          <Badge label={isVerified ? 'Verified' : 'Unverified'} tone={isVerified ? 'success' : 'warning'} />
        </View>
      </View>

      {kind === 'video' ? (
        <Pressable style={styles.mediaVideoPlaceholder} onPress={() => Linking.openURL(uri)}>
          <Ionicons name="play-circle" size={36} color={colors.surface} />
          <Text style={styles.mediaVideoPlaceholderText}>Open video</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => Linking.openURL(uri)}>
          <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
        </Pressable>
      )}

      {kind === 'image' && (item?.width || item?.height) ? (
        <Text style={styles.mediaMetaText}>{item.width || '—'}×{item.height || '—'}px</Text>
      ) : null}
      {item?.uploadedAt ? <Text style={styles.mediaMetaText}>Uploaded {formatDate(item.uploadedAt)}</Text> : null}
      {item?.verificationStatus?.verifiedAt ? (
        <Text style={styles.mediaVerifiedText}>Verified {formatDate(item.verificationStatus.verifiedAt)}</Text>
      ) : null}
      {item?.verificationStatus?.rejectionNote ? (
        <View style={styles.mediaRejectionNote}>
          <Text style={styles.mediaRejectionNoteText}>{item.verificationStatus.rejectionNote}</Text>
        </View>
      ) : null}

      {stagedDecision ? (
        <View style={[styles.mediaStagedBanner, isStagedReject && styles.mediaStagedBannerDanger]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.mediaStagedBannerTitle, isStagedReject && styles.mediaStagedBannerTitleDanger]}>
              Pending: {isStagedVerify ? 'Verify' : 'Reject'}
            </Text>
            {stagedDecision.note ? <Text style={styles.mediaStagedBannerNote}>{stagedDecision.note}</Text> : null}
          </View>
          <Pressable onPress={() => onUndo(itemKey)}>
            <Text style={styles.mediaStagedUndo}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.mediaButtonRow}>
        <Pressable
          style={[styles.mediaVerifyButton, isStagedVerify && styles.mediaVerifyButtonActive]}
          onPress={() => onVerify(itemKey, displayName)}
          disabled={disabled}
        >
          <Text style={styles.mediaVerifyButtonText}>{isStagedVerify ? 'Staged ✓ Verify' : 'Verify'}</Text>
        </Pressable>
        <Pressable
          style={[styles.mediaRejectButton, isStagedReject && styles.mediaRejectButtonActive]}
          onPress={() => setShowRejectBox((v) => !v)}
          disabled={disabled}
        >
          <Text style={[styles.mediaRejectButtonText, isStagedReject && styles.mediaRejectButtonTextActive]}>
            {isStagedReject ? 'Staged ✓ Reject' : 'Reject'}
          </Text>
        </Pressable>
      </View>

      {showRejectBox ? (
        <View style={styles.mediaRejectBox}>
          <TextInput
            style={styles.reasonInput}
            value={note}
            onChangeText={setNote}
            placeholder="Enter rejection note"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <View style={styles.mediaButtonRow}>
            <Pressable
              style={[styles.mediaStageRejectButton, !note.trim() && styles.buttonDisabled]}
              disabled={disabled || !note.trim()}
              onPress={() => {
                onReject(itemKey, displayName, note.trim());
                setShowRejectBox(false);
                setNote('');
              }}
            >
              <Text style={styles.mediaStageRejectButtonText}>Stage reject</Text>
            </Pressable>
            <Pressable
              style={styles.reasonCancelButton}
              onPress={() => {
                setShowRejectBox(false);
                setNote('');
              }}
            >
              <Text style={styles.reasonCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Sticky footer summarizing every locally-staged media decision, with one
// button that fires the batch request. Mirrors PendingChangesBar on the
// web admin's vendor detail page.
function PendingChangesBar({ counts, totalCount, onDiscard, onSubmit, loading, error }) {
  if (totalCount === 0) return null;
  return (
    <View style={styles.pendingBar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pendingBarTitle}>
          {totalCount} pending change{totalCount === 1 ? '' : 's'}
        </Text>
        <Text style={styles.pendingBarSubtitle}>
          {counts.coverImages} image{counts.coverImages === 1 ? '' : 's'} · {counts.coverVideos} video{counts.coverVideos === 1 ? '' : 's'}
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <View style={styles.pendingBarButtons}>
        <Pressable style={styles.reasonCancelButton} onPress={onDiscard} disabled={loading}>
          <Text style={styles.reasonCancelText}>Discard</Text>
        </Pressable>
        <Pressable style={[styles.reasonConfirmButton, loading && styles.buttonDisabled]} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.surface} size="small" /> : <Text style={styles.reasonConfirmText}>Submit</Text>}
        </Pressable>
      </View>
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

// RN's Alert.prompt is iOS-only, so reject/suspend (both of which need a
// typed reason) get their own cross-platform text-input modal instead.
function ReasonModal({ visible, title, description, placeholder, confirmLabel, danger, loading, onCancel, onConfirm }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              disabled={loading || !text.trim()}
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

function FormField({ label, value, onChangeText, placeholder, multiline }) {
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
  sellerType: '',
  businessName: '',
  ownerName: '',
  businessEmail: '',
  contactNumber: '',
  website: '',
  businessRole: '',
  businessCategory: '',
  productSubCategory: '',
  serviceSubCategory: '',
  sellingMode: '',
  tagLine: '',
  description: '',
  specialInstructions: '',
  tags: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  isStoreActive: false,
  isStoreOnline: false,
  isVisible: false,
  isFeatured: false,
  termsAccepted: false,
  privacyAccepted: false,
});

function vendorToEditForm(vendor) {
  const businessData = vendor?.businessData || {};
  const address = vendor?.address || {};
  const storeStatus = vendor?.storeStatus || {};
  const legal = vendor?.legal || {};
  return {
    sellerType: vendor?.sellerType || '',
    businessName: businessData.businessName || '',
    ownerName: businessData.ownerName || '',
    businessEmail: businessData.businessEmail || '',
    contactNumber: businessData.contactNumber || '',
    website: businessData.website || '',
    businessRole: businessData.businessRole || '',
    businessCategory: businessData.businessCategory || '',
    productSubCategory: businessData.productSubCategory || '',
    serviceSubCategory: businessData.serviceSubCategory || '',
    sellingMode: businessData.sellingMode || '',
    tagLine: businessData.tagLine || '',
    description: businessData.description || '',
    specialInstructions: businessData.specialInstructions || '',
    tags: Array.isArray(businessData.tags) ? businessData.tags.join(', ') : '',
    street: address.street || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || '',
    country: address.country || '',
    isStoreActive: !!storeStatus.isStoreActive,
    isStoreOnline: !!storeStatus.isStoreOnline,
    isVisible: !!storeStatus.isVisible,
    isFeatured: !!storeStatus.isFeatured,
    termsAccepted: !!legal?.terms?.isAccepted,
    privacyAccepted: !!legal?.privacy?.isAccepted,
  };
}

// Mirrors buildVendorProfileUpdatePayload on the web admin's vendor detail
// page (mechji-admin-web/src/app/vendor/[vendorId]/page.jsx) so both admin
// surfaces send the same PATCH /vendors/vendor/:vendorId/profile shape.
// Media (cover images/videos) editing is intentionally left out here —
// same simplification the web page notes for its own quick-edit form.
function buildProfileUpdatePayload(form) {
  return {
    sellerType: form.sellerType,
    businessData: {
      businessName: form.businessName,
      ownerName: form.ownerName,
      businessEmail: form.businessEmail,
      contactNumber: form.contactNumber,
      website: form.website,
      businessRole: form.businessRole,
      businessCategory: form.businessCategory,
      productSubCategory: form.productSubCategory,
      serviceSubCategory: form.serviceSubCategory,
      sellingMode: form.sellingMode,
      tagLine: form.tagLine,
      description: form.description,
      specialInstructions: form.specialInstructions,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    },
    address: {
      street: form.street,
      city: form.city,
      state: form.state,
      zip: form.zip,
      country: form.country,
    },
    legal: {
      terms: { isAccepted: form.termsAccepted },
      privacy: { isAccepted: form.privacyAccepted },
    },
    storeStatus: {
      isStoreActive: form.isStoreActive,
      isStoreOnline: form.isStoreOnline,
      isVisible: form.isVisible,
      isFeatured: form.isFeatured,
    },
  };
}

function EditVendorModal({ visible, vendor, loading, error, onCancel, onSave }) {
  const [form, setForm] = useState(emptyEditForm());

  useEffect(() => {
    if (visible) setForm(vendorToEditForm(vendor));
  }, [visible, vendor]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={onCancel} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit vendor</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.formSectionHeading}>Business</Text>
          <FormField label="Seller type" value={form.sellerType} onChangeText={set('sellerType')} placeholder="individual / business" />
          <FormField label="Business name" value={form.businessName} onChangeText={set('businessName')} placeholder="Business name" />
          <FormField label="Owner name" value={form.ownerName} onChangeText={set('ownerName')} placeholder="Owner name" />
          <FormField label="Business email" value={form.businessEmail} onChangeText={set('businessEmail')} placeholder="owner@business.com" />
          <FormField label="Contact number" value={form.contactNumber} onChangeText={set('contactNumber')} placeholder="Phone number" />
          <FormField label="Website" value={form.website} onChangeText={set('website')} placeholder="https://" />
          <FormField label="Business role" value={form.businessRole} onChangeText={set('businessRole')} placeholder="Business role" />
          <FormField label="Business category" value={form.businessCategory} onChangeText={set('businessCategory')} placeholder="Category" />
          <FormField label="Product sub-category" value={form.productSubCategory} onChangeText={set('productSubCategory')} placeholder="Product sub-category" />
          <FormField label="Service sub-category" value={form.serviceSubCategory} onChangeText={set('serviceSubCategory')} placeholder="Service sub-category" />
          <FormField label="Selling mode" value={form.sellingMode} onChangeText={set('sellingMode')} placeholder="Selling mode" />
          <FormField label="Tagline" value={form.tagLine} onChangeText={set('tagLine')} placeholder="Short tagline" />
          <FormField label="Description" value={form.description} onChangeText={set('description')} placeholder="Business description" multiline />
          <FormField label="Special instructions" value={form.specialInstructions} onChangeText={set('specialInstructions')} placeholder="Special instructions" multiline />
          <FormField label="Tags (comma separated)" value={form.tags} onChangeText={set('tags')} placeholder="tag1, tag2" />

          <Text style={styles.formSectionHeading}>Address</Text>
          <FormField label="Street" value={form.street} onChangeText={set('street')} placeholder="Street" />
          <FormField label="City" value={form.city} onChangeText={set('city')} placeholder="City" />
          <FormField label="State" value={form.state} onChangeText={set('state')} placeholder="State" />
          <FormField label="Zip" value={form.zip} onChangeText={set('zip')} placeholder="Zip" />
          <FormField label="Country" value={form.country} onChangeText={set('country')} placeholder="Country" />

          <Text style={styles.formSectionHeading}>Store status</Text>
          <FormSwitch label="Store active" value={form.isStoreActive} onValueChange={set('isStoreActive')} />
          <FormSwitch label="Store online" value={form.isStoreOnline} onValueChange={set('isStoreOnline')} />
          <FormSwitch label="Visible" value={form.isVisible} onValueChange={set('isVisible')} />
          <FormSwitch label="Featured" value={form.isFeatured} onValueChange={set('isFeatured')} />

          <Text style={styles.formSectionHeading}>Legal</Text>
          <FormSwitch label="Terms accepted" value={form.termsAccepted} onValueChange={set('termsAccepted')} />
          <FormSwitch label="Privacy accepted" value={form.privacyAccepted} onValueChange={set('privacyAccepted')} />

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => onSave(buildProfileUpdatePayload(form))}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>Save changes</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  const successMessage = useSelector(selectAdminVendorSuccessMessage);
  const stagedVerification = useSelector(selectAdminVendorStagedVerification);
  const batchSubmitLoading = useSelector(selectAdminVendorBatchSubmitLoading);
  const batchSubmitError = useSelector(selectAdminVendorBatchSubmitError);

  const [menuVisible, setMenuVisible] = useState(false);
  const [reasonModal, setReasonModal] = useState(null); // 'reject' | 'suspend' | null
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchVendorAdminView(id));
    return () => {
      dispatch(clearAdminVendor());
    };
  }, [dispatch, id]);

  const businessData = vendor?.businessData || {};
  const address = vendor?.address || {};
  const storeStatus = vendor?.storeStatus || {};
  const status = vendor?.status || {};
  const commission = vendor?.commission || {};
  const subscription = vendor?.subscription || {};
  const performance = vendor?.performance || {};
  const analytics = vendor?.analytics || {};
  const reviews = vendor?.reviews || {};
  const media = vendor?.media || {};
  const coverImages = Array.isArray(media.coverImages) ? media.coverImages : [];
  const coverVideos = Array.isArray(media.coverVideos) ? media.coverVideos : [];
  const hasCoordinates = address.coordinates?.latitude != null && address.coordinates?.longitude != null;

  const stagedCounts = {
    coverImages: Object.keys(stagedVerification?.coverImages || {}).length,
    coverVideos: Object.keys(stagedVerification?.coverVideos || {}).length,
  };
  const stagedTotalCount = stagedCounts.coverImages + stagedCounts.coverVideos;

  const businessName = businessData.businessName || 'Unnamed vendor';
  const metaLine = [businessData.businessCategory, address.city].filter(Boolean).join('  ·  ');

  // Two independent status dimensions — never conflated into one key.
  const verificationStatus = status.verificationStatus; // pending | under_review | verified | rejected
  const storeStatusValue = storeStatus.status; // inactive | active | paused | suspended | closed | deleted | blacklisted
  const isDeleted = Boolean(vendor?.isDeleted);

  const canApproveOrReject = verificationStatus === 'under_review';
  const canSuspend = storeStatusValue === 'active';
  const canReinstate = storeStatusValue === 'suspended';

  const isBusy = Object.values(actionLoading || {}).some(Boolean);
  const isInitialLoading = fetchStatus === 'loading' && !vendor;

  const refresh = () => dispatch(fetchVendorAdminView(id));

  const handleApprove = () => dispatch(approveVendor(id)).then(refresh);
  const handleReject = (reason) => {
    setReasonModal(null);
    dispatch(rejectVendor({ vendorId: id, reason })).then(refresh);
  };
  const handleSuspend = (reason) => {
    setReasonModal(null);
    dispatch(suspendVendor({ vendorId: id, reasons: reason ? [reason] : [], otherReason: reason || null })).then(refresh);
  };
  const handleReinstate = () => dispatch(reinstateVendor(id)).then(refresh);
  const handleDelete = () =>
    Alert.alert(
      'Delete vendor?',
      `This removes ${businessName} from the marketplace. This can be undone from this menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(softDeleteVendor(id)) },
      ]
    );
  const handleRestore = () => dispatch(restoreVendor(id));
  const handleViewOnMap = () => {
    const lat = address.coordinates?.latitude;
    const lng = address.coordinates?.longitude;
    if (lat == null || lng == null) return;
    // Universal Google Maps URL — opens the Google Maps app when installed
    // (both iOS and Android), otherwise falls back to the browser. Avoids
    // pulling in a native maps library just to deep-link to one pin.
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() =>
      Alert.alert('Could not open map', 'No app was available to open the location.')
    );
  };
  const handleSaveEdit = async (payload) => {
    const result = await dispatch(updateVendorProfile({ vendorId: id, payload }));
    if (updateVendorProfile.fulfilled.match(result)) {
      setEditVisible(false);
    }
  };

  // Media verify/reject — staged locally only (stageCoverImageDecision /
  // stageCoverVideoDecision), nothing hits the network until the admin
  // taps "Submit" on the pending-changes bar.
  const handleVerifyCoverImage = (imageKey, label) =>
    dispatch(stageCoverImageDecision({ imageKey, decision: 'verify', note: null, label }));
  const handleRejectCoverImage = (imageKey, label, note) =>
    dispatch(stageCoverImageDecision({ imageKey, decision: 'reject', note, label }));
  const handleVerifyCoverVideo = (videoKey, label) =>
    dispatch(stageCoverVideoDecision({ videoKey, decision: 'verify', note: null, label }));
  const handleRejectCoverVideo = (videoKey, label, note) =>
    dispatch(stageCoverVideoDecision({ videoKey, decision: 'reject', note, label }));
  const handleUndoCoverImageDecision = (imageKey) => dispatch(unstageDecision({ group: 'coverImages', key: imageKey }));
  const handleUndoCoverVideoDecision = (videoKey) => dispatch(unstageDecision({ group: 'coverVideos', key: videoKey }));
  const handleDiscardStagedMedia = () => dispatch(clearStagedDecisions());
  const handleSubmitStagedMedia = async () => {
    const result = await dispatch(
      submitVendorVerificationBatch({ vendorId: id, payload: buildStagedMediaPayload(stagedVerification) })
    );
    if (submitVendorVerificationBatch.fulfilled.match(result)) {
      dispatch(fetchVendorAdminView(id));
    }
  };

  const menuActions = isDeleted
    ? [{ key: 'restore', label: 'Restore vendor', onPress: handleRestore }]
    : [{ key: 'delete', label: 'Delete vendor', danger: true, onPress: handleDelete }];

  const firstActionError = Object.values(actionError || {}).find(Boolean);

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
        <ScrollView
          contentContainerStyle={[styles.content, stagedTotalCount > 0 && styles.contentWithPendingBar]}
        >
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(id || businessName) }]}>
            <Text style={styles.avatarText}>{getInitials(businessName)}</Text>
          </View>
          <Text style={styles.name}>{businessName}</Text>
          {!!businessData.tagLine && <Text style={styles.meta}>{businessData.tagLine}</Text>}
          {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}

          <View style={styles.badgeRow}>
            <Badge label={verificationStatus || 'pending'} tone={toneForStatus(verificationStatus)} />
            <Badge label={storeStatusValue || 'inactive'} tone={toneForStatus(storeStatusValue)} />
            {storeStatus.isFeatured ? <Badge label="Featured" tone="info" /> : null}
            {isDeleted ? <Badge label="Deleted" tone="error" /> : null}
          </View>

          {!!fetchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          )}
          {!!successMessage && (
            <Pressable style={styles.successBanner} onPress={() => dispatch(clearAdminVendorMessages())}>
              <Text style={styles.successText}>{successMessage}</Text>
            </Pressable>
          )}
          {!!firstActionError && (
            <Pressable style={styles.errorBanner} onPress={() => dispatch(clearAdminVendorMessages())}>
              <Text style={styles.errorText}>{firstActionError}</Text>
            </Pressable>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Avg. rating</Text>
              <Text style={styles.statValue}>
                {reviews.averageRating != null ? Number(reviews.averageRating).toFixed(1) : '—'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total reviews</Text>
              <Text style={styles.statValue}>{reviews.totalReviews ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Overall score</Text>
              <Text style={styles.statValue}>{performance.scores?.overallScore ?? '—'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Store followers</Text>
              <Text style={styles.statValue}>{analytics.engagement?.storeFollowers ?? 0}</Text>
            </View>
          </View>

          <SectionCard title="Business">
            <InfoRow label="Vendor ID" value={vendor?.vendorId || vendor?._id || '—'} />
            <InfoRow label="Owner" value={businessData.ownerName || '—'} />
            <InfoRow label="Seller type" value={formatLabel(vendor?.sellerType)} />
            <InfoRow label="Email" value={businessData.businessEmail || '—'} />
            <InfoRow label="Phone" value={businessData.contactNumber || '—'} />
            <InfoRow label="Website" value={businessData.website || '—'} />
            <InfoRow label="Category" value={businessData.businessCategory || '—'} />
            <InfoRow label="Selling mode" value={businessData.sellingMode || '—'} />
            <InfoRow label="Joined" value={formatDate(vendor?.createdAt)} isLast />
          </SectionCard>

          <SectionCard title="Address">
            <InfoRow label="Street" value={address.street || '—'} />
            <InfoRow label="City" value={address.city || '—'} />
            <InfoRow label="State" value={address.state || '—'} />
            <InfoRow label="Zip" value={address.zip || '—'} />
            <InfoRow label="Country" value={address.country || '—'} />
            {hasCoordinates ? (
              <InfoRow
                label="Coordinates"
                value={`${address.coordinates?.latitude}, ${address.coordinates?.longitude}`}
              />
            ) : null}
            <InfoRow label="Full address" value={formatAddress(address)} isLast={!hasCoordinates} />
            {hasCoordinates ? (
              <Pressable style={styles.mapButton} onPress={handleViewOnMap}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={styles.mapButtonText}>See on map</Text>
              </Pressable>
            ) : null}
          </SectionCard>

          {coverImages.length > 0 ? (
            <SectionCard title="Cover images" subtitle="Stage a verify/reject decision for each, then submit all at once.">
              {coverImages.map((img, index) => {
                const imageKey = img?.cloudinaryId || img?.uri || `coverImage_${index}`;
                return (
                  <MediaTile
                    key={imageKey}
                    kind="image"
                    item={img}
                    index={index}
                    itemKey={imageKey}
                    stagedDecision={stagedVerification?.coverImages?.[imageKey]}
                    onVerify={handleVerifyCoverImage}
                    onReject={handleRejectCoverImage}
                    onUndo={handleUndoCoverImageDecision}
                    disabled={batchSubmitLoading}
                  />
                );
              })}
            </SectionCard>
          ) : null}

          {coverVideos.length > 0 ? (
            <SectionCard title="Cover videos" subtitle="Stage a verify/reject decision for each, then submit all at once.">
              {coverVideos.map((vid, index) => {
                const videoKey = vid?.cloudinaryId || vid?.uri || `coverVideo_${index}`;
                return (
                  <MediaTile
                    key={videoKey}
                    kind="video"
                    item={vid}
                    index={index}
                    itemKey={videoKey}
                    stagedDecision={stagedVerification?.coverVideos?.[videoKey]}
                    onVerify={handleVerifyCoverVideo}
                    onReject={handleRejectCoverVideo}
                    onUndo={handleUndoCoverVideoDecision}
                    disabled={batchSubmitLoading}
                  />
                );
              })}
            </SectionCard>
          ) : null}

          <SectionCard title="Store status">
            <InfoRow label="Store active" value={storeStatus.isStoreActive ? 'Yes' : 'No'} />
            <InfoRow label="Store online" value={storeStatus.isStoreOnline ? 'Yes' : 'No'} />
            <InfoRow label="Visible" value={storeStatus.isVisible ? 'Yes' : 'No'} />
            <InfoRow
              label="Featured"
              value={storeStatus.isFeatured ? 'Yes' : 'No'}
              isLast={storeStatusValue !== 'suspended' || !storeStatus.suspension}
            />
            {storeStatusValue === 'suspended' && storeStatus.suspension ? (
              <>
                <InfoRow label="Suspended at" value={formatDate(storeStatus.suspension.suspendedAt)} />
                <InfoRow label="Reason" value={storeStatus.suspension.reason || '—'} isLast />
              </>
            ) : null}
          </SectionCard>

          <SectionCard title="Commission">
            <InfoRow label="Flat rate" value={formatCurrency(commission.flatRate)} />
            <InfoRow label="Percentage rate" value={commission.percentageRate != null ? `${commission.percentageRate}%` : '—'} />
            <InfoRow label="Service rate" value={commission.serviceRate != null ? `${commission.serviceRate}%` : '—'} />
            <InfoRow label="Applies to" value={[commission.appliesTo?.products && 'Products', commission.appliesTo?.services && 'Services'].filter(Boolean).join(', ') || '—'} isLast />
          </SectionCard>

          <SectionCard title="Subscription">
            <InfoRow label="Plan" value={subscription.planName || subscription.planId || '—'} />
            <InfoRow label="Tier" value={subscription.tier || '—'} />
            <InfoRow label="Status" value={formatLabel(subscription.status)} />
            <InfoRow label="Auto renew" value={subscription.autoRenew ? 'Yes' : 'No'} />
            <InfoRow label="Price" value={formatCurrency(subscription.pricing?.amount, subscription.pricing?.currency)} />
            <InfoRow label="Next billing" value={formatDate(subscription.billing?.nextBillingDate)} isLast />
          </SectionCard>

          {isDeleted ? (
            <SectionCard title="Deletion">
              <InfoRow label="Deleted at" value={formatDate(vendor?.deletedAt)} isLast />
            </SectionCard>
          ) : null}

          {canApproveOrReject && (
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

          {canApproveOrReject && (
            <Pressable
              style={[styles.dangerButton, isBusy && styles.buttonDisabled]}
              onPress={() => setReasonModal('reject')}
              disabled={isBusy}
            >
              {actionLoading?.reject ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.dangerButtonText}>Reject vendor</Text>
              )}
            </Pressable>
          )}

          {canReinstate && (
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
                  <Text style={styles.primaryButtonText}>Activate vendor</Text>
                </>
              )}
            </Pressable>
          )}

          <Pressable style={styles.secondaryButton} onPress={() => setEditVisible(true)} disabled={isBusy}>
            <Text style={styles.secondaryButtonText}>Edit vendor details</Text>
          </Pressable>

          {canSuspend && (
            <Pressable
              style={[styles.dangerButton, isBusy && styles.buttonDisabled]}
              onPress={() => setReasonModal('suspend')}
              disabled={isBusy}
            >
              {actionLoading?.suspend ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.dangerButtonText}>Deactivate vendor</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}

      <PendingChangesBar
        counts={stagedCounts}
        totalCount={stagedTotalCount}
        onDiscard={handleDiscardStagedMedia}
        onSubmit={handleSubmitStagedMedia}
        loading={batchSubmitLoading}
        error={batchSubmitError}
      />

      <ActionSheet visible={menuVisible} onClose={() => setMenuVisible(false)} actions={menuActions} />

      <ReasonModal
        visible={reasonModal === 'reject'}
        title="Reject vendor"
        description={`Provide a reason for rejecting ${businessName}.`}
        placeholder="Enter rejection reason"
        confirmLabel="Reject vendor"
        danger
        loading={actionLoading?.reject}
        onCancel={() => setReasonModal(null)}
        onConfirm={handleReject}
      />
      <ReasonModal
        visible={reasonModal === 'suspend'}
        title="Deactivate vendor"
        description={`${businessName} will be taken off the marketplace until reinstated.`}
        placeholder="Enter deactivation reason"
        confirmLabel="Deactivate vendor"
        danger
        loading={actionLoading?.suspend}
        onCancel={() => setReasonModal(null)}
        onConfirm={handleSuspend}
      />

      <EditVendorModal
        visible={editVisible}
        vendor={vendor}
        loading={actionLoading?.profile}
        error={actionError?.profile}
        onCancel={() => setEditVisible(false)}
        onSave={handleSaveEdit}
      />
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
  contentWithPendingBar: {
    paddingBottom: spacing.xl * 3,
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
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  badgeText: {
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
  successBanner: {
    width: '100%',
    backgroundColor: colors.successMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: spacing.md,
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
  sectionCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionBody: {
    marginTop: spacing.xs,
  },
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
  mapButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: spacing.xs,
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
    marginRight: spacing.sm,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  reasonDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
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
  reasonButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  reasonCancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  reasonConfirmButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    backgroundColor: colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  reasonConfirmButtonDanger: {
    backgroundColor: colors.danger,
  },
  reasonConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  formContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  formSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  formField: {
    marginBottom: spacing.sm,
  },
  formLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
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
  formInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  formSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mediaTile: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  mediaTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  mediaTileTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  mediaBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  mediaImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  mediaVideoPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaVideoPlaceholderText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  mediaMetaText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  mediaVerifiedText: {
    fontSize: 12,
    color: colors.success,
    marginTop: spacing.xs,
  },
  mediaRejectionNote: {
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  mediaRejectionNoteText: {
    fontSize: 12,
    color: colors.danger,
  },
  mediaStagedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  mediaStagedBannerDanger: {
    backgroundColor: colors.dangerMuted,
  },
  mediaStagedBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  mediaStagedBannerTitleDanger: {
    color: colors.danger,
  },
  mediaStagedBannerNote: {
    fontSize: 12,
    color: colors.text,
    marginTop: 2,
  },
  mediaStagedUndo: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textDecorationLine: 'underline',
    marginLeft: spacing.sm,
  },
  mediaButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mediaVerifyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: spacing.sm,
  },
  mediaVerifyButtonActive: {
    backgroundColor: colors.success,
    opacity: 0.85,
  },
  mediaVerifyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  mediaRejectButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: spacing.sm,
  },
  mediaRejectButtonActive: {
    backgroundColor: colors.dangerMuted,
  },
  mediaRejectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  mediaRejectButtonTextActive: {
    color: colors.danger,
  },
  mediaRejectBox: {
    marginTop: spacing.sm,
  },
  mediaStageRejectButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: spacing.sm,
  },
  mediaStageRejectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  pendingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  pendingBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pendingBarSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  pendingBarButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
