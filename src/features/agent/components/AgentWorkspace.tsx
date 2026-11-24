import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, FlatList, KeyboardAvoidingView, Modal, PanResponder, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { MainStackParamList } from '../../../core/navigation/MainStack';
import { AGENT_ENDPOINTS } from '../../../core/constants/apiConstants';
import axiosClient from '../../../core/network/axiosClient';
import { colors } from '../../../core/theme/appTheme';
import { TreeEntry } from '../../workspace/api/workspaceApi';
import { useAgentStore } from '../store/useAgentStore';
import { agentApi, JobFilePreview } from '../api/agentApi';
import { mergePreviewTree } from '../previewTree';
import { jobErrorReason } from '../jobFeedback';
import AgentChat from './AgentChat';
import GitPanel from './GitPanel';
import { GitAction, gitApi, GitStatus } from '../api/gitApi';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { readLocal, saveLocal, workspaceKey } from '../sessionStorage';
import useAgentStream from '../useAgentStream';
import { clampEditorRatio } from '../agentEvents';
import { EditorDraft, saveEditorDraft } from '../editorDrafts';

const PROVIDER_LABELS: Record<string, string> = { openai: 'OpenAI', claude: 'Claude', gemini: 'Gemini' };
type Draft = EditorDraft;
type LocalWorkspace = { drafts: Record<string, Draft>; prompt: string; selectedFile: string | null; treePath: string; expandedFolders: string[];
  entriesByPath: Record<string, TreeEntry[]>; previewFiles: JobFilePreview[]; editorRatio: number; };

