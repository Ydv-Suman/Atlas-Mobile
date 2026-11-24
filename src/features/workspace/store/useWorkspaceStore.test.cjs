const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/useWorkspaceStore.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const key = account => `atlas.workspace.last-project.v1:${encodeURIComponent(account)}`;
const project = id => ({ id, projectName: `Project ${id}`, githubUrl: `https://github.com/owner/project-${id}` });
function load(api, { storage = new Map(), legacy = null } = {}) {
  const result = {};
  vm.runInNewContext(code, { exports: result, require: name => name === '../api/workspaceApi' ? { workspaceApi: api }
    : name === '../../../core/storage/secureStore' ? { getSecure: async () => legacy }
    : name === '../../../core/constants/storageKeys' ? { STORAGE_KEYS: { LAST_ACTIVE_PROJECT_ID: 'legacy' } }
    : name === '../../agent/sessionStorage' ? { readLocal: key => JSON.parse(storage.get(key) ?? 'null'), saveLocal: (key, value) => storage.set(key, JSON.stringify(value)) }
    : name === 'axios' ? { __esModule: true, default: { isAxiosError: () => false } } : require(name) });
  return result.useWorkspaceStore;
}
const response = projects => ({ data: { data: projects } });

test('last selected project restores immediately after reload and refreshes its metadata', async () => {
  const storage = new Map();
  const first = load({ fetchProjects: async () => response([project(7), project(8)]) }, { storage });
  await first.getState().restoreProject('alice'); first.getState().setActiveProject(8);
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const reloaded = load({ fetchProjects: () => pending }, { storage });
  const restoring = reloaded.getState().restoreProject('alice');
  assert.equal(reloaded.getState().activeProjectId, 8);
  assert.equal(reloaded.getState().projects[0].projectName, 'Project 8');
  finish(response([project(7), { ...project(8), projectName: 'Renamed' }])); await restoring;
  assert.equal(reloaded.getState().activeProjectId, 8);
  assert.equal(JSON.parse(storage.get(key('alice'))).projectName, 'Renamed');
});
test('legacy saved IDs migrate only when they belong to the loaded account', async () => {
  const storage = new Map();
  const own = load({ fetchProjects: async () => response([project(7)]) }, { storage, legacy: '7' });
  await own.getState().restoreProject('alice');
  assert.equal(own.getState().activeProjectId, 7); assert.equal(JSON.parse(storage.get(key('alice'))).id, 7);
  const other = load({ fetchProjects: async () => response([project(9)]) }, { legacy: '7' });
  await other.getState().restoreProject('bob'); assert.equal(other.getState().activeProjectId, null);
});
test('refresh does not override a project selected while the request was in flight', async () => {
  let finish, next = Promise.resolve(response([project(7), project(8)]));
  const store = load({ fetchProjects: () => next }); await store.getState().restoreProject('alice'); store.getState().setActiveProject(7);
  next = new Promise(resolve => { finish = resolve; }); const refreshing = store.getState().fetchProjects();
  store.getState().setActiveProject(8); finish(response([project(7), project(8)])); await refreshing;
  assert.equal(store.getState().activeProjectId, 8);
});
test('late requests from another account cannot replace the current account or its selection', async () => {
  const storage = new Map([[key('alice'), JSON.stringify(project(7))], [key('bob'), JSON.stringify(project(9))]]);
  let finish, calls = 0; const pending = new Promise(resolve => { finish = resolve; });
  const store = load({ fetchProjects: () => ++calls === 1 ? pending : Promise.resolve(response([project(9)])) }, { storage });
  const first = store.getState().restoreProject('alice'); await new Promise(resolve => setImmediate(resolve));
  await store.getState().restoreProject('bob'); finish(response([project(7)])); await first;
  assert.equal(store.getState().account, 'bob'); assert.equal(store.getState().activeProjectId, 9);
  assert.deepEqual(Array.from(store.getState().projects, item => item.id), [9]);
});
test('cached project stays available during a network failure and concurrent loads are deduplicated', async () => {
  const storage = new Map([[key('alice'), JSON.stringify(project(7))]]); let calls = 0;
  const store = load({ fetchProjects: async () => { calls++; throw new Error('offline'); } }, { storage });
  const restoring = store.getState().restoreProject('alice'); const fetching = store.getState().fetchProjects(); await Promise.all([restoring, fetching]);
  assert.equal(calls, 1); assert.equal(store.getState().activeProjectId, 7); assert.ok(store.getState().error);
  assert.equal(store.getState().isRestoringProject, false);
});
test('a deleted or inaccessible project is cleared instead of reopening from stale cache', async () => {
  const storage = new Map([[key('alice'), JSON.stringify(project(7))]]);
  const store = load({ fetchProjects: async () => response([]) }, { storage }); await store.getState().restoreProject('alice');
  assert.equal(store.getState().activeProjectId, null); assert.equal(JSON.parse(storage.get(key('alice'))), null);
});
test('deleting the active project clears its remembered selection', async () => {
  const storage = new Map();
  const store = load({ fetchProjects: async () => response([project(7)]), deleteProject: async () => {} }, { storage });
  await store.getState().restoreProject('alice'); store.getState().setActiveProject(7); await store.getState().deleteProject(7);
  assert.equal(store.getState().activeProjectId, null); assert.equal(JSON.parse(storage.get(key('alice'))), null);
});
