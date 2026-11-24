import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { agentApi, JobResponse } from '../api/agentApi';
import { jobErrorReason } from '../jobFeedback';
import { mergeEvents } from '../agentEvents';
import { readLocal, saveLocal, workspaceKey } from '../sessionStorage';
import { useAuthStore } from '../../auth/store/useAuthStore';
import AgentTranscript from './AgentTranscript';
import BouncingDots from './BouncingDots';

export function mergeTurns(previous: JobResponse[], incoming: JobResponse[]) {
  const jobs = new Map(previous.map(job => [job.id, job]));
  incoming.forEach(job => {
    const existing = jobs.get(job.id);
    jobs.set(job.id, { ...existing, ...job, prompt: job.prompt ?? existing?.prompt,
      responseText: job.responseText ?? existing?.responseText, provider: job.provider ?? existing?.provider, events: mergeEvents(existing?.events ?? [], job.events ?? []) });
  });
  return [...jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function userPrompt(prompt?: string) {
  return prompt?.split('\n\nUse these edited file drafts as context:')[0] ?? 'Earlier request';
}

export default function AgentChat({ projectId, currentJob, pendingPrompt, error, submitting }: {
  projectId: string; currentJob: JobResponse | null; pendingPrompt: string | null;
  error: string | null; submitting: boolean;
}) {
  const account = useAuthStore(state => state.user?.username ?? '');
  const cacheKey = `${workspaceKey(account, projectId)}:chat`;
  const [jobs, setJobs] = useState<JobResponse[]>(() => { try { return readLocal<JobResponse[]>(cacheKey) ?? []; } catch { return []; } });
  const cachedJobs = useRef(jobs);
  cachedJobs.current = jobs;
  useEffect(() => {
    const timer = setTimeout(() => { if (account) try { saveLocal(cacheKey, cachedJobs.current.slice(-100)); } catch { /* Server history remains available. */ } }, 500);
    return () => clearTimeout(timer);
  }, [account, cacheKey, jobs]);
  useEffect(() => {
    const flush = () => { if (account) try { saveLocal(cacheKey, cachedJobs.current.slice(-100)); } catch { /* Server history remains available. */ } };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
    return () => { subscription.remove(); flush(); };
  }, [account, cacheKey]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [retry, setRetry] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const follow = useRef(true);
  const dragging = useRef(false);
  const latest = useRef(currentJob);
  latest.current = currentJob;
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setHistoryError(false);
    agentApi.getProjectJobs(projectId).then(({ data }) => {
      if (!active) return;
      setJobs(previous => {
        const merged = mergeTurns(data.data ?? [], previous);
        return latest.current ? mergeTurns(merged, [latest.current]) : merged;
      });
    }).catch(() => { if (active) setHistoryError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, retry]));
  useEffect(() => {
    if (currentJob) {
      setJobs(previous => mergeTurns(previous, [currentJob]));
    }
  }, [currentJob]);
  useEffect(() => { if (submitting) { follow.current = true; scroll.current?.scrollToEnd({ animated: true }); } }, [submitting]);

  return <View style={styles.viewport}><ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content}
    scrollEnabled nestedScrollEnabled showsVerticalScrollIndicator indicatorStyle="black" keyboardDismissMode="on-drag"
    keyboardShouldPersistTaps="handled" accessibilityLabel="Agent conversation"
    onTouchStart={() => { follow.current = false; }}
    onScrollBeginDrag={() => { dragging.current = true; follow.current = false; }}
    onScrollEndDrag={() => { dragging.current = false; }}
    scrollEventThrottle={100} onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
      if (!dragging.current) follow.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 40;
    }} onContentSizeChange={() => { if (follow.current && !dragging.current) scroll.current?.scrollToEnd({ animated: false }); }}>
    {loading && <ActivityIndicator color="#627189" accessibilityLabel="Loading conversation" />}
    {historyError && <TouchableOpacity onPress={() => setRetry(value => value + 1)}>
      <Text style={styles.error}>Couldn't load earlier messages. Tap to retry.</Text>
    </TouchableOpacity>}
    {!loading && !historyError && !jobs.length && !pendingPrompt && <Text style={styles.empty}>Ask a question, explore an idea, or make a change.</Text>}
    {jobs.map(job => <View key={job.id} style={styles.turn}>
      <View style={styles.user}><Text style={styles.userLabel} accessibilityLabel="Your prompt">›</Text><Text style={styles.userText}>{userPrompt(job.prompt)}</Text></View>
      <View style={styles.assistant}>
        {job.events?.length ? <AgentTranscript events={job.events} jobId={job.id} active={job.status === 'PENDING' || job.status === 'RUNNING'} /> :
          job.responseText || job.status === 'COMPLETED' ? <Text style={styles.text}>{job.responseText ?? (job.diffOutput ? 'Changes ready. Open Files to review them.' : 'Request completed.')}</Text> :
          job.status !== 'FAILED' && job.status !== 'CANCELLED' ? <BouncingDots /> : null}
        {(job.status === 'FAILED' || job.status === 'CANCELLED') && <Text style={job.status === 'FAILED' ? styles.error : styles.activity}>{jobErrorReason(job.errorMessage ?? 'Stopped. Your files were saved.')}</Text>}

      </View>
    </View>)}
    {!currentJob && pendingPrompt && <View style={styles.turn}>
      <View style={styles.user}><Text style={styles.userLabel} accessibilityLabel="Your prompt">›</Text><Text style={styles.userText}>{userPrompt(pendingPrompt)}</Text></View>
      <View style={styles.assistant}>
        {submitting ? <BouncingDots /> : error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>}
    {currentJob && error && currentJob.status !== 'FAILED' && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
  </ScrollView></View>;
}

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
  scroll: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  content: { paddingVertical: 16, paddingRight: 6, gap: 22 },
  turn: { gap: 12 },
  user: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 10, backgroundColor: '#EAEFF5' },
  userLabel: { color: '#237A53', fontFamily: mono, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  userText: { flex: 1, color: '#18243B', fontFamily: mono, fontSize: 13, lineHeight: 21 },
  assistant: { paddingLeft: 18, gap: 6 },
  text: { color: '#344660', fontFamily: mono, fontSize: 13, lineHeight: 21 },
  activity: { color: '#237A53', fontFamily: mono, fontSize: 14, lineHeight: 21 },
  changes: { color: '#237A53', fontFamily: mono, fontSize: 11, lineHeight: 18, marginTop: 4 },
  error: { color: '#C73645', fontFamily: mono, fontSize: 13, lineHeight: 21 },
  empty: { color: '#627189', fontFamily: mono, fontSize: 13, lineHeight: 21, paddingVertical: 12 },
});
