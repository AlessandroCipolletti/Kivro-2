import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { OpenClawDiscoveryAdapter } from '../dist/packages/openclaw-adapter/src/discovery.js';
import { ReadOnlyOpenClawDiscovery } from '../dist/packages/openclaw-adapter/src/read-only-discovery.js';
import { LocalOpenClawCommandRunner } from '../dist/packages/openclaw-adapter/src/command-runner.js';
import { buildSuggestedDependencyGraph } from '../dist/packages/openclaw-adapter/src/dependency-candidates.js';

function fixture(installRoot) {
  const homeDir = mkdtempSync(join(realpathSync(tmpdir()), 'kivro-discovery-'));
  const stateDir = join(homeDir, '.openclaw');
  const workspaceDir = join(stateDir, 'workspace');
  const configPath = join(stateDir, 'openclaw.json');
  mkdirSync(workspaceDir, { recursive: true });
  return {
    homeDir, stateDir, workspaceDir, configPath,
    scanner: new ReadOnlyOpenClawDiscovery({ homeDir, stateDir, workspaceDir, configPath, installRoot }),
    cleanup() { rmSync(homeDir, { recursive: true, force: true }); },
  };
}

test('installed bundled and custodian skill metadata is discovered without writing package or seller state', async () => {
  const packageRoot = mkdtempSync(join(realpathSync(tmpdir()), 'kivro-openclaw-package-'));
  const f = fixture(packageRoot);
  try {
    writeFileSync(f.configPath, '{}');
    writeFileSync(join(packageRoot, 'package.json'), '{"name":"openclaw","version":"2026.8.2"}');
    skill(join(packageRoot, 'skills'), 'bundled-example', 'name: bundled-example');
    skill(join(packageRoot, 'custodian-skills'), 'repair', 'name: repair');
    const before = [snapshot(packageRoot), snapshot(f.homeDir)];
    const result = await f.scanner.scan();
    assert.deepEqual(result.skills.map((item) => [item.name, item.source]), [
      ['bundled-example', 'bundled'], ['repair', 'custodian'],
    ]);
    assert.ok(result.skills.every((item) => item.consent === 'not-granted' && item.readiness === 'unknown' && item.visibility === 'unknown'));
    assert.deepEqual([snapshot(packageRoot), snapshot(f.homeDir)], before);
  } finally { f.cleanup(); rmSync(packageRoot, { recursive: true, force: true }); }
});

test('unverified installed package is never scanned', async () => {
  const packageRoot = mkdtempSync(join(realpathSync(tmpdir()), 'kivro-unverified-package-'));
  const f = fixture(packageRoot);
  try {
    writeFileSync(f.configPath, '{}');
    writeFileSync(join(packageRoot, 'package.json'), '{"name":"not-openclaw","version":"1"}');
    skill(join(packageRoot, 'skills'), 'hidden', 'name: hidden');
    const result = await f.scanner.scan();
    assert.deepEqual(result.skills, []);
    assert.ok(result.issues.includes('INSTALL_ROOT_UNVERIFIED'));
  } finally { f.cleanup(); rmSync(packageRoot, { recursive: true, force: true }); }
});

function skill(root, directory, frontmatter) {
  const path = join(root, directory);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'SKILL.md'), `---\n${frontmatter}\n---\nPrivate body that must not be returned\n`);
}

function snapshot(path) {
  const result = new Map();
  function visit(current) {
    const stat = lstatSync(current);
    const relative = current.slice(path.length);
    result.set(relative, {
      mode: stat.mode,
      mtime: stat.mtimeMs,
      bytes: stat.isFile() ? readFileSync(current).toString('base64') : undefined,
    });
    if (stat.isDirectory()) for (const child of readdirSync(current)) visit(join(current, child));
  }
  visit(path);
  return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
}

