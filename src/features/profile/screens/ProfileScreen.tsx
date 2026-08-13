import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { authApi, UserDto } from '../../auth/api/authApi';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { borderRadius, colors, fontSize, spacing } from '../../../core/theme/appTheme';
import AtlasButton from '../../../shared/components/AtlasButton';
import AtlasTextInput from '../../../shared/components/AtlasTextInput';
import ErrorBanner from '../../../shared/components/ErrorBanner';

type EditingField = 'name' | 'email' | 'password' | null;

const OTP_LENGTH = 6;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;

export function getUserInitials(user: UserDto | null): string {
  const first = user?.firstName?.trim()[0];
  const last = user?.lastName?.trim()[0];

  if (first || last) {
    return `${first ?? ''}${last ?? ''}`.toUpperCase();
  }

  return (user?.username?.trim()[0] ?? user?.email?.trim()[0] ?? 'A').toUpperCase();
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const fullName = [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ');
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  const startEdit = (field: Exclude<EditingField, null>) => {
    setFirstName(user?.firstName ?? '');
    setMiddleName(user?.middleName ?? '');
    setLastName(user?.lastName ?? '');
    setEmail(user?.email ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setEditingField(field);
  };

  const cancelEdit = () => {
    setError(null);
    setEditingField(null);
  };

  const saveProfile = async () => {
    if (editingField === 'name' && (!firstName.trim() || !lastName.trim())) {
      setError('First name and last name are required.');
      return;
    }

    if (editingField === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    if (editingField === 'password') {
      if (!currentPassword) {
        setError('Current password is required.');
        return;
      }

      if (newPassword.length < 8 || !PASSWORD_PATTERN.test(newPassword)) {
        setError('Password must include uppercase, lowercase, a number, and a special character.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New password and confirmation do not match.');
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    const updatedEmail = email.trim().toLowerCase();
    const emailChanged = editingField === 'email' && updatedEmail !== user?.email?.toLowerCase();

    try {
      await authApi.updateProfile(
        editingField === 'name'
          ? {
              firstName: firstName.trim(),
              middleName: middleName.trim(),
              lastName: lastName.trim(),
            }
          : editingField === 'email'
            ? { email: updatedEmail }
            : { currentPassword, password: newPassword },
      );
      await fetchUser();
      setEditingField(null);
      if (emailChanged) {
        setOtp('');
        setVerificationError(null);
        setVerificationEmail(updatedEmail);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const verifyUpdatedEmail = async () => {
    if (!verificationEmail || otp.length !== OTP_LENGTH) return;

    setIsVerifying(true);
    setVerificationError(null);

    try {
      await authApi.verifyEmail(verificationEmail, otp);
      await fetchUser();
      setVerificationEmail(null);
      setOtp('');
    } catch (e) {
      setVerificationError(getErrorMessage(e));
    } finally {
      setIsVerifying(false);
    }
  };

  const resendVerificationOtp = async () => {
    if (!verificationEmail) return;

    setIsResending(true);
    setVerificationError(null);

    try {
      await authApi.resendOtp(verificationEmail);
      setOtp('');
    } catch (e) {
      setVerificationError(getErrorMessage(e));
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, '');
    const digits = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] ?? '');

    if (clean.length === 0) {
      digits[index] = '';
      setOtp(digits.join(''));
      return;
    }

    if (clean.length > 1) {
      clean.slice(0, OTP_LENGTH - index).split('').forEach((digit, offset) => {
        digits[index + offset] = digit;
      });
      setOtp(digits.join(''));
      otpInputRefs.current[Math.min(index + clean.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    digits[index] = clean[0];
    setOtp(digits.join(''));
    otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const digits = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] ?? '');
      digits[index - 1] = '';
      setOtp(digits.join(''));
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getUserInitials(user)}</Text>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{fullName || user?.username || 'Atlas User'}</Text>
          <EditIconButton onPress={() => startEdit('name')} />
        </View>

        <View style={styles.details}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <DetailRow label="Username" value={user?.username ?? 'Not available'} />
          <DetailRow
            label="Email"
            value={user?.email ?? 'Not available'}
            onEdit={() => startEdit('email')}
          />
          <SecurityButton onPress={() => startEdit('password')} />
          <StatusRow label="Email Verified" verified={user?.emailVerified === true} />
          <StatusRow label="GitHub Connected" verified={user?.githubAuthorized === true} />
          <DetailRow label="Plan" value={formatValue(user?.tier)} />
          <DetailRow label="Role" value={formatRole(user?.role)} />
          <DetailRow label="Joined" value={formatDate(user?.createdAt)} isLast />
        </View>
      </ScrollView>

      <Modal visible={editingField !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{getModalTitle(editingField)}</Text>

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {editingField === 'name' ? (
              <>
                <AtlasTextInput label="First Name" value={firstName} onChangeText={setFirstName} />
                <AtlasTextInput label="Middle Name" value={middleName} onChangeText={setMiddleName} />
                <AtlasTextInput label="Last Name" value={lastName} onChangeText={setLastName} />
              </>
            ) : editingField === 'email' ? (
              <AtlasTextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : (
              <>
                <AtlasTextInput
                  label="Current Password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <AtlasTextInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <AtlasTextInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <View style={styles.editActions}>
              <AtlasButton
                label="Save"
                onPress={saveProfile}
                isLoading={isSaving}
                disabled={isSaving}
                style={styles.actionButton}
              />
              <AtlasButton
                label="Cancel"
                onPress={cancelEdit}
                variant="secondary"
                disabled={isSaving}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={verificationEmail !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Email</Text>
            <Text style={styles.verificationMessage}>
              Enter the 6-digit code sent to {verificationEmail}.
            </Text>

            {verificationError && (
              <ErrorBanner
                message={verificationError}
                onDismiss={() => setVerificationError(null)}
              />
            )}

            <View style={styles.otpRow}>
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { otpInputRefs.current[index] = ref; }}
                  style={[
                    styles.otpBox,
                    otp[index] && styles.otpBoxFilled,
                  ]}
                  value={otp[index] ?? ''}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(event) => handleOtpKeyPress(event.nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <View style={styles.editActions}>
              <AtlasButton
                label="Verify Email"
                onPress={verifyUpdatedEmail}
                isLoading={isVerifying}
                disabled={otp.length !== OTP_LENGTH || isVerifying}
                style={styles.actionButton}
              />
              <AtlasButton
                label="Resend Code"
                onPress={resendVerificationOtp}
                variant="secondary"
                isLoading={isResending}
                disabled={isResending}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <AtlasButton
        label="Logout"
        onPress={logout}
        variant="danger"
        style={styles.logoutButton}
      />
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  onEdit,
  isLast = false,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, isLast && styles.lastDetailRow]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        <Text style={styles.detailValue}>{value}</Text>
        {onEdit && <EditIconButton onPress={onEdit} />}
      </View>
    </View>
  );
}

function EditIconButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.editIconButton,
        pressed && styles.editIconButtonPressed,
      ]}
    >
      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
    </Pressable>
  );
}

function SecurityButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.passwordButtonWrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.passwordButton,
          pressed && styles.passwordButtonPressed,
        ]}
      >
        <Ionicons name="lock-closed-outline" size={18} color={colors.background} />
        <Text style={styles.passwordButtonText}>Change Password</Text>
      </Pressable>
    </View>
  );
}

function StatusRow({ label, verified }: { label: string; verified: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={[
        styles.statusPill,
        verified ? styles.statusPillVerified : styles.statusPillPending,
      ]}>
        <Ionicons
          name={verified ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          size={16}
          color={verified ? colors.success : colors.warning}
        />
        <Text style={[
          styles.statusText,
          { color: verified ? colors.success : colors.warning },
        ]}>
          {verified ? 'Verified' : 'Not verified'}
        </Text>
      </View>
    </View>
  );
}

function getModalTitle(field: EditingField): string {
  if (field === 'name') return 'Edit Name';
  if (field === 'email') return 'Edit Email';
  return 'Change Password';
}

function formatRole(role: UserDto['role'] | undefined): string {
  return formatValue(role?.replace('ROLE_', ''));
}

function formatValue(value: string | undefined): string {
  if (!value) return 'Not available';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  }
  return 'Unable to update profile.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 0,
  },
  content: {
    paddingBottom: 120,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  details: {
    width: '100%',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  lastDetailRow: {
    borderBottomWidth: 0,
  },
  passwordButtonWrap: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  passwordButton: {
    minHeight: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  passwordButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  passwordButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  detailValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  detailValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  editIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
  },
  editIconButtonPressed: {
    opacity: 0.65,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusPillVerified: {
    backgroundColor: colors.success + '1A',
  },
  statusPillPending: {
    backgroundColor: colors.warning + '1A',
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.45)',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  verificationMessage: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 22,
    marginBottom: spacing.md,
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
  editActions: {
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
  logoutButton: {
    width: '100%',
    transform: [{ translateY: spacing.xs }],
  },
});
