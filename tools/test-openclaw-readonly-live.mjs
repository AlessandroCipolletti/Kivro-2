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
  const entries = new Map();
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
      const metadata = JSON.stringify([stat.mode, stat.size, stat.mtimeMs, stat.ctimeMs]);
      hash.update(JSON.stringify([current, metadata]));
      entries.set(current, metadata);
      if (stat.isDirectory()) {
        const entries = (await readdir(current)).sort();
        for (const entry of entries) queue.push(join(current, entry));
      }
    }
  }
  return { digest: hash.digest('hex'), count, entries };
}

const baselineA=await snapshot();
const baselineB=await snapshot();
const before = await snapshot();
const discovery = await new ReadOnlyOpenClawDiscovery(paths).scan();
const after = await snapshot();
const changed=[];
for(const [path,metadata] of before.entries){
  if(after.entries.get(path)!==metadata)changed.push({
    pathDigest:createHash('sha256').update(path).digest('hex').slice(0,16),
    root:roots.findIndex((root)=>path.startsWith(root)),
    directoryClass:path.slice(paths.stateDir.length).split('/').slice(1,4).join('/'),
    before:metadata,after:after.entries.get(path),
    removed:!after.entries.has(path)});
}
for(const path of after.entries.keys())if(!before.entries.has(path))changed.push({
  pathDigest:createHash('sha256').update(path).digest('hex').slice(0,16),
  root:roots.findIndex((root)=>path.startsWith(root)),added:true});
assert.deepEqual({digest:after.digest,count:after.count},
  {digest:before.digest,count:before.count},
  `OpenClaw personal/package metadata changed during read-only discovery; `+
  `ambientDrift=${baselineA.digest!==baselineB.digest}; changed=${JSON.stringify(changed.slice(0,12))}`);
assert.ok(discovery.skills.every((skill) => skill.consent === 'not-granted' && skill.readiness === 'unknown'));
process.stdout.write(JSON.stringify({
  result: 'read_only_metadata_unchanged', scannedEntries: before.count,
  skillCandidates: discovery.skills.length, issues: discovery.issues,
}) + '\n');
