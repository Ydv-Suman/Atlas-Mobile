import Storage from 'expo-sqlite/kv-store';

export function workspaceKey(user: string, projectId: string) {
  return `atlas.workspace.v1:${encodeURIComponent(user)}:${projectId}`;
}
export function readLocal<T>(key: string): T | null {
  const saved = Storage.getItemSync(key);
  return saved ? JSON.parse(saved) as T : null;
}
export function saveLocal(key: string, value: unknown) {
  Storage.setItemSync(key, JSON.stringify(value));
}
