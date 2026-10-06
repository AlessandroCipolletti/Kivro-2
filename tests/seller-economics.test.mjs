import assert from 'node:assert/strict';
import test from 'node:test';
import { sellerPricePreview, sellerJobEconomics } from '../dist/packages/application/src/seller-economics.js';

const price={tier:'USD_999',currency:'USD',buyerAmountMinor:999,platformFeeMinor:199,
  sellerEarningMinor:800};
const budget={providerId:'openai',modelId:'model',credentialRef:'seller:key',maxRequestsPerJob:2,
  maxInputTokensPerRequest:2000,maxOutputTokensPerRequest:1000,
  maxEstimatedSpendMicroUsdPerJob:9_000_000,inputPriceMicroUsdPerMillionTokens:1_000_000,
  outputPriceMicroUsdPerMillionTokens:2_000_000};

test('seller economics labels uncertainty and warns on loss at selected tier',()=>{
  const unknown=sellerPricePreview(price,null,'SELLER');
  assert.equal(unknown.providerCostEvidence,'UNKNOWN');
  assert.equal(unknown.estimatedNetProceedsMinor,null);
  const preview=sellerPricePreview(price,budget,'SELLER');
  assert.equal(preview.maxProviderCostMicroUsd,9_000_000);
  assert.equal(preview.possibleLoss,true);
  assert.equal(preview.sellerProceedsMinor,800);
  const reported=sellerJobEconomics(price,[{reservedMicroUsd:100_000,
    accountedMicroUsd:50_000,measuredCostMicroUsd:null,completed:true}], 'SELLER');
  assert.equal(reported.providerCostEvidence,'ESTIMATED_FROM_USAGE');
  assert.equal(reported.providerCostMicroUsd,50_000);
  const measured=sellerJobEconomics(price,[{reservedMicroUsd:100_000,
    accountedMicroUsd:50_000,measuredCostMicroUsd:60_000,completed:true}], 'SELLER');
  assert.equal(measured.providerCostEvidence,'MEASURED_PROVIDER');
  assert.equal(sellerJobEconomics(price,[],'NONE').providerCostEvidence,'NO_EXTERNAL_AI_COST');
});
