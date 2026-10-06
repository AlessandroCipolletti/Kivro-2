import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { OpenClawDiscoveryAdapter } from '../dist/packages/openclaw-adapter/src/discovery.js';
import { LocalOpenClawCommandRunner } from '../dist/packages/openclaw-adapter/src/command-runner.js';

function fixtureRunner(responses) {
  const calls = [];
  return {
    calls,
    async run(args) {
      const command = args.join(' ');
      calls.push(command);
      const response = responses[command];
      if (response instanceof Error) throw response;
      if (!response) throw new Error('Unexpected inspection command');
      return response;
    },
  };
}

test('discovery returns only local suggestions and no personal paths or metadata', async () => {
  const runner = fixtureRunner({
    '--version': { exitCode: 0, stdout: 'OpenClaw 2026.8.2 (0965053)\n' },
    'config validate --json': { exitCode: 0, stdout: JSON.stringify({ valid: true, configPath: '/private/seller/openclaw.json' }) },
    'skills list --json': { exitCode: 0, stdout: JSON.stringify({
      workspaceDir: '/private/seller/workspace',
      skills: [
        { name: 'research', eligible: true, description: 'private customer secret', source: '/private/seller' },
        { name: 'draft', eligible: false, missing: { env: ['SECRET_KEY'] } },
      ],
    }) },
  });
  const result = await new OpenClawDiscoveryAdapter(runner).inspect();
  assert.deepEqual(result, {
    detection: { status: 'detected', version: '2026.8.2', compatibility: 'unverified' },
    config: 'valid',
    skills: { status: 'available', suggestions: [
      { name: 'draft', eligible: false, consent: 'not-granted' },
      { name: 'research', eligible: true, consent: 'not-granted' },
    ] },
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /private|SECRET_KEY|customer secret/);
  assert.deepEqual(runner.calls, ['--version', 'config validate --json', 'skills list --json']);
});

test('missing runtime stops metadata inspection and fails closed', async () => {
  const runner = fixtureRunner({ '--version': new Error('missing') });
  assert.deepEqual(await new OpenClawDiscoveryAdapter(runner).inspect(), {
    detection: { status: 'unavailable' },
    config: 'unavailable',
    skills: { status: 'unavailable', suggestions: [] },
  });
  assert.deepEqual(runner.calls, ['--version']);
});

test('invalid config and failed or malformed skill inventory cannot grant consent', async () => {
  const runner = fixtureRunner({
    '--version': { exitCode: 0, stdout: 'OpenClaw 2026.8.2\n' },
    'config validate --json': { exitCode: 1, stdout: JSON.stringify({ valid: false, issues: [{ path: 'secret.provider' }] }) },
    'skills list --json': { exitCode: 0, stdout: JSON.stringify({ skills: [
      { name: 'research', eligible: true }, { name: 'research', eligible: true },
    ] }) },
  });
  const result = await new OpenClawDiscoveryAdapter(runner).inspect();
  assert.equal(result.config, 'invalid');
  assert.deepEqual(result.skills, { status: 'unavailable', suggestions: [] });
});

test('unknown CLI output shape is unavailable rather than eligible', async () => {
  const runner = fixtureRunner({
    'skills list --json': { exitCode: 0, stdout: JSON.stringify({ skills: [{ name: '../personal', eligible: true }] }) },
    'config validate --json': { exitCode: 0, stdout: '{"valid":"true"}' },
  });
  const adapter = new OpenClawDiscoveryAdapter(runner);
  assert.deepEqual(await adapter.discoverSkills(), { status: 'unavailable', suggestions: [] });
  assert.equal(await adapter.inspectConfig(), 'unavailable');
});

test('command boundary refuses mutation commands before spawning', () => {
  assert.throws(
    () => new LocalOpenClawCommandRunner().run(['config', 'set', 'gateway.port', '1234']),
    TypeError,
  );
  assert.throws(
    () => new LocalOpenClawCommandRunner().run(['skills', 'list', '--json']),
    TypeError,
  );
  assert.throws(
    () => new LocalOpenClawCommandRunner().run(['config', 'validate', '--json']),
    TypeError,
  );
});

test('live local inspection only probes version and never touches personal skill state', async () => {
  const result = await new OpenClawDiscoveryAdapter(new LocalOpenClawCommandRunner('/definitely-not-a-kivro-openclaw-binary')).inspect();
  assert.deepEqual(result, {
    detection: { status: 'unavailable' },
    config: 'unavailable',
    skills: { status: 'unavailable', suggestions: [] },
  });
});

test('command boundary fails closed when executable is missing or output exceeds limit', async () => {
  await assert.rejects(
    new LocalOpenClawCommandRunner('/definitely-not-a-kivro-openclaw-binary').run(['--version']),
    { code: 'UNAVAILABLE' },
  );
  await assert.rejects(
    new LocalOpenClawCommandRunner(process.execPath, 10_000, 1).run(['--version']),
    { code: 'OUTPUT_LIMIT' },
  );
});

test('timed-out inspection terminates its child process group', { skip: process.platform === 'win32' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kivro-openclaw-inspect-'));
  const executable = join(directory, 'hanging-openclaw');
  try {
    writeFileSync(executable, '#!/bin/sh\nsleep 5\n');
    chmodSync(executable, 0o700);
    const started = Date.now();
    await assert.rejects(
      new LocalOpenClawCommandRunner(executable, 50).run(['--version']),
      { code: 'TIMED_OUT' },
    );
    assert.ok(Date.now() - started < 2_000, 'timeout should not wait for a descendant-held output pipe');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
