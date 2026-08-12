import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/authApi';
import AtlasButton from '../../../shared/components/AtlasButton';
import ErrorBanner from '../../../shared/components/ErrorBanner';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/appTheme';
import { AuthStackParamList } from '../../../core/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'CheckEmail'>;

const RESEND_COOLDOWN = 60;
const OTP_LENGTH = 6;

type PopupState =
  | { type: 'none' }
  | { type: 'success' }
  | { type: 'error'; message: string };

export default function CheckEmailScreen({ navigation }: Props) {
  const { pendingVerificationEmail, error, clearError } = useAuthStore();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [popup, setPopup] = useState<PopupState>({ type: 'none' });
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const otp = digits.join('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleDigitChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (clean.length === 0) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    // Handle paste — distribute across boxes
    if (clean.length > 1) {
      const chars = clean.slice(0, OTP_LENGTH).split('');
      const next = [...digits];
      chars.forEach((c, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = c;
      });
      setDigits(next);
      const focusIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean[0];
    setDigits(next);
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = useCallback(async () => {
    if (!pendingVerificationEmail || otp.length !== OTP_LENGTH) return;
    setIsVerifying(true);
    try {
      await authApi.verifyEmail(pendingVerificationEmail, otp);
      setPopup({ type: 'success' });
    } catch (e: any) {
      setPopup({ type: 'error', message: e.response?.data?.message ?? 'Incorrect OTP, please try again' });
    } finally {
      setIsVerifying(false);
    }
  }, [pendingVerificationEmail, otp]);

  const handleResend = useCallback(async () => {
    if (!pendingVerificationEmail || cooldown > 0) return;
    setIsResending(true);
    try {
      await authApi.resendOtp(pendingVerificationEmail);
      setCooldown(RESEND_COOLDOWN);
    } catch (e: any) {
      setPopup({ type: 'error', message: e.response?.data?.message ?? 'Failed to resend' });
    } finally {
      setIsResending(false);
    }
  }, [pendingVerificationEmail, cooldown]);

  const resendReady = cooldown === 0 && !isResending;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✉</Text>
        </View>

        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{pendingVerificationEmail}</Text>
        </Text>

        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[
                styles.otpBox,
                d !== '' && styles.otpBoxFilled,
              ]}
              value={d}
              onChangeText={(t) => handleDigitChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        <AtlasButton
          label="Verify Email"
          onPress={handleVerify}
          isLoading={isVerifying}
          disabled={otp.length !== OTP_LENGTH}
          style={styles.verifyButton}
        />

        <AtlasButton
          label={cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
          onPress={handleResend}
          variant="secondary"
          isLoading={isResending}
          disabled={!resendReady}
          style={resendReady ? styles.resendReady : styles.resendCooldown}
        />
      </View>

      <Modal visible={popup.type !== 'none'} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => {}}>
          <View style={styles.popup}>
            {popup.type === 'success' && (
              <>
                <Text style={styles.popupIcon}>✓</Text>
                <Text style={styles.popupTitle}>Email Verified!</Text>
                <Text style={styles.popupMessage}>Your email has been verified successfully.</Text>
                <AtlasButton
                  label="Go to Sign In"
                  onPress={() => {
                    setPopup({ type: 'none' });
                    navigation.navigate('Login');
                  }}
                />
              </>
            )}
            {popup.type === 'error' && (
              <>
                <Text style={styles.popupIconError}>✕</Text>
                <Text style={styles.popupTitle}>Verification Failed</Text>
                <Text style={styles.popupMessage}>{popup.message}</Text>
                <AtlasButton
                  label="Try Again"
                  onPress={() => {
                    setDigits(Array(OTP_LENGTH).fill(''));
                    setPopup({ type: 'none' });
                    setTimeout(() => inputRefs.current[0]?.focus(), 100);
                  }}
                />
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    width: '100%',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  email: {
    color: colors.primary,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.lg,
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F0F0F5',
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
  },
  verifyButton: {
    marginBottom: spacing.sm,
  },
  resendReady: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  resendCooldown: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  popup: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  popupIcon: {
    fontSize: 48,
    color: colors.success,
    marginBottom: spacing.md,
  },
  popupIconError: {
    fontSize: 48,
    color: colors.error,
    marginBottom: spacing.md,
  },
  popupTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  popupMessage: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
