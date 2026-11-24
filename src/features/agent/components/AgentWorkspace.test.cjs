const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function mountWorkspace(options = {}) {
  const snapshot = options.snapshot ?? { prompt: 'hello', drafts: { 'file.py': { original: 'old workspace', content: 'my unsaved edit' } } };
  const alerts = [];
  const timers = new Map(); let timerId = 0, autoSaveEffect;
  const states = [], refs = [], submissions = [];
  let stateIndex = 0, refIndex = 0, first = true, fileCalls = 0;
  const state = { jobStatus: 'IDLE', currentJob: null, jobProjectId: null, pendingPrompt: null, error: null,
    selectedProvider: 'openai', setProvider: () => {}, fetchJob: async () => {}, stop: async () => {},
    submitPrompt: async (...args) => { submissions.push(args); return 'accepted-job'; } };
  const store = () => state; store.getState = () => state;
  const react = {
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => { if (fn.toString().includes('handleSaveFile(pending')) autoSaveEffect = fn; },
  };
  const native = { Alert: { alert: (...args) => alerts.push(args) }, StyleSheet: { create: styles => styles, absoluteFill: {} }, Platform: { OS: 'ios' },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) }, useWindowDimensions: () => ({ width: 390 }) };
  for (const name of ['ActivityIndicator','FlatList','KeyboardAvoidingView','Modal','ScrollView','Text','TextInput','TouchableOpacity','View']) native[name] = name;
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const modules = {
    react, 'react-native': native, 'react/jsx-runtime': jsx, axios: { __esModule: true, default: { isAxiosError: () => false } },
    '@react-navigation/native': { useNavigation: () => ({}), useFocusEffect: callback => { if (first) callback(); } },
    '@react-navigation/bottom-tabs': { useBottomTabBarHeight: () => 72 },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../../../core/theme/appTheme': { colors: {} },
    '../../../core/constants/apiConstants': { AGENT_ENDPOINTS: { KEYS: '/keys' } },
    '../../../core/network/axiosClient': { __esModule: true, default: { get: async () => ({ data: { data: [{ provider: 'openai' }] } }) } },
    '../store/useAgentStore': { useAgentStore: store },
    '../../auth/store/useAuthStore': { useAuthStore: selector => selector({ user: { username: 'owner' } }) },
    '../sessionStorage': { workspaceKey: () => 'saved-workspace', readLocal: () => snapshot, saveLocal: () => {} },
    '../previewTree': { mergePreviewTree: () => [] },
    '../api/agentApi': { agentApi: { getProjectJobs: async () => ({ data: { data: [] } }),
      file: async () => { fileCalls++; throw new Error('The workspace changed'); },
      saveFile: async () => { fileCalls++; throw new Error('must not upload drafts from chat'); }, ...(options.api ?? {}) } },
  };
  const editor = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../editorDrafts.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: editor, require: () => modules['../api/agentApi'] });
  modules['../editorDrafts'] = editor;
  const exports = {};
  const source = fs.readFileSync(`${__dirname}/AgentWorkspace.tsx`, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, AbortController, setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id), require: name => modules[name] ?? { __esModule: true, default: () => {} } });
  const render = () => { stateIndex = refIndex = 0; return exports.default({ projectId: '7', projectName: 'Project' }); };
  render();
  await new Promise(resolve => setImmediate(resolve));
  first = false;
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    const children = [node.props?.children, node.props?.ListFooterComponent];
    if (node.type === 'FlatList') children.push(node.props.data.map(item => node.props.renderItem({ item })));
    for (const child of children.flat(Infinity)) { const match = find(child, predicate); if (match) return match; }
    return null;
  };
  return { render, snapshot, alerts, submissions, state,
    scheduleAutoSave: () => { render(); return autoSaveEffect(); },
    fireTimers: async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.fn()); await new Promise(resolve => setImmediate(resolve)); },
    timerCount: () => timers.size,
    fileCalls: () => fileCalls,
    button: label => find(render(), node => node.props?.accessibilityLabel === label),
    listing: () => find(render(), node => node.type === 'FlatList') };
}

