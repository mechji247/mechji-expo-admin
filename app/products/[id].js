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
  clearCurrentProduct,
  clearCurrentProductMessage,
  fetchProductAdminView,
  removeProduct,
  restoreProduct,
  selectCurrentProduct,
  selectCurrentProductError,
  selectCurrentProductStatus,
  selectCurrentProductSuccessMessage,
  selectProductActionError,
  selectProductActionLoading,
  updateProductDetails,
  updateProductStatus,
} from '../../store/slices/productsSlice';

// Field paths below match the real Product schema exactly
// (server/newSchemaModels/schemas/product/productSchema.js) and what
// GET /admin/products/product/:productId now returns (added alongside
// this screen — it didn't exist before). Two independent status
// dimensions exist on the schema: the top-level `status` (draft/pending/
// active/inactive/outOfStock/rejected), which is what every action below
// actually changes, and a separate `verificationStatus.status` (pending/
// verified/rejected/none) that nothing in this admin app writes to yet —
// it's shown read-only rather than wired to a control that would silently
// no-op against the backend.

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
    case 'outOfStock':
      return 'error';
    case 'pending':
    case 'draft':
      return 'warning';
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
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
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
  title: '',
  condition: '',
  descriptionShort: '',
  descriptionLong: '',
  categoryPrimary: '',
  categorySecondary: '',
  brandName: '',
  mrp: '',
  cost: '',
  selling: '',
  stock: '',
  lowStockThreshold: '',
  allowBackorder: false,
  trackInventory: true,
  tags: '',
  isFeatured: false,
  isPromoted: false,
  adminNotes: '',
  metaTitle: '',
  metaDescription: '',
});

function productToEditForm(product) {
  const description = product?.description || {};
  const category = product?.category || {};
  const brand = product?.brand || {};
  const pricing = product?.pricing || {};
  const inventory = product?.inventory || {};
  const seo = product?.seo || {};
  return {
    title: product?.title || '',
    condition: product?.condition || '',
    descriptionShort: description.short || '',
    descriptionLong: description.long || '',
    categoryPrimary: category.primary || '',
    categorySecondary: category.secondary || '',
    brandName: brand.name || '',
    mrp: pricing.mrp != null ? String(pricing.mrp) : '',
    cost: pricing.cost != null ? String(pricing.cost) : '',
    selling: pricing.selling != null ? String(pricing.selling) : '',
    stock: inventory.stock != null ? String(inventory.stock) : '',
    lowStockThreshold: inventory.lowStockThreshold != null ? String(inventory.lowStockThreshold) : '',
    allowBackorder: !!inventory.allowBackorder,
    trackInventory: inventory.trackInventory !== false,
    tags: Array.isArray(product?.tags) ? product.tags.join(', ') : '',
    isFeatured: !!product?.isFeatured,
    isPromoted: !!product?.isPromoted,
    adminNotes: product?.adminNotes || '',
    metaTitle: seo.metaTitle || '',
    metaDescription: seo.metaDescription || '',
  };
}

// Matches updateProductDetails' accepted payload shape on the backend
// (server/controllers/admin/adminProductsControllers.js) — deliberately
// scoped to catalog-detail fields; variants/media/shipping keep their own
// editors later, same "quick edit form" scope decision the vendor admin
// detail page made for its own profile edit.
function buildProductUpdatePayload(form) {
  return {
    title: form.title,
    condition: form.condition,
    description: { short: form.descriptionShort, long: form.descriptionLong },
    category: { primary: form.categoryPrimary, secondary: form.categorySecondary },
    brand: { name: form.brandName },
    pricing: {
      mrp: Number(form.mrp) || 0,
      cost: form.cost ? Number(form.cost) : undefined,
      selling: Number(form.selling) || 0,
    },
    inventory: {
      trackInventory: form.trackInventory,
      stock: Number(form.stock) || 0,
      lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
      allowBackorder: form.allowBackorder,
    },
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    isFeatured: form.isFeatured,
    isPromoted: form.isPromoted,
    adminNotes: form.adminNotes,
    seo: { metaTitle: form.metaTitle, metaDescription: form.metaDescription },
  };
}

