import { TreeEntry } from '../workspace/api/workspaceApi';
import { JobFilePreview } from './api/agentApi';

export function mergePreviewTree(entries: TreeEntry[], files: JobFilePreview[], directory: string): TreeEntry[] {
  const result = new Map(entries.map(entry => [entry.path, entry]));
  const prefix = directory ? `${directory}/` : '';
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const relative = file.path.slice(prefix.length);
    if (!relative) continue;
    const slash = relative.indexOf('/');
    if (slash < 0) {
      if (file.deleted) result.delete(file.path);
      else result.set(file.path, { name: relative, path: file.path, type: 'file', size: file.content?.length ?? 0, previewOnly: !result.has(file.path) });
    } else if (!file.deleted) {
      const name = relative.slice(0, slash);
      const path = prefix + name;
      if (!result.has(path)) result.set(path, { name, path, type: 'dir', size: 0, previewOnly: true });
    }
  }
  return [...result.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}