test('sending chat succeeds with a stale local file draft and never attempts to upload it', async () => {
  const ui = await mountWorkspace();
  const button = ui.button('Send prompt');
  assert.ok(button); assert.equal(button.props.disabled, false);
  await button.props.onPress();
  assert.equal(ui.submissions.length, 1); assert.equal(ui.submissions[0][1], 'hello');
  assert.equal(ui.fileCalls(), 0); assert.equal(ui.snapshot.drafts['file.py'].content, 'my unsaved edit');
});

test('long press shows a Cancel/Delete confirmation without deleting until confirmed', async () => {
  const file = { name: 'file.py', path: 'file.py', type: 'file', size: 2 };
  const other = { ...file, name: 'other.py', path: 'other.py' };
  let deleted = 0;
  const ui = await mountWorkspace({ snapshot: { entriesByPath: { '': [file, other] } }, api: {
    deleteEntry: async () => { deleted++; return { data: { data: { ...file, trashId: 'trash-1' } } }; },
  } });
  ui.button('Edit file file.py').props.onLongPress();
  assert.equal(deleted, 0);
  const popup = ui.alerts[0];
  assert.equal(popup[0], 'Delete file?');
  assert.equal(popup[2][0].text, 'Cancel'); assert.equal(popup[2][1].text, 'Delete');
  assert.equal(popup[2][1].style, 'destructive');
  await popup[2][1].onPress();
  assert.equal(deleted, 1); assert.deepEqual(Array.from(ui.listing().props.data, item => item.path), ['other.py']);
  assert.equal(ui.button('Undo deletion'), null);
  assert.equal(popup[1].includes('undo'), false);
});

test('manual file creation opens the new empty file in the editor', async () => {
  let created;
  const ui = await mountWorkspace({ api: { createEntry: async (...args) => {
    created = args;
    return { data: { data: { name: 'manual.py', path: 'manual.py', type: 'file', size: 0, content: '', etag: 'empty-hash' } } };
  } } });
  ui.button('New file').props.onPress();
  ui.button('New file name').props.onChangeText('manual.py');
  await ui.button('Create item').props.onPress();
  assert.equal(created.join(','), '7,,manual.py,file');
  assert.equal(ui.button('Edit manual.py').props.value, '');
  assert.ok(ui.listing().props.data.some(item => item.path === 'manual.py'));
});


test('folders expand inline with nested indentation and keep project siblings visible', async () => {
  const src = { name: 'src', path: 'src', type: 'dir' };
  const nested = { name: 'lib', path: 'src/lib', type: 'dir' };
  const file = { name: 'code.py', path: 'src/lib/code.py', type: 'file' };
  const readme = { name: 'README.md', path: 'README.md', type: 'file' };
  const ui = await mountWorkspace({ snapshot: { entriesByPath: { '': [src, readme], src: [nested], 'src/lib': [file] } } });
  const paths = () => Array.from(ui.listing().props.data, item => [item.path, item.depth]);
  assert.deepEqual(paths(), [['src', 0], ['README.md', 0]]);
  ui.button('Expand folder src').props.onPress();
  ui.button('Expand folder lib').props.onPress();
  assert.deepEqual(paths(), [['src', 0], ['src/lib', 1], ['src/lib/code.py', 2], ['README.md', 0]]);
  ui.button('Collapse folder src').props.onPress();
  assert.deepEqual(paths(), [['src', 0], ['README.md', 0]]);
});

test('creation is inline inside the selected folder and root creation is at the list bottom', async () => {
  const src = { name: 'src', path: 'src', type: 'dir' };
  let created;
  const ui = await mountWorkspace({ snapshot: { entriesByPath: { '': [src], src: [] } }, api: {
    createEntry: async (...args) => { created = args; return { data: { data: { name: 'child', path: 'src/child', type: 'dir' } } }; },
  } });
  ui.button('Expand folder src').props.onPress();
  ui.button('New folder').props.onPress();
  assert.equal(ui.listing().props.ListFooterComponent, null);
  assert.equal(ui.button('New folder name').props.accessibilityHint, 'Inside src');
  const row = ui.listing().props.renderItem({ item: ui.listing().props.data[0] });
  assert.ok(row.props.children[1]);
  ui.button('New folder name').props.onChangeText('child');
  await ui.button('Create item').props.onPress();
  assert.equal(created.join(','), '7,src,child,dir');
  assert.ok(ui.listing().props.data.some(item => item.path === 'src/child' && item.depth === 1));
  ui.button('Select project root').props.onPress();
  ui.button('New file').props.onPress();
  assert.ok(ui.listing().props.ListFooterComponent);
  assert.equal(ui.button('New file name').props.accessibilityHint, 'In project root');
});


