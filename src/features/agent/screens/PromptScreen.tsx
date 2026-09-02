import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fontSize, spacing, borderRadius } from '../../../core/theme/appTheme';
import { useAgentStore } from '../store/useAgentStore';
import { MainStackParamList } from '../../../core/navigation/MainStack';
import { WORKSPACE_ENDPOINTS } from '../../../core/constants/apiConstants';
import axiosClient from '../../../core/network/axiosClient';
import ErrorBanner from '../../../shared/components/ErrorBanner';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Prompt'>;
type Route = RouteProp<MainStackParamList, 'Prompt'>;

const PROVIDERS = ['deepseek', 'claude', 'openai'] as const;

interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
}

export default function PromptScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [prompt, setPrompt] = useState('');

  // File browser state
  const [showFiles, setShowFiles] = useState(false);
  const [treePath, setTreePath] = useState('');
  const [treeEntries, setTreeEntries] = useState<TreeEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  const {
    jobStatus,
    selectedProvider,
    error,
    submitPrompt,
    setProvider,
    clearError,
  } = useAgentStore();

  const isSubmitting = jobStatus === 'SUBMITTING';
  const canSubmit = prompt.trim().length > 0 && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const jobId = await submitPrompt(params.projectId, prompt.trim());
    if (jobId) {
      setPrompt('');
      // ponytail: navigate to JobStatusScreen when built
    }
  }, [canSubmit, submitPrompt, params.projectId, prompt]);

  const fetchTree = useCallback(async (path: string) => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const { data } = await axiosClient.get(
        WORKSPACE_ENDPOINTS.PROJECT_TREE(params.projectId, path),
      );
      setTreeEntries(data.data ?? []);
      setTreePath(path);
    } catch {
      setTreeError('Failed to load files');
    } finally {
      setTreeLoading(false);
    }
  }, [params.projectId]);

  const openFileBrowser = useCallback(() => {
    setShowFiles(true);
    fetchTree('');
  }, [fetchTree]);

  const navigateUp = useCallback(() => {
    const parent = treePath.includes('/')
      ? treePath.substring(0, treePath.lastIndexOf('/'))
      : '';
    fetchTree(parent);
  }, [treePath, fetchTree]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {params.projectName}
        </Text>
        <TouchableOpacity onPress={openFileBrowser} hitSlop={12}>
          <Ionicons name="folder-open-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <View style={styles.body}>
        <TextInput
          style={styles.input}
          placeholder="Describe what you want to build or change..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          value={prompt}
          onChangeText={setPrompt}
          editable={!isSubmitting}
          autoFocus
        />

        <View style={styles.footer}>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.providerChip,
                  selectedProvider === p && styles.providerChipActive,
                ]}
                onPress={() => setProvider(p)}
                disabled={isSubmitting}
              >
                <Text
                  style={[
                    styles.providerLabel,
                    selectedProvider === p && styles.providerLabelActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitLabel}>Run</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* File Browser Modal */}
      <Modal visible={showFiles} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFiles(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {treePath || params.projectName}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {treePath !== '' && (
            <TouchableOpacity style={styles.upRow} onPress={navigateUp}>
              <Ionicons name="arrow-up-outline" size={18} color={colors.primary} />
              <Text style={styles.upText}>..</Text>
            </TouchableOpacity>
          )}

          {treeError && <ErrorBanner message={treeError} onDismiss={() => setTreeError(null)} />}

          {treeLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={treeEntries}
              keyExtractor={(item) => item.path}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.treeRow}
                  onPress={() => item.type === 'dir' && fetchTree(item.path)}
                  disabled={item.type === 'file'}
                  activeOpacity={item.type === 'dir' ? 0.6 : 1}
                >
                  <Ionicons
                    name={item.type === 'dir' ? 'folder' : 'document-outline'}
                    size={20}
                    color={item.type === 'dir' ? colors.warning : colors.textSecondary}
                  />
                  <Text style={styles.treeName}>{item.name}</Text>
                  {item.type === 'dir' && (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No files found</Text>
              }
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'space-between' },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingTop: spacing.md, lineHeight: 24 },
  footer: { paddingBottom: spacing.xl, gap: spacing.md },
  providerRow: { flexDirection: 'row', gap: spacing.sm },
  providerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  providerChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  providerLabel: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textSecondary, textTransform: 'capitalize' },
  providerLabelActive: { color: colors.primary, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitLabel: { fontSize: fontSize.md, fontWeight: '600', color: '#fff' },
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  upRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  upText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '500' },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  treeName: { fontSize: fontSize.md, color: colors.text, flex: 1 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  loader: { padding: spacing.xl },
});
