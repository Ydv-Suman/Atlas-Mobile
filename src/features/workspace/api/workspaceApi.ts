import axiosClient from '../../../core/network/axiosClient';
import { WORKSPACE_ENDPOINTS } from '../../../core/constants/apiConstants';

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  language: string | null;
  default_branch: string;
  private: boolean;
  fork: boolean;
  stargazers_count: number;
  updated_at: string;
  owner: { login: string; avatar_url: string };
}

export interface WorkspaceProject {
  id: number;
  projectName: string;
  framework: string | null;
  githubUrl: string;
  repoOwner: string;
  repoOwnership: 'PERSONAL' | 'ORGANIZATION';
  repoVisibility: 'PUBLIC' | 'PRIVATE';
  projectType: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
}

export interface CreateProjectRequest {
  projectName: string;
  framework?: string;
  githubUrl: string;
  repoOwner: string;
  repoOwnership: string;
  repoVisibility: string;
  projectType?: string;
  createIfNotExists?: boolean;
}

export interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  previewOnly?: boolean;
}

interface ApiResponse<T> {
  statusCode: string;
  message: string;
  data: T | null;
}

export const workspaceApi = {
  fetchTree: (id: string, path = '', signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<TreeEntry[]>>(WORKSPACE_ENDPOINTS.PROJECT_TREE(id, path), { signal }),

  fetchFile: (id: string, path: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ path: string; content: string }>>(WORKSPACE_ENDPOINTS.PROJECT_FILE(id, path), { signal }),

  fetchRepos: () =>
    axiosClient.get<ApiResponse<GithubRepo[]>>(WORKSPACE_ENDPOINTS.REPOS),

  fetchProjects: () =>
    axiosClient.get<ApiResponse<WorkspaceProject[]>>(WORKSPACE_ENDPOINTS.PROJECTS),

  createProject: (data: CreateProjectRequest) =>
    axiosClient.post<ApiResponse<WorkspaceProject>>(WORKSPACE_ENDPOINTS.PROJECTS, data),

  deleteProject: (id: number) =>
    axiosClient.delete<ApiResponse<null>>(`${WORKSPACE_ENDPOINTS.PROJECTS}/${id}`),
};
