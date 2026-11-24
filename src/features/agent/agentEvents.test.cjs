const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const events = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/agentEvents.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: events });

test('stream parser handles split frames, CRLF, and heartbeat comments', () => {
 const received = [];
 const parse = events.sseParser(event => received.push(event));
 parse(':keepalive\n\nevent:agent\ndata: {"sequence":1,"type":"text.delta","text":"hel');
 assert.equal(received.length, 0);
 parse('lo"}\r\n\r\ndata: {"sequence":2,"type":"turn.end"}\n\n');
 assert.equal(received.length, 2); assert.equal(received[0].text, 'hello');
});
test('stream deltas become one message and final snapshots do not duplicate it', () => {
 const input = [{sequence:1,type:'text.delta',itemId:'m',text:'Hello '}, {sequence:2,type:'text.delta',itemId:'m',text:'world'},
 {sequence:3,type:'text.complete',itemId:'m',text:'Hello world'}, {sequence:4,type:'tool',itemId:'cmd',text:'python3 hello.py',status:'inProgress'},
 {sequence:5,type:'tool.delta',itemId:'cmd',text:'hello world\n'}, {sequence:6,type:'tool',itemId:'cmd',text:'python3 hello.py',output:'hello world\n',status:'completed'}];
 const items = events.transcriptItems(events.mergeEvents(input, [input[0]]));
 assert.equal(items.length, 2); assert.equal(items[0].text, 'Hello world'); assert.equal(items[1].output, 'hello world\n');
});
test('divider clamps both panels while allowing useful vertical resizing', () => {
 assert.equal(events.clampEditorRatio(0.5, 700), 0.5);
 assert.ok(events.clampEditorRatio(-5, 700) > 0);
 assert.ok(events.clampEditorRatio(5, 700) < 1);
 assert.ok(Number.isFinite(events.clampEditorRatio(0.5, 0)));
});
test('local workspaces retain drafts and settings under separate user/project keys', () => {
 const disk = new Map();
 const storage = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/sessionStorage.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: storage, require: () => ({ __esModule: true, default: { getItemSync: key => disk.get(key) ?? null, setItemSync: (key,value) => disk.set(key,value) } }),
 });
 const key = storage.workspaceKey('alice', '7');
 storage.saveLocal(key, { drafts: { 'new/hello.py': { original: '', content: 'print("hello")' } }, editorRatio: 0.55 });
 const reopened = storage.readLocal(key);
 assert.equal(reopened.drafts['new/hello.py'].content, 'print("hello")'); assert.equal(reopened.editorRatio, 0.55);
 assert.equal(storage.readLocal(storage.workspaceKey('bob', '7')), null);
 assert.equal(storage.readLocal(storage.workspaceKey('alice', '8')), null);
});
