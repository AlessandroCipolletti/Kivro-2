import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LAUNCH_PRICE_TIERS } from '../dist/packages/contracts/src/pricing.js';

test('offline seller launch-tier reference matches the authoritative PostgreSQL seed',()=>{
  const sql=readFileSync('packages/persistence/migrations/0015_finance.sql','utf8');
  const seed=sql.match(/INSERT INTO marketplace_price_tiers\([\s\S]*?;/)?.[0];
  assert.ok(seed);
  const rows=[...seed.matchAll(/\('(?<tier>USD_\d+)',(?<buyer>\d+),(?<fee>\d+),(?<seller>\d+),\d+\)/g)]
    .map((match)=>({tier:match.groups.tier,buyerAmountMinor:Number(match.groups.buyer),
      platformFeeMinor:Number(match.groups.fee),sellerEarningMinor:Number(match.groups.seller)}));
  assert.deepEqual(LAUNCH_PRICE_TIERS.map(({tier,buyerAmountMinor,
    platformFeeMinor,sellerEarningMinor})=>({tier,buyerAmountMinor,
      platformFeeMinor,sellerEarningMinor})),rows);
});
