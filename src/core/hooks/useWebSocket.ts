import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE_URL } from '../constants/apiConstants';
import { getSecure } from '../storage/secureStore';
import { STORAGE_KEYS } from '../constants/storageKeys';

export interface WsStepMessage {
  jobId: string;
  step: string;
  status: string;
  message?: string;
  timestamp?: string;
}

interface UseWebSocketOptions {
  jobId: string;
  onStep: (msg: WsStepMessage) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useWebSocket({ jobId, onStep, onComplete, onError }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const retriedRef = useRef(false);

  const connect = useCallback(async () => {
    const jwt = await getSecure(STORAGE_KEYS.JWT_TOKEN);
    if (!jwt) {
      onError?.('No auth token');
      return;
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const url = `${wsBase}/api/v1/ws/jobs/${jobId}?token=${jwt}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg: WsStepMessage = JSON.parse(event.data);
        onStep(msg);
        if (msg.status === 'COMPLETED') onComplete?.();
        if (msg.status === 'ERROR' || msg.status === 'FAILED') onError?.(msg.message ?? 'Job failed');
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      if (!retriedRef.current) {
        retriedRef.current = true;
        setTimeout(() => connect(), 2000);
      } else {
        onError?.('WebSocket connection failed');
      }
    };

    ws.onclose = () => setIsConnected(false);
  }, [jobId, onStep, onComplete, onError]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, disconnect };
}
