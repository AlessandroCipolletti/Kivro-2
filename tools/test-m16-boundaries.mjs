#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const allSteps = [
  ['typecheck', ['typecheck']],
  ['lint-and-architecture', ['lint']],
  ['unit-and-boundary', ['test']],
  ['web-build', ['--filter', '@kivro/web', 'build']],
  ...['m01', 'm02', 'm03', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13', 'm15']
    .map((name) => [`postgres-${name}`, [`test:postgres:${name}`]]),
  ['docker-sandbox', ['test:sandbox:docker']],
  ['docker-output', ['test:sandbox:output']],
  ['docker-control', ['test:sandbox:job-control']],
  ['output-storage', ['test:output:storage']],
  ['openclaw-execution', ['test:openclaw:execution']],
  ['core-worker-slice', ['test:core-worker:m16']],
  ['object-storage', ['test:storage:seaweedfs']],
  ['object-storage-minio', ['test:storage:minio']],
  ...['m10', 'm12', 'm13'].map((name) => [`browser-${name}`, [`test:browser:${name}`]]),
];
const only = process.argv[2] === '--only' ? new Set(process.argv.slice(3)) : null;
if (process.argv[2] && process.argv[2] !== '--only') throw new Error('USAGE: --only <step>...');
const steps = only ? allSteps.filter(([name]) => only.has(name)) : allSteps;
if (only && (steps.length !== only.size || steps.length === 0))
  throw new Error('UNKNOWN_OR_EMPTY_STEP');

function run(args) {
  return new Promise((done) => {
    const child = spawn('pnpm', args, { cwd: root, stdio: 'inherit', env: process.env });
    child.once('error', (error) => done({ exitCode: null, error: error.message }));
    child.once('exit', (code, signal) => done({ exitCode: code, signal }));
  });
}

const results = [];
for (const [name, args] of steps) {
  process.stdout.write(`\n[M16 component boundary] ${name}: pnpm ${args.join(' ')}\n`);
  const startedAt = new Date().toISOString();
  const outcome = await run(args);
  results.push({ name, command: ['pnpm', ...args], startedAt,
    completedAt: new Date().toISOString(), ...outcome });
}
const report = { schemaVersion: 1, evidenceClass: 'COMPONENT_ONLY',
  warning: 'Passing this suite does not prove paid two-user E2E, Stripe test-mode purchase, production Worker composition or both-provider conformance.',
  results };
const path = resolve(process.env.KIVRO_M16_EVIDENCE_PATH ?? '/tmp/kivro-m16-boundaries.json');
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`\nM16 component evidence: ${path}\n`);
if (results.some((item) => item.exitCode !== 0)) process.exitCode = 1;
