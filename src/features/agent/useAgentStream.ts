import { useEffect } from 'react';
import { AppState } from 'react-native';
import { fetch } from 'expo/fetch';
import { API_BASE_URL, AGENT_ENDPOINTS } from '../../core/constants/apiConstants';
import { STORAGE_KEYS } from '../../core/constants/storageKeys';
import { getSecure } from '../../core/storage/secureStore';
import { useAgentStore } from './store/useAgentStore';
import { sseParser } from './agentEvents';

export default function useAgentStream(jobId?: string, active = false) {
  useEffect(() => {
    if (!jobId || !active) return;
    let disposed = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let connecting = false;
    const connect = async () => {
      if (disposed || connecting || AppState.currentState === 'background') return;
      connecting = true;
      controller = new AbortController();
      try {
        const token = await getSecure(STORAGE_KEYS.JWT_TOKEN);
        const job = useAgentStore.getState().currentJob;
        if (disposed || job?.id !== jobId) return;
        const after = job.events?.at(-1)?.sequence ?? 0;
        const response = await fetch(`${API_BASE_URL}${AGENT_ENDPOINTS.JOB(jobId)}/events?after=${after}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        const parse = sseParser(event => { if (!disposed) useAgentStore.getState().receiveEvent(jobId, event); });
        const decoder = new TextDecoder();
        const reader = response.body.getReader();
        try {
          while (!disposed) {
            const { value, done } = await reader.read();
            if (done) break;
            parse(decoder.decode(value, { stream: true }));
          }
        } finally { reader.releaseLock(); }
      } catch { /* Polling remains available while the live stream reconnects. */ }
      finally {
        connecting = false;
        if (!disposed) {
          await useAgentStore.getState().fetchJob(jobId);
          const status = useAgentStore.getState().currentJob?.status;
          if (status === 'PENDING' || status === 'RUNNING') timer = setTimeout(connect, 1500);
        }
      }
    };
    connect();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') connect(); else controller?.abort();
    });
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); subscription.remove(); };
  }, [jobId, active]);
}
