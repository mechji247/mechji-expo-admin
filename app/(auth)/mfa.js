import { useRouter } from 'expo-router';
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
  clearAdminError,
  resetAdminAuthState,
  selectAdminChallengeToken,
  selectAdminError,
  selectAdminLoading,
  selectAdminMfaSetupRequired,
  verifyAdminMfa,
} from '../../store/slices/adminSlice';

export default function MfaScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const loading = useSelector(selectAdminLoading);
  const error = useSelector(selectAdminError);
  const challengeToken = useSelector(selectAdminChallengeToken);
  const mfaSetupRequired = useSelector(selectAdminMfaSetupRequired);

  const [code, setCode] = useState('');

  const isCodeValid = /^\d{6}$/.test(code);

  const handleChangeCode = (value) => {
    if (error) dispatch(clearAdminError());
    setCode(value.replace(/[^0-9]/g, '').slice(0, 6));
  };

  const handleSubmit = () => {
    if (!isCodeValid || loading) return;
    dispatch(verifyAdminMfa({ challengeToken, code }));
  };

  const handleUseDifferentAccount = () => {
    dispatch(resetAdminAuthState());
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {mfaSetupRequired ? 'Set up two-factor authentication' : 'Two-factor verification'}
          </Text>
          <Text style={styles.subtitle}>
            {mfaSetupRequired
              ? 'Enter the 6-digit code from your authenticator app to finish setting up two-factor authentication.'
              : 'Enter the 6-digit code from your authenticator app to continue.'}
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Verification code</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={handleChangeCode}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            onSubmitEditing={handleSubmit}
          />
        </View>

        <Pressable
          style={[styles.button, (!isCodeValid || loading) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isCodeValid || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>

        <Pressable style={styles.linkButton} onPress={handleUseDifferentAccount} disabled={loading}>
          <Text style={styles.linkText}>Use a different account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
    fontSize: 22,
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
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
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
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});