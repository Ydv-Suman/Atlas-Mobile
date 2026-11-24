const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(`${__dirname}/GitPanel.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const initialStatus = () => ({ branch: 'feat/test', head: 'head-1', upstream: 'origin/feat/test', ahead: 2, behind: 0, operation: null, revision: 'review-1',
  changes: [{ path: 'hello.py', status: 'M' }], branches: [{ name: 'feat/test', remote: false }, { name: 'main', remote: false }, { name: 'origin/remote', remote: true }] });
async function mount(options = {}) {
  const states = [], refs = [], alerts = [], actions = [], changed = [], opened = [], busy = [];
  let stateIndex = 0, refIndex = 0, effects = [], status = options.status ?? initialStatus();
  const props = { visible: true, projectId: '7', blockedReason: null, refreshKey: 0, onClose() {}, onStatus() {}, onBusyChange: value => busy.push(value), onChanged: action => changed.push(action), onOpenFile: path => opened.push(path), ...options.props };
  const react = {
    useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef: initial => { const index = refIndex++; return refs[index] ??= { current: initial }; }, useCallback: fn => fn, useEffect: fn => effects.push(fn),
  };
  const native = { StyleSheet: { create: value => value, absoluteFill: {} }, Platform: { OS: 'ios' }, Alert: { alert: (...args) => alerts.push(args) } };
  for (const name of ['View', 'Text', 'TouchableOpacity', 'TextInput', 'Modal', 'ScrollView', 'KeyboardAvoidingView', 'ActivityIndicator']) native[name] = name;
  const api = { status: async () => ({ data: { data: status } }),
    action: async (project, action, request) => { actions.push({ project, action, request }); if (options.fail) throw new Error('network failure');
      if (action === 'commit') status = { ...status, changes: [], head: 'head-2', revision: 'review-2', ahead: 3 };
      if (action === 'push') status = { ...status, upstream: 'origin/feat/test', ahead: 0, behind: 0 };
      return { data: { data: { status, message: 'Completed' } } }; },
    diff: async () => ({ data: { data: { path: 'hello.py', diff: '-before\n+after' } } }), history: async () => ({ data: { data: [] } }),
  };
  const result = {};
  vm.runInNewContext(compiled, { exports: result, require: name => name === 'react' ? react : name === 'react-native' ? native : name === 'axios' ? { __esModule: true, default: { isAxiosError: () => false } }
    : name === '../api/gitApi' ? { gitApi: api } : name === 'react-native-safe-area-context' ? { useSafeAreaInsets: () => ({ bottom: 34 }) }
    : name === '@expo/vector-icons' ? { Ionicons: 'Icon' } : { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } });
  const render = () => { stateIndex = refIndex = 0; effects = []; return result.default(props); };
  render(); effects.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve));
  const find = (node, label) => {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.accessibilityLabel === label) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, label); if (found) return found; }
    return null;
  };
  return { actions, alerts, busy, changed, opened, props, render, button: label => find(render(), label), tick: () => new Promise(resolve => setImmediate(resolve)) };
}
test('commit waits for saved editor changes and sends the reviewed revision without pushing automatically', async () => {
  const ui = await mount();
  assert.equal(ui.button('Commit changes').props.disabled, true);
  ui.button('Git commit message').props.onChangeText('Implement change');
  ui.props.blockedReason = 'Saving editor changes'; assert.equal(ui.button('Commit changes').props.disabled, true);
  ui.props.blockedReason = null; ui.button('Commit changes').props.onPress(); await ui.tick();
  assert.equal(ui.actions.length, 1); assert.equal(ui.actions[0].action, 'commit');
  assert.equal(ui.actions[0].request.expectedRevision, 'review-1'); assert.equal(ui.actions[0].request.message, 'Implement change');
  assert.deepEqual(ui.changed, ['commit']); assert.deepEqual(ui.busy, [true, false]);
  assert.equal(ui.button('Git commit message'), null);
  assert.ok(ui.button('Push 3 commits to GitHub'));
  assert.ok(ui.button('Git next action'));
});
test('push requires a separate confirmation and verifies the reviewed HEAD', async () => {
  const ui = await mount({ status: { ...initialStatus(), changes: [] } }); ui.button('Push 2 commits to GitHub').props.onPress();
  assert.equal(ui.actions.length, 0); assert.equal(ui.button('Git feedback title').props.children, 'Push to GitHub?');
  assert.equal(ui.alerts.length, 0); ui.button('Push to GitHub').props.onPress(); await ui.tick();
  assert.equal(ui.actions[0].action, 'push'); assert.equal(ui.actions[0].request.expectedHead, 'head-1');
});
test('branch picker creates a named branch and file diffs can open in the editor', async () => {
  const ui = await mount(); ui.button('Select Git branch').props.onPress(); ui.button('Create new branch').props.onPress();
  ui.button('New Git branch name').props.onChangeText('feat/new'); ui.button('Create branch').props.onPress(); await ui.tick();
  assert.equal(ui.actions[0].action, 'create-branch'); assert.equal(ui.actions[0].request.target, 'feat/new');
  ui.button('Review hello.py').props.onPress(); await ui.tick(); ui.button('Open in editor').props.onPress();
  assert.deepEqual(ui.opened, ['hello.py']);
});
test('a failed Git action retains the commit message and releases the workspace busy state', async () => {
  const ui = await mount({ fail: true }); ui.button('Git commit message').props.onChangeText('Keep this message');
  ui.button('Commit changes').props.onPress(); await ui.tick();
  assert.equal(ui.button('Git commit message').props.value, 'Keep this message'); assert.deepEqual(ui.busy, [true, false]); assert.ok(ui.button('Refresh Git'));
});


test('an unpublished clean branch shows Publish as the next action without an empty commit form', async () => {
  const ui = await mount({ status: { ...initialStatus(), upstream: null, ahead: 0, changes: [] } });
  assert.equal(ui.button('Git commit message'), null);
  assert.equal(ui.button('Commit changes'), null);
  assert.equal(ui.button('Publish branch to GitHub').props.disabled, false);
  ui.button('Publish branch to GitHub').props.onPress();
  assert.equal(ui.button('Git feedback title').props.children, 'Publish branch?');
  assert.equal(ui.actions.length, 0);
  ui.button('Publish to GitHub').props.onPress(); await ui.tick();
  assert.equal(ui.actions[0].action, 'push');
  assert.equal(ui.button('Publish branch to GitHub'), null);
  ui.button('Dismiss Git result').props.onPress();
  assert.ok(ui.button('Check for updates'));
});

test('incoming updates and diverged branches have a clear next action', async () => {
  const incoming = await mount({ status: { ...initialStatus(), changes: [], ahead: 0, behind: 1 } });
  assert.ok(incoming.button('Pull 1 update from GitHub'));
  const diverged = await mount({ status: { ...initialStatus(), changes: [], ahead: 2, behind: 1 } });
  assert.ok(diverged.button('Choose merge or rebase'));
  assert.equal(diverged.button('Push 2 commits to GitHub'), null);
});

test('push and Check for updates show centered feedback that can be dismissed', async () => {
  const ui = await mount({ status: { ...initialStatus(), changes: [] } });
  ui.button('Push 2 commits to GitHub').props.onPress(); ui.button('Push to GitHub').props.onPress();
  assert.equal(ui.button('Git feedback message').props.children, 'Please wait…');
  await ui.tick();
  assert.equal(ui.button('Git feedback title').props.children, 'Push to GitHub');
  assert.equal(ui.button('Git feedback message').props.children, 'Completed');
  assert.equal(ui.alerts.length, 0);
  ui.button('Dismiss Git result').props.onPress();
  assert.equal(ui.button('Git action feedback'), null);
  ui.button('Check for updates').props.onPress(); await ui.tick();
  assert.equal(ui.actions.at(-1).action, 'fetch');
  assert.equal(ui.button('Git feedback message').props.children, 'No new commits to pull from GitHub.');
  ui.button('Dismiss Git result').props.onPress(); assert.ok(ui.button('Check for updates'));
});

test('switch picker shows a local branch once and retains branches only available on GitHub', async () => {
  const status = initialStatus(); status.branches.push({ name: 'origin/main', remote: true });
  const ui = await mount({ status }); ui.button('Select Git branch').props.onPress();
  assert.ok(ui.button('Switch to main'));
  assert.equal(ui.button('Switch to origin/main'), null);
  assert.ok(ui.button('Switch to origin/remote'));
});

test('merge confirmation names the current branch as the destination', async () => {
  const ui = await mount(); ui.button('Git tab Merge').props.onPress();
  ui.button('Merge main').props.onPress();
  assert.equal(ui.alerts[0][0], 'Merge into feat/test?');
  assert.match(ui.alerts[0][1], /from main into feat\/test/);
  assert.equal(ui.actions.length, 0);
  ui.alerts[0][2][1].onPress(); await ui.tick();
  assert.equal(ui.actions[0].action, 'merge'); assert.equal(ui.actions[0].request.target, 'main');
});


test('vertical Git tabs switch workflows directly without the overflow menu', async () => {
  const ui = await mount();
  assert.equal(ui.button('More Git actions'), null);
  for (const label of ['Changes', 'Branches', 'Sync', 'Merge', 'Rebase', 'History']) assert.ok(ui.button(`Git tab ${label}`));
  assert.equal(ui.button('Git tab Changes').props.accessibilityState.selected, true);
  ui.button('Git tab Sync').props.onPress();
  assert.equal(ui.button('Git tab Sync').props.accessibilityState.selected, true);
  assert.ok(ui.button('Fetch remote branches')); assert.ok(ui.button('Pull latest from GitHub'));
  assert.equal(ui.button('Git commit message'), null);
  ui.button('Git tab Branches').props.onPress(); assert.ok(ui.button('Create new branch'));
  ui.button('Git tab Rebase').props.onPress(); assert.ok(ui.button('Rebase onto main'));
  ui.button('Git tab History').props.onPress(); await ui.tick();
  assert.equal(ui.button('Git tab History').props.accessibilityState.selected, true);
  ui.button('Git tab Changes').props.onPress(); assert.ok(ui.button('Git commit message'));
});


test('pull results and sync failures stay centered in the workflow without system popups', async () => {
  const pull = await mount({ status: { ...initialStatus(), changes: [], ahead: 0, behind: 1 } });
  pull.button('Pull 1 update from GitHub').props.onPress(); await pull.tick();
  assert.equal(pull.button('Git feedback title').props.children, 'Pull from GitHub');
  assert.equal(pull.button('Git feedback message').props.children, 'Completed'); assert.equal(pull.alerts.length, 0);
  const failed = await mount({ fail: true, status: { ...initialStatus(), changes: [], ahead: 0 } });
  failed.button('Check for updates').props.onPress(); await failed.tick();
  assert.equal(failed.button('Git feedback title').props.children, 'Check for updates');
  assert.ok(failed.button('Git feedback message').props.children); assert.equal(failed.alerts.length, 0);
  failed.button('Dismiss Git result').props.onPress(); assert.ok(failed.button('Check for updates'));
});

test('tapping the selected branch returns to its current workflow without a Git mutation', async () => {
  for (const [extra, label] of [
    [{ ahead: 0 }, 'Check for updates'],
    [{ ahead: 2 }, 'Push 2 commits to GitHub'],
    [{ ahead: 0, behind: 1 }, 'Pull 1 update from GitHub'],
    [{ upstream: null, ahead: 0 }, 'Publish branch to GitHub'],
  ]) {
    const ui = await mount({ status: { ...initialStatus(), changes: [], ...extra } });
    ui.button('Select Git branch').props.onPress();
    const selected = ui.button('Switch to feat/test');
    assert.equal(selected.props.disabled, false);
    assert.equal(selected.props.accessibilityState.selected, true);
    selected.props.onPress();
    assert.equal(ui.button('Git tab Changes').props.accessibilityState.selected, true);
    assert.ok(ui.button(label)); assert.equal(ui.actions.length, 0);
  }
});


test('centered push confirmation retains the HEAD and review the user actually saw', async () => {
  const status = { ...initialStatus(), changes: [] };
  const ui = await mount({ status }); ui.button('Push 2 commits to GitHub').props.onPress();
  status.head = 'new-head'; status.revision = 'new-review';
  ui.button('Push to GitHub').props.onPress(); await ui.tick();
  assert.equal(ui.actions[0].request.expectedHead, 'head-1');
  assert.equal(ui.actions[0].request.expectedRevision, 'review-1');
});
