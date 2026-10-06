import assert from 'node:assert/strict';
import test from 'node:test';
import { handleStripeWebhook } from '../dist/apps/web/src/payments/webhook-handler.js';

test('webhook endpoint preserves raw bytes and retries persistence failures',async()=>{
  const body=' {"id":"evt_1"} ';let received;
  const service={webhookSecret:'whsec_example',repository:{
    async receiveStripeWebhook(raw,header){received={raw:raw.toString('utf8'),header};return 'evt_1';}
  }};
  const request=()=>new globalThis.Request('https://kivro.example/api/stripe/webhook',{
    method:'POST',headers:{'stripe-signature':'t=123,v1=abc','content-type':'application/json'},
    body});
  assert.equal((await handleStripeWebhook(request(),service)).status,200);
  assert.deepEqual(received,{raw:body,header:'t=123,v1=abc'});
  const invalid=new globalThis.Request('https://kivro.example/api/stripe/webhook',{
    method:'POST',headers:{'content-type':'application/json'},body});
  assert.equal((await handleStripeWebhook(invalid,service)).status,400);
  const unavailable={...service,repository:{async receiveStripeWebhook(){throw new Error('database down');}}};
  assert.equal((await handleStripeWebhook(request(),unavailable)).status,500);
});
