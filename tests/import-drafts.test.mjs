import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { SellerImportDraftStore } from '../dist/apps/worker/src/import-drafts.js';

const seller = '11111111-1111-4111-8111-111111111111';
const otherSeller = '99999999-9999-4999-8999-999999999999';
const draftId = '22222222-2222-4222-8222-222222222222';
const worker = '33333333-3333-4333-8333-333333333333';
const version = '44444444-4444-4444-8444-444444444444';
const manifestHash = `sha256:${'a'.repeat(64)}`;

function graph() {
  const node = (id, type, dependsOn = []) => ({
    id, type, name: id, requirement: 'REQUIRED', sensitivity: 'MEDIUM',
    discoveredFrom: ['SKILL_METADATA'], dependsOn, marketplaceSupport: 'UNDETERMINED',
    confidence: 'CONFIRMED', selected: false, health: 'UNKNOWN',
  });
  return { graphVersion: 1, rootId: 'research', inference: null,
    nodes: [node('research', 'SKILL', ['company-db']), node('company-db', 'DATABASE')] };
}

function state() {
  const dir = mkdtempSync(join(tmpdir(), 'kivro-import-draft-'));
  return { dir, cleanup() { rmSync(dir, { recursive: true, force: true }); } };
}

test('seller-local drafts persist explicit one-node selections and reject stale or changed replays', () => {
  const f = state();
  try {
    let store = new SellerImportDraftStore(f.dir);
    const initial = store.createDraft(draftId, seller, graph());
    assert.equal(initial.revision, 0);
    assert.ok(initial.graph.nodes.every((item) => item.selected === false));
    const action = { actionId: '55555555-5555-4555-8555-555555555555', draftId,
      sellerAccountId: seller, dependencyId: 'research', selected: true, expectedRevision: 0,
      actedAt: '2026-10-06T00:00:00.000Z' };
    const selected = store.applySelection(action);
    assert.equal(selected.revision, 1);
    assert.deepEqual(selected.graph.nodes.filter((item) => item.selected).map((item) => item.id), ['research']);
    assert.deepEqual(store.applySelection(action), selected, 'Identical replay returns the original outcome');
    assert.throws(() => store.applySelection({ ...action, selected: false }), { code: 'CONFLICT' });
    assert.throws(() => store.applySelection({ ...action, actionId: '66666666-6666-4666-8666-666666666666' }), { code: 'CONFLICT' });
    assert.throws(() => store.getDraft(draftId, otherSeller), { code: 'NOT_FOUND' });
    assert.equal(store.createDraft(draftId, seller, graph()).revision, 1, 'Creation replay must not reset selections');
    store.close();
    store = new SellerImportDraftStore(f.dir);
    assert.deepEqual(store.getDraft(draftId, seller), selected);
    store.close();
    assert.equal(lstatSync(join(f.dir, 'import.sqlite')).mode & 0o077, 0);
  } finally { f.cleanup(); }
});

test('discovered imports cannot arrive preselected or with an inferred inference grant', () => {
  const f = state();
  try {
    const store = new SellerImportDraftStore(f.dir);
    const selected = graph(); selected.nodes[0].selected = true;
    assert.throws(() => store.createDraft(draftId, seller, selected), { code: 'INVALID_ARGUMENT' });
    const inferred = graph(); inferred.inference = { mode: 'LOCAL', dependencyId: 'research',
      provider: 'local', model: 'unverified', billingOwner: 'SELLER' };
    assert.throws(() => store.createDraft(draftId, seller, inferred), { code: 'INVALID_ARGUMENT' });
    store.close();
  } finally { f.cleanup(); }
});

