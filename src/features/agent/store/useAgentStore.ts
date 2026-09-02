import { create } from 'zustand';
import { agentApi, JobResponse } from '../api/agentApi';
import axios from 'axios';

interface AgentState {
  currentJob: JobResponse | null;
  jobStatus: 'IDLE' | 'SUBMITTING' | 'POLLING' | 'DONE' | 'ERROR';
  selectedProvider: string;
  error: string | null;

  submitPrompt: (projectId: string, prompt: string) => Promise<string | null>;
  fetchJob: (jobId: string) => Promise<void>;
  setProvider: (provider: string) => void;
  reset: () => void;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  currentJob: null,
  jobStatus: 'IDLE',
  selectedProvider: 'deepseek',
  error: null,

  submitPrompt: async (projectId, prompt) => {
    set({ jobStatus: 'SUBMITTING', error: null, currentJob: null });
    try {
      const { data } = await agentApi.submitJob({
        projectId,
        prompt,
        provider: get().selectedProvider,
      });
      const job = data.data;
      if (job) {
        set({ currentJob: job, jobStatus: 'DONE' });
        return job.id;
      }
      set({ jobStatus: 'ERROR', error: 'No job returned' });
      return null;
    } catch (e) {
      set({ jobStatus: 'ERROR', error: extractError(e) });
      return null;
    }
  },

  fetchJob: async (jobId) => {
    try {
      const { data } = await agentApi.getJob(jobId);
      if (data.data) set({ currentJob: data.data });
    } catch (e) {
      set({ error: extractError(e) });
    }
  },

  setProvider: (provider) => set({ selectedProvider: provider }),

  reset: () => set({ currentJob: null, jobStatus: 'IDLE', error: null }),

  clearError: () => set({ error: null }),
}));

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message;
  }
  return 'Something went wrong';
}
