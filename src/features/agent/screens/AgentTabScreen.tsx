import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '../../../core/theme/appTheme';
import { useAgentStore } from '../store/useAgentStore';
import { useWorkspaceStore } from '../../workspace/store/useWorkspaceStore';
import ErrorBanner from '../../../shared/components/ErrorBanner';

const PROVIDERS = ['deepseek', 'claude', 'openai'] as const;

export default function AgentTabScreen() {
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const projects = useWorkspaceStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Ionicons name="sparkles-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No project selected</Text>
        <Text style={styles.emptyText}>
          Tap a project in Workspace to get started.
        </Text>
      </View>
    );
  }

  return <PromptBody projectId={String(activeProject.id)} projectName={activeProject.projectName} />;
}

function PromptBody({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [prompt, setPrompt] = useState('');
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
    const jobId = await submitPrompt(projectId, prompt.trim());
    if (jobId) {
      setPrompt('');
      // ponytail: navigate to JobStatusScreen when built
    }
  }, [canSubmit, submitPrompt, projectId, prompt]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Ionicons name="folder-outline" size={20} color={colors.primary} />
        <Text style={styles.headerTitle} numberOfLines={1}>{projectName}</Text>
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
        />

        <View style={styles.footer}>
          <View style={styles.providerRow}>
            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.providerChip, selectedProvider === p && styles.providerChipActive]}
                onPress={() => setProvider(p)}
                disabled={isSubmitting}
              >
                <Text style={[styles.providerLabel, selectedProvider === p && styles.providerLabelActive]}>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, flex: 1 },
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
});
