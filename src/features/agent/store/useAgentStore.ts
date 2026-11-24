import { AgentEvent, mergeEvents } from '../agentEvents';
import { create } from 'zustand';
import { agentApi, JobResponse } from '../api/agentApi';
import axios from 'axios';
import { jobErrorReason } from '../jobFeedback';

export interface JobStep {
  step: string;
  status: 'IN_PROGRESS' | 'DONE' | 'ERROR';
  message: string | null;
}

interface AgentState {
  currentJob: JobResponse | null;
  jobProjectId: string | null;
  pendingPrompt: string | null;
  jobStatus: 'IDLE' | 'SUBMITTING' | 'POLLING' | 'DONE' | 'ERROR';
  steps: JobStep[];
  selectedProvider: string;
  error: string | null;

  submitPrompt: (projectId: string, prompt: string) => Promise<string | null>;
  receiveEvent: (jobId: string, event: AgentEvent) => void;
  stop: () => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  updateStep: (step: string, status: string, message?: string) => void;
  setProvider: (provider: string) => void;
  reset: () => void;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  currentJob: null,
  jobProjectId: null,
  pendingPrompt: null,
  jobStatus: 'IDLE',
  steps: [],
  selectedProvider: 'openai',
  error: null,

  submitPrompt: async (projectId, prompt) => {
    if (get().jobStatus === 'SUBMITTING' || get().jobStatus === 'POLLING') return null;
    set({ jobStatus: 'SUBMITTING', jobProjectId: projectId, pendingPrompt: prompt, error: null, currentJob: null, steps: [] });
    try {
      const { data } = await agentApi.submitJob({
        projectId,
        prompt,
        provider: get().selectedProvider,
      });
      const job = data.data;
      if (job) {
        set({ currentJob: { ...job, events: mergeEvents(get().currentJob?.id === job.id ? get().currentJob?.events ?? [] : [], job.events ?? []) }, jobStatus: ['COMPLETED', 'CANCELLED'].includes(job.status) ? 'DONE' : job.status === 'FAILED' ? 'ERROR' : 'POLLING',
          error: job.status === 'FAILED' ? jobErrorReason(job.errorMessage ?? 'The agent could not complete this request.') : null });
        return job.id;
      }
      set({ jobStatus: 'ERROR', error: 'No job returned' });
      return null;
    } catch (e) {
      set({ jobStatus: 'ERROR', error: extractError(e) });
      return null;
    }
  },

  receiveEvent: (jobId, event) => {
    const job = get().currentJob;
    if (!job || job.id !== jobId) return;
    set({ currentJob: { ...job, events: mergeEvents(job.events ?? [], [event]) } });
    if (event.type === 'turn.end') get().fetchJob(jobId);
  },
  stop: async () => {
    const job = get().currentJob;
    if (!job) return;
    try { await agentApi.stop(job.id); } catch (error) { set({ error: extractError(error) }); }
  },

  fetchJob: async (jobId) => {
    try {
      const { data } = await agentApi.getJob(jobId);
      if (data.data && get().currentJob?.id === jobId) {
        const job = data.data;
        set({ currentJob: { ...job, events: mergeEvents(get().currentJob?.id === job.id ? get().currentJob?.events ?? [] : [], job.events ?? []) }, jobStatus: ['COMPLETED', 'CANCELLED'].includes(job.status) ? 'DONE' : job.status === 'FAILED' ? 'ERROR' : 'POLLING',
          error: job.status === 'FAILED' ? jobErrorReason(job.errorMessage ?? 'The agent could not complete this request.') : null });
      }
    } catch (e) {
      if (get().currentJob?.id === jobId) set({ error: extractError(e) });
    }
  },

  updateStep: (step, status, message) => {
    const steps = [...get().steps];
    const idx = steps.findIndex((s) => s.step === step);
    const entry: JobStep = { step, status: status as JobStep['status'], message: message ?? null };
    if (idx >= 0) {
      steps[idx] = entry;
    } else {
      steps.push(entry);
    }
    set({ steps });
  },

  setProvider: (provider) => set({ selectedProvider: provider }),

  reset: () => set({ currentJob: null, jobProjectId: null, pendingPrompt: null, jobStatus: 'IDLE', steps: [], error: null }),

  clearError: () => set({ error: null }),
}));

function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 402) return 'Not enough credits. Add credits to continue.';
    return jobErrorReason(e.response?.data?.errorMessage ?? e.response?.data?.message ?? e.message);
  }
  return 'Something went wrong';
}