test('read-only scanner finds file-backed skill and configured references without consent or secrets', async () => {
  const f = fixture();
  try {
    const extra = join(f.homeDir, 'extra-skills');
    skill(join(f.workspaceDir, 'skills'), 'research', 'name: research\ndescription: private client data\nmetadata:\n  openclaw:\n    requires:\n      bins: [rg]\n      anyBins: [curl, wget]\n      env: [RESEARCH_TOKEN]\n      config: [browser.enabled]');
    skill(join(f.homeDir, '.agents', 'skills'), 'draft', 'name: draft');
    skill(extra, 'summarize', 'name: summarize');
    writeFileSync(f.configPath, `{
      agents: { defaults: { workspace: ${JSON.stringify(f.workspaceDir)}, model: { primary: 'vendor/model' } }, list: [{ id: 'main' }] },
      skills: { load: { extraDirs: [${JSON.stringify(extra)}] } },
      tools: { allow: ['web_search'], deny: ['exec'] },
      plugins: { entries: { calendar: { apiKey: 'PRIVATE_KEY_VALUE' } } },
      secrets: { token: 'PRIVATE_SECRET_VALUE' }
    }`);
    writeFileSync(join(f.stateDir, '.env'), 'ANOTHER_SECRET=private');
    const before = snapshot(f.homeDir);
    const result = await f.scanner.scan();
    assert.equal(result.status, 'scanned');
    assert.equal(result.config, 'parsed');
    assert.deepEqual(result.skills.map((item) => item.name), ['draft', 'research', 'summarize']);
    assert.deepEqual(result.tools.map((item) => item.name), ['exec', 'web_search']);
    assert.deepEqual(result.plugins.map((item) => item.name), ['calendar']);
    assert.deepEqual(result.models.map((item) => item.name), ['vendor/model']);
    assert.deepEqual(result.skills.find((item) => item.name === 'research').declaredResources, {
      binaries: ['rg'], anyBinaries: ['curl', 'wget'], environmentKeys: ['RESEARCH_TOKEN'], configKeys: ['browser.enabled'], status: 'declared',
    });
    const suggestion = buildSuggestedDependencyGraph(result, 'research');
    assert.equal(suggestion.inference, null);
    assert.ok(suggestion.nodes.every((item) => item.selected === false && item.health === 'UNKNOWN'));
    assert.deepEqual(suggestion.nodes.filter((item) => item.requirement === 'REQUIRED').map((item) => item.name).sort(),
      ['RESEARCH_TOKEN', 'browser.enabled', 'research', 'rg']);
    assert.deepEqual(suggestion.nodes.filter((item) => item.requirement === 'OPTIONAL').map((item) => item.name).sort(),
      ['curl', 'wget']);
    assert.equal(suggestion.alternatives.length, 1);
    assert.doesNotMatch(JSON.stringify(suggestion), /PRIVATE_SECRET_VALUE|PRIVATE_KEY_VALUE|client data|openclaw\.json/);
    assert.ok(result.skills.every((item) => item.consent === 'not-granted' && item.readiness === 'unknown' && item.visibility === 'unknown'));
    assert.ok(result.tools.every((item) => item.consent === 'not-granted' && item.readiness === 'unknown'));
    assert.deepEqual(snapshot(f.homeDir), before, 'scan must preserve file bytes, modes and mtimes');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|client data|\.env|openclaw\.json|extra-skills/);
  } finally { f.cleanup(); }
});

test('symlinked roots and skill files are skipped, with uncertainty reported', async () => {
  const f = fixture();
  try {
    const outside = mkdtempSync(join(tmpdir(), 'kivro-discovery-secret-'));
    try {
      skill(outside, 'hidden', 'name: hidden');
      symlinkSync(outside, join(f.workspaceDir, 'skills'));
      const managed = join(f.stateDir, 'skills', 'safe');
      mkdirSync(managed, { recursive: true });
      symlinkSync(join(outside, 'hidden', 'SKILL.md'), join(managed, 'SKILL.md'));
      writeFileSync(f.configPath, '{}');
      const result = await f.scanner.scan();
      assert.deepEqual(result.skills, []);
      assert.equal(result.status, 'partial');
      assert.ok(result.issues.includes('ROOT_SYMLINK'));
    } finally { rmSync(outside, { recursive: true, force: true }); }
  } finally { f.cleanup(); }
});

test('missing config still discovers default-root candidates but never guesses readiness', async () => {
  const f = fixture();
  try {
    skill(join(f.stateDir, 'skills'), 'local', 'name: local');
    const result = await f.scanner.scan();
    assert.equal(result.config, 'missing');
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.skills.map((item) => item.name), ['local']);
    assert.equal(result.skills[0].readiness, 'unknown');
    assert.ok(result.issues.includes('CONFIG_MISSING'));
  } finally { f.cleanup(); }
});

