/* global URL, Buffer, AbortController */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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

test('approved OpenClaw tool policy writes only a validated bounded deliverable',
  { timeout: 120_000 }, async () => {
    assert.ok(image);
    const root = mkdtempSync(join(tmpdir(), 'kivro-openclaw-file-'));
    const jobId = randomUUID(), attemptId = randomUUID(), versionId = randomUUID();
    const input = join(root, attemptId, 'input');
    mkdirSync(input, { recursive: true, mode: 0o700 });
    const assetId = randomUUID();
    mkdirSync(join(input, 'source'), { mode: 0o755 });
    writeFileSync(join(input, 'source', `${assetId}.txt`), 'buyer input only', { mode: 0o644 });
    const config = JSON.parse(readFileSync(new URL('./fixtures/openclaw-m07-config.json', import.meta.url)));
    config.agents.defaults.sandbox.docker.image = image;
    config.tools.allow = ['kivro_read_input', 'kivro_write_output', 'kivro_submit_result'];
    config.tools.sandbox.tools.allow = [...config.tools.allow];
    writeFileSync(join(input, 'config.json'), JSON.stringify(config));
    writeFileSync(join(input, 'message.txt'), 'Create report.txt and submit it as the result.');
    writeFileSync(join(input, 'kivro-run.json'), JSON.stringify({ version: 1,
      modelRef: 'kivro/broker', timeoutSeconds: 40 }));
    writeFileSync(join(input, 'kivro-files.json'), JSON.stringify({ version: 1, inputs: [{
      fieldKey: 'source', assetId, path: `/job/input/source/${assetId}.txt`, sizeBytes: 16,
    }],
      maxOutputFileBytes: 65536, maxToolCalls: 64 }));
    let inferenceCalls = 0;
    const completion = new SellerCompletionBroker({ async resolve() { return 'synthetic-key'; } },
      { providerId: 'synthetic', async complete(request, credential) {
        assert.equal(credential, 'synthetic-key');
        assert.deepEqual(request.tools.map((tool) => tool.function.name).sort(),
          ['kivro_read_input', 'kivro_submit_result', 'kivro_write_output']);
        inferenceCalls++;
        if (inferenceCalls === 2) {
          assert.ok(request.messages.some((message) => message.role === 'tool' &&
            message.content.includes(Buffer.from('buyer input only').toString('base64'))));
        }
        const invocation = inferenceCalls === 1 ? { name: 'kivro_read_input',
          arguments: JSON.stringify({ fieldKey: 'source', assetId, offset: 0, length: 64 }) } :
          inferenceCalls === 2 ? { name: 'kivro_write_output',
          arguments: JSON.stringify({ name: 'report.txt', offset: 0,
            bytesBase64: Buffer.from('report ready').toString('base64') }) } :
          { name: 'kivro_submit_result', arguments: JSON.stringify({ fields: {
            report: { type: 'FILE', path: 'report.txt' },
          } }) };
        return { id: randomUUID(), object: 'chat.completion', created: Math.floor(Date.now() / 1000),
          model: 'broker', choices: [{ index: 0,
            finish_reason: inferenceCalls < 4 ? 'tool_calls' : 'stop',
            message: inferenceCalls < 4 ? { role: 'assistant', content: null,
              tool_calls: [{ id: `call_${inferenceCalls}`, type: 'function', function: invocation }] } :
              { role: 'assistant', content: 'Submitted.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 } };
      } }, { async reserve() {}, async settle() {} });
    const providerBudget = { providerId: 'synthetic', modelId: 'broker', credentialRef: 'seller:test-only',
      maxRequestsPerJob: 4, maxInputTokensPerRequest: 8192, maxOutputTokensPerRequest: 2048,
      maxEstimatedSpendMicroUsdPerJob: 100_000,
      inputPriceMicroUsdPerMillionTokens: 1_000_000,
      outputPriceMicroUsdPerMillionTokens: 1_000_000 };
    const sidecar = new BrokerSidecar(docker, new DockerJobControlAdapter(docker), jobId, attemptId,
      async () => {}, async (request) => completion.invoke({ jobId,
        capabilityVersionId: versionId, providerBudget,
        allowedToolNames: ['kivro_read_input', 'kivro_write_output', 'kivro_submit_result'] },
      request.payload, request.id, new AbortController().signal));
    const sandbox = new DockerSandboxAdapter({ dockerExecutable: docker, approvedImage: image,
      collectorImage: collector, attemptRoot: root });
    const contract = { schemaVersion: 1, fields: [{ key: 'report', label: 'Report', order: 0,
      required: true, type: 'FILE', constraints: { maxFiles: 1, maxFileSizeBytes: 65536,
        maxTotalSizeBytes: 65536, allowedMimeTypes: ['text/plain'], allowedExtensions: ['.txt'] } }] };
    try {
      const result = await sandbox.runWithOutputControlled({ planVersion: 1, image, networkMode: 'none',
        readOnlyRoot: true, capDrop: ['ALL'], noNewPrivileges: true, seccomp: 'builtin',
        runAs: '65532:65532', maxRuntimeSeconds: 60, memoryMb: 1024, cpu: 1,
        maxPids: 128, maxOutputBytes: 65536 }, attemptId, ['run-job'], contract,
      { maxFileBytes: 65536, maxResultBytes: 65536 }, async (collected) => {
        assert.equal(collected.files[0].relativePath, 'report.txt');
        assert.equal(collected.files[0].detectedMimeType, 'text/plain');
      }, { jobId, async onReady() {}, async onStartPermitted() {},
        async onStarted(id) { await sidecar.start(id); }, async onWatchdogTick() {},
        async onStopped() { await sidecar.close(); } });
      assert.equal(result.exitCode, 0);
        assert.equal(inferenceCalls, 4);
    } finally { await sidecar.close(); rmSync(root, { recursive: true, force: true }); }
  });