function EditProductModal({ visible, product, loading, error, onCancel, onSave }) {
  const [form, setForm] = useState(emptyEditForm());

  useEffect(() => {
    if (visible) setForm(productToEditForm(product));
  }, [visible, product]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={onCancel} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit product</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.formSectionHeading}>Basics</Text>
          <FormField label="Title" value={form.title} onChangeText={set('title')} placeholder="Product title" />
          <FormField label="Condition" value={form.condition} onChangeText={set('condition')} placeholder="new / used / refurbished" />
          <FormField label="Short description" value={form.descriptionShort} onChangeText={set('descriptionShort')} placeholder="Short summary" multiline />
          <FormField label="Full description" value={form.descriptionLong} onChangeText={set('descriptionLong')} placeholder="Full description" multiline />

          <Text style={styles.formSectionHeading}>Category & brand</Text>
          <FormField label="Category (primary)" value={form.categoryPrimary} onChangeText={set('categoryPrimary')} placeholder="Primary category" />
          <FormField label="Category (secondary)" value={form.categorySecondary} onChangeText={set('categorySecondary')} placeholder="Secondary category" />
          <FormField label="Brand" value={form.brandName} onChangeText={set('brandName')} placeholder="Brand name" />
          <FormField label="Tags (comma separated)" value={form.tags} onChangeText={set('tags')} placeholder="tag1, tag2" />

          <Text style={styles.formSectionHeading}>Pricing</Text>
          <FormField label="MRP" value={form.mrp} onChangeText={set('mrp')} placeholder="0" keyboardType="numeric" />
          <FormField label="Cost" value={form.cost} onChangeText={set('cost')} placeholder="0" keyboardType="numeric" />
          <FormField label="Selling price" value={form.selling} onChangeText={set('selling')} placeholder="0" keyboardType="numeric" />

          <Text style={styles.formSectionHeading}>Inventory</Text>
          <FormField label="Stock" value={form.stock} onChangeText={set('stock')} placeholder="0" keyboardType="numeric" />
          <FormField label="Low stock threshold" value={form.lowStockThreshold} onChangeText={set('lowStockThreshold')} placeholder="5" keyboardType="numeric" />
          <FormSwitch label="Track inventory" value={form.trackInventory} onValueChange={set('trackInventory')} />
          <FormSwitch label="Allow backorder" value={form.allowBackorder} onValueChange={set('allowBackorder')} />

          <Text style={styles.formSectionHeading}>Visibility</Text>
          <FormSwitch label="Featured" value={form.isFeatured} onValueChange={set('isFeatured')} />
          <FormSwitch label="Promoted" value={form.isPromoted} onValueChange={set('isPromoted')} />

          <Text style={styles.formSectionHeading}>SEO</Text>
          <FormField label="Meta title" value={form.metaTitle} onChangeText={set('metaTitle')} placeholder="Meta title" />
          <FormField label="Meta description" value={form.metaDescription} onChangeText={set('metaDescription')} placeholder="Meta description" multiline />

          <Text style={styles.formSectionHeading}>Admin</Text>
          <FormField label="Admin notes" value={form.adminNotes} onChangeText={set('adminNotes')} placeholder="Internal notes (not shown to the vendor)" multiline />

          <Pressable
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => onSave(buildProductUpdatePayload(form))}
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

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const product = useSelector(selectCurrentProduct);
  const fetchStatus = useSelector(selectCurrentProductStatus);
  const fetchError = useSelector(selectCurrentProductError);
  const successMessage = useSelector(selectCurrentProductSuccessMessage);
  const actionLoadingById = useSelector(selectProductActionLoading);
  const actionErrorById = useSelector(selectProductActionError);

  const [menuVisible, setMenuVisible] = useState(false);
  const [reasonModal, setReasonModal] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchProductAdminView(id));
    return () => {
      dispatch(clearCurrentProduct());
    };
  }, [dispatch, id]);

  const isBusy = Boolean(actionLoadingById?.[id]);
  const actionError = actionErrorById?.[id];
  const isInitialLoading = fetchStatus === 'loading' && !product;

  const category = product?.category || {};
  const brand = product?.brand || {};
  const pricing = product?.pricing || {};
  const inventory = product?.inventory || {};
  const description = product?.description || {};
  const media = product?.media || {};
  const images = Array.isArray(media.images) ? media.images : [];
  const videos = Array.isArray(media.videos) ? media.videos : [];
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const shipping = product?.shipping || {};
  const productLocation = product?.productLocation || {};
  const ratings = product?.ratings || {};
  const analytics = product?.analytics || {};
  const performance = product?.performance || {};
  const verification = product?.verificationStatus || {};

  const status = product?.status;
  const isDeleted = Boolean(product?.isDeleted);
  const hasCoordinates =
    productLocation.coordinates?.latitude != null &&
    productLocation.coordinates?.longitude != null &&
    (productLocation.coordinates.latitude !== 0 || productLocation.coordinates.longitude !== 0);

  const primaryImage = images.find((img) => img?.isPrimary) || images[0];
  const title = product?.title || 'Unnamed product';
  const metaLine = [category.primary, category.secondary].filter(Boolean).join('  ·  ');

  const refresh = () => dispatch(fetchProductAdminView(id));

  const handleVerify = () => dispatch(updateProductStatus({ productId: id, status: 'active' }));
  const handleReject = (reason) => {
    setReasonModal(false);
    dispatch(updateProductStatus({ productId: id, status: 'rejected', reason }));
  };
  const handleDeactivate = () => dispatch(updateProductStatus({ productId: id, status: 'inactive' }));
  const handleDelete = () =>
    Alert.alert(
      'Delete product?',
      `This removes "${title}" from the marketplace. This can be undone from this menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(removeProduct(id)) },
      ]
    );
  const handleRestore = () => dispatch(restoreProduct(id));
  const handleSaveEdit = async (payload) => {
    const result = await dispatch(updateProductDetails({ productId: id, payload }));
    if (updateProductDetails.fulfilled.match(result)) {
      setEditVisible(false);
    }
  };
  const handleViewOnMap = () => {
    const lat = productLocation.coordinates?.latitude;
    const lng = productLocation.coordinates?.longitude;
    if (lat == null || lng == null) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() =>
      Alert.alert('Could not open map', 'No app was available to open the location.')
    );
  };

  const menuActions = isDeleted
    ? [{ key: 'restore', label: 'Restore product', onPress: handleRestore }]
    : [{ key: 'delete', label: 'Delete product', danger: true, onPress: handleDelete }];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Product</Text>
        <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
        </Pressable>
      </View>

      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !product ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{fetchError || 'Product not found.'}</Text>
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
          {!!brand.name && <Text style={styles.meta}>{brand.name}</Text>}
          {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}

          <View style={styles.badgeRow}>
            <Badge label={status || 'draft'} tone={toneForStatus(status)} />
            {verification.status && verification.status !== 'none' ? (
              <Badge label={`Verification: ${formatLabel(verification.status)}`} tone={toneForStatus(verification.status)} />
            ) : null}
            {product?.isFeatured ? <Badge label="Featured" tone="info" /> : null}
            {product?.isPromoted ? <Badge label="Promoted" tone="info" /> : null}
            {isDeleted ? <Badge label="Deleted" tone="error" /> : null}
          </View>

          {!!fetchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          )}
          {!!successMessage && (
            <Pressable style={styles.successBanner} onPress={() => dispatch(clearCurrentProductMessage())}>
              <Text style={styles.successText}>{successMessage}</Text>
            </Pressable>
          )}
          {!!actionError && <View style={styles.errorBanner}><Text style={styles.errorText}>{actionError}</Text></View>}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Price</Text>
              <Text style={styles.statValue}>{formatCurrency(pricing.selling, pricing.currency)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Stock</Text>
              <Text style={styles.statValue}>{inventory.stock ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Avg. rating</Text>
              <Text style={styles.statValue}>{ratings.average != null ? Number(ratings.average).toFixed(1) : '—'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Views</Text>
              <Text style={styles.statValue}>{analytics.views ?? 0}</Text>
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
            <InfoRow label="SKU" value={product?.sku || '—'} />
            <InfoRow label="Vendor ID" value={product?.vendorId || '—'} />
            <InfoRow label="Product type" value={formatLabel(product?.productType)} />
            <InfoRow label="Condition" value={formatLabel(product?.condition)} />
            <InfoRow label="Has variants" value={product?.hasVariants ? `Yes (${variants.length})` : 'No'} />
            <InfoRow label="Created" value={formatDate(product?.createdAt)} isLast />
          </SectionCard>

          {(description.short || description.long || description.features?.length) ? (
            <SectionCard title="Description">
              {!!description.short && <InfoRow label="Short" value={description.short} />}
              {!!description.long && <InfoRow label="Full" value={description.long} />}
              {Array.isArray(description.features) && description.features.length ? (
                <InfoRow label="Features" value={description.features.join(', ')} isLast />
              ) : null}
            </SectionCard>
          ) : null}

          <SectionCard title="Pricing">
            <InfoRow label="MRP" value={formatCurrency(pricing.mrp, pricing.currency)} />
            <InfoRow label="Selling price" value={formatCurrency(pricing.selling, pricing.currency)} />
            <InfoRow label="Cost" value={formatCurrency(pricing.cost, pricing.currency)} />
            <InfoRow
              label="Discount"
              value={pricing.discount?.percentage ? `${pricing.discount.percentage}% off` : '—'}
              isLast
            />
          </SectionCard>

          <SectionCard title="Inventory">
            <InfoRow label="Track inventory" value={inventory.trackInventory ? 'Yes' : 'No'} />
            <InfoRow label="Stock" value={inventory.stock ?? 0} />
            <InfoRow label="Low stock threshold" value={inventory.lowStockThreshold ?? '—'} />
            <InfoRow label="Allow backorder" value={inventory.allowBackorder ? 'Yes' : 'No'} isLast />
          </SectionCard>

          {variants.length > 0 ? (
            <SectionCard title="Variants" subtitle={`${variants.length} variant${variants.length === 1 ? '' : 's'}`}>
              {variants.map((v, index) => (
                <InfoRow
                  key={v?._id || index}
                  label={v?.name || `Variant ${index + 1}`}
                  value={`${formatCurrency(v?.price?.selling)} · Stock ${v?.stock?.quantity ?? 0}${v?.isActive === false ? ' · Inactive' : ''}`}
                  isLast={index === variants.length - 1}
                />
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Shipping">
            <InfoRow label="Delivery method" value={shipping.deliveryMethod || '—'} />
            <InfoRow label="Delivery charge" value={formatCurrency(shipping.deliveryCharge)} />
            <InfoRow label="Free delivery" value={shipping.freeDelivery ? 'Yes' : 'No'} />
            <InfoRow label="Delivery time" value={shipping.deliveryTimeInDays ? `${shipping.deliveryTimeInDays} day(s)` : '—'} isLast />
          </SectionCard>

          {(productLocation.city || productLocation.street || hasCoordinates) ? (
            <SectionCard title="Location">
              <InfoRow label="Street" value={productLocation.street || '—'} />
              <InfoRow label="City" value={productLocation.city || '—'} />
              <InfoRow label="State" value={productLocation.state || '—'} />
              <InfoRow label="Country" value={productLocation.country || '—'} isLast={!hasCoordinates} />
              {hasCoordinates ? (
                <Pressable style={styles.mapButton} onPress={handleViewOnMap}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={styles.mapButtonText}>See on map</Text>
                </Pressable>
              ) : null}
            </SectionCard>
          ) : null}

          <SectionCard title="Performance">
            <InfoRow label="Total reviews" value={ratings.count ?? 0} />
            <InfoRow label="Total views" value={analytics.views ?? 0} />
            <InfoRow label="Units sold" value={performance.sales?.unitsSold ?? 0} />
            <InfoRow label="Quality score" value={performance.scores?.qualityScore ?? '—'} isLast />
          </SectionCard>

          {status === 'rejected' && product?.rejectionReason ? (
            <SectionCard title="Rejection reason">
              <InfoRow label="Reason" value={product.rejectionReason} isLast />
            </SectionCard>
          ) : null}

          {!!product?.adminNotes && (
            <SectionCard title="Admin notes">
              <InfoRow label="Notes" value={product.adminNotes} isLast />
            </SectionCard>
          )}

          {isDeleted ? (
            <SectionCard title="Deletion">
              <InfoRow label="Deleted at" value={formatDate(product?.deletedAt)} isLast />
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
            <Text style={styles.secondaryButtonText}>Update product</Text>
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
        title="Reject product"
        description={`Provide a reason for rejecting "${title}".`}
        placeholder="Enter rejection reason"
        confirmLabel="Reject product"
        danger
        loading={isBusy}
        onCancel={() => setReasonModal(false)}
        onConfirm={handleReject}
      />

      <EditProductModal
        visible={editVisible}
        product={product}
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
