const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(api) {
 const result = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/editorDrafts.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
 { exports: result, require: () => ({ agentApi: api }) });
 return result.saveEditorDraft;
}
test('editor save refreshes an obsolete hash when the workspace base still matches', async () => {
 let saved;
 const save = load({ file: async () => ({ data: { data: { content: 'base', etag: 'current-hash' } } }),
  saveFile: async (...args) => { saved = args; return { data: { data: { content: 'my edit', etag: 'saved-hash' } } }; } });
 const result = await save('7', 'file.py', { original: 'base', content: 'my edit', etag: 'old-hash' });
 assert.equal(saved[3], 'current-hash'); assert.equal(result.etag, 'saved-hash');
});
test('a matching workspace copy is acknowledged without a redundant write', async () => {
 const save = load({ file: async () => ({ data: { data: { content: 'already applied', etag: 'new-hash' } } }),
  saveFile: async () => assert.fail('must not write') });
 assert.equal((await save('7', 'file.py', { original: 'old', content: 'already applied' })).etag, 'new-hash');
});
test('a genuine conflict does not overwrite either copy or mutate the local draft', async () => {
 const draft = { original: 'old base', content: 'local edits' };
 const save = load({ file: async () => ({ data: { data: { content: 'agent edits', etag: 'remote-hash' } } }),
  saveFile: async () => assert.fail('must not overwrite agent edits') });
 await assert.rejects(() => save('7', 'file.py', draft), /local draft is kept/);
 assert.equal(draft.content, 'local edits'); assert.equal(draft.original, 'old base');
});
