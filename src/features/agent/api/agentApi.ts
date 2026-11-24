import { AgentEvent } from '../agentEvents';
import { TreeEntry } from '../../workspace/api/workspaceApi';
import axiosClient from '../../../core/network/axiosClient';
import { AGENT_ENDPOINTS } from '../../../core/constants/apiConstants';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobRequest {
  projectId: string;
  prompt: string;
  provider: string;
}

export interface JobResponse {
  id: string;
  projectId: string;
  status: JobStatus;
  diffOutput: string | null;
  errorMessage: string | null;
  creditsConsumed: number | null;
  createdAt: string;
  completedAt: string | null;
  prompt?: string;
  responseText?: string | null;
  provider?: string;
  step?: string | null;
  events?: AgentEvent[];
  interactive?: boolean;
}

export interface JobFilePreview {
  path: string;
  content: string | null;
  deleted: boolean;
}

export interface WorkspaceEntry extends TreeEntry { content?: string; etag?: string; }
export interface DeletedEntry extends TreeEntry { trashId: string; }

interface ApiResponse<T> {
  statusCode: string;
  message: string;
  data: T | null;
}

export const agentApi = {
  createEntry: (projectId: string, parent: string, name: string, kind: 'file' | 'dir') =>
    axiosClient.post<ApiResponse<WorkspaceEntry>>(`/api/agent/sessions/project/${projectId}/entries`, { parent, name, kind }),
  deleteEntry: (projectId: string, path: string) =>
    axiosClient.delete<ApiResponse<DeletedEntry>>(`/api/agent/sessions/project/${projectId}/entries`, { params: { path } }),
  restoreEntry: (projectId: string, trashId: string) =>
    axiosClient.post<ApiResponse<WorkspaceEntry>>(`/api/agent/sessions/project/${projectId}/trash/${trashId}/restore`),

  stop: (jobId: string) => axiosClient.post(`${AGENT_ENDPOINTS.JOB(jobId)}/stop`),
  answer: (jobId: string, requestId: string, approved: boolean, answers: Record<string, { answers: string[] }> = {}) =>
    axiosClient.post(`${AGENT_ENDPOINTS.JOB(jobId)}/answer`, { requestId, approved, answers }),
  tree: (projectId: string, path: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<TreeEntry[]>>(`/api/agent/sessions/project/${projectId}/tree`, { params: { path }, signal, timeout: 120000 }),
  file: (projectId: string, path: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ path: string; content: string; etag: string }>>(`/api/agent/sessions/project/${projectId}/file`, { params: { path }, signal, timeout: 120000 }),
  saveFile: (projectId: string, path: string, content: string, etag: string) =>
    axiosClient.put<ApiResponse<{ path: string; content: string; etag: string }>>(`/api/agent/sessions/project/${projectId}/file`, { content, etag }, { params: { path } }),

  submitJob: (data: JobRequest) =>
    axiosClient.post<ApiResponse<JobResponse>>(AGENT_ENDPOINTS.JOBS, data),

  getJob: (jobId: string) =>
    axiosClient.get<ApiResponse<JobResponse>>(AGENT_ENDPOINTS.JOB(jobId)),

  getFiles: (jobId: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<JobFilePreview[]>>(AGENT_ENDPOINTS.JOB_FILES(jobId), { signal }),

  getProjectJobs: (projectId: string) =>
    axiosClient.get<ApiResponse<JobResponse[]>>(AGENT_ENDPOINTS.PROJECT_JOBS(projectId)),
};
