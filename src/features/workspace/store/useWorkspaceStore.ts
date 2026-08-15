import { create } from 'zustand';
import { workspaceApi, GithubRepo, WorkspaceProject, CreateProjectRequest } from '../api/workspaceApi';
import { saveSecure } from '../../../core/storage/secureStore';
import { STORAGE_KEYS } from '../../../core/constants/storageKeys';
import axios from 'axios';

interface WorkspaceState {
  projects: WorkspaceProject[];
  repos: GithubRepo[];
  activeProjectId: number | null;
  isLoadingProjects: boolean;
  isLoadingRepos: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchRepos: () => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<boolean>;
  deleteProject: (id: number) => Promise<boolean>;
  setActiveProject: (id: number) => void;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projects: [],
  repos: [],
  activeProjectId: null,
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

  createProject: async (reqData) => {
    set({ error: null });
    try {
      const { data } = await workspaceApi.createProject(reqData);
      if (data.data) {
        set((s) => ({ projects: [...s.projects, data.data!] }));
      }
      return true;
    } catch (e) {
      set({ error: extractError(e) });
      return false;
    }
  },

  deleteProject: async (id) => {
    set({ error: null });
    try {
      await workspaceApi.deleteProject(id);
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
      }));
      return true;
    } catch (e) {
      set({ error: extractError(e) });
      return false;
    }
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id });
    saveSecure(STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID, String(id));
  },

  clearError: () => set({ error: null }),
}));

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  }
  return 'Something went wrong';
}
