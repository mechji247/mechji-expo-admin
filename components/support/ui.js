import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../lib/constants/theme';

// Small building blocks for the Support screens, styled with the admin
// app's theme tokens (lib/constants/theme.js).

function animateWithKeyboard(e) {
  if (Platform.OS !== 'ios' || !e?.duration) return;
  const duration = Math.max(e.duration, 10);
  LayoutAnimation.configureNext({ duration, update: { duration, type: LayoutAnimation.Types[e.easing] || LayoutAnimation.Types.keyboard } });
}

/**
 * How much of the view behind `ref` the software keyboard covers (dp).
 *
 * Replaces KeyboardAvoidingView for the Support screens. It compares the
 * keyboard's top edge (screen coords) with the view's own window frame, so it
 * is right on iOS and on Android whether or not the OS resized the window:
 * Android edge-to-edge (mandatory on SDK 54+) no longer honours adjustResize,
 * and a window that *was* resized simply measures as 0 overlap — no double
 * padding. Pad the view's bottom by `overlap` and pass `onLayout` to it.
 */
export function useKeyboardOverlap(ref) {
  const [state, setState] = useState({ overlap: 0, visible: false });
  const kbTop = useRef(null);
  const current = useRef(state);
  current.current = state;

  const measure = useCallback((event) => {
    const top = kbTop.current;
    const commit = (overlap) => {
      const visible = top != null;
      const prev = current.current;
      if (Math.abs(prev.overlap - overlap) <= 1 && prev.visible === visible) return;
      animateWithKeyboard(event);
      setState({ overlap, visible });
    };
    if (top == null) { commit(0); return; }
    const node = ref.current;
    if (!node?.measureInWindow) { commit(0); return; }
    node.measureInWindow((x, y, w, h) => {
      if (!Number.isFinite(y) || !Number.isFinite(h)) return;
      commit(Math.max(0, Math.round(y + h - top)));
    });
  }, [ref]);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onFrame = (e) => {
      const { screenY, height } = e?.endCoordinates || {};
      kbTop.current = height > 0 && Number.isFinite(screenY) ? screenY : null;
      measure(e);
    };
    const onHide = (e) => { kbTop.current = null; measure(e); };
    // iOS: "will" events so the layout animates with the keyboard; the frame
    // event also covers height changes (QuickType bar, emoji keyboard).
    // Android: only "did" events exist; didShow re-fires on height changes.
    const subs = ios
      ? [Keyboard.addListener('keyboardWillChangeFrame', onFrame), Keyboard.addListener('keyboardWillHide', onHide)]
      : [Keyboard.addListener('keyboardDidShow', onFrame), Keyboard.addListener('keyboardDidHide', onHide)];
    // Keyboard already up when this mounts (e.g. a sheet opened mid-typing).
    const m = Keyboard.metrics?.();
    if (m?.height > 0 && Number.isFinite(m.screenY)) { kbTop.current = m.screenY; measure(null); }
    return () => subs.forEach((s) => s.remove());
  }, [measure]);

  // The view moved/resized (header changed, rotation): recompute while open.
  const onLayout = useCallback(() => { if (kbTop.current != null) measure(null); }, [measure]);
  return { overlap: state.overlap, visible: state.visible, onLayout };
}

export const TONES = {
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  error: { bg: colors.dangerMuted, fg: colors.danger },
  info: { bg: colors.infoMuted, fg: colors.info },
  neutral: { bg: '#EEF0F4', fg: colors.textMuted },
  brand: { bg: colors.primaryMuted, fg: colors.primary },
};

export function Badge({ tone = 'neutral', children, style }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.badgeText, { color: t.fg }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}

