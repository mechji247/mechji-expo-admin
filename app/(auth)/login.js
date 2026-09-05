import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import {
  adminLogin,
  clearAdminError,
  selectAdminError,
  selectAdminLoading,
} from '../../store/slices/adminSlice';
import { saveTokens } from '../../lib/tokens/secureTokens';
import log from '../../lib/utils/logger';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAdminLoading);
  const error = useSelector(selectAdminError);

  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const trimmedAdminId = adminId.trim();
  const isAdminIdValid = trimmedAdminId.length > 0;
  const isFormValid = isAdminIdValid && password.length > 0;

  const handleSubmit = async () => {
    setTouched(true);
    if (!isFormValid || loading) return;

    const result = await dispatch(
      adminLogin({ adminId: trimmedAdminId, password, clientType: 'expo' })
    );

    if (adminLogin.fulfilled.match(result)) {
      
      if (result.payload?.mfaRequired) {
        return router.replace('/mfa');
      }

      if (result.payload?.accessToken) {
        try {
          await saveTokens({
            accessToken: result.payload.accessToken,
            refreshToken: result.payload.refreshToken,
          });
          return router.replace('/');
        } catch (err) {
          log.error('Failed to persist admin session tokens', err?.message || err);
        }
      }
    } else {
      log.error('Admin sign-in failed', result.payload);
    }
  };

  const handleChangeAdminId = (value) => {
    if (error) dispatch(clearAdminError());
    setAdminId(value);
  };

  const handleChangePassword = (value) => {
    if (error) dispatch(clearAdminError());
    setPassword(value);
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot your password?',
      'Self-service reset isn’t available yet. Ask a super admin to reset your password from Manage Admins.'
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[colors.primaryMuted, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <StatusBar style="dark"/>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.brand}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoLetter}>M</Text>
              </View>
              <Text style={styles.brandTitle}>Mechji Admin</Text>
              <Text style={styles.brandSubtitle}>Sign in to the control center</Text>
            </View>

            <View style={styles.card}>
              {!!error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>Admin ID or email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  value={adminId}
                  onChangeText={handleChangeAdminId}
                  placeholder="MECHJI-ADM-000000"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  editable={!loading}
                />
              </View>
              {touched && !isAdminIdValid && (
                <Text style={styles.fieldError}>Admin ID is required</Text>
              )}

              <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  value={password}
                  onChangeText={handleChangePassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  editable={!loading}
                  onSubmitEditing={handleSubmit}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              {touched && password.length === 0 && (
                <Text style={styles.fieldError}>Password is required</Text>
              )}

              <Pressable onPress={handleForgotPassword} style={styles.forgotLink} hitSlop={8}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              <Pressable
                style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={!isFormValid || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.buttonText}>Sign in</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
              <Text style={styles.footerText}>Protected by two-factor authentication</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  logoLetter: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '700',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  brandSubtitle: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  labelSpaced: {
    marginTop: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  inputField: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  fieldError: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.danger,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.sm + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    marginLeft: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
});