import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync,
  symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { removeKnownStagedAttempts,withStagedBuyerInputs } from
  '../dist/apps/worker/src/input-staging.js';

const bytes = Buffer.from('hello buyer file');
const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const origin = 'http://127.0.0.1:9000';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kivro-stage-'));
  const attemptId = randomUUID();
  const assetId = randomUUID();
  const binding = { fieldKey: 'source', assetId, path: `/job/input/source/${assetId}.txt`,
    detectedMimeType: 'text/plain', sizeBytes: bytes.length };
  const options = { attemptRoot: root, attemptId, storageOrigin: origin,
    allowInsecureLoopback: true, maxFileBytes: 1024, maxTotalBytes: 2048, timeoutMs: 5000,
    downloads: [{ binding, expectedSha256: digest,
      signedGetUrl: `${origin}/bucket/private/assets/${assetId}/object?signature=valid` }],
    fetcher: async () => new globalThis.Response(bytes, { headers: { 'content-length': String(bytes.length) } }) };
  return { root, attemptId, assetId, binding, options,
    cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('Worker stages authorized input bytes privately and removes them after consumer exits', async () => {
  const f = fixture();
  try {
    const result = await withStagedBuyerInputs(f.options, async (inputRoot) => {
      assert.equal(readFileSync(join(inputRoot, 'source', `${f.assetId}.txt`), 'utf8'), bytes.toString());
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(existsSync(join(f.root, f.attemptId)), false);
  } finally { f.cleanup(); }
});

test('Worker refuses untrusted storage origins, redirects, tampering and forged input paths', async () => {
  for (const override of [
    { downloads: [{ binding: { fieldKey: 'source', assetId: randomUUID(),
      path: '/job/input/source/../../etc/passwd', detectedMimeType: 'text/plain', sizeBytes: bytes.length },
    expectedSha256: digest, signedGetUrl: `${origin}/x` }] },
    { downloads: [{ binding: null, expectedSha256: digest,
      signedGetUrl: 'https://evil.example/private' }] },
  ]) {
    const f = fixture();
    try {
      const downloads = override.downloads.map((item) => ({ ...item,
        binding: item.binding ?? f.binding }));
      await assert.rejects(withStagedBuyerInputs({ ...f.options, downloads }, async () => undefined));
      assert.equal(existsSync(join(f.root, f.attemptId)), false);
    } finally { f.cleanup(); }
  }
  const f = fixture();
  try {
    await assert.rejects(withStagedBuyerInputs({ ...f.options,
      downloads: [{ ...f.options.downloads[0], expectedSha256: `sha256:${'0'.repeat(64)}` }],
    }, async () => undefined), { code: 'HASH_MISMATCH' });
    assert.equal(existsSync(join(f.root, f.attemptId)), false);
  } finally { f.cleanup(); }
  const g = fixture();
  try {
    await assert.rejects(withStagedBuyerInputs({ ...g.options,
      fetcher: async () => new globalThis.Response(null, { status: 302,
        headers: { location: 'https://evil.example/private' } }),
    }, async () => undefined), { code: 'DOWNLOAD_FAILED' });
    assert.equal(existsSync(join(g.root, g.attemptId)), false);
  } finally { g.cleanup(); }
});

test('crash recovery removes only journaled private attempts and refuses symlink escape',async()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-crash-inputs-'));
  const outside=mkdtempSync(join(tmpdir(),'kivro-crash-outside-'));
  const known=randomUUID(),other=randomUUID(),malicious=randomUUID();
  try{
    mkdirSync(join(root,known),{mode:0o700});
    mkdirSync(join(root,other),{mode:0o700});
    writeFileSync(join(root,known,'buyer.txt'),'private input');
    writeFileSync(join(root,other,'not-this-job.txt'),'other job');
    await removeKnownStagedAttempts(root,[known,known]);
    assert.equal(existsSync(join(root,known)),false);
    assert.equal(readFileSync(join(root,other,'not-this-job.txt'),'utf8'),'other job');
    await assert.rejects(removeKnownStagedAttempts(root,['../escape']));
    symlinkSync(outside,join(root,malicious));
    await assert.rejects(removeKnownStagedAttempts(root,[malicious]),
      {code:'INSECURE_ROOT'});
    assert.equal(existsSync(outside),true);
  }finally{
    rmSync(root,{recursive:true,force:true});
    rmSync(outside,{recursive:true,force:true});
  }
});