const BTN = {
  primary: { bg: colors.primary, fg: colors.surface, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
  danger: { bg: colors.danger, fg: colors.surface, border: colors.danger },
};

export function Button({ label, onPress, variant = 'secondary', size = 'md', busy, disabled, icon, style, accessibilityLabel }) {
  const v = BTN[variant] || BTN.secondary;
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }}
      style={({ pressed }) => [
        styles.btn, size === 'sm' && styles.btnSm,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed && !off) && { opacity: 0.8 }, off && { opacity: 0.5 }, style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 16} color={v.fg} /> : null}
      {label ? <Text style={[styles.btnText, size === 'sm' && { fontSize: 12 }, { color: v.fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

export function Chip({ label, count, active, onPress, tone }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: Boolean(active) }}
      style={[styles.chip, active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
      <Text style={[styles.chipText, active && { color: colors.primary }]}>{label}</Text>
      {count ? <Badge tone={tone || (active ? 'brand' : 'neutral')} style={{ marginLeft: 6 }}>{String(count)}</Badge> : null}
    </Pressable>
  );
}

export function Card({ title, right, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title || right ? (
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.sm }}>{children}</View>
    </View>
  );
}

export function StateView({ loading, error, onRetry, empty, title = 'Nothing here yet', text }) {
  if (loading) {
    return <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading…</Text></View>;
  }
  if (error) {
    return (
      <View style={styles.state} accessibilityLiveRegion="polite">
        <Text style={[styles.muted, { color: colors.danger, textAlign: 'center' }]}>{error}</Text>
        {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>{title}</Text>
        {text ? <Text style={[styles.muted, { textAlign: 'center' }]}>{text}</Text> : null}
      </View>
    );
  }
  return null;
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onDismiss ? <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss"><Ionicons name="close" size={16} color={colors.danger} /></Pressable> : null}
    </View>
  );
}

export function Field({ label, hint, required, children }) {
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={styles.label}>{label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}</Text> : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input({ multiline, style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      {...props}
      style={[styles.input, multiline && { minHeight: 88 }, style]}
    />
  );
}

/** A picker: shows the selected label; opens a list sheet to choose. */
export function Select({ value, options = [], onChange, placeholder = 'Choose…', label, disabled }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => (o.value ?? o.id) === value);
  return (
    <>
      <Pressable onPress={() => !disabled && setOpen(true)} accessibilityRole="button" accessibilityLabel={label ? `${label}: ${current?.label || placeholder}` : undefined}
        style={[styles.input, styles.select, disabled && { opacity: 0.5 }]}>
        <Text style={{ flex: 1, color: current ? colors.text : colors.textMuted, fontSize: 14 }} numberOfLines={1}>{current?.label || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || placeholder}>
        {placeholder !== null ? (
          <Pressable style={styles.option} onPress={() => { onChange(''); setOpen(false); }}>
            <Text style={[styles.optionText, !value && styles.optionActive]}>{placeholder}</Text>
          </Pressable>
        ) : null}
        {options.map((o) => {
          const v = o.value ?? o.id;
          return (
            <Pressable key={v} style={styles.option} onPress={() => { onChange(v); setOpen(false); }} accessibilityState={{ selected: v === value }}>
              <Text style={[styles.optionText, v === value && styles.optionActive]}>{o.label}</Text>
              {v === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}

/** Bottom sheet dialog with a scrollable body and an optional footer. */
export function Sheet({ visible, onClose, title, children, footer }) {
  const insets = useSafeAreaInsets();
  const frameRef = useRef(null);
  const kb = useKeyboardOverlap(frameRef);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* paddingTop keeps a tall sheet (e.g. with the keyboard up) clear of the status bar/notch. */}
      <View ref={frameRef} collapsable={false} onLayout={kb.onLayout} style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top, paddingBottom: kb.overlap }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <View style={styles.backdrop} />
        </Pressable>
        {/* Home-indicator padding only matters when the sheet touches the screen edge, not when it sits on the keyboard. */}
        <View style={[styles.sheet, { paddingBottom: kb.visible ? spacing.sm : Math.max(insets.bottom, spacing.md) }]} accessibilityViewIsModal>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} accessibilityRole="header">{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function KeyValue({ rows }) {
  return (
    <View style={{ gap: 6 }}>
      {rows.filter(Boolean).map(([k, v]) => (
        <View key={k} style={styles.kvRow}>
          <Text style={styles.kvKey}>{k}</Text>
          {typeof v === 'string' || typeof v === 'number' || v == null
            ? <Text style={styles.kvVal} selectable>{v ?? '—'}</Text>
            : <View style={{ flex: 1 }}>{v}</View>}
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Segmented({ tabs, value, onChange }) {
  return (
    // flexGrow: 0 — a horizontal ScrollView defaults to flexGrow 1, so inside a
    // column next to a flex:1 sibling it would steal half the screen height.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segBar} contentContainerStyle={styles.segRow} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Pressable key={t.id} onPress={() => onChange(t.id)} accessibilityRole="tab" accessibilityState={{ selected: value === t.id }}
          style={[styles.seg, value === t.id && styles.segActive]}>
          <Text style={[styles.segText, value === t.id && { color: colors.primary }]}>{t.label}{t.count ? ` · ${t.count}` : ''}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function CheckRow({ label, checked, onToggle }) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(checked) }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.primary : colors.textMuted} />
      <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export const supportStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
});

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, minHeight: 42 },
  btnSm: { paddingHorizontal: 10, minHeight: 32, borderRadius: 8 },
  btnText: { fontSize: 14, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  state: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  stateTitle: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  muted: { fontSize: 13, color: colors.textMuted },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.dangerMuted, borderRadius: 10, padding: 10 },
  errorText: { flex: 1, color: colors.danger, fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textMuted },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  sheetFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: 15, color: colors.text, flex: 1 },
  optionActive: { color: colors.primary, fontWeight: '700' },
  kvRow: { flexDirection: 'row', gap: spacing.sm },
  kvKey: { width: '38%', fontSize: 12, color: colors.textMuted },
  kvVal: { flex: 1, fontSize: 13, color: colors.text },
  section: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: spacing.sm },
  segBar: { flexGrow: 0, flexShrink: 0 },
  segRow: { gap: 6, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  seg: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  segText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
