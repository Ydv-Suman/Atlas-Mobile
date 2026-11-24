export interface AgentEvent {
  sequence: number;
  type: string;
  itemId?: string;
  text?: string;
  output?: string;
  status?: string;
  exitCode?: number;
  requestId?: string;
  detail?: string;
  questions?: { id?: string; question: string; header?: string; options?: { label: string; description?: string }[] }[];
}
export function mergeEvents(previous: AgentEvent[], incoming: AgentEvent[]) {
  const events = new Map(previous.map(event => [event.sequence, event]));
  incoming.forEach(event => events.set(event.sequence, event));
  return [...events.values()].sort((a, b) => a.sequence - b.sequence);
}
export function sseParser(accept: (event: AgentEvent) => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    let boundary: number;
    while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const block = buffer.slice(0, boundary);
      const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)![0];
      buffer = buffer.slice(boundary + separator.length);
      const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data) accept(JSON.parse(data));
    }
  };
}
export function transcriptItems(events: AgentEvent[]) {
  const items = new Map<string, AgentEvent>();
  for (const event of events) {
    if (event.type === 'result' || event.type === 'turn.end') continue;
    if (event.type === 'request.resolved') {
      const item = items.get(`request:${event.requestId}`);
      if (item) items.set(`request:${event.requestId}`, { ...item, status: 'resolved' });
      continue;
    }
    const key = event.requestId ? `request:${event.requestId}` : event.itemId ?? `event:${event.sequence}`;
    const existing = items.get(key);
    if (event.type === 'text.delta') items.set(key, { ...event, type: 'text', text: (existing?.text ?? '') + (event.text ?? '') });
    else if (event.type === 'text.complete') items.set(key, { ...event, type: 'text' });
    else if (event.type === 'tool.delta') items.set(key, { ...existing, ...event, type: 'tool', text: existing?.text ?? '', output: (existing?.output ?? '') + (event.text ?? '') });
    else if (event.type === 'tool') items.set(key, { ...existing, ...event, text: event.text || existing?.text, output: event.output || existing?.output });
    else items.set(key, event);
  }
  return [...items.values()];
}
export function clampEditorRatio(ratio: number, height: number) {
  const usable = Math.max(height - 12, 1);
  const minimum = Math.min(120 / usable, 0.4);
  const maximum = Math.max(minimum, 1 - Math.min(220 / usable, 0.6));
  return Math.max(minimum, Math.min(maximum, ratio));
}
