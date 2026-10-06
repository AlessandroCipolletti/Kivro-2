import assert from 'node:assert/strict';
import test from 'node:test';
import { URL, URLSearchParams } from 'node:url';
import { StripeHttpGateway } from '../dist/packages/infrastructure/stripe/src/gateway.js';
import { STRIPE_API_VERSION } from '../dist/packages/infrastructure/contracts/src/payment-ports.js';

test('Stripe adapter pins API/version/mode and sends stable idempotent credit request', async () => {
  const requests=[];
  const gateway=new StripeHttpGateway('sk_test_fakeforunit','test',async (url,options)=>{
    requests.push({url,options});
    return new globalThis.Response(JSON.stringify({ id:'pi_M08',status:'processing',amount:999,
      currency:'usd',customer:'cus_M08',metadata:{kivro_purchase_id:'00000000-0000-4000-8000-000000000001'},
      livemode:false }),{status:200});
  });
  const intent=await gateway.createCreditPaymentIntent({ customerId:'cus_M08',amountMinor:999,
    purchaseId:'00000000-0000-4000-8000-000000000001',idempotencyKey:'purchase:one:intent' });
  assert.equal(intent.amountMinor,999);
  assert.equal(requests[0].url,'https://api.stripe.com/v1/payment_intents');
  assert.equal(requests[0].options.headers['Stripe-Version'],STRIPE_API_VERSION);
  assert.equal(requests[0].options.headers['Idempotency-Key'],'purchase:one:intent');
  assert.equal(new URLSearchParams(requests[0].options.body).get('metadata[kivro_purchase_id]'),
    '00000000-0000-4000-8000-000000000001');
  assert.throws(()=>new StripeHttpGateway('sk_live_wrong','test',async()=>{}));
  await assert.rejects(gateway.createCreditPaymentIntent({customerId:'cus_M08',amountMinor:9.5,
    purchaseId:'00000000-0000-4000-8000-000000000001',idempotencyKey:'x'}));
});

test('Stripe fee and refund reads validate provider identity, currency and mode', async () => {
  const calls=[];
  const objects={
    '/v1/charges/ch_M08':{id:'ch_M08',payment_intent:'pi_M08',amount:999,
      currency:'usd',balance_transaction:'txn_M08',livemode:false},
    '/v1/balance_transactions/txn_M08':{id:'txn_M08',fee:43,currency:'usd',source:'ch_M08'},
    '/v1/refunds/re_M08':{id:'re_M08',payment_intent:'pi_M08',charge:'ch_M08',
      amount:999,currency:'usd',status:'succeeded'},
    '/v1/refunds':{object:'list',has_more:false,data:[{id:'re_M08',
      payment_intent:'pi_M08',charge:'ch_M08',amount:999,currency:'usd',status:'succeeded'}]},
    '/v1/payouts':{object:'list',has_more:false,data:[{id:'po_M08',amount:800,
      currency:'usd',status:'paid',livemode:false}]},
    '/v1/accounts/acct_M08':{id:'acct_M08',transfers_enabled:true,
      payouts_enabled:true,details_submitted:true,country:'US',
      requirements:{currently_due:[]}},
  };
  const gateway=new StripeHttpGateway('sk_test_fakeforunit','test',async (url,options)=>{
    calls.push({url,options});
    return new globalThis.Response(JSON.stringify(objects[new URL(url).pathname]),{status:200});
  });
  assert.equal((await gateway.retrieveCharge('ch_M08')).balanceTransactionId,'txn_M08');
  assert.equal((await gateway.retrieveBalanceTransaction('txn_M08')).feeMinor,43);
  assert.equal((await gateway.retrieveRefund('re_M08')).status,'succeeded');
  assert.equal((await gateway.listRefunds('pi_M08')).refunds[0].id,'re_M08');
  assert.match(calls[3].url,/payment_intent=pi_M08/);
  assert.equal((await gateway.listPayouts('acct_M08')).payouts[0].status,'paid');
  assert.equal(calls[4].options.headers['Stripe-Account'],'acct_M08');
  assert.equal((await gateway.retrieveConnectAccount('acct_M08')).transfersEnabled,true);
  assert.equal(calls.length,6);
  await assert.rejects(gateway.retrieveRefund('re_../secret'));
  objects['/v1/refunds/re_M08'].payment_intent='forged';
  await assert.rejects(gateway.retrieveRefund('re_M08'));
});
