import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import AtlasTextInput from '../../../shared/components/AtlasTextInput';
import AtlasButton from '../../../shared/components/AtlasButton';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/appTheme';
import { AuthStackParamList } from '../../../core/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showError, setShowError] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    await login(username.trim(), password);
    const err = useAuthStore.getState().error;
    if (err) setShowError(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Atlas</Text>
          <Text style={styles.subtitle}>Code from anywhere</Text>
        </View>

        <View style={styles.form}>
          <AtlasTextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your username"
          />

          <AtlasTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Enter your password"
          />

          <AtlasButton
            label="Sign In"
            onPress={handleLogin}
            isLoading={isLoading}
            disabled={!username.trim() || !password.trim()}
            style={styles.button}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showError && !!error} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => {}}>
          <View style={styles.popup}>
            <Text style={styles.popupIconError}>✕</Text>
            <Text style={styles.popupTitle}>Login Failed</Text>
            <Text style={styles.popupMessage}>{error}</Text>
            <AtlasButton
              label="Try Again"
              onPress={() => {
                setShowError(false);
                clearError();
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  link: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
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
