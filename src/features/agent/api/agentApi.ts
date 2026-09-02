import axiosClient from '../../../core/network/axiosClient';
import { AGENT_ENDPOINTS } from '../../../core/constants/apiConstants';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

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
}

interface ApiResponse<T> {
  statusCode: string;
  message: string;
  data: T | null;
}

export const agentApi = {
  submitJob: (data: JobRequest) =>
    axiosClient.post<ApiResponse<JobResponse>>(AGENT_ENDPOINTS.JOBS, data),

  getJob: (jobId: string) =>
    axiosClient.get<ApiResponse<JobResponse>>(AGENT_ENDPOINTS.JOB(jobId)),

  getProjectJobs: (projectId: string) =>
    axiosClient.get<ApiResponse<JobResponse[]>>(AGENT_ENDPOINTS.PROJECT_JOBS(projectId)),
};
