import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  verifyAdminMfa,
} from '../../store/slices/adminSlice';
import { saveTokens } from '../../lib/tokens/secureTokens';
import log from '../../lib/utils/logger';

const CODE_LENGTH = 6;
const MAX_MFA_ATTEMPTS = 5;

function useBlinkingCursor(active) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(0);
      return undefined;
    }

    opacity.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [active, opacity]);

  return opacity;
}
export default function MfaScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const loading = useSelector(selectAdminLoading);
  const error = useSelector(selectAdminError);
  const challengeToken = useSelector(selectAdminChallengeToken);

  const [code, setCode] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  // Wrong-OTP attempts on THIS mfa screen instance. Resets to 0 whenever the
  // screen remounts (a fresh login -> new challengeToken), never persisted.
  // The admin stays on this screen and can keep retrying after each wrong
  // entry until all 5 are used, then they're sent back to login to start over.
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const inputRef = useRef(null);
  const cursorOpacity = useBlinkingCursor(isFocused && !loading);

  const isCodeValid = /^\d{6}$/.test(code);
  const cursorIndex = code.length < CODE_LENGTH ? code.length : -1;

  const focusInput = () => {
    if (!loading) inputRef.current?.focus();
  };

  const handleChangeCode = (value) => {
    if (error) dispatch(clearAdminError());
    setCode(value.replace(/[^0-9]/g, '').slice(0, 6));
  };

  const goBackToLogin = () => {
    dispatch(resetAdminAuthState());
    router.replace('/login');
  };

  const handleSubmit = async () => {
    if (!isCodeValid || loading || attemptsUsed >= MAX_MFA_ATTEMPTS) return;

    const result = await dispatch(
      verifyAdminMfa({ challengeToken, emailOtp: code, clientType: 'expo' })
    );

    if (verifyAdminMfa.fulfilled.match(result)) {
      if (result.payload?.accessToken) {
        try {
          await saveTokens({
            accessToken: result.payload.accessToken,
            refreshToken: result.payload.refreshToken,
          });
        } catch (err) {
          log.error('Failed to persist admin session tokens', err?.message || err);
        }
      }

      return router.replace('/');
    }

    log.error('Admin MFA verification failed', result.payload);

    dispatch(clearAdminError());
    setCode('');

    const isLockedMessage = /locked/i.test(result.payload || '');

    if (isLockedMessage) {
      Alert.alert(
        'MFA locked',
        result.payload || 'MFA is temporarily locked. Please sign in again later.',
        [{ text: 'OK', onPress: goBackToLogin }]
      );
      return;
    }

    const newAttemptsUsed = attemptsUsed + 1;
    setAttemptsUsed(newAttemptsUsed);
    const attemptsRemaining = MAX_MFA_ATTEMPTS - newAttemptsUsed;

    if (attemptsRemaining <= 0) {
      Alert.alert(
        'Too many incorrect attempts',
        'You have used all 5 attempts to verify this code. Please sign in again.',
        [{ text: 'OK', onPress: goBackToLogin }]
      );
      return;
    }

    Alert.alert(
      'Incorrect code',
      `${result.payload || 'The OTP you entered was incorrect.'} You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
      [{ text: 'OK', onPress: focusInput }]
    );
  };

  const handleUseDifferentAccount = () => {
    goBackToLogin();
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
          <Text style={styles.title}>Two-factor verification</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we emailed you to continue.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Verification code</Text>

          <Pressable style={styles.codeRow} onPress={focusInput}>
            {Array.from({ length: CODE_LENGTH }).map((_, index) => {
              const digit = code[index];
              const isCursor = index === cursorIndex;

              return (
                <View
                  key={index}
                  style={[styles.codeBox, isCursor && styles.codeBoxActive]}
                >
                  {digit ? (
                    <Text style={styles.codeDigit}>{digit}</Text>
                  ) : isCursor ? (
                    <Animated.View
                      style={[styles.cursor, { opacity: cursorOpacity }]}
                    />
                  ) : null}
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={handleChangeCode}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            editable={!loading && attemptsUsed < MAX_MFA_ATTEMPTS}
            onSubmitEditing={handleSubmit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus
            caretHidden
          />

          {attemptsUsed > 0 && attemptsUsed < MAX_MFA_ATTEMPTS ? (
            <Text style={styles.attemptsText}>
              {MAX_MFA_ATTEMPTS - attemptsUsed} attempt{MAX_MFA_ATTEMPTS - attemptsUsed === 1 ? '' : 's'} remaining
            </Text>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.button,
            (!isCodeValid || loading || attemptsUsed >= MAX_MFA_ATTEMPTS) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isCodeValid || loading || attemptsUsed >= MAX_MFA_ATTEMPTS}
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
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  codeBox: {
    width: 44,
    height: 52,
    marginHorizontal: spacing.xs / 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: colors.primary,
  },
  codeDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  cursor: {
    width: 2,
    height: 26,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  attemptsText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.danger,
    textAlign: 'center',
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