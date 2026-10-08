import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectE2ePrerequisites } from '../tools/test-m16-e2e-preflight.mjs';
import {inspectStripeE2ePrerequisites} from '../tools/test-m16-stripe-runner.mjs';

test('M16 E2E preflight refuses absent/test-placeholder credentials without printing secrets',()=>{
  const missing=inspectE2ePrerequisites({KIVRO_STRIPE_MODE:'test',
    KIVRO_CONTROL_PLANE_STATE:'ACTIVE',STRIPE_SECRET_KEY:'sk_test_replace_me',
    STRIPE_PUBLISHABLE_KEY:'pk_test_replace_me',
    STRIPE_WEBHOOK_SECRET:'whsec_replace_me'},()=>false);
  assert.ok(missing.includes('STRIPE_SECRET_KEY test mode'));
  assert.ok(missing.includes('Docker Engine'));
  assert.ok(missing.includes('DATABASE_URL'));
  assert.ok(missing.includes('KIVRO_OUTPUT_COLLECTOR_IMAGE'));
  assert.equal(missing.some((item)=>item.includes('sk_test_replace_me')),false);
});

test('M16 preflight rejects collector drift and production mode',()=>{
  const digest=`runtime@sha256:${'a'.repeat(64)}`;
  const env={NODE_ENV:'production',KIVRO_STRIPE_MODE:'test',
    KIVRO_CONTROL_PLANE_STATE:'ACTIVE',STRIPE_SECRET_KEY:'sk_test_valid',
    STRIPE_PUBLISHABLE_KEY:'pk_test_valid',STRIPE_WEBHOOK_SECRET:'whsec_valid',
    DATABASE_URL:'postgres://local',WORKER_DISCOVERY_URL:'https://example.test',
    KIVRO_OPENCLAW_APPROVED_IMAGE:digest,
    KIVRO_OUTPUT_COLLECTOR_IMAGE:`runtime@sha256:${'b'.repeat(64)}`,
    KIVRO_OPENCLAW_APPROVAL_RECORD:'/tmp/approval',
    KIVRO_OPENCLAW_RUNTIME_ROOT:'/tmp/runtime',
    KIVRO_STORAGE_ORIGIN:'https://storage.example.test',
    KIVRO_CONTROL_PLANE_ID:'plane'};
  const missing=inspectE2ePrerequisites(env);
  assert.ok(missing.includes('KIVRO_OUTPUT_COLLECTOR_IMAGE approved digest'));
  assert.ok(missing.includes('non-production test environment'));
});

test('Stripe-backed E2E refuses placeholders without falling back to development credits',()=>{
  const missing=inspectStripeE2ePrerequisites({KIVRO_STRIPE_MODE:'test',
    STRIPE_SECRET_KEY:'sk_test_replace_me',STRIPE_PUBLISHABLE_KEY:'pk_test_replace_me',
    STRIPE_WEBHOOK_SECRET:'whsec_replace_me',NODE_ENV:'development'},()=>true);
  assert.ok(missing.includes('STRIPE_SECRET_KEY test mode'));
  assert.ok(missing.includes('KIVRO_M16_STRIPE_CONNECT_ACCOUNT_ID'));
  assert.equal(missing.some((item)=>item.includes('replace_me')),false);
  assert.deepEqual(inspectStripeE2ePrerequisites({KIVRO_STRIPE_MODE:'test',
    STRIPE_SECRET_KEY:'sk_test_valid123',STRIPE_PUBLISHABLE_KEY:'pk_test_valid123',
    STRIPE_WEBHOOK_SECRET:'whsec_valid123',
    KIVRO_M16_STRIPE_CONNECT_ACCOUNT_ID:'acct_valid123'},()=>true),[]);
});
