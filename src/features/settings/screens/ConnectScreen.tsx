import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { colors, fontSize, spacing, borderRadius } from '../../../core/theme/appTheme';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { authApi } from '../../auth/api/authApi';
import axiosClient from '../../../core/network/axiosClient';
import { AGENT_ENDPOINTS } from '../../../core/constants/apiConstants';
import ErrorBanner from '../../../shared/components/ErrorBanner';
import AtlasButton from '../../../shared/components/AtlasButton';

interface ApiKeyInfo {
  id: string;
  provider: string;
  keyHint: string;
  createdAt: string;
}

export default function ConnectScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API keys state
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newProvider, setNewProvider] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    try {
      const { data } = await axiosClient.get(AGENT_ENDPOINTS.KEYS);
      setKeys(data.data ?? []);
    } catch {
      // ponytail: silent fail on key list, non-critical
    } finally {
      setIsLoadingKeys(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, []);

  const connectGithub = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { data } = await authApi.authorizeGithub();
      await WebBrowser.openAuthSessionAsync(data.authorizationUrl);
      await fetchUser();
      if (!useAuthStore.getState().user?.githubAuthorized) {
        setError('GitHub not connected yet. Complete authorization in browser.');
      }
    } catch (e) {
      setError(extractError(e));
    } finally {
      setIsConnecting(false);
    }
  };

  const saveKey = async () => {
    if (!newProvider.trim() || !newApiKey.trim()) return;
    setIsSavingKey(true);
    try {
      await axiosClient.post(AGENT_ENDPOINTS.KEYS, {
        provider: newProvider.trim().toLowerCase(),
        apiKey: newApiKey.trim(),
      });
      setNewProvider('');
      setNewApiKey('');
      setShowAddKey(false);
      loadKeys();
    } catch (e) {
      setError(extractError(e));
    } finally {
      setIsSavingKey(false);
    }
  };

  const deleteKey = (provider: string) => {
    Alert.alert('Remove Key', `Delete ${provider} API key?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosClient.delete(`${AGENT_ENDPOINTS.KEYS}/${provider}`);
            setKeys((prev) => prev.filter((k) => k.provider !== provider));
          } catch (e) {
            setError(extractError(e));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Connect</Text>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* GitHub Section */}
      <Text style={styles.sectionTitle}>GitHub</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons
            name={user?.githubAuthorized ? 'checkmark-circle' : 'logo-github'}
            size={22}
            color={user?.githubAuthorized ? colors.success : colors.text}
          />
          <Text style={styles.rowLabel}>
            {user?.githubAuthorized ? 'Connected' : 'Not connected'}
          </Text>
        </View>
        {!user?.githubAuthorized && (
          <AtlasButton
            label="Connect GitHub"
            onPress={connectGithub}
            isLoading={isConnecting}
            style={styles.sectionBtn}
          />
        )}
      </View>

      {/* API Keys Section */}
      <Text style={styles.sectionTitle}>AI Provider Keys</Text>
      <View style={styles.card}>
        {isLoadingKeys ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : keys.length === 0 && !showAddKey ? (
          <Text style={styles.emptyText}>No API keys added. Use your own keys for Claude, OpenAI, or other providers.</Text>
        ) : (
          keys.map((k) => (
            <View key={k.id} style={styles.keyRow}>
              <View style={styles.keyInfo}>
                <Text style={styles.keyProvider}>{k.provider}</Text>
                <Text style={styles.keyHint}>••••{k.keyHint}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteKey(k.provider)} hitSlop={12}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {showAddKey && (
          <View style={styles.addKeyForm}>
            <TextInput
              style={styles.input}
              placeholder="Provider (e.g. claude, openai)"
              placeholderTextColor={colors.textMuted}
              value={newProvider}
              onChangeText={setNewProvider}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="API Key"
              placeholderTextColor={colors.textMuted}
              value={newApiKey}
              onChangeText={setNewApiKey}
              autoCapitalize="none"
              secureTextEntry
            />
            <View style={styles.addKeyActions}>
              <TouchableOpacity onPress={() => { setShowAddKey(false); setNewProvider(''); setNewApiKey(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <AtlasButton label="Save" onPress={saveKey} isLoading={isSavingKey} style={styles.saveBtn} />
            </View>
          </View>
        )}

        {!showAddKey && (
          <TouchableOpacity style={styles.addKeyBtn} onPress={() => setShowAddKey(true)}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addKeyText}>Add API Key</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  }
  return 'Something went wrong';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 60, paddingBottom: spacing.xxl },
  header: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  sectionBtn: { marginTop: spacing.md, borderRadius: borderRadius.md },
  loader: { padding: spacing.md },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  keyInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  keyProvider: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  keyHint: { fontSize: fontSize.sm, color: colors.textMuted },
  addKeyForm: { marginTop: spacing.md, gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.background,
  },
  addKeyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
  },
  cancelText: { fontSize: fontSize.sm, color: colors.textSecondary },
  saveBtn: { paddingHorizontal: spacing.lg, borderRadius: borderRadius.sm },
  addKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  addKeyText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
});
