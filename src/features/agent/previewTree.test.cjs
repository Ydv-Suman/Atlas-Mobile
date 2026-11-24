const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
const source = fs.readFileSync(`${__dirname}/previewTree.ts`, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
vm.runInNewContext(compiled.outputText, { exports: exportsForTest });
const { mergePreviewTree } = exportsForTest;

test('a generated Python file appears alongside existing GitHub files', () => {
  const result = mergePreviewTree([{ name: 'README.md', path: 'README.md', type: 'file', size: 10 }],
    [{ path: 'hello.py', content: 'print("Hello, world!")\n', deleted: false }], '');
  assert.equal(result.map(entry => entry.name).join(','), 'hello.py,README.md');
  assert.equal(result.find(entry => entry.path === 'hello.py').previewOnly, true);
});

test('new nested folders can be browsed without a matching GitHub directory', () => {
  const files = [{ path: 'src/tools/hello.py', content: 'print("hello")', deleted: false }];
  assert.equal(mergePreviewTree([], files, '')[0].path, 'src');
  assert.equal(mergePreviewTree([], files, 'src')[0].path, 'src/tools');
  assert.equal(mergePreviewTree([], files, 'src/tools')[0].name, 'hello.py');
  assert.equal(mergePreviewTree([], files, '')[0].previewOnly, true);
});

test('deleted files disappear and modified files do not duplicate entries', () => {
  const entries = ['old.py', 'keep.py'].map(name => ({ name, path: name, type: 'file', size: 1 }));
  const files = [{ path: 'old.py', content: null, deleted: true }, { path: 'keep.py', content: 'updated', deleted: false }];
  const result = mergePreviewTree(entries, files, '');
  assert.equal(result.length, 1);
  assert.equal(result[0].path, 'keep.py');
  assert.equal(result[0].previewOnly, false);
});