test('unresolved includes, collisions, malformed metadata, and inaccessible extra roots remain explicit', async () => {
  const f = fixture();
  try {
    skill(join(f.workspaceDir, 'skills'), 'one', 'name: shared');
    skill(join(f.stateDir, 'skills'), 'two', 'name: shared');
    const malformed = join(f.stateDir, 'skills', 'bad');
    mkdirSync(malformed, { recursive: true });
    writeFileSync(join(malformed, 'SKILL.md'), '---\nname: [broken\n---\n');
    writeFileSync(f.configPath, `{$include: './other.json', skills: {load: {extraDirs: ['/outside-home']}}}`);
    const result = await f.scanner.scan();
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.skills.map((item) => item.name), ['shared', 'shared']);
    assert.ok(result.skills.every((item) => item.ambiguous));
    assert.throws(() => buildSuggestedDependencyGraph(result, 'shared'), /ambiguous/);
    for (const issue of ['CONFIG_INCLUDE_UNRESOLVED', 'ROOT_OUTSIDE_HOME', 'SKILL_COLLISION', 'SKILL_NAME_INVALID']) {
      assert.ok(result.issues.includes(issue), issue);
    }
  } finally { f.cleanup(); }
});

test('adapter combines safe version probe with read-only local discovery', async () => {
  const f = fixture();
  try {
    writeFileSync(f.configPath, '{}');
    const calls = [];
    const runner = { async run(args) { calls.push(args); return { exitCode: 0, stdout: 'OpenClaw 2026.8.2\n' }; } };
    const result = await new OpenClawDiscoveryAdapter(runner, f.scanner).inspect();
    assert.deepEqual(result.detection, { status: 'detected', version: '2026.8.2', compatibility: 'unverified' });
    assert.equal(result.local.config, 'parsed');
    assert.deepEqual(calls, [['--version']]);
  } finally { f.cleanup(); }
});

test('command boundary refuses personal-state CLI inspection and mutations', () => {
  for (const args of [
    ['config', 'set', 'gateway.port', '1234'],
    ['skills', 'list', '--json'],
    ['config', 'validate', '--json'],
  ]) assert.throws(() => new LocalOpenClawCommandRunner().run(args), TypeError);
});

test('command boundary fails closed when executable is missing or output exceeds limit', async () => {
  await assert.rejects(new LocalOpenClawCommandRunner('/definitely-not-a-kivro-openclaw-binary').run(['--version']), { code: 'UNAVAILABLE' });
  await assert.rejects(new LocalOpenClawCommandRunner(process.execPath, 10_000, 1).run(['--version']), { code: 'OUTPUT_LIMIT' });
});

test('timed-out version probe terminates its child process group', { skip: process.platform === 'win32' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-openclaw-inspect-'));
  const executable = join(directory, 'hanging-openclaw');
  try {
    writeFileSync(executable, '#!/bin/sh\nsleep 5\n');
    chmodSync(executable, 0o700);
    const started = Date.now();
    await assert.rejects(new LocalOpenClawCommandRunner(executable, 50).run(['--version']), { code: 'TIMED_OUT' });
    assert.ok(Date.now() - started < 2_000);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('version probe isolates home and never inherits seller secret environment', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-openclaw-version-fixture-'));
  const executable = join(directory, 'fixture-openclaw');
  const priorHome = process.env.HOME;
  const priorSecret = process.env.SELLER_SECRET_SENTINEL;
  try {
    writeFileSync(executable, '#!/bin/sh\nmkdir -p "$HOME/state"\nprintf touched > "$HOME/state/probe"\nprintf "OpenClaw 2026.8.2\\n"\nif [ -n "${SELLER_SECRET_SENTINEL:-}" ]; then printf inherited-secret; fi\n');
    chmodSync(executable, 0o700);
    process.env.HOME = directory;
    process.env.SELLER_SECRET_SENTINEL = 'private-seller-value';
    const result = await new LocalOpenClawCommandRunner(executable).run(['--version']);
    assert.equal(result.stdout, 'OpenClaw 2026.8.2\n');
    assert.deepEqual(readdirSync(directory), ['fixture-openclaw']);
  } finally {
    if (priorHome === undefined) delete process.env.HOME; else process.env.HOME = priorHome;
    if (priorSecret === undefined) delete process.env.SELLER_SECRET_SENTINEL;
    else process.env.SELLER_SECRET_SENTINEL = priorSecret;
    rmSync(directory, { recursive: true, force: true });
  }
});
