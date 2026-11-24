import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AgentEvent, transcriptItems } from '../agentEvents';
import { agentApi } from '../api/agentApi';
import { jobErrorReason } from '../jobFeedback';
import BouncingDots from './BouncingDots';

function AgentRequest({ event, jobId, active }: { event: AgentEvent; jobId: string; active: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (approved: boolean) => {
    setSent(true); setError(null);
    try { await agentApi.answer(jobId, event.requestId!, approved,
      Object.fromEntries(Object.entries(answers).map(([id, value]) => [id, { answers: [value] }]))); }
    catch { setSent(false); setError("Couldn't send your answer. Try again."); }
  };
  const waiting = active && event.status !== 'resolved';
  return <View style={styles.request}>
    {event.type === 'approval' ? <>
      <Text style={styles.label}>Permission requested</Text>
      <Text style={styles.code}>{event.text}</Text>
      {!!event.detail && <Text style={styles.muted}>{event.detail}</Text>}
    </> : event.questions?.map(question => {
      const id = question.id ?? question.question;
      return <View key={id} style={styles.question}>
        <Text style={styles.code}>{question.question}</Text>
        {waiting && <>
          {question.options?.map(option => <TouchableOpacity key={option.label} disabled={sent}
            onPress={() => setAnswers(previous => ({ ...previous, [id]: option.label }))}>
            <Text style={[styles.option, answers[id] === option.label && styles.selected]}>{option.label}</Text>
          </TouchableOpacity>)}
          <TextInput style={styles.answer} value={answers[id] ?? ''} onChangeText={value => setAnswers(previous => ({ ...previous, [id]: value }))}
            placeholder="Your answer" editable={!sent} accessibilityLabel={question.question} multiline />
        </>}
      </View>;
    })}
    {waiting && <View style={styles.actions}>
      <TouchableOpacity style={styles.button} onPress={() => send(true)} disabled={sent || (event.type === 'question' && event.questions?.some(q => !answers[q.id ?? q.question]?.trim()))}>
        <Text style={styles.buttonText}>{sent ? 'Sending…' : event.type === 'approval' ? 'Allow once' : 'Send answer'}</Text>
      </TouchableOpacity>
      {event.type === 'approval' && <TouchableOpacity style={styles.button} onPress={() => send(false)} disabled={sent}><Text style={styles.buttonText}>Decline</Text></TouchableOpacity>}
    </View>}
    {error && <Text style={styles.error}>{error}</Text>}
  </View>;
}

export default function AgentTranscript({ events, jobId, active }: { events: AgentEvent[]; jobId: string; active: boolean }) {
  const items = transcriptItems(events);
  const waiting = active && !items.some(item => item.type === 'text' && item.text) && !items.some(item => (item.type === 'approval' || item.type === 'question') && item.status !== 'resolved');
  return <View style={styles.transcript}>{items.map(event => {
    const key = event.requestId ?? event.itemId ?? String(event.sequence);
    if (event.type === 'approval' || event.type === 'question') return <AgentRequest key={key} event={event} jobId={jobId} active={active} />;
    if (event.type === 'text') return <Text key={key} style={styles.text}>{event.text}</Text>;
    if (event.type === 'tool') return <View key={key} style={styles.tool}>
      {!!event.text && <Text style={styles.code}>$ {event.text}</Text>}
      {!!event.output && <Text style={styles.output}>{event.output}</Text>}
      {event.exitCode != null && event.exitCode !== 0 && <Text style={styles.error}>Exited with code {event.exitCode}</Text>}
    </View>;
    if (event.type === 'files') return <Text key={key} style={styles.changed}>{event.status === 'failed' ? 'Could not change' : event.status === 'declined' ? 'Declined' : 'Files'}: {event.text}</Text>;
    if (event.type === 'error' || event.type === 'notice') return <Text key={key} style={styles.error}>{jobErrorReason(event.text ?? 'The agent stopped.')}</Text>;
    return null;
  })}{waiting && <BouncingDots />}</View>;
}
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const styles = StyleSheet.create({
  transcript: { gap: 12 }, text: { color: '#344660', fontFamily: mono, fontSize: 13, lineHeight: 21 },
  code: { color: '#18243B', fontFamily: mono, fontSize: 12, lineHeight: 20 },
  tool: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#F2F5F8', borderRadius: 8, gap: 6 },
  output: { color: '#526277', fontFamily: mono, fontSize: 11, lineHeight: 18 },
  changed: { color: '#237A53', fontFamily: mono, fontSize: 11, lineHeight: 18 },
  error: { color: '#C73645', fontSize: 12, lineHeight: 19 },
  request: { padding: 12, borderWidth: 1, borderColor: '#CBD3DF', borderRadius: 10, gap: 8 },
  label: { color: '#627189', fontSize: 11, fontWeight: '600' }, muted: { color: '#627189', fontSize: 12, lineHeight: 18 },
  question: { gap: 8 }, option: { color: '#344660', paddingVertical: 6, fontSize: 13 }, selected: { color: '#237A53', fontWeight: '700' },
  answer: { borderWidth: 1, borderColor: '#CBD3DF', borderRadius: 8, minHeight: 40, padding: 8, color: '#18243B' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#EAEFF5', borderRadius: 8 },
  buttonText: { color: '#18243B', fontSize: 12, fontWeight: '600' },
});
