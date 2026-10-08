/* global AbortController */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import { WorkerBrokerRouter } from '../dist/apps/worker/src/broker-router.js';

import {pkg} from './fixtures/worker-package.mjs';

test('seller-selected research tool reaches only its M06 broker and policy', async () => {
  const selected = pkg(['kivro_research_search']);
  const jobId = randomUUID();
  const calls = [];
  const router = new WorkerBrokerRouter(selected, jobId, {
    completion: { async invoke(binding, payload) { calls.push(['completion', binding, payload]);
      return { choices: [] }; } },
    research: { async search(binding, input) { calls.push(['search', binding, input]);
      return { results: [] }; } },
  });
  assert.deepEqual(router.allowedToolNames, ['kivro_research_search', 'kivro_submit_result']);
  const requestId=randomUUID();
  await router.dispatch({ type: 'REQUEST', id: requestId, kind: 'RESEARCH_SEARCH',
    payload: { query: 'company research', maxResults: 2 } }, new AbortController().signal);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].jobId, jobId);
  assert.deepEqual(calls[0][2], { query: 'company research', maxResults: 2,
    requestId });
  await assert.rejects(router.dispatch({ type: 'REQUEST', id: randomUUID(),
    kind: 'RESEARCH_FETCH', payload: { url: 'https://example.com' } },
  new AbortController().signal), { code: 'UNDECLARED_TOOL' });
  await assert.rejects(router.dispatch({ type: 'REQUEST', id: randomUUID(),
    kind: 'DECLARED_API', payload: { connectorId: 'other', input: {} } },
  new AbortController().signal), { code: 'UNDECLARED_TOOL' });
  assert.equal(calls.length, 1);
});

test('discovery, unsupported tools and missing brokers never create consent', () => {
  const discoveredOnly = pkg();
  const router = new WorkerBrokerRouter(discoveredOnly, randomUUID(), { completion: {} });
  assert.deepEqual(router.allowedToolNames, ['kivro_submit_result']);
  assert.throws(() => new WorkerBrokerRouter(pkg(['kivro_research_search']), randomUUID(),
    { completion: {} }), { code: 'BROKER_UNAVAILABLE' });
  assert.throws(() => new WorkerBrokerRouter(pkg(['exec']), randomUUID(),
    { completion: {} }), { code: 'POLICY_MISMATCH' });
  const browserClaim=pkg();browserClaim.permissionPolicy.browser=true;
  assert.throws(() => new WorkerBrokerRouter(browserClaim, randomUUID(),
    { completion: {} }), { code: 'POLICY_MISMATCH' },
  'an unsupported browser declaration cannot pass seller review or job admission');
  assert.throws(() => new WorkerBrokerRouter(pkg(['browser']), randomUUID(),
    { completion: {} }), { code: 'POLICY_MISMATCH' });
  assert.throws(() => new WorkerBrokerRouter(discoveredOnly, randomUUID(),
    { completion: {} }, { inputFiles: true, outputFiles: false }), { code: 'POLICY_MISMATCH' });
});

test('named resource and declared API ports must be bound before a job is admitted',()=>{
  const resource=pkg(['kivro_resource_read']);
  const operation={id:'company_get',schema:'seller_public',table:'company',
    columns:['id'],lookupColumn:'id',maxRows:1};
  resource.permissionPolicy.proprietaryDatabase='READ_ONLY';
  resource.permissionPolicy.localResources=[{resourceId:'company_db',
    statementTimeoutMs:1000,operations:[operation]}];
  resource.permissionPolicy.sellerCredentialRefs.push('seller:company-readonly');
  resource.workerManifest.resources=[{id:'company_db',type:'local-resource-broker',
    permissions:['company_get'],credentialRef:'seller:company-readonly'}];
  resource.dependencyGraph.nodes.push({...resource.dependencyGraph.nodes[0],
    id:'company_db',type:'DATABASE',name:'Company database',selected:true});
  assert.throws(()=>new WorkerBrokerRouter(resource,randomUUID(),{
    completion:{},localResources:new Map()}),{code:'BROKER_UNAVAILABLE'});
  assert.doesNotThrow(()=>new WorkerBrokerRouter(resource,randomUUID(),{
    completion:{},localResources:new Map([['company_db',{}]])}));

  const api=pkg(['kivro_declared_api']);
  const connector={id:'company-api',host:'api.example.com',method:'GET',path:'/lookup',
    maxRequestsPerJob:2,maxRequestBytes:1000,maxResponseBytes:1000};
  api.permissionPolicy.publicInternet='DECLARED_DOMAINS';
  api.permissionPolicy.privateApi='READ_ONLY';
  api.permissionPolicy.internet={version:1,mode:'DECLARED_API_ACCESS',
    connectors:[connector]};
  api.workerManifest.resources=[{id:'company-api',type:'declared-api',permissions:['GET']}];
  api.dependencyGraph.nodes.push({...api.dependencyGraph.nodes[0],
    id:'company-api',type:'PRIVATE_API',name:'Company API',selected:true});
  assert.throws(()=>new WorkerBrokerRouter(api,randomUUID(),{
    completion:{},declaredApi:{hasDeclaredConnector(){return false;}}}),
  {code:'BROKER_UNAVAILABLE'});
  assert.doesNotThrow(()=>new WorkerBrokerRouter(api,randomUUID(),{
    completion:{},declaredApi:{hasDeclaredConnector(value){
      return value.id==='company-api'&&value.host==='api.example.com';}}}));
});
