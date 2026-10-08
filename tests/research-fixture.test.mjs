import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';
import { InternetPolicySchema } from '../dist/packages/contracts/src/internet-policy.js';
import { CapabilityIOContractSchema } from '../dist/packages/contracts/src/capability-io.js';
import { validateInputPayload } from '../dist/packages/contracts/src/contract-values.js';

test('canonical video-ad fixture combines public research and a private video skill without granting arbitrary action', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/m06-advertising-capability.json', import.meta.url), 'utf8'));
  assert.equal(InternetPolicySchema.safeParse(fixture.internetPolicy).success, true);
  assert.equal(CapabilityIOContractSchema.safeParse(fixture.ioContract).success, true);
  assert.equal(fixture.ioContract.input.fields[0].key, 'companyName');
  assert.equal(fixture.ioContract.input.fields[0].type,'SHORT_TEXT');
  assert.equal(fixture.ioContract.input.fields[0].required,true);
  assert.equal(validateInputPayload(fixture.ioContract.input,{values:{companyName:'Acme'},
    assets:{}}).values.companyName,'Acme');
  assert.throws(()=>validateInputPayload(fixture.ioContract.input,{values:{},assets:{}}),
    {code:'MISSING_FIELD',field:'companyName'});
  assert.equal(fixture.ioContract.output.fields[0].key, 'videoAd');
  assert.equal(fixture.internetPolicy.mode, 'PUBLIC_WEB_RESEARCH');
  assert.equal(fixture.internetPolicy.download.enabled, true);
  assert.equal('arbitraryHttp' in fixture.internetPolicy, false);
});
