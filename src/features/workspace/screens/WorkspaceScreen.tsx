import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, borderRadius } from '../../../core/theme/appTheme';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { GithubRepo, WorkspaceProject } from '../api/workspaceApi';
import ErrorBanner from '../../../shared/components/ErrorBanner';

export default function WorkspaceScreen() {
  const {
    projects,
    repos,
    isLoadingProjects,
    isLoadingRepos,
    error,
    fetchProjects,
    fetchRepos,
    clearError,
  } = useWorkspaceStore();

  useEffect(() => {
    fetchProjects();
    fetchRepos();
  }, []);

  const onRefresh = useCallback(() => {
    fetchProjects();
    fetchRepos();
  }, []);

  const isRefreshing = isLoadingProjects || isLoadingRepos;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Workspace</Text>

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <SectionHeader title="Active Projects" count={projects.length} />
            {isLoadingProjects && projects.length === 0 ? (
              <ActivityIndicator
                color={colors.primary}
                style={styles.loader}
              />
            ) : projects.length === 0 ? (
              <EmptyState message="No projects yet. Create one from a repository below." />
            ) : (
              projects.map((p) => <ProjectCard key={p.id} project={p} />)
            )}

            <SectionHeader
              title="Repositories"
              count={repos.length}
              style={styles.repoSectionHeader}
            />
            {isLoadingRepos && repos.length === 0 ? (
              <ActivityIndicator
                color={colors.primary}
                style={styles.loader}
              />
            ) : repos.length === 0 ? (
              <EmptyState message="No repositories found on your GitHub account." />
            ) : (
              repos.map((r) => <RepoCard key={r.id} repo={r} />)
            )}
          </>
        }
      />
    </View>
  );
}

function SectionHeader({
  title,
  count,
  style,
}: {
  title: string;
  count: number;
  style?: object;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </View>
  );
}

function ProjectCard({ project }: { project: WorkspaceProject }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="folder-outline" size={18} color={colors.primary} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {project.projectName}
          </Text>
        </View>
        <VisibilityBadge isPrivate={project.repoVisibility === 'PRIVATE'} />
      </View>
      {project.githubUrl && (
        <Text style={styles.cardDesc} numberOfLines={1}>
          {project.githubUrl.slice(0, 80)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function RepoCard({ repo }: { repo: GithubRepo }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="book-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {repo.name}
          </Text>
        </View>
        <VisibilityBadge isPrivate={repo.private} />
      </View>
      {repo.description && (
        <Text style={styles.cardDesc} numberOfLines={1}>
          {repo.description.slice(0, 80)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function VisibilityBadge({ isPrivate }: { isPrivate: boolean }) {
  return (
    <View
      style={[
        styles.visibilityBadge,
        isPrivate && styles.privateBadge,
      ]}
    >
      <Ionicons
        name={isPrivate ? 'lock-closed-outline' : 'globe-outline'}
        size={11}
        color={isPrivate ? colors.warning : colors.textMuted}
      />
      <Text
        style={[
          styles.visibilityText,
          isPrivate && styles.privateText,
        ]}
      >
        {isPrivate ? 'Private' : 'Public'}
      </Text>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  header: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  repoSectionHeader: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  countText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  cardDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: 3,
  },
  privateBadge: {
    borderColor: colors.warning + '40',
    backgroundColor: colors.warning + '10',
  },
  visibilityText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
  },
  privateText: {
    color: colors.warning,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loader: {
    padding: spacing.xl,
  },
});