export default function AgentWorkspace({ projectId, projectName }: {
  projectId: string; projectName: string;
}) {
  const account = useAuthStore(state => state.user?.username ?? '');
  const cacheKey = workspaceKey(account, projectId);
  const [saved] = useState<Partial<LocalWorkspace>>(() => { try { return readLocal<LocalWorkspace>(cacheKey) ?? {}; } catch { return {}; } });
  const [showGit, setShowGit] = useState(false);
  const [isGitBusy, setIsGitBusy] = useState(false);
  const [gitCount, setGitCount] = useState(0);
  const onGitStatus = useCallback((status: GitStatus) => setGitCount(status.changes.length), []);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const savingFile = useRef(false);
  const failedSaves = useRef<Record<string, string>>({});
  const [autoSaveRetry, setAutoSaveRetry] = useState(0);
  const [fileSaveErrors, setFileSaveErrors] = useState<Record<string, string>>({});
  const [cacheError, setCacheError] = useState<string | null>(null);
  const entriesByPath = useRef(saved.entriesByPath ?? {});
  const [creation, setCreation] = useState<{ kind: 'file' | 'dir'; parent: string } | null>(null);
  const [entryName, setEntryName] = useState('');
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const mutating = useRef(false);
  const [treeRefresh, setTreeRefresh] = useState(0);
  const [editorRatio, setEditorRatio] = useState(saved.editorRatio ?? 0.4);
  const [layoutHeight, setLayoutHeight] = useState(650);
  const ratioRef = useRef(editorRatio);
  ratioRef.current = editorRatio;
  const splitStart = useRef(editorRatio);
  const verticalSlider = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => { splitStart.current = ratioRef.current; },
    onPanResponderMove: (_, gesture) => setEditorRatio(clampEditorRatio(splitStart.current + gesture.dy / Math.max(layoutHeight - 12, 1), layoutHeight)),
  }), [layoutHeight]);
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < 600;
  const [showFiles, setShowFiles] = useState(windowWidth >= 600);
  const [panelWidth, setPanelWidth] = useState(220);
  const [workbenchWidth, setWorkbenchWidth] = useState(340);
  const panelWidthRef = useRef(220);
  const resizeStart = useRef(220);
  const resizePanel = useCallback((width: number) => {
    const next = Math.max(84, Math.min(workbenchWidth - 180, width));
    panelWidthRef.current = next;
    setPanelWidth(next);
  }, [workbenchWidth]);
  const panelSlider = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3,
    onPanResponderGrant: () => { resizeStart.current = panelWidthRef.current; },
    onPanResponderMove: (_, gesture) => resizePanel(resizeStart.current + gesture.dx),
  }), [resizePanel]);
  useEffect(() => { resizePanel(panelWidthRef.current); }, [resizePanel]);
  const [treePath, setTreePath] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<string[]>(saved.expandedFolders ?? []);
  const [loadingFolders, setLoadingFolders] = useState<string[]>([]);
  const [failedFolders, setFailedFolders] = useState<string[]>([]);
  const [previewFiles, setPreviewFiles] = useState<JobFilePreview[]>(saved.previewFiles ?? []);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [entries, setEntries] = useState<TreeEntry[]>(saved.entriesByPath?.[''] ?? []);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(saved.selectedFile ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(saved.drafts ?? {});
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(saved.prompt ?? '');
  const [providers, setProviders] = useState<string[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(false);
  const treeList = useRef<FlatList<TreeEntry & { depth: number }>>(null);
  const fileRequest = useRef<AbortController | null>(null);
  const { jobStatus, currentJob, jobProjectId, selectedProvider, setProvider, submitPrompt, fetchJob, pendingPrompt, error, stop } = useAgentStore();
  useAgentStream(currentJob?.id, currentJob?.status === 'PENDING' || currentJob?.status === 'RUNNING');
  const fileRevision = currentJob?.events?.filter(event => event.type === 'files' || (event.type === 'tool' && event.status === 'completed')).length ?? 0;
  const snapshot = { drafts, prompt, selectedFile, treePath, entriesByPath: entriesByPath.current, previewFiles, editorRatio, expandedFolders };
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => {
    const timer = setTimeout(() => { if (account) try { saveLocal(cacheKey, snapshotRef.current); setCacheError(null); } catch { setCacheError("Couldn't save drafts on this device."); } }, 200);
    return () => clearTimeout(timer);
  }, [account, cacheKey, drafts, prompt, selectedFile, treePath, previewFiles, editorRatio, entries, expandedFolders]);
  useEffect(() => {
    const flush = () => { if (account) try { saveLocal(cacheKey, snapshotRef.current); } catch { setCacheError("Couldn't save drafts on this device."); } };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
    return () => { subscription.remove(); flush(); };
  }, [account, cacheKey]);
  const isSubmitting = jobStatus === 'SUBMITTING';
  const isCurrentProject = currentJob != null && String(currentJob.projectId) === projectId;
  const ownsRequest = isCurrentProject || jobProjectId === projectId;
  const rawJobError = ownsRequest ? error ?? (currentJob?.status === 'FAILED' ? currentJob.errorMessage : null) : null;
  const jobError = rawJobError ? jobErrorReason(rawJobError) : null;
  const isBusy = isSubmitting || jobStatus === 'POLLING';
  const visibleEntries: (TreeEntry & { depth: number })[] = [];
  const appendFolder = (parent: string, depth: number) => {
    const children = parent === '' ? entries : entriesByPath.current[parent] ?? [];
    const visible = failedFolders.includes(parent) ? mergePreviewTree(children, previewFiles, parent) : children;
    for (const entry of [...visible].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))) {
      visibleEntries.push({ ...entry, depth });
      if (entry.type === 'dir' && expandedFolders.includes(entry.path)) appendFolder(entry.path, depth + 1);
    }
  };
  appendFolder('', 0);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const state = useAgentStore.getState();
    if (!['SUBMITTING', 'POLLING'].includes(state.jobStatus)) {
      agentApi.getProjectJobs(projectId).then(({ data }) => {
        const current = useAgentStore.getState();
        if (controller.signal.aborted || ['SUBMITTING', 'POLLING'].includes(current.jobStatus)) return;
        const job = data.data?.[0];
        if (job) useAgentStore.setState({ currentJob: job, jobProjectId: projectId,
          jobStatus: ['COMPLETED', 'CANCELLED'].includes(job.status) ? 'DONE' : job.status === 'FAILED' ? 'ERROR' : 'POLLING',
          error: job.status === 'FAILED' ? jobErrorReason(job.errorMessage ?? 'The agent could not complete this request.') : null });
      }).catch(() => { /* Current-session jobs continue to work if history is unavailable. */ });
    }
    return () => controller.abort();
  }, [projectId]));

  useEffect(() => {
    if (!isCurrentProject || !currentJob || !['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentJob.status) || (!currentJob.interactive && !currentJob.diffOutput)) return;
    const controller = new AbortController();
    setPreviewError(null);
    agentApi.getFiles(currentJob.id, controller.signal).then(({ data }) => {
      const files = data.data ?? [];
      setPreviewFiles(previous => {
        if (currentJob.interactive) return files;
        const merged = new Map(previous.map(file => [file.path, file]));
        files.forEach(file => merged.set(file.path, file));
        return [...merged.values()];
      });
      setDrafts(previous => {
        const next = { ...previous };
        for (const file of files) {
          if (next[file.path] && next[file.path].content !== next[file.path].original) continue;
          if (file.deleted) delete next[file.path];
          else if (file.content !== null) next[file.path] = { original: file.content, content: file.content };
        }
        return next;
      });
    }).catch(() => { if (!controller.signal.aborted) setPreviewError("Couldn't load generated files. Reopen this panel to retry."); });
    return () => controller.abort();
  }, [isCurrentProject, currentJob?.id, currentJob?.status, previewRefresh]);

  useEffect(() => {
    if (!currentJob || !['PENDING', 'RUNNING'].includes(currentJob.status)) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await fetchJob(currentJob.id);
      const job = useAgentStore.getState().currentJob;
      if (!disposed && job?.id === currentJob.id && ['PENDING', 'RUNNING'].includes(job.status)) {
        timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [currentJob?.id, currentJob?.status, fetchJob]);

  useEffect(() => {
    const controller = new AbortController();
    setTreeLoading(true);
    setTreeError(null);
    const paths = ['', ...expandedFolders];
    setLoadingFolders(paths);
    const failures: string[] = [];
    Promise.all(paths.map(async path => {
      try {
        const { data } = await agentApi.tree(projectId, path, controller.signal);
        if (!controller.signal.aborted) { entriesByPath.current[path] = data.data ?? []; setEntries([...(entriesByPath.current[''] ?? [])]); }
      } catch (error) {
        if (!controller.signal.aborted) { failures.push(path); setTreeError(errorMessage(error)); }
      }
    })).finally(() => {
      if (controller.signal.aborted) return;
      setEntries([...(entriesByPath.current[''] ?? [])]);
      setFailedFolders(failures); setLoadingFolders([]); setTreeLoading(false);
    });
    return () => controller.abort();
  }, [projectId, expandedFolders, fileRevision, currentJob?.status, treeRefresh]);

  useEffect(() => () => fileRequest.current?.abort(), []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setKeysLoading(true);
    setKeysError(null);
    setShowProviders(false);
    axiosClient.get<{ data: { provider: string }[] | null }>(AGENT_ENDPOINTS.KEYS, { signal: controller.signal })
      .then(({ data }) => {
        const available = [...new Set((data.data ?? []).map(key => key.provider.toLowerCase()).filter(provider => ['openai', 'claude'].includes(provider)))];
        setProviders(available);
        if (!available.includes(useAgentStore.getState().selectedProvider) && available.length) {
          setProvider(available[0]);
        }
      })
      .catch(e => { if (!controller.signal.aborted) { setProviders([]); setKeysError(errorMessage(e)); } })
      .finally(() => { if (!controller.signal.aborted) setKeysLoading(false); });
    return () => controller.abort();
  }, [setProvider]));

  const openFile = async (entry: TreeEntry) => {
    if (entry.type === 'dir') {
      setCreation(null); setEntryError(null);
      const isExpanded = expandedFolders.includes(entry.path);
      setExpandedFolders(previous => isExpanded ? previous.filter(path => path !== entry.path && !path.startsWith(entry.path + '/')) : [...previous, entry.path]);
      setTreePath(isExpanded ? entry.path.split('/').slice(0, -1).join('/') : entry.path);
      return;
    }
    setTreePath(entry.path.split('/').slice(0, -1).join('/'));
    fileRequest.current?.abort();
    const controller = new AbortController();
    fileRequest.current = controller;
    setSelectedFile(entry.path);
    if (isCompact) setShowFiles(false);
    setFileError(null);
    const preview = previewFiles.find(file => file.path === entry.path);
    if (preview) {
      setFileLoading(false);
      if (preview.deleted) { setFileError('This file was removed by the agent.'); return; }
      if (preview.content === null) { setFileError('This file has no text preview.'); return; }
      setDrafts(previous => previous[entry.path] ? previous : { ...previous, [entry.path]: { original: preview.content!, content: preview.content! } });
      return;
    }
    if (drafts[entry.path]) { setFileLoading(false); return; }
    setFileLoading(true);
    try {
      const { data } = await agentApi.file(projectId, entry.path, controller.signal);
      if (!data.data) throw new Error('No file content returned');
      const { content, etag } = data.data;
      setDrafts(previous => ({ ...previous, [entry.path]: { original: content, content, etag } }));
    } catch (e) {
      if (!controller.signal.aborted) setFileError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setFileLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedFile || !currentJob?.interactive) return;
    const controller = new AbortController();
    agentApi.file(projectId, selectedFile, controller.signal).then(({ data }) => {
      if (!data.data) return;
      const file = data.data;
      setDrafts(previous => {
        if (previous[selectedFile]?.content !== previous[selectedFile]?.original) return previous;
        return { ...previous, [selectedFile]: { original: file.content, content: file.content, etag: file.etag } };
      });
    }).catch(error => { if (!controller.signal.aborted && axios.isAxiosError(error) && error.response?.status === 404) setFileError('This file was removed from the workspace.'); });
    return () => controller.abort();
  }, [projectId, selectedFile, fileRevision, currentJob?.status]);

  const canSubmit = !!prompt.trim() && !isBusy && !isGitBusy && !isSavingFile && !isMutating && !keysLoading && providers.includes(selectedProvider);
  const handleSubmit = async () => {
    if (!canSubmit || savingFile.current || mutating.current) return;
    const draft = selectedFile ? drafts[selectedFile] : undefined;
    if (selectedFile && draft && draft.content !== draft.original && failedSaves.current[selectedFile] !== draft.content) {
      await handleSaveFile(selectedFile, draft);
    }
    const jobId = await submitPrompt(projectId, prompt.trim());
    if (jobId) setPrompt('');
  };
  const handleSaveFile = useCallback(async (path: string, draft: Draft) => {
    if (isBusy || isGitBusy || savingFile.current || mutating.current || draft.content === draft.original) return;
    savingFile.current = true;
    setIsSavingFile(true);
    setFileSaveErrors(previous => { const next = { ...previous }; delete next[path]; return next; });
    try {
      const saved = await saveEditorDraft(projectId, path, draft);
      delete failedSaves.current[path];
      setDrafts(previous => previous[path] ? { ...previous, [path]: {
        original: saved.content, content: previous[path].content, etag: saved.etag,
      } } : previous);
    } catch (error) {
      failedSaves.current[path] = draft.content;
      setFileSaveErrors(previous => ({ ...previous, [path]: `Couldn't auto-save. ${errorMessage(error)}` }));
    } finally {
      savingFile.current = false;
      setIsSavingFile(false);
    }
  }, [projectId, isBusy, isGitBusy]);

  useEffect(() => {
    if (isBusy || isGitBusy || isSavingFile || isMutating) return;
    const pending = Object.entries(drafts).find(([path, draft]) => draft.content !== draft.original && failedSaves.current[path] !== draft.content);
    if (!pending) return;
    const timer = setTimeout(() => { void handleSaveFile(pending[0], pending[1]); }, 700);
    return () => clearTimeout(timer);
  }, [drafts, isBusy, isGitBusy, isSavingFile, isMutating, autoSaveRetry, handleSaveFile]);

  const refreshFolder = () => { setTreeRefresh(value => value + 1); };
  const cacheEntry = (parent: string, entry: TreeEntry) => {
    const next = [...(entriesByPath.current[parent] ?? []).filter(item => item.path !== entry.path), entry];
    entriesByPath.current[parent] = next;
    setEntries([...(entriesByPath.current[''] ?? [])]);
  };
  const createEntry = async () => {
    if (!creation || !entryName.trim() || isBusy || isGitBusy || savingFile.current || mutating.current) return;
    mutating.current = true; setIsMutating(true); setEntryError(null);
    try {
      const { data } = await agentApi.createEntry(projectId, creation.parent, entryName.trim(), creation.kind);
      const entry = data.data;
      if (!entry) throw new Error('Could not confirm creation. Refresh this folder before retrying.');
      cacheEntry(creation.parent, entry);
      setPreviewFiles(previous => previous.filter(file => file.path !== entry.path));
      if (entry.type === 'file') {
        setDrafts(previous => previous[entry.path]?.content !== previous[entry.path]?.original ? previous : {
          ...previous, [entry.path]: { original: entry.content ?? '', content: entry.content ?? '', etag: entry.etag },
        });
        fileRequest.current?.abort(); setFileLoading(false); setFileError(null); setSelectedFile(entry.path);
        if (isCompact) setShowFiles(false);
      }
      if (creation.parent) setExpandedFolders(previous => previous.includes(creation.parent) ? previous : [...previous, creation.parent]);
      setCreation(null); setEntryName(''); refreshFolder();
    } catch (error) { setEntryError(errorMessage(error)); }
    finally { mutating.current = false; setIsMutating(false); }
  };
  const deleteEntry = async (entry: TreeEntry) => {
    if (isBusy || isGitBusy || savingFile.current || mutating.current) return;
    mutating.current = true; setIsMutating(true); setEntryError(null);
    try {
      const { data } = await agentApi.deleteEntry(projectId, entry.path);
      if (!data.data) throw new Error('Could not confirm deletion. Refresh this folder before retrying.');
      const inside = (path: string) => path === entry.path || path.startsWith(entry.path + '/');
      for (const [path, children] of Object.entries(entriesByPath.current)) {
        if (inside(path)) delete entriesByPath.current[path];
        else entriesByPath.current[path] = children.filter(item => !inside(item.path));
      }
      setEntries([...(entriesByPath.current[''] ?? [])]);
      setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([path]) => !inside(path))));
      setFileSaveErrors(previous => Object.fromEntries(Object.entries(previous).filter(([path]) => !inside(path))));
      for (const path of Object.keys(failedSaves.current)) if (inside(path)) delete failedSaves.current[path];
      setExpandedFolders(previous => previous.filter(path => !inside(path)));
      if (inside(treePath)) setTreePath(entry.path.split('/').slice(0, -1).join('/'));
      setPreviewFiles(previous => previous.filter(file => !inside(file.path)));
      if (selectedFile && inside(selectedFile)) {
        fileRequest.current?.abort(); setSelectedFile(null); setFileError(null); setFileLoading(false);
      }
      refreshFolder();
    } catch (error) { setEntryError(errorMessage(error)); }
    finally { mutating.current = false; setIsMutating(false); }
  };
  const confirmDelete = (entry: TreeEntry) => {
    if (isBusy || isGitBusy || isSavingFile || isMutating) return;
    Alert.alert(`Delete ${entry.type === 'dir' ? 'folder' : 'file'}?`,
      entry.type === 'dir' ? `Delete “${entry.name}” and its contents?` : `Delete “${entry.name}”?`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entry) }], { cancelable: true });
  };

  const hasLocalEdits = Object.values(drafts).some(draft => draft.content !== draft.original);
  const failedSavePath = Object.keys(fileSaveErrors).find(path => drafts[path]?.content !== drafts[path]?.original);
  const gitBlockedReason = isBusy ? 'Wait for the agent to finish before changing Git.' : isMutating ? 'Wait for the file operation to finish.' : hasLocalEdits || isSavingFile
    ? failedSavePath ? `Could not save ${failedSavePath}. Open it to retry or reload before using Git.` : 'Saving your editor changes…' : null;
  useEffect(() => {
    if (showGit || isBusy || isGitBusy || isSavingFile) return;
    let active = true;
    const timer = setTimeout(() => { gitApi.status(projectId).then(({ data }) => { if (active) onGitStatus(data.data); }).catch(() => {}); }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [projectId, showGit, isBusy, isGitBusy, isSavingFile, fileRevision, treeRefresh, onGitStatus]);
  const onGitChanged = (action: GitAction) => {
    if (['switch', 'pull', 'merge', 'rebase', 'continue', 'abort'].includes(action)) {
      setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([, draft]) => draft.content !== draft.original)));
      setSelectedFile(null); setPreviewFiles([]); entriesByPath.current = {}; setEntries([]); setExpandedFolders([]); setTreePath('');
    }
    refreshFolder();
  };
  const reloadEditorFile = (path: string) => Alert.alert('Reload workspace file?', `Discard the local edits to “${path}” and load the saved workspace version?`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Reload', style: 'destructive', onPress: async () => {
      fileRequest.current?.abort(); const controller = new AbortController(); fileRequest.current = controller;
      setFileLoading(true); setFileError(null);
      try {
        const { data } = await agentApi.file(projectId, path, controller.signal);
        if (!data.data || controller.signal.aborted) return;
        const file = data.data;
        setDrafts(previous => ({ ...previous, [path]: { original: file.content, content: file.content, etag: file.etag } }));
        delete failedSaves.current[path]; setFileSaveErrors(previous => { const next = { ...previous }; delete next[path]; return next; });
      } catch (error) {
        if (!controller.signal.aborted && axios.isAxiosError(error) && error.response?.status === 404) {
          setDrafts(previous => { const next = { ...previous }; delete next[path]; return next; });
          setSelectedFile(previous => previous === path ? null : previous);
          delete failedSaves.current[path]; setFileSaveErrors(previous => { const next = { ...previous }; delete next[path]; return next; });
        } else if (!controller.signal.aborted) setFileError(errorMessage(error));
      } finally { if (!controller.signal.aborted) setFileLoading(false); }
    } },
  ]);
  const currentDraft = selectedFile ? drafts[selectedFile] : undefined;
  const fileSaveError = selectedFile ? fileSaveErrors[selectedFile] : undefined;
  const openFiles = () => {
    setShowFiles(true);
    setPreviewRefresh(value => value + 1);
  };

  const creationForm = creation && <View style={[styles.createForm, { paddingLeft: 12 + (creation.parent ? creation.parent.split('/').length : 0) * 16 }]}>
            <TextInput style={styles.nameInput} value={entryName} onChangeText={setEntryName} editable={!isMutating}
              autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={createEntry}
              accessibilityHint={creation.parent ? `Inside ${creation.parent}` : 'In project root'}
              placeholder={creation.kind === 'file' ? 'File name, e.g. hello.py' : 'Folder name'} accessibilityLabel={creation.kind === 'file' ? 'New file name' : 'New folder name'} />
            <View style={styles.fileActions}>
              <TouchableOpacity style={styles.fileAction} disabled={isMutating || !entryName.trim() || isBusy} onPress={createEntry} accessibilityRole="button" accessibilityLabel="Create item">
                <Text style={styles.fileActionText}>{isMutating ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fileAction} disabled={isMutating} onPress={() => { setCreation(null); setEntryError(null); }} accessibilityRole="button" accessibilityLabel="Cancel creation">
                <Text style={styles.fileActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>;

  const filePanel = (
        <View style={[styles.filePanel, { width: isCompact ? Math.min(windowWidth * 0.82, 320) : panelWidth }, isCompact && { marginTop: insets.top + 8, marginBottom: tabBarHeight + 12 + Math.max(insets.bottom - 20, 6), height: undefined }]}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle} numberOfLines={1} onPress={() => { setTreePath(''); setCreation(null); }} accessibilityRole="button" accessibilityLabel="Select project root">{projectName}</Text>
            {(['file', 'dir'] as const).map(kind => <TouchableOpacity key={kind} style={styles.addEntryButton}
              disabled={isBusy || isGitBusy || isSavingFile || isMutating} accessibilityRole="button" accessibilityLabel={kind === 'file' ? 'New file' : 'New folder'}
              onPress={() => { if (treePath) setExpandedFolders(previous => previous.includes(treePath) ? previous : [...previous, treePath]); setCreation({ kind, parent: treePath }); setEntryName(''); setEntryError(null); }}>
              <Ionicons name={kind === 'file' ? 'document-outline' : 'folder-outline'} size={21} color="#344660" />
              <View style={styles.addEntryBadge}><Ionicons name="add" size={12} color="#344660" /></View>
            </TouchableOpacity>)}
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowFiles(false)}
              accessibilityRole="button" accessibilityLabel="Close folder panel">
              <Ionicons name="close" size={21} color="#344660" />
            </TouchableOpacity>
          </View>
          {entryError && <Text style={styles.panelError} accessibilityLiveRegion="polite">{entryError}</Text>}
          {treeError && !!visibleEntries.length && <Text style={styles.panelError}>{treeError}</Text>}
          {previewError && <Text style={styles.panelError}>{previewError}</Text>}
          {treeLoading && !visibleEntries.length && !creation ? <ActivityIndicator style={styles.center} color={colors.primary} /> : treeError && !visibleEntries.length && !creation ? (
            <Text style={styles.panelError}>{treeError}</Text>
          ) : <FlatList ref={treeList} data={visibleEntries} keyExtractor={item => item.path} keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => { if (creation?.parent === '') treeList.current?.scrollToEnd({ animated: true }); }}
            renderItem={({ item }) => <View><TouchableOpacity style={[styles.fileRow, { paddingLeft: 12 + item.depth * 16 }, (selectedFile === item.path || (item.type === 'dir' && treePath === item.path)) && styles.selectedFile]}
              onPress={() => openFile(item)} onLongPress={() => confirmDelete(item)} delayLongPress={450}
              accessibilityActions={[{ name: 'longpress', label: 'Delete' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') confirmDelete(item); }} accessibilityState={item.type === 'dir' ? { expanded: expandedFolders.includes(item.path) } : undefined} accessibilityLabel={`${item.type === 'dir' ? (expandedFolders.includes(item.path) ? 'Collapse folder' : 'Expand folder') : 'Edit file'} ${item.name}`}>
              <Ionicons name={item.type === 'dir' && expandedFolders.includes(item.path) ? 'chevron-down' : 'chevron-forward'} size={12} color={item.type === 'dir' ? colors.textMuted : 'transparent'} />
              <Ionicons name={item.type === 'dir' ? (expandedFolders.includes(item.path) ? 'folder-open-outline' : 'folder-outline') : 'document-outline'} size={17}
                color={item.type === 'dir' ? colors.primary : colors.textSecondary} />
              <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
              {item.type === 'dir' && loadingFolders.includes(item.path) && <ActivityIndicator size="small" color={colors.textMuted} />}
            </TouchableOpacity>
              {creation?.parent === item.path && item.type === 'dir' && creationForm}
            </View>}
            ListFooterComponent={creation?.parent === '' ? creationForm : null}
            ListEmptyComponent={creation ? null : <Text style={styles.path}>This folder is empty.</Text>} />}
        </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 8 }]} onLayout={event => setLayoutHeight(event.nativeEvent.layout.height - insets.top - 8)} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <View style={[styles.workbench, { flex: editorRatio }]} onLayout={event => setWorkbenchWidth(event.nativeEvent.layout.width)}>
        {!isCompact && showFiles && <>{filePanel}
        <View style={styles.panelSlider} {...panelSlider.panHandlers} accessible accessibilityRole="adjustable"
          accessibilityLabel="File panel width" accessibilityValue={{ min: 84, max: Math.max(84, workbenchWidth - 180), now: panelWidth }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => resizePanel(panelWidth + (event.nativeEvent.actionName === 'increment' ? 20 : -20))}>
          <View style={styles.sliderGrip} />
        </View></>}
        <View style={styles.editor}>
          <View style={styles.editorHeader}>
            <TouchableOpacity style={styles.filesButton} onPress={openFiles}
              accessibilityRole="button" accessibilityLabel="Open project files">
              <Ionicons name="folder-open-outline" size={21} color="#344660" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowGit(true)} accessibilityRole="button" accessibilityLabel={gitCount ? `Open Git, ${gitCount} changed files` : 'Open Git'}>
              <Ionicons name="git-branch-outline" size={21} color="#344660" />
              {gitCount > 0 && <View style={styles.gitBadge}><Text style={styles.gitBadgeText}>{gitCount > 99 ? '99+' : gitCount}</Text></View>}
            </TouchableOpacity>
            <Text style={styles.fileTitle} numberOfLines={1}>{selectedFile ?? 'Files'}</Text>
          </View>
          {!!fileSaveError && <Text style={styles.editorSaveError} accessibilityLiveRegion="polite">{fileSaveError}</Text>}
          {!!fileSaveError && <TouchableOpacity onPress={() => { delete failedSaves.current[selectedFile!]; setAutoSaveRetry(value => value + 1); }} accessibilityRole="button" accessibilityLabel="Retry automatic save"><Text style={styles.lightAction}>Retry</Text></TouchableOpacity>}
          {!!fileSaveError && selectedFile && <TouchableOpacity onPress={() => reloadEditorFile(selectedFile)} accessibilityRole="button" accessibilityLabel="Reload workspace file"><Text style={styles.lightAction}>Reload workspace file</Text></TouchableOpacity>}
          {fileLoading ? <ActivityIndicator style={styles.center} color={colors.textSecondary} /> : fileError ? (
            <View style={styles.center}><Text style={styles.editorHint}>{fileError}</Text>
              <TouchableOpacity style={styles.iconButton} onPress={() => selectedFile && openFile({ name: selectedFile, path: selectedFile, type: 'file', size: 0 })}>
                <Text style={styles.lightAction}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : currentDraft ? (
            <TextInput style={styles.code} multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false}
              spellCheck={false} editable={!isGitBusy} accessibilityLabel={`Edit ${selectedFile}`} value={currentDraft.content}
              onChangeText={content => setDrafts(previous => ({ ...previous, [selectedFile!]: { ...previous[selectedFile!], content } }))} />
          ) : <View style={styles.center}>
            <TouchableOpacity style={styles.openFileButton} onPress={openFiles}
              accessibilityRole="button" accessibilityLabel="Open a file">
              <Ionicons name="document-text-outline" size={28} color="#8290A5" />
              <Text style={styles.openFileLabel}>Open a file</Text>
            </TouchableOpacity>
          </View>}
        </View>


      </View>

      <View style={styles.verticalSlider} hitSlop={{ top: 6, bottom: 6 }} {...verticalSlider.panHandlers} accessible accessibilityRole="adjustable"
        accessibilityLabel="Resize editor and agent panels" accessibilityValue={{ min: 0, max: 100, now: Math.round(editorRatio * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => { setEditorRatio(clampEditorRatio(editorRatio + (event.nativeEvent.actionName === 'increment' ? 0.08 : -0.08), layoutHeight)); }}>
        <View style={styles.verticalGrip} />
      </View>
      <GitPanel visible={showGit} projectId={projectId} blockedReason={gitBlockedReason} refreshKey={treeRefresh + fileRevision}
        onClose={() => setShowGit(false)} onStatus={onGitStatus} onBusyChange={setIsGitBusy} onChanged={onGitChanged}
        onOpenFile={path => { setShowGit(false); void openFile({ path, name: path.split('/').at(-1)!, type: 'file', size: 0 }); }} />
      <Modal visible={isCompact && showFiles} transparent animationType="fade" onRequestClose={() => setShowFiles(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowFiles(false)}
            accessibilityRole="button" accessibilityLabel="Dismiss project files" />
          {filePanel}
        </View>
      </Modal>
      <View style={[styles.composer, { flex: 1 - editorRatio }]}>
        <View style={styles.chatHeader}>
          <View style={styles.providerAnchor}>
            {showProviders && <View style={styles.providerMenu}>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.providerOptions}>
                {providers.map(provider => <TouchableOpacity key={provider} style={styles.providerOption}
                  onPress={() => { setProvider(provider); setShowProviders(false); }} accessibilityRole="button">
                  <Text style={styles.providerText}>{PROVIDER_LABELS[provider] ?? provider}</Text>
                  {provider === selectedProvider && <Ionicons name="checkmark" size={16} color="#237A53" />}
                </TouchableOpacity>)}
              </ScrollView>
            </View>}
            <TouchableOpacity style={styles.providerButton} disabled={providers.length < 2 || keysLoading || isBusy}
              onPress={() => setShowProviders(value => !value)} accessibilityLabel="Select AI agent" accessibilityState={{ expanded: showProviders }}>
              <Text style={styles.providerText}>{keysLoading ? 'Loading agents' : providers.includes(selectedProvider) ? PROVIDER_LABELS[selectedProvider] ?? selectedProvider : 'No agent connected'}</Text>
              {providers.length > 1 && <Ionicons name={showProviders ? 'chevron-up' : 'chevron-down'} size={14} color="#627189" />}
            </TouchableOpacity>
          </View>
        </View>
        <AgentChat projectId={projectId} currentJob={isCurrentProject ? currentJob : null}
          pendingPrompt={ownsRequest ? pendingPrompt : null} error={jobError} submitting={isSubmitting && ownsRequest} />
        <View style={styles.inputRing}>
          <Text style={styles.promptPrefix} accessible={false}>›</Text>
          <TextInput style={styles.prompt} placeholder="Ask or describe a change…" placeholderTextColor="#8190A5"
            multiline textAlignVertical="center" value={prompt} onChangeText={setPrompt} editable={!isBusy && !isGitBusy} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Agent prompt" />
          <TouchableOpacity style={[styles.sendButton, !canSubmit && !isBusy && styles.disabled]} onPress={isBusy && isCurrentProject ? stop : handleSubmit} disabled={isBusy ? !isCurrentProject : !canSubmit} accessibilityLabel={isBusy ? "Stop agent" : "Send prompt"} accessibilityRole="button">
            {isBusy ? <Ionicons name="stop" size={18} color="#FFFFFF" /> : <>
              <Ionicons name="arrow-up" size={21} color="#FFFFFF" />
            </>}
          </TouchableOpacity>
        </View>
        {cacheError && <Text style={styles.panelError}>{cacheError}</Text>}
        {keysError && <Text style={[styles.panelError, styles.terminalError]}>{keysError}</Text>}
        {!keysLoading && !keysError && providers.length === 0 && <TouchableOpacity onPress={() => nav.navigate('Tabs', { screen: 'Connect' })}>
          <Text style={styles.setupHint}>Add an OpenAI or Claude key in Connect to start an agent.</Text>
        </TouchableOpacity>}
      </View>
    </KeyboardAvoidingView>
  );
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.errorMessage ?? error.response?.data?.message ?? error.message;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  workbench: { flex: 1, minHeight: 100, flexDirection: 'row', marginHorizontal: 10 },
  editor: { flex: 1, minWidth: 0, backgroundColor: colors.background, borderWidth: 1, borderColor: '#CBD3DF', borderRadius: 18, overflow: 'hidden' },
  editorHeader: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E9EF' },
  gitBadge: { position: 'absolute', right: -2, top: 1, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#237A53', alignItems: 'center', justifyContent: 'center' },
  gitBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  fileTitle: { flex: 1, color: '#344660', fontSize: 12, fontWeight: '600' },
  editorSaveError: { color: colors.error, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 8 },
  code: { flex: 1, color: colors.text, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, fontSize: 13, lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  editorHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  lightAction: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  filePanel: { paddingTop: 18, backgroundColor: '#F7F8FA', height: '100%', borderWidth: 1, borderLeftWidth: 0, borderColor: '#CBD3DF', borderTopRightRadius: 18, borderBottomRightRadius: 24, borderBottomLeftRadius: 24, overflow: 'hidden' },
  filesButton: { width: 36, height: 44, justifyContent: 'center' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: '#18243B30' },
  openFileButton: { alignItems: 'center', gap: 12, padding: 20 },
  openFileLabel: { color: '#8290A5', fontSize: 13, fontWeight: '500' },
  panelSlider: { width: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA', borderRightWidth: 1, borderRightColor: '#E5E9EF' },
  sliderGrip: { width: 3, height: 32, borderRadius: 2, backgroundColor: '#BCC5D2' },
  panelHeading: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6, marginBottom: 6 },
  panelTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#344660' },
  addEntryButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addEntryBadge: { position: 'absolute', right: 7, bottom: 6, backgroundColor: '#F7F8FA', borderRadius: 6 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 },
  fileAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  fileActionText: { color: '#344660', fontSize: 12, fontWeight: '600' },
  createForm: { paddingHorizontal: 12, paddingBottom: 8 },
  nameInput: { borderWidth: 1, borderColor: '#A6B3C5', borderRadius: 8, minHeight: 44, paddingHorizontal: 10, backgroundColor: '#FFFFFF', color: '#18243B', fontSize: 13 },
  fileRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 18 },
  selectedFile: { backgroundColor: '#E5ECFA' },
  fileName: { flex: 1, fontSize: 13, color: colors.textSecondary },
  path: { fontSize: 11, color: colors.textMuted, padding: 14 },
  panelError: { fontSize: 12, lineHeight: 18, color: colors.error, padding: 12 },
  verticalSlider: { height: 12, alignItems: 'center', justifyContent: 'center' },
  verticalGrip: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#A6B3C5' },
  chatHeader: { zIndex: 3, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E9EF' },
  composer: { flex: 1.5, minHeight: 210, marginHorizontal: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderWidth: 1, borderColor: '#CBD3DF', borderRadius: 18, backgroundColor: '#FFFFFF' },
  inputRing: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#A6B3C5', borderRadius: 12, padding: 7, paddingLeft: 12, backgroundColor: '#F7F8FA', marginTop: 8 },
  terminalError: { color: '#C73645' },
  promptPrefix: { color: '#237A53', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 20, fontWeight: '600' },
  prompt: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', flex: 1, minHeight: 44, maxHeight: 104, fontSize: 13, lineHeight: 21, color: '#18243B', paddingVertical: 10, paddingHorizontal: 0 },
  setupHint: { fontSize: 12, lineHeight: 18, color: '#237A53', paddingBottom: 10 },
  providerAnchor: { flex: 1, zIndex: 2 },
  providerButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 0 },
  providerText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#18243B', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  providerMenu: { position: 'absolute', top: '100%', left: 0, width: 190, marginTop: 4, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: '#A6B3C5', backgroundColor: '#F7F8FA', shadowColor: '#18243B', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  providerOptions: { maxHeight: 200 },
  providerOption: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sendButton: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, backgroundColor: '#237A53', borderRadius: 10 },
  disabled: { opacity: 0.4 },
});
