const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(`${__dirname}/AgentChat.tsx`, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const eventExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../agentEvents.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: eventExports });
const exportsObject = {};
vm.runInNewContext(compiled.outputText, { exports: exportsObject,
  require: name => name === '../agentEvents' ? eventExports : name === 'react-native' ? { Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles } } : {} });

test('conversation keeps earlier turns and replaces polling updates without duplicate replies', () => {
  const first = { id: 'a', createdAt: '2026-11-23T01:00:00Z', status: 'COMPLETED', responseText: 'Two options' };
  const next = { id: 'b', createdAt: '2026-11-23T01:01:00Z', status: 'RUNNING' };
  const done = { ...next, status: 'COMPLETED', responseText: 'Explaining option two' };
  const turns = exportsObject.mergeTurns([next, first], [done]);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].id, 'a');
  assert.equal(turns[1].responseText, 'Explaining option two');
  assert.equal(first.responseText, 'Two options');
});

function loadWithHooks(hooks) {
  const result = {};
  vm.runInNewContext(compiled.outputText, { exports: result, ...hooks,
    require: name => name === '../agentEvents' ? eventExports : name === 'react' ? hooks.react : name === 'react-native'
      ? { Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles }, View: 'View', ScrollView: 'ScrollView', Text: 'Text' }
      : name === 'react/jsx-runtime' ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      : name === './BouncingDots' ? { __esModule: true, default: 'BouncingDots' }
      : { useFocusEffect: () => {}, useAuthStore: selector => selector({ user: { username: 'test-user' } }), workspaceKey: () => 'test-key', readLocal: () => hooks.jobs ?? null, saveLocal: () => {} } });
  return result;
}

test('scrolling to earlier messages disables automatic jumps while replies grow', () => {
  const chat = loadWithHooks({ react: {
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: initial => ({ current: initial }),
    useCallback: fn => fn, useEffect: () => {},
  } });
  const viewport = chat.default({ projectId: '1', currentJob: null, pendingPrompt: null, error: null, submitting: false });
  const scroll = viewport.props.children.props;
  let jumps = 0;
  scroll.ref.current = { scrollToEnd: () => { jumps++; } };
  scroll.onContentSizeChange();
  assert.equal(jumps, 1);
  scroll.onTouchStart();
  scroll.onContentSizeChange();
  assert.equal(jumps, 1);
  scroll.onScrollBeginDrag();
  scroll.onContentSizeChange();
  assert.equal(jumps, 1);
  scroll.onScrollEndDrag();
  scroll.onScroll({ nativeEvent: { contentOffset: { y: 0 }, contentSize: { height: 2000 }, layoutMeasurement: { height: 300 } } });
  scroll.onContentSizeChange();
  assert.equal(jumps, 1);
  scroll.onScroll({ nativeEvent: { contentOffset: { y: 1700 }, contentSize: { height: 2000 }, layoutMeasurement: { height: 300 } } });
  scroll.onContentSizeChange();
  assert.equal(jumps, 2);
});


test('waiting dots show during submission and disappear when response text arrives', () => {
  const hooks = { react: {
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: initial => ({ current: initial }),
    useCallback: fn => fn, useEffect: () => {},
  } };
  const pending = loadWithHooks(hooks).default({ projectId: '1', currentJob: null, pendingPrompt: 'hello', error: null, submitting: true });
  assert.ok(JSON.stringify(pending).includes('BouncingDots'));
  for (const responseText of ['', 'Here is my suggestion']) {
    const job = { id: 'j', prompt: 'hello', status: 'RUNNING', responseText, createdAt: '2026-11-24' };
    const chat = loadWithHooks({ ...hooks, jobs: [job] }).default({ projectId: '1', currentJob: job, pendingPrompt: null, error: null, submitting: false });
    assert.equal(JSON.stringify(chat).includes('BouncingDots'), !responseText);
  }
});
