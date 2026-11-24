import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { GitAction, gitApi, GitCommit, GitStatus } from '../api/gitApi';

type Page = 'main' | 'branches' | 'create' | 'sync' | 'merge' | 'rebase' | 'diff' | 'history';
function reason(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.data?.errorMessage ?? error.message : error instanceof Error ? error.message : 'Could not load Git. Try again.';
}
export default function GitPanel({ visible, projectId, blockedReason, refreshKey, onClose, onStatus, onBusyChange, onChanged, onOpenFile }: {
  visible: boolean; projectId: string; blockedReason: string | null; refreshKey: number;
  onClose: () => void; onStatus: (status: GitStatus) => void; onBusyChange: (busy: boolean) => void;
  onChanged: (action: GitAction) => void; onOpenFile: (path: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [page, setPage] = useState<Page>('main');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<GitAction | null>(null);
  const workingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; message: string; phase: 'confirm' | 'working' | 'success' | 'error'; review?: { expectedRevision: string; expectedHead: string } } | null>(null);
  const [message, setMessage] = useState('');
  const [branchName, setBranchName] = useState('');
  const [diff, setDiff] = useState<{ path: string; diff: string } | null>(null);
  const [history, setHistory] = useState<GitCommit[]>([]);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const { data } = await gitApi.status(projectId);
      if (request !== generation.current) return;
      setStatus(data.data); onStatus(data.data);
    } catch (error) { if (request === generation.current) setError(reason(error)); }
    finally { if (request === generation.current) setLoading(false); }
  }, [projectId, onStatus]);
  useEffect(() => {
    if (visible && page === 'main' && !workingRef.current) void load();
    return () => { generation.current++; };
  }, [visible, page, refreshKey, blockedReason, load]);
  useEffect(() => { if (visible) { setPage('main'); setNotice(null); setFeedback(null); } }, [visible]);
  const action = async (kind: GitAction, extra: Record<string, string> = {}) => {
    if (!status || workingRef.current || blockedReason) return;
    const feedbackTitle = kind === 'fetch' ? 'Check for updates' : kind === 'pull' ? 'Pull from GitHub' : kind === 'push' ? 'Push to GitHub' : null;
    setFeedback(feedbackTitle ? { title: feedbackTitle, message: 'Please wait…', phase: 'working' } : null);
    workingRef.current = true; generation.current++; setLoading(false); setWorking(kind); onBusyChange(true); setError(null); setNotice(null);
    try {
      const { data } = await gitApi.action(projectId, kind, { expectedRevision: status.revision, expectedHead: status.head, ...extra });
      setStatus(data.data.status); onStatus(data.data.status);
      if (feedbackTitle) {
        setNotice(null);
        const next = data.data.status;
        const result = kind === 'fetch' && next.upstream
          ? next.behind ? `${next.behind} new commit${next.behind === 1 ? '' : 's'} available on GitHub.` : 'No new commits to pull from GitHub.'
          : data.data.message;
        setFeedback({ title: feedbackTitle, message: result, phase: 'success' });
      } else setNotice(kind === 'commit' ? 'Committed. Continue with the button below to send your commits to GitHub.' : data.data.message);
      setPage('main');
      if (kind === 'commit') setMessage('');
      if (kind === 'create-branch') setBranchName('');
      onChanged(kind);
    } catch (error) {
      if (feedbackTitle) setFeedback({ title: feedbackTitle, message: reason(error), phase: 'error' });
      else setError(reason(error));
      await loadAfterError();
    }
    finally { workingRef.current = false; setWorking(null); onBusyChange(false); }
  };
  const loadAfterError = async () => {
    try { const { data } = await gitApi.status(projectId); setStatus(data.data); onStatus(data.data); } catch { /* Keep the action error visible. */ }
  };
  const close = () => { if (!workingRef.current) onClose(); };
  const choose = (target: string) => {
    if (workingRef.current) return;
    if (page === 'branches' && target === status?.branch) {
      setPage('main'); setError(null); setNotice(null); return;
    }
    if (page === 'branches') { void action('switch', { target }); return; }
    const kind = page as 'merge' | 'rebase';
    Alert.alert(kind === 'merge' ? `Merge into ${status?.branch}?` : 'Rebase branch?',
      kind === 'merge' ? `Bring commits from ${target} into ${status?.branch}. ${status?.branch} will receive the changes.` : `Rebase ${status?.branch} onto ${target}.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: kind === 'merge' ? 'Merge' : 'Rebase', onPress: () => { void action(kind, { target }); } }]);
  };
  const showDiff = async (path: string) => {
    const request = ++detailGeneration.current; setPage('diff'); setDiff(null); setLoading(true); setError(null);
    try { const { data } = await gitApi.diff(projectId, path); if (request === detailGeneration.current) setDiff(data.data); }
    catch (error) { if (request === detailGeneration.current) setError(reason(error)); }
    finally { if (request === detailGeneration.current) setLoading(false); }
  };
  const showHistory = async () => {
    const request = ++detailGeneration.current; setPage('history'); setHistory([]); setLoading(true); setError(null);
    try { const { data } = await gitApi.history(projectId); if (request === detailGeneration.current) setHistory(data.data); }
    catch (error) { if (request === detailGeneration.current) setError(reason(error)); }
    finally { if (request === detailGeneration.current) setLoading(false); }
  };
  const disabled = !!blockedReason || !!working || loading;
  const button = (label: string, press: () => void, unavailable = false, primary = false, readOnly = false) => <TouchableOpacity
    accessibilityRole="button" accessibilityLabel={label} onPress={press} disabled={(readOnly ? !!working || loading : disabled) || unavailable}
    style={[styles.button, primary && styles.primary, ((readOnly ? !!working || loading : disabled) || unavailable) && styles.disabled]}>
    <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
  </TouchableOpacity>;
  const confirmPush = () => {
    if (!status) return;
    setFeedback({ title: status.upstream ? 'Push to GitHub?' : 'Publish branch?',
      message: `${status.upstream ? 'Send committed changes on' : 'Publish'} ${status.branch} to GitHub.`, phase: 'confirm',
      review: { expectedRevision: status.revision, expectedHead: status.head },
    });
  };
  const diverged = !!status?.ahead && !!status?.behind;
  const nextStep = status && !status.operation && <View style={styles.footer} accessibilityLabel="Git next action">
    {status.changes.length ? <>
      <TextInput style={styles.input} placeholder="Describe your changes…" placeholderTextColor="#8290A5" value={message} onChangeText={setMessage} maxLength={2000} multiline editable={!working} accessibilityLabel="Git commit message" />
      {button('Commit changes', () => { void action('commit', { message }); }, !message.trim(), true)}
      <Text style={styles.footerHint}>Next, send your commit to GitHub from this same button.</Text>
    </> : !status.branch ? button('Select a branch', () => setPage('branches'), false, true) : !status.upstream ? <>
      <Text style={styles.footerHint}>Saved in this workspace. Publish this branch to GitHub.</Text>
      {button('Publish branch to GitHub', confirmPush, false, true)}
    </> : diverged ? <>
      <Text style={styles.footerHint}>Your branch and GitHub both have new commits. Merge or rebase to continue.</Text>
      {button('Choose merge or rebase', () => setPage('merge'), false, true)}
    </> : status.behind ? button(`Pull ${status.behind} update${status.behind === 1 ? '' : 's'} from GitHub`, () => { void action('pull'); }, false, true)
      : status.ahead ? button(`Push ${status.ahead} commit${status.ahead === 1 ? '' : 's'} to GitHub`, confirmPush, false, true)
      : button('Check for updates', () => { void action('fetch'); })}
  </View>;
  const tabs = [
    { page: 'main', label: 'Changes', icon: 'git-commit-outline' },
    { page: 'branches', label: 'Branches', icon: 'git-branch-outline' },
    { page: 'sync', label: 'Sync', icon: 'sync-outline' },
    { page: 'merge', label: 'Merge', icon: 'git-merge-outline' },
    { page: 'rebase', label: 'Rebase', icon: 'repeat-outline' },
    { page: 'history', label: 'History', icon: 'time-outline' },
  ] as const;
  const activeTab = page === 'diff' ? 'main' : page === 'create' ? 'branches' : page;
  const selectTab = (next: typeof tabs[number]['page']) => {
    if (workingRef.current) return;
    detailGeneration.current++; setLoading(false); setError(null); setNotice(null); setFeedback(null);
    if (next === 'history') void showHistory();
    else setPage(next);
  };
  const titles: Record<Page, string> = { main: 'Git', branches: 'Switch branch', create: 'New branch', sync: 'Sync with GitHub', merge: 'Merge branch', rebase: 'Rebase onto branch', diff: 'Changes', history: 'Commit history' };
  const branches = status?.branches.filter(branch => page !== 'branches' || !branch.remote || !status.branches.some(local => !local.remote && local.name === branch.name.replace(/^origin\//, ''))) ?? [];
  const lines = diff?.diff.split('\n') ?? [];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss Git panel" disabled={!!working} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), maxHeight: '88%' }]}>
        <View style={styles.grip} />
        <View style={styles.heading}>
          {(page === 'diff' || page === 'create') && <TouchableOpacity style={styles.iconButton} onPress={() => { detailGeneration.current++; setLoading(false); setPage(page === 'create' ? 'branches' : 'main'); }} disabled={!!working} accessibilityRole="button" accessibilityLabel="Back to Git"><Ionicons name="arrow-back" size={21} color="#344660" /></TouchableOpacity>}
          <View pointerEvents="none" style={styles.headingTitle}><Text style={styles.title}>{titles[page]}</Text></View>
          <TouchableOpacity style={[styles.iconButton, { marginLeft: 'auto' }]} onPress={close} disabled={!!working} accessibilityRole="button" accessibilityLabel="Close Git panel"><Ionicons name="close" size={22} color="#344660" /></TouchableOpacity>
        </View>
        <View style={styles.workspaceBody}>
          <View style={styles.workflow}>
            {feedback ? <View style={styles.feedback} accessibilityLabel="Git action feedback" accessibilityLiveRegion="polite">
              {feedback.phase === 'working' ? <ActivityIndicator color="#237A53" size="small" /> : <Ionicons name={feedback.phase === 'error' ? 'alert-circle-outline' : feedback.phase === 'confirm' ? 'cloud-upload-outline' : 'checkmark-circle-outline'} size={30} color={feedback.phase === 'error' ? '#C73645' : '#237A53'} />}
              <Text style={styles.feedbackTitle} accessibilityLabel="Git feedback title">{feedback.title}</Text>
              <Text style={styles.feedbackMessage} accessibilityLabel="Git feedback message">{feedback.message}</Text>
              {feedback.phase === 'confirm' ? <View style={styles.feedbackActions}>
                {button(feedback.title === 'Publish branch?' ? 'Publish to GitHub' : 'Push to GitHub', () => { if (feedback.review) void action('push', feedback.review); }, false, true)}
                <TouchableOpacity style={styles.button} onPress={() => setFeedback(null)} accessibilityRole="button" accessibilityLabel="Cancel Git push"><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
              </View> : feedback.phase !== 'working' && <TouchableOpacity style={[styles.button, styles.feedbackActions]} onPress={() => setFeedback(null)} accessibilityRole="button" accessibilityLabel="Dismiss Git result"><Text style={styles.buttonText}>Done</Text></TouchableOpacity>}
            </View> : <>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {blockedReason && <Text style={styles.muted}>{blockedReason}</Text>}
          {error && <View style={styles.errorRow}><Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text><TouchableOpacity onPress={() => { void load(); }} disabled={!!working} accessibilityLabel="Refresh Git" accessibilityRole="button"><Text style={styles.link}>Refresh</Text></TouchableOpacity></View>}
          {notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}
          {working && <Text style={styles.muted} accessibilityLiveRegion="polite">{working === 'create-branch' ? 'Creating branch' : working.charAt(0).toUpperCase() + working.slice(1)}…</Text>}
          {loading && <View accessibilityLabel="Loading Git" style={styles.skeleton}><View style={styles.placeholder} /><View style={[styles.placeholder, { width: '68%' }]} /><View style={[styles.placeholder, { width: '82%' }]} /></View>}
          {page === 'main' && status && <>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.branch} hitSlop={{ top: 4, bottom: 4 }} onPress={() => setPage('branches')} disabled={disabled || !!status.operation} accessibilityRole="button" accessibilityLabel="Select Git branch">
                <Ionicons name="git-branch-outline" size={20} color="#344660" /><Text style={styles.branchName} numberOfLines={1}>{status.branch ?? (status.operation ? `${status.operation} in progress` : 'Detached HEAD')}</Text><Ionicons name="chevron-down" size={17} color="#627189" />
              </TouchableOpacity>

            </View>
            {!status.upstream && <Text style={styles.muted}>Not on GitHub yet</Text>}
            {status.operation && <View style={styles.operation}><Text style={styles.operationTitle}>{status.operation === 'rebase' ? 'Rebase' : 'Merge'} in progress</Text><Text style={styles.muted}>Open conflicting files, resolve the markers, then continue.</Text>
              <View style={styles.actions}>{button('Continue', () => { void action('continue'); })}{button('Abort', () => Alert.alert(`Abort ${status.operation}?`, 'Restore the branch to before this operation and discard conflict-resolution edits.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Abort', style: 'destructive', onPress: () => { void action('abort'); } }]))}</View>
            </View>}
            {status.changes.length ? <>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Changes to commit</Text><Text style={styles.count}>{status.changes.length}</Text></View>
              <View>{status.changes.map(change => <TouchableOpacity key={change.path} style={styles.file} onPress={() => { void showDiff(change.path); }} disabled={!!working} accessibilityRole="button" accessibilityLabel={`Review ${change.path}`}>
                <Text style={[styles.fileStatus, change.status === 'C' || change.status === 'D' ? styles.red : change.status === 'A' ? styles.green : styles.blue]}>{change.status}</Text><Text numberOfLines={1} style={styles.fileName}>{change.path}</Text><Ionicons name="chevron-forward" size={15} color="#8290A5" />
              </TouchableOpacity>)}</View>
            </> : !status.operation && <View style={styles.readyState}>
              <Ionicons name={!status.upstream || status.ahead ? 'cloud-upload-outline' : status.behind ? 'cloud-download-outline' : 'checkmark-circle-outline'} size={30} color="#237A53" />
              <Text style={styles.readyTitle}>{!status.upstream ? 'Ready to publish' : diverged ? 'Branches have different commits' : status.ahead ? `${status.ahead} commit${status.ahead === 1 ? '' : 's'} ready to push` : status.behind ? 'Updates available on GitHub' : 'Up to date with GitHub'}</Text>
              <Text style={styles.muted}>No uncommitted file changes.</Text>
            </View>}
          </>}
          {page === 'sync' && <>{button('Pull latest from GitHub', () => { void action('pull'); }, !status?.upstream || !!status.operation)}{button('Fetch remote branches', () => { void action('fetch'); })}</>}
          {['branches', 'merge', 'rebase'].includes(page) && status && <>
            {page === 'branches' && button('Create new branch', () => setPage('create'))}
            {page === 'merge' && <Text style={styles.muted}>Choose the branch to merge into {status.branch}.</Text>}
            {page === 'rebase' && <Text style={styles.muted}>Rebase {status.branch} onto the branch you choose.</Text>}
            {branches.map(branch => <TouchableOpacity key={branch.name + branch.remote} style={styles.branchRow} disabled={!!working || (branch.name === status.branch ? page !== 'branches' : disabled)} onPress={() => choose(branch.name)} accessibilityRole="button" accessibilityState={{ selected: branch.name === status.branch }} accessibilityLabel={`${page === 'branches' ? 'Switch to' : page === 'rebase' ? 'Rebase onto' : 'Merge'} ${branch.name}`}>
              <Ionicons name={branch.remote ? 'cloud-outline' : 'git-branch-outline'} size={17} color="#627189" /><Text style={styles.fileName}>{branch.remote ? branch.name.replace(/^origin\//, '') : branch.name}</Text>{branch.remote && <Text style={styles.muted}>GitHub</Text>}{branch.name === status.branch && <Ionicons name="checkmark" size={18} color="#237A53" />}
            </TouchableOpacity>)}
          </>}
          {page === 'create' && <><TextInput style={styles.input} value={branchName} onChangeText={setBranchName} placeholder="feat/my-change" autoCapitalize="none" autoCorrect={false} editable={!working} accessibilityLabel="New Git branch name" />{button('Create branch', () => { void action('create-branch', { target: branchName.trim() }); }, !branchName.trim(), true)}</>}
          {page === 'history' && history.map(commit => <View key={commit.sha} style={styles.historyRow}><Text style={styles.commitSubject}>{commit.subject}</Text><Text style={styles.muted}>{commit.sha} · {commit.author}</Text><Text style={styles.muted}>{new Date(commit.date).toLocaleDateString()}</Text></View>)}
          {page === 'diff' && diff && <><Text style={styles.commitSubject}>{diff.path}</Text>{button('Open in editor', () => onOpenFile(diff.path), false, false, true)}<ScrollView horizontal><Text selectable style={styles.diff}>{lines.slice(0, 600).map((line, index) => <Text key={index} style={line.startsWith('+') ? styles.green : line.startsWith('-') ? styles.red : line.startsWith('@@') ? styles.blue : undefined}>{line}{'\n'}</Text>)}</Text></ScrollView>{lines.length > 600 && <Text style={styles.muted}>Showing the first 600 lines.</Text>}</>}
        </ScrollView>
        {page === 'main' && nextStep}
            </>}
          </View>
          <ScrollView style={styles.tabRail} contentContainerStyle={styles.tabRailContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" accessibilityLabel="Git workflow tabs">
            {tabs.map(tab => {
              const unavailable = !!working || (!status && tab.page !== 'main') || (!!status?.operation && ['branches', 'merge', 'rebase'].includes(tab.page));
              return <TouchableOpacity key={tab.page} onPress={() => selectTab(tab.page)} disabled={unavailable}
              accessibilityRole="tab" accessibilityLabel={`Git tab ${tab.label}`} accessibilityState={{ selected: activeTab === tab.page, disabled: unavailable }}
              style={[styles.tab, activeTab === tab.page && styles.activeTab, unavailable && styles.disabled]}>
              <Ionicons name={tab.icon} size={18} color={activeTab === tab.page ? '#237A53' : '#627189'} />
              <Text style={[styles.tabLabel, activeTab === tab.page && styles.activeTabLabel]}>{tab.label}</Text>
            </TouchableOpacity>; })}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#18243B55' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, minHeight: '55%' },
  grip: { alignSelf: 'center', marginTop: 8, width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD3DF' },
  heading: { flexDirection: 'row', alignItems: 'center', minHeight: 52 }, headingTitle: { position: 'absolute', left: 44, right: 44, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: '#18243B', textAlign: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  workspaceBody: { flex: 1, flexDirection: 'row', minHeight: 0 },
  feedback: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16 },
  feedbackTitle: { color: '#344660', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  feedbackMessage: { color: '#627189', fontSize: 12, lineHeight: 19, textAlign: 'center' },
  feedbackActions: { alignSelf: 'stretch', gap: 8 },
  workflow: { width: '60%', flexGrow: 0, flexShrink: 0, minWidth: 0, paddingRight: 12 },
  tabRail: { width: '40%', flexGrow: 0, flexShrink: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E9EF' },
  tabRailContent: { paddingLeft: 8, paddingBottom: 12, gap: 4 },
  tab: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: 'transparent' },
  activeTab: { borderLeftColor: '#237A53' },
  tabLabel: { color: '#627189', fontSize: 12 },
  activeTabLabel: { color: '#237A53', fontWeight: '700' },
  content: { gap: 10, paddingBottom: 16 },
  footer: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E9EF' },
  footerHint: { color: '#627189', fontSize: 11, lineHeight: 17 },
  readyState: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 },
  readyTitle: { color: '#344660', fontSize: 16, fontWeight: '600', textAlign: 'center' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  branch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 48, borderWidth: 1, borderColor: '#DCE2EA', borderRadius: 8, paddingHorizontal: 10 },
  branchName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#344660' }, branchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  button: { minHeight: 44, borderRadius: 10, backgroundColor: '#EAEFF5', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#237A53' }, buttonText: { color: '#344660', fontSize: 13, fontWeight: '600', textAlign: 'center' }, primaryText: { color: '#FFFFFF' }, disabled: { opacity: 0.4 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, sectionTitle: { fontSize: 13, fontWeight: '700', color: '#344660' }, count: { color: '#627189', fontSize: 12 },
  file: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 }, fileStatus: { width: 17, fontFamily: mono, fontSize: 12, fontWeight: '600' }, fileName: { flex: 1, fontSize: 12, color: '#344660' },
  input: { minHeight: 48, maxHeight: 110, padding: 12, borderWidth: 1, borderColor: '#CBD3DF', borderRadius: 10, color: '#18243B', fontSize: 13, textAlignVertical: 'top' },
  muted: { fontSize: 12, color: '#627189', lineHeight: 19 }, notice: { color: '#237A53', fontSize: 12, lineHeight: 19 },
  errorRow: { gap: 4 }, error: { color: '#C73645', fontSize: 12, lineHeight: 19 }, link: { color: '#237A53', fontSize: 13, paddingVertical: 8, fontWeight: '600' },
  operation: { borderLeftWidth: 3, borderLeftColor: '#B98726', backgroundColor: '#FBF8EF', padding: 12, gap: 8 }, operationTitle: { color: '#7B5C23', fontSize: 13, fontWeight: '700' },
  historyRow: { paddingVertical: 10, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E9EF' }, commitSubject: { color: '#344660', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  diff: { fontFamily: mono, fontSize: 11, lineHeight: 18, color: '#344660', paddingVertical: 10 }, red: { color: '#C73645' }, green: { color: '#237A53' }, blue: { color: '#3A6BA0' },
  skeleton: { gap: 12, paddingVertical: 8 }, placeholder: { height: 18, width: '94%', backgroundColor: '#EAEFF5', borderRadius: 5 },
});
