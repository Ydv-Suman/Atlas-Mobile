import { create } from 'zustand';
import { workspaceApi, GithubRepo, WorkspaceProject } from '../api/workspaceApi';
import axios from 'axios';

interface WorkspaceState {
  projects: WorkspaceProject[];
  repos: GithubRepo[];
  isLoadingProjects: boolean;
  isLoadingRepos: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchRepos: () => Promise<void>;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projects: [],
  repos: [],
  isLoadingProjects: false,
  isLoadingRepos: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoadingProjects: true, error: null });
    try {
      const { data } = await workspaceApi.fetchProjects();
      set({ projects: data.data ?? [], isLoadingProjects: false });
    } catch (e) {
      set({ isLoadingProjects: false, error: extractError(e) });
    }
  },

  fetchRepos: async () => {
    set({ isLoadingRepos: true, error: null });
    try {
      const { data } = await workspaceApi.fetchRepos();
      set({ repos: data.data ?? [], isLoadingRepos: false });
    } catch (e) {
      set({ isLoadingRepos: false, error: extractError(e) });
    }
  },

  clearError: () => set({ error: null }),
}));

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  }
  return 'Something went wrong';
}
