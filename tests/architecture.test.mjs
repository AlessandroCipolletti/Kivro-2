import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { architectureViolations, forbiddenImports, openClawBoundaryViolations } from '../tools/architecture.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('shared packages do not import provider adapters or provider SDKs', () => {
  assert.deepEqual(architectureViolations(root), []);
});

test('both provider profile locations exist as structural shells', () => {
  for (const path of ['apps/cloud-netsons', 'apps/cloud-aws', 'packages/infrastructure/netsons', 'packages/infrastructure/aws']) {
    assert.ok(existsSync(join(root, path)));
    assert.ok(JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')).name.startsWith('@kivro/'));
  }
});

test('drift canary rejects a provider import in shared code', () => {
  assert.deepEqual(forbiddenImports('import { Client } from "@aws-sdk/client-s3";'), ['@aws-sdk/client-s3']);
  assert.deepEqual(forbiddenImports('import { createJob } from "../infrastructure/netsons/job.js";'), ['../infrastructure/netsons/job.js']);
  assert.deepEqual(forbiddenImports('import "aws-sdk";'), ['aws-sdk']);
  assert.deepEqual(forbiddenImports('type S3 = import("@aws-sdk/client-s3").S3Client;'), ['@aws-sdk/client-s3']);
  assert.deepEqual(forbiddenImports('import { storage } from "../infrastructure/s3/src/storage.js";'),
    ['../infrastructure/s3/src/storage.js']);
});

test('OpenClaw stays external and runtime access stays behind the adapter', () => {
  assert.equal(existsSync(join(root, 'openclaw')), false, 'Do not vendor an OpenClaw fork');
  assert.deepEqual(openClawBoundaryViolations(root), []);
});
