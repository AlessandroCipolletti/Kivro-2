import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { FinancialSnapshotSchema, purchaseMovements, reserveMovements, releaseMovements,
  settleMovements, refundMovements, assertFinancialTransition } from '../dist/packages/application/src/finance-policy.js';

test('M08 finance plans balance exactly in integer minor units', () => {
  const buyer = randomUUID(), seller = randomUUID();
  const snapshot = { tier: 'USD_999', currency: 'USD', buyerAmountMinor: 999,
    platformFeeMinor: 199, sellerEarningMinor: 800, taxMinor: 0, buyerTotalMinor: 999 };
  assert.deepEqual(FinancialSnapshotSchema.parse(snapshot), snapshot);
  for (const plan of [purchaseMovements(buyer, 2000), reserveMovements(buyer, 999),
    releaseMovements(buyer, 999), settleMovements(buyer,seller,snapshot),
    refundMovements(buyer,seller,snapshot,'pending')]) {
    assert.equal(plan.reduce((sum,item) => sum+item.amountMinor,0), 0);
    assert.ok(plan.every((item) => Number.isSafeInteger(item.amountMinor)));
  }
  assert.deepEqual(settleMovements(buyer,seller,{ ...snapshot,taxMinor:100,
    buyerTotalMinor:1099 }).map((m)=>m.amountMinor),[-1099,800,199,100]);
  assert.throws(() => FinancialSnapshotSchema.parse({ ...snapshot,platformFeeMinor:200 }));
  assert.throws(() => FinancialSnapshotSchema.parse({ ...snapshot,buyerAmountMinor:999.5 }));
  assert.throws(() => reserveMovements(buyer,Number.MAX_SAFE_INTEGER));
  assert.throws(() => reserveMovements(buyer,0));
  assertFinancialTransition('RESERVED','SETTLED');
  assertFinancialTransition('SETTLED','REFUNDED');
  assert.throws(()=>assertFinancialTransition('RELEASED','SETTLED'));
});
