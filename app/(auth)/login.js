import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing } from '../../lib/constants/theme';
import {
  adminLogin,
  clearAdminError,
  resetAdminAuthState,
  selectAdminError,
  selectAdminLoading,
} from '../../store/slices/adminSlice';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { clearTokens, saveTokens } from '../../lib/tokens/secureTokens';
import log from '../../lib/utils/logger';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAdminLoading);
  const error = useSelector(selectAdminError);

  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmedAdminId = adminId.trim();
  const isAdminIdValid = trimmedAdminId.length > 0;
  const isFormValid = isAdminIdValid && password.length > 0;

  const handleSubmit = async () => {
    setTouched(true);
    if (!isFormValid || loading) return;
    try {
       const response = await dispatch(adminLogin({ adminId: trimmedAdminId, password , clientType : "expo"}));
        if(response?.type === "mechjiAdmin/login/fulfilled" && response?.payload?.success) {
            await saveTokens({ accessToken : response?.payload?.accessToken , refreshToken : response?.payload?.refreshToken });
            return router.replace("/")
        }
    } catch (error) {
        console.error('Error on admin sign in :' , error?.response?.data?.message || error?.message || error);
        await clearTokens();
        dispatch(resetAdminAuthState());
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

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Admin sign in</Text>
            <Text style={styles.subtitle}>Sign in with your Mechji admin ID</Text>
          </View>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Admin ID</Text>
            <TextInput
              style={styles.input}
              value={adminId}
              onChangeText={handleChangeAdminId}
              placeholder="Enter your admin ID"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              editable={!loading}
            />
            {touched && !isAdminIdValid && (
              <Text style={styles.fieldError}>Admin ID is required</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={handleChangePassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textContentType="password"
              editable={!loading}
              onSubmitEditing={handleSubmit}
            />
            {touched && password.length === 0 && (
              <Text style={styles.fieldError}>Password is required</Text>
            )}
          </View>

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textMuted,
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
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  fieldError: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.danger,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
});