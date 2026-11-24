import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../core/theme/appTheme';
import { useWorkspaceStore } from '../../workspace/store/useWorkspaceStore';
import AgentWorkspace from '../components/AgentWorkspace';

export default function AgentTabScreen() {
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const projects = useWorkspaceStore(s => s.projects);
  const activeProject = projects.find(project => project.id === activeProjectId);

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
