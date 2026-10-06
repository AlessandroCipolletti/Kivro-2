/* global fetch, AbortSignal, Buffer, process */
import { Type } from 'typebox';
import { defineToolPlugin } from 'openclaw/plugin-sdk/tool-plugin';
import { registerSandboxBackend } from 'openclaw/plugin-sdk/sandbox';
import { constants } from 'node:fs';
import { open, readFile, writeFile } from 'node:fs/promises';

// The Worker has already created and inspected the one per-job Docker container.
// OpenClaw's mandatory sandbox mode uses that verified container as its backend;
// it must never receive a host Docker socket or create a nested privileged one.
registerSandboxBackend('kivro-contained', {
  async factory({ cfg, sessionKey }) {
    if (cfg.mode !== 'all' || cfg.backend !== 'kivro-contained' ||
      cfg.workspaceAccess !== 'none' || cfg.docker.network !== 'none' ||
      cfg.docker.readOnlyRoot !== true ||
      !/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/.test(cfg.docker.image) ||
      cfg.docker.capDrop?.length !== 1 || cfg.docker.capDrop[0] !== 'ALL' ||
      cfg.docker.binds?.length || process.getuid?.() !== 65532) {
      throw new Error('KIVRO_SANDBOX_POLICY_MISMATCH');
    }
    const response = await fetch('http://127.0.0.1:8787/health', {
      signal: AbortSignal.timeout(1000),
    });
    if (response.status !== 204) throw new Error('KIVRO_SANDBOX_NOT_ATTESTED');
    return {
      id: 'kivro-contained', runtimeId: sessionKey,
      runtimeLabel: 'Kivro verified per-job Docker container', workdir: '/job/work',
      async buildExecSpec() { throw new Error('KIVRO_SHELL_DENIED'); },
      async runShellCommand() { throw new Error('KIVRO_SHELL_DENIED'); },
    };
  },
  resolveWorkdir() { return '/job/work'; },
});

const routes = [
  ['kivro_research_search', '/broker/research/search', Type.Object({
    query: Type.String({ minLength: 2, maxLength: 256 }),
    maxResults: Type.Integer({ minimum: 1, maximum: 20 }),
  })],
  ['kivro_research_fetch', '/broker/research/fetch', Type.Object({
    url: Type.String({ minLength: 8, maxLength: 2048 }),
  })],
  ['kivro_research_download', '/broker/research/download', Type.Object({
    url: Type.String({ minLength: 8, maxLength: 2048 }),
  })],
  ['kivro_resource_read', '/broker/resource/read', Type.Object({
    resourceId: Type.String({ minLength: 1, maxLength: 160 }),
    operationId: Type.String({ minLength: 1, maxLength: 160 }),
    lookup: Type.String({ minLength: 1, maxLength: 160 }),
  })],
  ['kivro_declared_api', '/broker/declared-api/invoke', Type.Object({
    connectorId: Type.String({ minLength: 1, maxLength: 160 }),
    input: Type.Record(Type.String(), Type.Unknown()),
  })],
];

