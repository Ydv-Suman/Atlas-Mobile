const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const result = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/workspaceApi.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: result, require: () => ({}) });
const repo = { name: 'project', html_url: 'https://github.com/owner/project', owner: { login: 'owner' }, private: false, fork: false, permissions: { admin: true, push: true } };
test('repo project requests use the backend ownership and visibility values', () => {
  const own = result.projectFromRepo(repo);
  assert.equal(own.repoOwnership, 'OWNER');
  assert.equal(own.repoVisibility, 'PUBLIC');
  assert.equal(own.repoOwner, 'owner');
  assert.equal(own.githubUrl, repo.html_url);
  const fork = result.projectFromRepo({ ...repo, fork: true, private: true });
  assert.equal(fork.repoOwnership, 'FORK'); assert.equal(fork.repoVisibility, 'PRIVATE');
  assert.equal(result.projectFromRepo({ ...repo, permissions: { admin: false, push: true } }).repoOwnership, 'COLLABORATOR');
  assert.equal(result.projectFromRepo({ ...repo, permissions: undefined }).repoOwnership, 'COLLABORATOR');
});
