import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalOutputPath, parseLocalResultManifest } from '../dist/packages/contracts/src/local-result.js';

test('local result manifest accepts bounded typed fields and portable nested output paths', () => {
  const parsed = parseLocalResultManifest({ schemaVersion: 1, fields: {
    summary: { type: 'MARKDOWN', value: '# Done' },
    renders: { type: 'FILES', paths: ['renders/front.png', 'renders/side.png'] },
  } });
  assert.deepEqual(parsed.fields.renders.paths, ['renders/front.png', 'renders/side.png']);
  assert.equal(canonicalOutputPath('scene/final.blend'), 'scene/final.blend');
});

test('local paths refuse traversal, absolute and ambiguous output references', () => {
  for (const path of ['../secret', 'renders/../secret', '/etc/passwd', 'C:\\private\\file',
    'renders//file.png', './file.png', 'result.json', '.ssh/id_rsa', 'a\0b', 'a/'.repeat(9) + 'x']) {
    assert.throws(() => canonicalOutputPath(path), { name: 'TypeError' }, path);
  }
  assert.throws(() => parseLocalResultManifest({ schemaVersion: 1, fields: {
    files: { type: 'FILES', paths: ['same.png', 'same.png'] },
  } }), { name: 'TypeError' });
  assert.throws(() => parseLocalResultManifest({ schemaVersion: 1, fields: {
    file: { type: 'FILE', path: '../outside' },
  } }), { name: 'TypeError' });
});

test('unknown result fields and oversized manifests are rejected', () => {
  assert.equal(parseLocalResultManifest({ schemaVersion: 1, fields: {} }).schemaVersion, 1);
  assert.throws(() => parseLocalResultManifest({ schemaVersion: 1, fields: {}, extra: true }));
  assert.throws(() => parseLocalResultManifest({ schemaVersion: 1, fields: {
    a: { type: 'FILE', path: 'good.png', hostPath: '/etc/passwd' },
  } }));
  assert.throws(() => parseLocalResultManifest({ schemaVersion: 1, fields: {
    a: { type: 'LONG_TEXT', value: 'x'.repeat(300_000) },
  } }));
});
