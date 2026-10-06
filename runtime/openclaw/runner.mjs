/* global process, setTimeout, clearTimeout, fetch, AbortSignal, Buffer */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const bin = '/opt/kivro/node_modules/openclaw/openclaw.mjs';
const preload = '/opt/kivro/plugin/index.mjs';
const argv = process.argv.slice(2);
if (argv.length !== 1 || !['--version', 'run-job'].includes(argv[0])) process.exit(64);

async function effectivePolicy(env, selected) {
  const report = await new Promise((resolveReport, rejectReport) => {
    const child = spawn(process.execPath,
      ['--import', preload, bin, 'sandbox', 'explain', '--json'],
      { stdio: ['ignore', 'pipe', 'pipe'], env });
    const chunks = [];
    let size = 0;
    const fail = () => { child.kill('SIGKILL'); rejectReport(new Error('INVALID_SANDBOX_POLICY')); };
    const timer = setTimeout(fail, 10_000);
    child.stdout.on('data', (chunk) => {
      size += chunk.byteLength;
      if (size > 65_536) { fail(); return; }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => { size += chunk.byteLength; if (size > 65_536) fail(); });
    child.on('error', fail);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) { rejectReport(new Error('INVALID_SANDBOX_POLICY')); return; }
      try { resolveReport(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { rejectReport(new Error('INVALID_SANDBOX_POLICY')); }
    });
  });
  const sandbox = report?.sandbox;
  const effective = sandbox?.tools;
  const allowed = new Set(selected);
  if (sandbox?.mode !== 'all' || sandbox?.backend !== 'kivro-contained' ||
    sandbox?.scope !== 'session' || sandbox?.workspaceAccess !== 'none' ||
    sandbox?.sessionIsSandboxed !== true || sandbox?.runtimeWorkdir !== '/job/work' ||
    !Array.isArray(sandbox?.workspaceMounts) || sandbox.workspaceMounts.length !== 0 ||
    report?.elevated?.enabled !== false ||
    !Array.isArray(effective?.allow) || effective.allow.length !== allowed.size ||
    effective.allow.some((name) => !allowed.has(name))) {
    throw new Error('INVALID_SANDBOX_POLICY');
  }
}

if (argv[0] === 'run-job') {
  let settings;
  let config;
  try {
    const bytes = await readFile('/job/input/kivro-run.json');
    if (bytes.byteLength > 4096) throw new Error('LIMIT');
    settings = JSON.parse(bytes.toString('utf8'));
    if (settings?.version !== 1 || typeof settings.modelRef !== 'string' ||
      !/^kivro\/[A-Za-z0-9._:/-]{1,160}$/.test(settings.modelRef) ||
      !Number.isSafeInteger(settings.timeoutSeconds) ||
      settings.timeoutSeconds < 1 || settings.timeoutSeconds > 3600) throw new Error('INVALID');
    const configBytes = await readFile('/job/input/config.json');
    if (configBytes.byteLength > 100_000) throw new Error('LIMIT');
    config = JSON.parse(configBytes.toString('utf8'));
    if (config?.agents?.defaults?.sandbox?.mode !== 'all' ||
      config.agents.defaults.sandbox.backend !== 'kivro-contained' ||
      config.agents.defaults.sandbox.workspaceAccess !== 'none' ||
      !/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/.test(
        config.agents.defaults.sandbox.docker?.image) ||
      config?.tools?.elevated?.enabled !== false ||
      !Array.isArray(config.tools.allow) || config.tools.allow.length < 1 ||
      !Array.isArray(config.tools.sandbox?.tools?.allow) ||
      JSON.stringify(config.tools.allow) !== JSON.stringify(config.tools.sandbox.tools.allow)) {
      throw new Error('INVALID_SANDBOX_POLICY');
    }
  } catch { process.exit(65); }
  let healthy = false;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:8787/health', { signal: AbortSignal.timeout(500) });
      if (response.status === 204) { healthy = true; break; }
    } catch { /* The Worker starts the bridge only after Docker confirms ownership. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!healthy) process.exit(66);
  try {
    await effectivePolicy({
      HOME: '/job/work', PATH: process.env.PATH,
      OPENCLAW_CONFIG_PATH: '/job/input/config.json',
      OPENCLAW_STATE_DIR: '/job/work/.openclaw/state',
      OPENCLAW_LOAD_SHELL_ENV: '0',
    }, config.tools.allow);
  } catch { process.exit(68); }
  argv.splice(0, argv.length, 'agent', 'exec', '--config', '/job/input/config.json',
    '--message-file', '/job/input/message.txt', '--cwd', '/job/work',
    '--model', settings.modelRef, '--code-mode', 'direct', '--json',
    '--timeout', String(settings.timeoutSeconds));
}

const child = spawn(process.execPath,
  [...(argv[0] === '--version' ? [] : ['--import', preload]), bin, ...argv],
  { stdio: 'inherit', env: {
  HOME: '/job/work', PATH: process.env.PATH,
  OPENCLAW_CONFIG_PATH: '/job/input/config.json',
  OPENCLAW_STATE_DIR: '/job/work/.openclaw/state',
  OPENCLAW_LOAD_SHELL_ENV: '0',
} });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', () => process.exit(67));
child.on('close', (code, signal) => process.exit(signal ? 128 + (signal === 'SIGTERM' ? 15 : 2) : code ?? 67));
