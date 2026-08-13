import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { authApi } from '../../auth/api/authApi';
import { useAuthStore } from '../../auth/store/useAuthStore';
import AtlasButton from '../../../shared/components/AtlasButton';
import ErrorBanner from '../../../shared/components/ErrorBanner';
import { borderRadius, colors, fontSize, spacing } from '../../../core/theme/appTheme';

export default function GitScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectGithub = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { data } = await authApi.authorizeGithub();
      await WebBrowser.openAuthSessionAsync(data.authorizationUrl);
      await fetchUser();

      if (!useAuthStore.getState().user?.githubAuthorized) {
        setError('GitHub is not connected yet. Complete authorization in the browser, then try again.');
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsConnecting(false);
    }
  };

  if (user?.githubAuthorized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusIcon}>
          <Ionicons name="checkmark-circle-outline" size={42} color={colors.success} />
        </View>
        <Text style={styles.title}>GitHub Connected</Text>
        <Text style={styles.message}>
          Your GitHub account is connected. Workspace and Git tools can use your repositories.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusIcon}>
        <Ionicons name="logo-github" size={42} color={colors.text} />
      </View>

      <Text style={styles.title}>Connect GitHub</Text>
      <Text style={styles.message}>
        GitHub is not connected. Connect your GitHub account to start working with repositories,
        branches, and pull requests.
      </Text>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <AtlasButton
        label="Connect GitHub"
        onPress={connectGithub}
        isLoading={isConnecting}
        style={styles.button}
      />
    </SafeAreaView>
  );
}

function getErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.message ?? e.response?.data?.errorMessage ?? e.message;
  }
  return 'Unable to start GitHub authorization.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  statusIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    borderRadius: borderRadius.md,
  },
});