async function invoke(path, params) {
  const response = await fetch(`http://127.0.0.1:8787${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('KIVRO_BROKER_DENIED');
  const text = await response.text();
  if (Buffer.byteLength(text) > 2_097_152) throw new Error('KIVRO_BROKER_LIMIT');
  return JSON.parse(text);
}

let filePolicy;
async function allowedFiles() {
  if (filePolicy) return filePolicy;
  const raw = await readFile('/job/input/kivro-files.json', 'utf8');
  if (Buffer.byteLength(raw) > 32_768) throw new Error('KIVRO_FILE_POLICY_INVALID');
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !Array.isArray(parsed.inputs) ||
    !Number.isSafeInteger(parsed.maxOutputFileBytes) || parsed.maxOutputFileBytes < 1) {
    throw new Error('KIVRO_FILE_POLICY_INVALID');
  }
  filePolicy = parsed;
  return parsed;
}

function outputName(value) {
  if (typeof value !== 'string' || value === 'result.json' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) || value === '.' || value === '..') {
    throw new Error('KIVRO_OUTPUT_PATH_DENIED');
  }
  return value;
}

const outputLocks = new Map();
async function appendOutput({ name, offset, bytesBase64 }) {
  const filename = outputName(name);
  if (!Number.isSafeInteger(offset) || offset < 0 || typeof bytesBase64 !== 'string' ||
    bytesBase64.length > 90_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bytesBase64)) {
    throw new Error('KIVRO_OUTPUT_INVALID');
  }
  const bytes = Buffer.from(bytesBase64, 'base64');
  if (!bytes.length || bytes.length > 65_536) throw new Error('KIVRO_OUTPUT_LIMIT');
  const prior = outputLocks.get(filename) ?? Promise.resolve();
  const work = prior.catch(() => {}).then(async () => {
    const policy = await allowedFiles();
    if (offset + bytes.length > policy.maxOutputFileBytes) throw new Error('KIVRO_OUTPUT_LIMIT');
    const path = `/job/output/${filename}`;
    const file = await open(path, constants.O_WRONLY | constants.O_NOFOLLOW |
      (offset === 0 ? constants.O_CREAT | constants.O_EXCL : constants.O_APPEND), 0o600);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== offset) {
        throw new Error('KIVRO_OUTPUT_CONFLICT');
      }
      let position = 0;
      while (position < bytes.length) {
        const wrote = await file.write(bytes, position, bytes.length - position);
        if (wrote.bytesWritten <= 0) throw new Error('KIVRO_OUTPUT_FAILED');
        position += wrote.bytesWritten;
      }
      return { path: filename, sizeBytes: offset + bytes.length };
    } finally { await file.close(); }
  });
  outputLocks.set(filename, work);
  try { return await work; }
  finally { if (outputLocks.get(filename) === work) outputLocks.delete(filename); }
}

export default defineToolPlugin({
  id: 'kivro-broker', name: 'Kivro Broker Tools',
  description: 'Worker-mediated, job-scoped research and resource operations',
  configSchema: Type.Object({}, { additionalProperties: false }),
  tools: (tool) => [
    ...routes.map(([name, path, parameters]) => tool({ name, label: name,
      description: 'Use the seller-approved Kivro operation',
      parameters, async execute(params) { return invoke(path, params); } })),
    tool({ name: 'kivro_submit_result', label: 'Submit Kivro result',
      description: 'Submit the final result against the published output contract',
      parameters: Type.Object({ fields: Type.Record(Type.String(), Type.Unknown()) }),
      async execute(params) {
        if (!params.fields || typeof params.fields !== 'object' || Array.isArray(params.fields) ||
          Object.keys(params.fields).length > 64 ||
          Object.keys(params.fields).some((key) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(key))) {
          throw new Error('KIVRO_RESULT_INVALID');
        }
        const result = JSON.stringify({ schemaVersion: 1, fields: params.fields });
        if (Buffer.byteLength(result) > 262_144) throw new Error('KIVRO_RESULT_LIMIT');
        await writeFile('/job/output/result.json', result, { flag: 'wx', mode: 0o600 });
        return { submitted: true };
      },
    }),
    tool({ name: 'kivro_read_input', label: 'Read a selected buyer input file',
      description: 'Read a bounded byte range of a declared staged buyer file',
      parameters: Type.Object({ fieldKey: Type.String(), assetId: Type.String(),
        offset: Type.Integer({ minimum: 0 }), length: Type.Integer({ minimum: 1, maximum: 65_536 }) }),
      async execute(params) {
        const policy = await allowedFiles();
        const file = policy.inputs.find((item) => item.fieldKey === params.fieldKey &&
          item.assetId === params.assetId);
        if (!file || typeof file.path !== 'string' || !/^\/job\/input\/[A-Za-z][A-Za-z0-9_]*\/[0-9a-f-]{36}\.[a-z0-9]{1,16}$/.test(file.path) ||
          !Number.isSafeInteger(file.sizeBytes) || params.offset > file.sizeBytes) {
          throw new Error('KIVRO_INPUT_DENIED');
        }
        const handle = await open(file.path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.nlink !== 1 || stat.size !== file.sizeBytes) {
            throw new Error('KIVRO_INPUT_CHANGED');
          }
          const length = Math.min(params.length, file.sizeBytes - params.offset);
          const buffer = Buffer.alloc(length);
          const read = await handle.read(buffer, 0, length, params.offset);
          return { bytesBase64: buffer.subarray(0, read.bytesRead).toString('base64'),
            offset: params.offset, sizeBytes: file.sizeBytes, eof: params.offset + read.bytesRead >= file.sizeBytes };
        } finally { await handle.close(); }
      },
    }),
    tool({ name: 'kivro_write_output', label: 'Write a deliverable file',
      description: 'Append a bounded byte chunk to a named output file',
      parameters: Type.Object({ name: Type.String(), offset: Type.Integer({ minimum: 0 }),
        bytesBase64: Type.String() }),
      async execute(params) { return appendOutput(params); },
    }),
  ],
});
