import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { verifyStripeWebhook } from '../dist/packages/application/src/stripe-webhook.js';
import { STRIPE_API_VERSION } from '../dist/packages/infrastructure/contracts/src/payment-ports.js';

test('Stripe signatures bind raw bytes, time, mode and pinned event version', () => {
  const now = Math.floor(Date.now()/1000), secret='whsec_testonly123';
  const event = { id:'evt_M08TEST', object:'event', type:'payment_intent.succeeded',
    api_version:STRIPE_API_VERSION, livemode:false, created:now,
    data:{ object:{ id:'pi_M08TEST',object:'payment_intent' } } };
  const raw=Buffer.from(JSON.stringify(event));
  const sign=(body,time=now)=>`t=${time},v1=${createHmac('sha256',secret)
    .update(Buffer.concat([Buffer.from(`${time}.`),body])).digest('hex')}`;
  assert.equal(verifyStripeWebhook(raw,sign(raw),secret,'test',now).objectId,'pi_M08TEST');
  assert.throws(()=>verifyStripeWebhook(Buffer.from(JSON.stringify(event,null,2)),sign(raw),secret,'test',now));
  assert.throws(()=>verifyStripeWebhook(raw,sign(raw,now-301),secret,'test',now));
  assert.throws(()=>verifyStripeWebhook(raw,sign(raw),secret,'live',now));
  assert.throws(()=>verifyStripeWebhook(raw,sign(raw),'whsec_wrong','test',now));
  const old=Buffer.from(JSON.stringify({ ...event,api_version:'2025-01-01.acacia' }));
  assert.throws(()=>verifyStripeWebhook(old,sign(old),secret,'test',now));
});
