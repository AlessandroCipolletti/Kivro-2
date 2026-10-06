import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hashOpenClawRuntimeSource } from '../dist/packages/openclaw-adapter/src/image-approval.js';

const root = resolve(import.meta.dirname, '..');
const runtime = join(root, 'runtime/openclaw');
const outputDir = join(root, '.local/worker');
const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
// No record is written unless every real Docker and OpenClaw conformance check exits zero.
execFileSync('pnpm', ['test:openclaw:execution'], { cwd: root, stdio: 'inherit', timeout: 300_000 });
const digests = JSON.parse(execFileSync(docker,
  ['image', 'inspect', 'kivro-openclaw-runtime:m07', '--format', '{{json .RepoDigests}}'],
  { encoding: 'utf8', timeout: 10_000 }));
const image = digests.find((item) => item.startsWith('kivro-openclaw-runtime@sha256:'));
if (!image) throw new Error('No repository image digest after conformance');
const record = { schemaVersion: 1, image, openClawVersion: '2026.8.2',
  runtimeSourceHash: await hashOpenClawRuntimeSource(runtime),
  conformanceSuite: 'm07-openclaw-execution/1',
  conformancePassedAt: new Date().toISOString() };
mkdirSync(outputDir, { recursive: true, mode: 0o700 });
const temp = join(outputDir, `openclaw-image-approval.${process.pid}.tmp`);
writeFileSync(temp, JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
renameSync(temp, join(outputDir, 'openclaw-image-approval.json'));
process.stdout.write(`${image}\n`);
