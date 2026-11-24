const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const feedbackSource = fs.readFileSync(`${__dirname}/../jobFeedback.ts`, 'utf8');
const feedbackCode = ts.transpileModule(feedbackSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const feedback = {};
vm.runInNewContext(feedbackCode.outputText, { exports: feedback });

const eventExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../agentEvents.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: eventExports });

function loadStore(agentApi) {
  const source = fs.readFileSync(`${__dirname}/useAgentStore.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: name => name === '../api/agentApi' ? { agentApi } : name === '../jobFeedback' ? feedback : name === '../agentEvents' ? eventExports : require(name),
  });
  return exports.useAgentStore;
}

test('accepted jobs stay in progress and cannot be submitted twice', async () => {
  let submissions = 0;
  const store = loadStore({ submitJob: async () => { submissions++; return { data: { data: { id: 'a', projectId: 1, status: 'PENDING' } } }; } });
  assert.equal(await store.getState().submitPrompt('1', 'Fix README'), 'a');
  assert.equal(store.getState().jobStatus, 'POLLING');
  assert.equal(await store.getState().submitPrompt('1', 'Duplicate'), null);
  assert.equal(submissions, 1);
});

test('polling maps running, completion, and job errors correctly', async () => {
  let job = { id: 'a', projectId: 1, status: 'PENDING' };
  const store = loadStore({ submitJob: async () => ({ data: { data: job } }), getJob: async () => ({ data: { data: job } }) });
  await store.getState().submitPrompt('1', 'Fix README');
  job = { ...job, status: 'RUNNING' };
  await store.getState().fetchJob('a');
  assert.equal(store.getState().jobStatus, 'POLLING');
  job = { ...job, status: 'COMPLETED' };
  await store.getState().fetchJob('a');
  assert.equal(store.getState().jobStatus, 'DONE');
  job = { ...job, status: 'FAILED', errorMessage: 'Provider rejected API key' };
  await store.getState().fetchJob('a');
  assert.equal(store.getState().jobStatus, 'ERROR');
  assert.equal(store.getState().error, 'The AI provider key is invalid.');
});

test('a late poll cannot overwrite a newer job', async () => {
  let finishPoll;
  const store = loadStore({ getJob: () => new Promise(resolve => { finishPoll = resolve; }) });
  store.setState({ currentJob: { id: 'a', status: 'RUNNING' } });
  const pending = store.getState().fetchJob('a');
  store.setState({ currentJob: { id: 'b', status: 'PENDING' } });
  finishPoll({ data: { data: { id: 'a', status: 'COMPLETED' } } });
  await pending;
  assert.equal(store.getState().currentJob.id, 'b');
});

test('no-credit responses show the backend message without creating a job', async () => {
  const store = loadStore({ submitJob: async () => { throw { isAxiosError: true, response: { status: 402, data: { errorMessage: 'Insufficient credits. Current balance: 0' } } }; } });
  assert.equal(await store.getState().submitPrompt('1', 'Fix README'), null);
  assert.equal(store.getState().jobStatus, 'ERROR');
  assert.equal(store.getState().currentJob, null);
  assert.equal(store.getState().error, 'Not enough credits. Add credits to continue.');
});


test('raw Feign failures expose only a useful reason', () => {
  const raw = '[500] during [GET] to [http://workspaceservice:8090/api/workspace/internal/project/7/repo-url] [WorkspaceFeignClient#getRepoUrl(Long)]: [{"errorCode":"500 INTERNAL_SERVER_ERROR","errorMessage":"An unexpected error occurred."}]';
  assert.equal(feedback.jobErrorReason(raw), "Couldn't load the project repository.");
  assert.equal(feedback.jobErrorReason('[500] feign.FeignException: internal stack'), "The agent couldn't complete the request. Try again.");
  assert.equal(feedback.jobErrorReason('{"errorMessage":"Insufficient credits. Current balance: 0"}'), 'Not enough credits. Add credits to continue.');
  assert.equal(feedback.jobErrorReason('403: Permission denied'), 'Permission denied');
  assert.equal(feedback.jobErrorReason('[500] [AuthFeignClient#getGithubToken(UUID)]'), "Couldn't access the GitHub connection. Reconnect GitHub in Connect.");
});

test('replayed stream events do not duplicate output and a stopped job becomes idle for another prompt', async () => {
  const store = loadStore({ getJob: async () => ({ data: { data: { id: 'a', status: 'CANCELLED', events: [] } } }) });
  store.setState({ currentJob: { id: 'a', status: 'RUNNING', events: [] }, jobStatus: 'POLLING' });
  const event = { sequence: 1, type: 'text.delta', itemId: 'reply', text: 'Hello' };
  store.getState().receiveEvent('a', event);
  store.getState().receiveEvent('a', event);
  assert.equal(store.getState().currentJob.events.length, 1);
  await store.getState().fetchJob('a');
  assert.equal(store.getState().jobStatus, 'DONE');
  assert.equal(store.getState().currentJob.events.length, 1);
});
