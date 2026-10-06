/* global URL, AbortController */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DockerSandboxAdapter, DockerJobControlAdapter } from '../dist/packages/sandbox-adapter/src/docker.js';
import { BrokerSidecar } from '../dist/apps/worker/src/broker-sidecar.js';
import { SellerCompletionBroker } from '../dist/packages/application/src/completion-broker.js';

const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = JSON.parse(execFileSync(docker, ['image', 'inspect', 'kivro-openclaw-runtime:m07',
  '--format', '{{json .RepoDigests}}'], { encoding: 'utf8' }))
  .find((value) => value.startsWith('kivro-openclaw-runtime@sha256:'));
const collector = 'alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b';

test('pinned OpenClaw runs an isolated headless job through the Worker bridge', { timeout: 120_000 }, async () => {
  assert.ok(image);
  const root = mkdtempSync(join(tmpdir(), 'kivro-openclaw-exec-'));
  const jobId = randomUUID(), attemptId = randomUUID();
  const input = join(root, attemptId, 'input');
  mkdirSync(input, { recursive: true, mode: 0o700 });
  const hostSecret = join(root, 'host-private-sentinel');
  writeFileSync(hostSecret, 'must never enter the job container', { mode: 0o600 });
  const config = JSON.parse(readFileSync(new URL('./fixtures/openclaw-m07-config.json',
    import.meta.url), 'utf8'));
  config.agents.defaults.sandbox.docker.image = image;
  writeFileSync(join(input, 'config.json'), JSON.stringify(config));
  writeFileSync(join(input, 'message.txt'), 'Submit answer "ready" using kivro_submit_result.', { mode: 0o600 });
  writeFileSync(join(input, 'kivro-run.json'), JSON.stringify({ version: 1, modelRef: 'kivro/broker',
    timeoutSeconds: 40 }), { mode: 0o600 });
  let inferenceCalls = 0;
  const versionId = randomUUID();
  const completion = new SellerCompletionBroker({ async resolve() { return 'synthetic-key'; } },
    { providerId: 'synthetic', async complete(request, credential) {
      assert.equal(credential, 'synthetic-key');
      assert.equal(request.stream, false);
      inferenceCalls++;
      return { id: randomUUID(), object: 'chat.completion', created: Math.floor(Date.now() / 1000),
        model: 'broker', choices: [{ index: 0, finish_reason: inferenceCalls === 1 ? 'tool_calls' : 'stop',
          message: inferenceCalls === 1 ? { role: 'assistant', content: null, tool_calls: [{
            id: 'call_kivro_result', type: 'function', function: {
              name: 'kivro_submit_result', arguments: JSON.stringify({ fields: {
                answer: { type: 'SHORT_TEXT', value: 'ready' },
              } }),
            },
          }] } : { role: 'assistant', content: 'Submitted.' } }],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } };
    } },
    { async reserve() {}, async settle() {} });
  const providerBudget = { providerId: 'synthetic', modelId: 'broker', credentialRef: 'seller:test-only',
    maxRequestsPerJob: 4, maxInputTokensPerRequest: 8192, maxOutputTokensPerRequest: 2048,
    maxEstimatedSpendMicroUsdPerJob: 100_000,
    inputPriceMicroUsdPerMillionTokens: 1_000_000,
    outputPriceMicroUsdPerMillionTokens: 1_000_000 };
  const sidecar = new BrokerSidecar(docker, new DockerJobControlAdapter(docker), jobId, attemptId,
    async () => {}, async (request) => {
      assert.equal(request.kind, 'INFERENCE');
      assert.equal(request.payload?.stream, true);
      return completion.invoke({ jobId, capabilityVersionId: versionId, providerBudget,
        allowedToolNames: ['kivro_submit_result'] }, request.payload, request.id, new AbortController().signal);
    });
  const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
    collectorImage: collector, attemptRoot: root });
  const contract = { schemaVersion: 1, fields: [
    { key: 'answer', label: 'Answer', order: 0, required: true, type: 'SHORT_TEXT' },
  ] };
  try {
    const result = await sandbox.runWithOutputControlled({ planVersion: 1, image, networkMode: 'none',
      readOnlyRoot: true, capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin',
      runAs: '65532:65532', maxRuntimeSeconds: 60, memoryMb: 1024, cpu: 1,
      maxPids: 128, maxOutputBytes: 65536 }, attemptId,
    ['run-job'],
    contract, { maxFileBytes: 65536, maxResultBytes: 65536 }, async (collected) => {
      assert.equal(collected.values.answer, 'ready');
    }, { jobId, async onReady() {}, async onStartPermitted() {},
      async onStarted(id) {
        await sidecar.start(id);
        execFileSync(docker, ['exec', '--user=65532:65532', id, 'node', '-e',
          `import('node:fs').then(async ({existsSync}) => {
            if (existsSync(process.argv[1])) process.exit(17);
            try {
              await fetch('http://169.254.169.254/latest/meta-data/',
                {signal: AbortSignal.timeout(800)});
              process.exit(18);
            } catch { process.exit(0); }
          })`, hostSecret], { timeout: 5000 });
      },
      async onWatchdogTick() {},
      async onStopped() { await sidecar.close(); },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(inferenceCalls, 2);
  } finally { await sidecar.close(); rmSync(root, { recursive: true, force: true }); }
});

test('OpenClaw runner refuses a disabled or foreign sandbox before broker or model access',
  { timeout: 60_000 }, async () => {
    const root = mkdtempSync(join(tmpdir(), 'kivro-openclaw-policy-denial-'));
    const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
      attemptRoot: root });
    const plan = { planVersion: 1, image, networkMode: 'none', readOnlyRoot: true,
      capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin', runAs: '65532:65532',
      maxRuntimeSeconds: 20, memoryMb: 1024, cpu: 1, maxPids: 128,
      maxOutputBytes: 65536 };
    try {
      for (const [index, change] of [
        (config) => { config.agents.defaults.sandbox.mode = 'off'; },
        (config) => { config.agents.defaults.sandbox.backend = 'docker'; },
        (config) => { config.tools.elevated.enabled = true; },
      ].entries()) {
        const attemptId = randomUUID();
        const input = join(root, attemptId, 'input');
        mkdirSync(input, { recursive: true, mode: 0o700 });
        const config = JSON.parse(readFileSync(new URL('./fixtures/openclaw-m07-config.json',
          import.meta.url), 'utf8'));
        config.agents.defaults.sandbox.docker.image = image;
        change(config);
        writeFileSync(join(input, 'config.json'), JSON.stringify(config));
        writeFileSync(join(input, 'message.txt'), `Denied case ${index}`);
        writeFileSync(join(input, 'kivro-run.json'), JSON.stringify({ version: 1,
          modelRef: 'kivro/broker', timeoutSeconds: 10 }));
        const result = await sandbox.run(plan, attemptId, ['run-job']);
        assert.equal(result.exitCode, 65);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
