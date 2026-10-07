import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { parseWebhookUrl,vettedWebhookAddress,webhookSignature,
  verifyWebhookSignature } from '../dist/packages/application/src/webhook-policy.js';
import { NodePinnedWebhookPost } from
  '../dist/packages/infrastructure/http/src/pinned-webhook-post.js';

test('M13 webhook URLs reject local, metadata, credentials, redirects and uncertain DNS',async()=>{
  for(const raw of ['http://example.com/hook','https://localhost/hook',
    'https://127.0.0.1/hook','https://169.254.169.254/latest/meta-data',
    'https://[::ffff:127.0.0.1]/hook','https://user:pass@example.com/hook',
    'https://example.com:8443/hook','https://example.com/hook#frag',
    'https://worker.internal/hook','https://cloud.local/hook',
    'https://service.example.com/hook']){
    assert.throws(()=>parseWebhookUrl(raw,['service.example.com']),undefined,raw);
  }
  const url=parseWebhookUrl('https://hooks.example.com/receive');
  assert.equal(vettedWebhookAddress(url,['8.8.8.8','1.1.1.1']),'8.8.8.8');
  for(const addresses of [[],['8.8.8.8','10.0.0.1'],['8.8.8.8','169.254.169.254'],
    ['8.8.8.8','::1'],['not-an-address']])
    assert.throws(()=>vettedWebhookAddress(url,addresses));
  const transport=new NodePinnedWebhookPost();
  assert.throws(()=>transport.post({url,pinnedAddress:'127.0.0.1',
    body:Buffer.from('{}'),headers:{},timeoutMs:1000,maxResponseBytes:1024}));
});

test('M13 HMAC signs raw bytes with timestamp and event replay protection',()=>{
  const secret='whsec_test',timestamp=String(Math.floor(Date.now()/1000));
  const raw=Buffer.from('{"id":"evt","data":{"x":1}}');
  const eventId=`evt_${randomUUID()}`;
  const signature=webhookSignature(secret,timestamp,raw);
  assert.equal(verifyWebhookSignature(secret,timestamp,raw,signature,eventId,new Set()),true);
  assert.equal(verifyWebhookSignature(secret,timestamp,Buffer.from('{}'),signature,eventId,new Set()),false);
  assert.equal(verifyWebhookSignature(secret,timestamp,raw,signature,eventId,new Set([eventId])),false);
  assert.equal(verifyWebhookSignature(secret,String(Number(timestamp)-301),raw,signature,
    eventId,new Set()),false);
  assert.equal(verifyWebhookSignature('wrong',timestamp,raw,signature,eventId,new Set()),false);
});
