import { create } from 'zustand';
import { workspaceApi, GithubRepo, WorkspaceProject, CreateProjectRequest } from '../api/workspaceApi';
import { getSecure } from '../../../core/storage/secureStore';
import { STORAGE_KEYS } from '../../../core/constants/storageKeys';
import { readLocal, saveLocal } from '../../agent/sessionStorage';
import axios from 'axios';

interface WorkspaceState {
  account: string | null;
  projects: WorkspaceProject[];
  repos: GithubRepo[];
  activeProjectId: number | null;
  isRestoringProject: boolean;
  isLoadingProjects: boolean;
  isLoadingRepos: boolean;
  error: string | null;

  restoreProject: (account: string | null) => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchRepos: () => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<boolean>;
  deleteProject: (id: number) => Promise<boolean>;
  setActiveProject: (id: number) => void;
  clearError: () => void;
}

const lastProjectKey = (account: string) => `atlas.workspace.last-project.v1:${encodeURIComponent(account)}`;
let generation = 0;
let projectLoad: { generation: number; promise: Promise<void> } | null = null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  account: null,
  projects: [],
  repos: [],
  activeProjectId: null,
  isRestoringProject: false,
  isLoadingProjects: false,
  isLoadingRepos: false,
  error: null,

  restoreProject: async (account) => {
    if (get().account === account) return;
    const request = ++generation;
    let cached: WorkspaceProject | null = null;
    if (account) try {
      const saved = readLocal<WorkspaceProject>(lastProjectKey(account));
      if (saved && Number.isSafeInteger(saved.id) && saved.id > 0 && typeof saved.projectName === 'string') cached = saved;
    } catch { /* The server can restore the project list if the device cache is unavailable. */ }
    set({ account, projects: cached ? [cached] : [], repos: [], activeProjectId: cached?.id ?? null,
      isRestoringProject: !!account, isLoadingProjects: false, isLoadingRepos: false, error: null });
    if (!account) return;
    try {
      if (!cached) {
        // Migrate the old ID only after matching it against this account's project list.
        const legacy = await getSecure(STORAGE_KEYS.LAST_ACTIVE_PROJECT_ID).catch(() => null);
        if (request !== generation) return;
        if (get().activeProjectId === null && legacy && /^[1-9]\d*$/.test(legacy)) set({ activeProjectId: Number(legacy) });
      }
      await get().fetchProjects();
    } finally { if (request === generation) set({ isRestoringProject: false }); }
  },

  fetchProjects: () => {
    const account = get().account;
    if (!account) return Promise.resolve();
    const request = generation;
    if (projectLoad?.generation === request) return projectLoad.promise;
    set({ isLoadingProjects: true, error: null });
    const promise = Promise.resolve().then(() => workspaceApi.fetchProjects()).then(({ data }) => {
      if (request !== generation) return;
      const projects = data.data ?? [];
      const selected = projects.find(project => project.id === get().activeProjectId);
      const hadSelection = get().activeProjectId !== null;
      set({ projects, activeProjectId: selected?.id ?? null, isLoadingProjects: false });
      if (selected || hadSelection) try { saveLocal(lastProjectKey(account), selected ?? null); }
      catch { set({ error: "Couldn't remember the last project on this device." }); }
    }).catch(e => {
      if (request === generation) set({ isLoadingProjects: false, error: extractError(e) });
    }).finally(() => { if (projectLoad?.promise === promise) projectLoad = null; });
    projectLoad = { generation: request, promise };
    return promise;
  },

  fetchRepos: async () => {
    if (!get().account) return;
    const request = generation;
    set({ isLoadingRepos: true, error: null });
    try {
      const { data } = await workspaceApi.fetchRepos();
      if (request === generation) set({ repos: data.data ?? [], isLoadingRepos: false });
    } catch (e) {
      if (request === generation) set({ isLoadingRepos: false, error: extractError(e) });
    }
  },

  createProject: async (reqData) => {
    if (!get().account) return false;
    const request = generation;
    set({ error: null });
    try {
      const { data } = await workspaceApi.createProject(reqData);
      if (request !== generation) return false;
      if (data.data) set((s) => ({ projects: [...s.projects, data.data!] }));
      return true;
    } catch (e) {
      if (request === generation) set({ error: extractError(e) });
      return false;
    }
  },

  deleteProject: async (id) => {
    const account = get().account;
    if (!account) return false;
    const request = generation;
    set({ error: null });
    try {
      await workspaceApi.deleteProject(id);
      if (request !== generation) return false;
      const removingActive = get().activeProjectId === id;
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id), activeProjectId: removingActive ? null : s.activeProjectId }));
      if (removingActive) try { saveLocal(lastProjectKey(account), null); }
      catch { set({ error: "Couldn't clear the last project on this device." }); }
      return true;
    } catch (e) {
      if (request === generation) set({ error: extractError(e) });
      return false;
    }
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id });
    const { account, projects } = get();
    const project = projects.find(project => project.id === id);
    if (account && project) try { saveLocal(lastProjectKey(account), project); }
    catch { set({ error: "Couldn't remember the last project on this device." }); }
  },

  clearError: () => set({ error: null }),
}));

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  return e instanceof Error ? e.message : 'Something went wrong';
}
