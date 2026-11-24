import axiosClient from '../../../core/network/axiosClient';
export type GitAction = 'commit' | 'create-branch' | 'switch' | 'fetch' | 'pull' | 'push' | 'merge' | 'rebase' | 'continue' | 'abort';
export type GitChange = { path: string; originalPath?: string; status: 'A' | 'M' | 'D' | 'R' | 'C' };
export type GitStatus = {
  branch: string | null; head: string; upstream: string | null; ahead: number; behind: number;
  changes: GitChange[]; branches: { name: string; remote: boolean }[]; operation: 'merge' | 'rebase' | null; revision: string;
};
export type GitCommit = { sha: string; subject: string; author: string; date: string };
interface Response<T> { data: T; message: string; }
const url = (project: string) => `/api/agent/sessions/project/${project}/git`;
export const gitApi = {
  status: (project: string) => axiosClient.get<Response<GitStatus>>(url(project), { timeout: 120000 }),
  diff: (project: string, path: string) => axiosClient.get<Response<{ path: string; diff: string }>>(`${url(project)}/diff`, { params: { path }, timeout: 120000 }),
  history: (project: string) => axiosClient.get<Response<GitCommit[]>>(`${url(project)}/history`, { timeout: 120000 }),
  action: (project: string, action: GitAction, request: Record<string, string>) => axiosClient.post<Response<{ message: string; status: GitStatus }>>(`${url(project)}/${action}`, request, { timeout: 120000 }),
};
