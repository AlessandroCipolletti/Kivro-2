import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { ReadOnlyOpenClawDiscovery } from '../dist/packages/openclaw-adapter/src/read-only-discovery.js';

const paths = ReadOnlyOpenClawDiscovery.defaultPaths();
const roots = [paths.stateDir, join(paths.homeDir, '.agents', 'skills')];
if (paths.installRoot) roots.push(join(paths.installRoot, 'skills'), join(paths.installRoot, 'custodian-skills'));

async function snapshot() {
  const hash = createHash('sha256');
  let count = 0;
  for (const root of roots) {
    const queue = [root];
    while (queue.length > 0) {
      const current = queue.shift();
      let stat;
      try { stat = await lstat(current); }
      catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }
      if (++count > 100_000) throw new Error('Personal-state metadata snapshot exceeded safety limit');
      hash.update(JSON.stringify([current, stat.mode, stat.size, stat.mtimeMs, stat.ctimeMs]));
      if (stat.isDirectory()) {
        const entries = (await readdir(current)).sort();
        for (const entry of entries) queue.push(join(current, entry));
      }
    }
  }
  return { digest: hash.digest('hex'), count };
}

const before = await snapshot();
const discovery = await new ReadOnlyOpenClawDiscovery(paths).scan();
const after = await snapshot();
assert.deepEqual(after, before, 'OpenClaw personal/package metadata changed during read-only discovery');
assert.ok(discovery.skills.every((skill) => skill.consent === 'not-granted' && skill.readiness === 'unknown'));
process.stdout.write(JSON.stringify({
  result: 'read_only_metadata_unchanged', scannedEntries: before.count,
  skillCandidates: discovery.skills.length, issues: discovery.issues,
}) + '\n');