test('seller inference choice adds unselected local candidates and survives restart without touching discovery', () => {
  const f = state();
  try {
    let store = new SellerImportDraftStore(f.dir);
    store.createDraft(draftId, seller, graph());
    const action = { actionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', draftId,
      sellerAccountId: seller, expectedRevision: 0,
      actedAt: '2026-10-06T00:00:00.000Z', mode: 'REMOTE_PROVIDER',
      provider: 'anthropic', model: 'claude-test', credentialRef: 'seller:anthropic' };
    const configured = store.configureInference(action);
    assert.equal(configured.revision, 1);
    assert.equal(configured.graph.inference.mode, 'REMOTE_PROVIDER');
    assert.equal(configured.graph.inference.billingOwner, 'SELLER');
    const declared = configured.graph.nodes.filter((node) =>
      node.discoveredFrom.includes('SELLER_DECLARATION'));
    assert.deepEqual(declared.map((node) => node.type).sort(),
      ['AI_MODEL', 'AI_PROVIDER', 'CREDENTIAL']);
    assert.ok(declared.every((node) => node.selected === false && node.health === 'UNKNOWN' &&
      node.marketplaceSupport === 'UNDETERMINED'));
    assert.ok(configured.graph.nodes[0].dependsOn.includes(configured.graph.inference.dependencyId));
    assert.deepEqual(store.configureInference(action), configured,
      'Lost acknowledgement replay returns the committed result');
    assert.throws(() => store.configureInference({ ...action, model: 'different' }), { code: 'CONFLICT' });
    assert.throws(() => store.configureInference({ ...action,
      actionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', expectedRevision: 1 }),
    { code: 'CONFLICT' }, 'A new inference route requires a separately reviewed draft');
    assert.throws(() => store.configureInference({ ...action,
      actionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', sellerAccountId: otherSeller }),
    { code: 'NOT_FOUND' });
    store.close();
    store = new SellerImportDraftStore(f.dir);
    assert.deepEqual(store.getDraft(draftId, seller), configured);
    store.close();
    const db = new DatabaseSync(join(f.dir, 'import.sqlite'));
    assert.throws(() => db.prepare('DELETE FROM import_inference_actions WHERE action_id = ?')
      .run(action.actionId), /append-only/);
    db.close();
  } finally { f.cleanup(); }
});

test('local inference requires an explicit endpoint candidate, never an inferred personal service grant', () => {
  const f = state();
  try {
    const store = new SellerImportDraftStore(f.dir);
    store.createDraft(draftId, seller, graph());
    const configured = store.configureInference({ actionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      draftId, sellerAccountId: seller, expectedRevision: 0,
      actedAt: '2026-10-06T00:00:00.000Z', mode: 'LOCAL', provider: 'ollama',
      model: 'local-test', endpointRef: 'seller:ollama' });
    assert.equal(configured.graph.inference.mode, 'LOCAL');
    assert.ok(configured.graph.nodes.some((node) => node.id ===
      configured.graph.inference.endpointRef && node.type === 'LOCAL_SERVICE' && !node.selected));
    store.close();
  } finally { f.cleanup(); }
});

test('seller resource declaration persists as an unselected, replay-safe local candidate',()=>{
  const f=state();
  try{
    let store=new SellerImportDraftStore(f.dir);
    store.createDraft(draftId,seller,graph());
    const action={actionId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',draftId,
      sellerAccountId:seller,expectedRevision:0,
      actedAt:'2026-10-06T00:00:00.000Z',resourceId:'customer_api',
      name:'Customer read API',type:'PRIVATE_API'};
    const declared=store.declareResource(action);
    assert.equal(declared.revision,1);
    assert.equal(declared.graph.nodes.find((node)=>node.id==='customer_api').selected,false);
    assert.ok(declared.graph.nodes.find((node)=>node.id==='research')
      .dependsOn.includes('customer_api'));
    assert.deepEqual(store.declareResource(action),declared);
    assert.throws(()=>store.declareResource({...action,name:'changed'}),{code:'CONFLICT'});
    assert.throws(()=>store.declareResource({...action,actionId:'ffffffff-ffff-4fff-8fff-ffffffffffff'}),
      {code:'CONFLICT'});
    store.close();store=new SellerImportDraftStore(f.dir);
    assert.deepEqual(store.getDraft(draftId,seller),declared);
    assert.throws(()=>store.getDraft(draftId,otherSeller),{code:'NOT_FOUND'});
    store.close();
    const db=new DatabaseSync(join(f.dir,'import.sqlite'));
    assert.throws(()=>db.prepare('DELETE FROM import_resource_actions WHERE action_id=?')
      .run(action.actionId),/append-only/);
    db.close();
  }finally{f.cleanup();}
});

test('consent is immutable, idempotent and visible only through seller-scoped queries', () => {
  const f = state();
  try {
    const store = new SellerImportDraftStore(f.dir);
    store.createDraft(draftId, seller, graph());
    store.applySelection({ actionId: '55555555-5555-4555-8555-555555555555', draftId,
      sellerAccountId: seller, dependencyId: 'research', selected: true, expectedRevision: 0,
      actedAt: '2026-10-06T00:00:00.000Z' });
    const consent = { sellerAccountId: seller, workerDeviceId: worker,
      capabilityVersionId: version, dependencyId: 'research', permissionType: 'SKILL',
      permissionValueRef: 'research', approvedAt: '2026-10-06T00:00:00.000Z',
      manifestHash, source: 'SELLER_ACTION' };
    const consentId = '77777777-7777-4777-8777-777777777777';
    assert.deepEqual(store.recordConsent(consentId, seller, consent), consent);
    assert.deepEqual(store.recordConsent(consentId, seller, consent), consent);
    assert.throws(() => store.recordConsent(consentId, seller, { ...consent,
      manifestHash: `sha256:${'b'.repeat(64)}` }), { code: 'CONFLICT' });
    assert.throws(() => store.recordConsent('88888888-8888-4888-8888-888888888888', otherSeller, consent),
      { code: 'NOT_FOUND' });
    assert.deepEqual(store.consentsForVersion(seller, version), [consent]);
    assert.deepEqual(store.consentsForVersion(otherSeller, version), []);
    store.close();
    const db = new DatabaseSync(join(f.dir, 'import.sqlite'));
    assert.throws(() => db.prepare('DELETE FROM import_permission_consents WHERE id = ?').run(consentId),
      /append-only/);
    assert.throws(() => db.prepare('UPDATE import_permission_consents SET payload_hash = payload_hash WHERE id = ?').run(consentId),
      /append-only/);
    assert.throws(() => db.prepare('DELETE FROM import_selection_actions WHERE action_id = ?')
      .run('55555555-5555-4555-8555-555555555555'), /append-only/);
    db.close();
  } finally { f.cleanup(); }
});
