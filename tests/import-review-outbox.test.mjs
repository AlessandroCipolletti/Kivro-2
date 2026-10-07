import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WorkerImportReviewOutbox } from
  '../dist/apps/worker/src/import-review-outbox.js';
import { WorkerCapabilityPackageStore } from
  '../dist/apps/worker/src/capability-package-store.js';
import { WorkerUnreviewedPackageStore } from
  '../dist/apps/worker/src/import-package.js';
import { openPrivateWorkerSqlite } from '../dist/apps/worker/src/local-state.js';
import { projectReviewedPackage } from
  '../dist/apps/worker/src/import-review-runner.js';
import { hashCanonicalJson } from '../dist/packages/contracts/src/canonical-json.js';
import { fixture, fixtureParts } from './seller-publication-contract.test.mjs';

test('tested Worker review survives restart and retries without a second test run',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-review-outbox-'));
  const seller=randomUUID(),review=fixture();
  let outbox=new WorkerImportReviewOutbox(root);
  try{
    assert.equal(outbox.load(review.candidate.id,seller),null);
    assert.deepEqual(outbox.record(review,seller,'https://api.example.com/v1'),review);
    outbox.close();outbox=new WorkerImportReviewOutbox(root);
    assert.deepEqual(outbox.load(review.candidate.id,seller)?.review,review);
    assert.equal(outbox.load(review.candidate.id,seller)?.providerEndpoint,
      'https://api.example.com/v1');
    assert.equal(outbox.load(review.candidate.id,randomUUID()),null);
    assert.deepEqual(outbox.record(review,seller,'https://api.example.com/v1'),review);
    assert.throws(()=>outbox.record({...review,messageId:randomUUID()},seller,
      'https://api.example.com/v1'),
      {code:'CONFLICT'});
    assert.throws(()=>outbox.record(review,seller,'https://other.example.com/v1'),
      {code:'CONFLICT'});
    outbox.markSent(review.candidate.id,seller);
    const first=outbox.load(review.candidate.id,seller)?.sentAt;
    assert.ok(first);
    outbox.markSent(review.candidate.id,seller);
    assert.equal(outbox.load(review.candidate.id,seller)?.sentAt,first);
  }finally{outbox.close();rmSync(root,{recursive:true,force:true});}
});

test('private review outbox upgrades an existing local SQLite schema before binding endpoints',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-review-upgrade-'));
  const old=openPrivateWorkerSqlite(root,'import.sqlite');
  old.exec(`CREATE TABLE import_review_outbox(capability_version_id TEXT PRIMARY KEY,
    seller_account_id TEXT NOT NULL,review_json TEXT NOT NULL,review_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,sent_at TEXT);
    CREATE TRIGGER import_review_outbox_content_immutable BEFORE UPDATE
    ON import_review_outbox WHEN NEW.review_hash<>OLD.review_hash
    BEGIN SELECT RAISE(ABORT,'review content is immutable'); END;`);
  old.close();
  const outbox=new WorkerImportReviewOutbox(root);
  const seller=randomUUID(),review=fixture();
  try{
    outbox.record(review,seller,'https://api.example.com/v1');
    assert.equal(outbox.load(review.candidate.id,seller)?.providerEndpoint,
      'https://api.example.com/v1');
    const db=openPrivateWorkerSqlite(root,'import.sqlite');
    try{assert.throws(()=>db.prepare(`UPDATE import_review_outbox SET provider_endpoint=?
      WHERE capability_version_id=?`).run('https://evil.example.com/v1',review.candidate.id),
      /review content is immutable/);}
    finally{db.close();}
  }finally{outbox.close();rmSync(root,{recursive:true,force:true});}
});

test('a crash after recording the review can recover the exact tested package without a new test',()=>{
  const root=mkdtempSync(join(tmpdir(),'kivro-review-crash-'));
  const seller=randomUUID(),{review,pkg,skills}=fixtureParts();
  const staged=new WorkerUnreviewedPackageStore(root);
  let outbox=new WorkerImportReviewOutbox(root);
  let installed=new WorkerCapabilityPackageStore(root);
  try{
    const draft={id:randomUUID(),sellerAccountId:seller,
      graphHash:hashCanonicalJson(pkg.dependencyGraph)};
    staged.stage(draft,{localPackage:pkg,reviewedSkills:skills});
    outbox.record(review,seller,'https://api.example.com/v1');
    outbox.close();installed.close();
    outbox=new WorkerImportReviewOutbox(root);
    installed=new WorkerCapabilityPackageStore(root);
    const pending=outbox.load(pkg.capabilityVersionId,seller);
    assert.ok(pending);
    const loaded=staged.load(pkg.capabilityVersionId,seller);
    const exact=projectReviewedPackage(loaded.localPackage);
    assert.equal(hashCanonicalJson(exact),pending.review.tests.testedPackageHash);
    installed.installReviewed(exact,{actorId:'local:seller',
      approvedAt:pending.review.tests.testedAt,
      reviewEvidenceHash:hashCanonicalJson(pending.review.tests)},loaded.reviewedSkills);
    assert.equal(hashCanonicalJson(installed.load(pkg.capabilityVersionId)),
      pending.review.candidate.localPackageHash);
    assert.equal(installed.loadReviewedSkills(pkg.capabilityVersionId).length,1);
  }finally{staged.close();outbox.close();installed.close();
    rmSync(root,{recursive:true,force:true});}
});
