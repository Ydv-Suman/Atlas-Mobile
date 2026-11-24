import { agentApi } from './api/agentApi';

export type EditorDraft = { original: string; content: string; etag?: string };

export async function saveEditorDraft(projectId: string, path: string, draft: EditorDraft) {
  const { data } = await agentApi.file(projectId, path);
  const workspace = data.data;
  if (!workspace) throw new Error('Could not read this workspace file. Your local draft is kept.');
  if (workspace.content === draft.content) return workspace;
  if (workspace.content !== draft.original) {
    throw new Error('The workspace file changed. Your local draft is kept on this device.');
  }
  const result = await agentApi.saveFile(projectId, path, draft.content, workspace.etag);
  if (!result.data.data) throw new Error('Could not confirm the save. Your local draft is kept.');
  return result.data.data;
}
