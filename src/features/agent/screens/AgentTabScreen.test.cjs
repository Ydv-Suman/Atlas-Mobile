const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/AgentTabScreen.tsx`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function render(state) {
  const result = {};
  vm.runInNewContext(code, { exports: result, require: name => name === 'react-native' ? {
    StyleSheet: { create: value => value }, ActivityIndicator: 'ActivityIndicator', View: 'View', Text: 'Text', TouchableOpacity: 'Button',
  } : name === '../../workspace/store/useWorkspaceStore' ? { useWorkspaceStore: () => state }
    : name === '../../auth/store/useAuthStore' ? { useAuthStore: selector => selector({ user: { username: 'alice' } }) }
    : name === '../../../core/theme/appTheme' ? { colors: {} }
    : name === '../components/AgentWorkspace' ? { __esModule: true, default: 'AgentWorkspace' }
    : name === '@expo/vector-icons' ? { Ionicons: 'Icon' }
    : { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } });
  return result.default();
}
const base = { account: 'alice', activeProjectId: null, projects: [], isRestoringProject: false, isLoadingProjects: false, error: null, fetchProjects() {} };
test('Agent waits for restoration instead of displaying No project selected', () => {
  const tree = render({ ...base, isRestoringProject: true });
  assert.equal(tree.props.children.type, 'ActivityIndicator');
  assert.equal(tree.props.children.props.accessibilityLabel, 'Restoring last project');
});
test('Agent renders the restored project while refreshing the server list', () => {
  const tree = render({ ...base, activeProjectId: 7, projects: [{ id: 7, projectName: 'Last project' }], isLoadingProjects: true });
  assert.equal(tree.type, 'AgentWorkspace'); assert.equal(tree.props.projectId, '7'); assert.equal(tree.props.projectName, 'Last project');
});
test('another account’s project is never rendered while its selection is being replaced', () => {
  const tree = render({ ...base, account: 'bob', activeProjectId: 7, projects: [{ id: 7, projectName: 'Other account' }] });
  assert.equal(tree.props.children.type, 'ActivityIndicator');
});
test('a failed first load offers Retry rather than an incorrect empty selection', () => {
  let retried = 0;
  const tree = render({ ...base, error: 'Offline', fetchProjects: () => { retried++; } });
  const retry = tree.props.children[1]; assert.equal(retry.props.accessibilityLabel, 'Retry loading projects');
  retry.props.onPress(); assert.equal(retried, 1);
});