function editableSnapshot() {
  return { prompt: 'hello', selectedFile: 'file.py', drafts: { 'file.py': { original: 'base', content: 'base' } },
    entriesByPath: { '': [{ name: 'file.py', path: 'file.py', type: 'file' }] } };
}
test('editor automatically saves the latest typing after debounce and pauses while the agent runs', async () => {
  const writes = [];
  const ui = await mountWorkspace({ snapshot: editableSnapshot(), api: {
    file: async () => ({ data: { data: { content: 'base', etag: 'base-hash' } } }),
    saveFile: async (...args) => { writes.push(args); return { data: { data: { content: args[2], etag: 'saved-hash' } } }; },
  } });
  assert.equal(ui.button('Save editor file to workspace'), null);
  ui.button('Edit file.py').props.onChangeText('first');
  const cancel = ui.scheduleAutoSave();
  assert.equal(ui.timerCount(), 1); assert.equal(writes.length, 0);
  cancel();
  ui.button('Edit file.py').props.onChangeText('latest');
  ui.state.jobStatus = 'POLLING';
  ui.scheduleAutoSave(); assert.equal(ui.timerCount(), 0);
  ui.state.jobStatus = 'IDLE';
  ui.scheduleAutoSave(); await ui.fireTimers();
  assert.equal(writes.length, 1); assert.equal(writes[0][2], 'latest');
  ui.scheduleAutoSave(); assert.equal(ui.timerCount(), 0);
});

test('typing during an automatic save is retained and saved on the next pass', async () => {
  let finish, workspace = 'base'; const writes = [];
  const ui = await mountWorkspace({ snapshot: editableSnapshot(), api: {
    file: async () => ({ data: { data: { content: workspace, etag: 'hash' } } }),
    saveFile: async (...args) => { writes.push(args[2]);
      if (writes.length === 1) await new Promise(resolve => { finish = resolve; });
      workspace = args[2]; return { data: { data: { content: workspace, etag: 'new-hash' } } }; },
  } });
  ui.button('Edit file.py').props.onChangeText('first');
  ui.scheduleAutoSave(); await ui.fireTimers();
  ui.button('Edit file.py').props.onChangeText('newer typing');
  finish(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.button('Edit file.py').props.value, 'newer typing');
  ui.scheduleAutoSave(); await ui.fireTimers();
  assert.deepEqual(writes, ['first', 'newer typing']);
});

test('a conflicting automatic save keeps the local edit and does not retry in a loop', async () => {
  let reads = 0;
  const ui = await mountWorkspace({ snapshot: editableSnapshot(), api: {
    file: async () => { reads++; return { data: { data: { content: 'agent change', etag: 'remote' } } }; },
    saveFile: async () => assert.fail('must not overwrite agent changes'),
  } });
  ui.button('Edit file.py').props.onChangeText('local change');
  ui.scheduleAutoSave(); await ui.fireTimers();
  assert.equal(ui.button('Edit file.py').props.value, 'local change');
  assert.ok(ui.button('Retry automatic save'));
  ui.scheduleAutoSave(); assert.equal(ui.timerCount(), 0); assert.equal(reads, 1);
  await ui.button('Send prompt').props.onPress();
  assert.equal(ui.submissions.length, 1); assert.equal(reads, 1);
});


test('sending a prompt flushes the selected pending edit before starting the agent', async () => {
  const order = [];
  const ui = await mountWorkspace({ snapshot: editableSnapshot(), api: {
    file: async () => ({ data: { data: { content: 'base', etag: 'hash' } } }),
    saveFile: async (...args) => { order.push('save'); return { data: { data: { content: args[2], etag: 'saved' } } }; },
  } });
  ui.state.submitPrompt = async () => { order.push('send'); return 'job'; };
  ui.button('Edit file.py').props.onChangeText('latest edit');
  await ui.button('Send prompt').props.onPress();
  assert.deepEqual(order, ['save', 'send']);
});
