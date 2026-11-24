import { ActivityIndicator, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../core/theme/appTheme';
import { useWorkspaceStore } from '../../workspace/store/useWorkspaceStore';
import AgentWorkspace from '../components/AgentWorkspace';
import { useAuthStore } from '../../auth/store/useAuthStore';

export default function AgentTabScreen() {
  const account = useAuthStore(state => state.user?.username ?? null);
  const { activeProjectId, projects, account: workspaceAccount, isRestoringProject, isLoadingProjects, error, fetchProjects } = useWorkspaceStore();
  const activeProject = workspaceAccount === account ? projects.find(project => project.id === activeProjectId) : undefined;

  if (!activeProject && (!account || workspaceAccount !== account || isRestoringProject || isLoadingProjects)) {
    return <View style={styles.empty}><ActivityIndicator color={colors.textSecondary} accessibilityLabel="Restoring last project" /></View>;
  }
  if (!activeProject && error) {
    return <View style={styles.empty}><Text style={styles.hint}>{error}</Text><TouchableOpacity onPress={() => { void fetchProjects(); }} accessibilityRole="button" accessibilityLabel="Retry loading projects"><Text style={styles.title}>Retry</Text></TouchableOpacity></View>;
  }

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Ionicons name="sparkles-outline" size={40} color={colors.textMuted} />
        <Text style={styles.title}>No project selected</Text>
        <Text style={styles.hint}>Select a project in Workspace to browse its files and work with your agent.</Text>
      </View>
    );
  }

  return <AgentWorkspace key={activeProject.id} projectId={String(activeProject.id)} projectName={activeProject.projectName} />;
}

const styles = StyleSheet.create({
  empty: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  hint: { fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
});
