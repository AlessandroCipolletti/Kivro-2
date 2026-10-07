import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { canonicalJson, hashCanonicalJson } from
  '../../../packages/contracts/src/canonical-json.js';
import { WorkerCapabilityReviewSchema, type WorkerCapabilityReview } from
  '../../../packages/contracts/src/seller-publication.js';
import { openPrivateWorkerSqlite } from './local-state.js';

export class ImportReviewOutboxError extends Error {
  constructor(readonly code:'NOT_FOUND'|'CONFLICT'|'CORRUPT'){
    super(code);this.name='ImportReviewOutboxError';
  }
}

/** The same tested review is replayed after a lost cloud acknowledgement.
 * A retry never spends seller inference again or manufactures fresh test hashes. */
export class WorkerImportReviewOutbox {
  private readonly db:DatabaseSync;
  constructor(stateDir:string){
    this.db=openPrivateWorkerSqlite(stateDir,'import.sqlite');
    this.db.exec(`CREATE TABLE IF NOT EXISTS import_review_outbox(
      capability_version_id TEXT PRIMARY KEY,seller_account_id TEXT NOT NULL,
      review_json TEXT NOT NULL,review_hash TEXT NOT NULL,
      provider_endpoint TEXT,
      created_at TEXT NOT NULL,sent_at TEXT);
      CREATE TRIGGER IF NOT EXISTS import_review_outbox_no_delete BEFORE DELETE
      ON import_review_outbox BEGIN SELECT RAISE(ABORT,'review history is append-only'); END;`);
    const columns=this.db.prepare('PRAGMA table_info(import_review_outbox)').all() as
      {name:string}[];
    if(!columns.some((column)=>column.name==='provider_endpoint'))
      this.db.exec('ALTER TABLE import_review_outbox ADD COLUMN provider_endpoint TEXT');
    this.db.exec(`CREATE TRIGGER IF NOT EXISTS import_review_outbox_content_immutable_v2 BEFORE UPDATE
      ON import_review_outbox WHEN NEW.capability_version_id<>OLD.capability_version_id OR
        NEW.seller_account_id<>OLD.seller_account_id OR NEW.review_json<>OLD.review_json OR
        NEW.review_hash<>OLD.review_hash OR
        NEW.provider_endpoint IS NOT OLD.provider_endpoint OR
        NEW.created_at<>OLD.created_at OR
        (OLD.sent_at IS NOT NULL AND NEW.sent_at IS NOT OLD.sent_at)
      BEGIN SELECT RAISE(ABORT,'review content is immutable'); END;`);
  }
  close():void{this.db.close();}

  load(capabilityVersionId:string,sellerAccountId:string):
    {review:WorkerCapabilityReview;providerEndpoint:string|null;sentAt:string|null}|null{
    const row=this.db.prepare(`SELECT review_json,review_hash,provider_endpoint,sent_at
      FROM import_review_outbox WHERE capability_version_id=? AND seller_account_id=?`)
      .get(z.uuid().parse(capabilityVersionId),z.uuid().parse(sellerAccountId)) as
      {review_json:string;review_hash:string;provider_endpoint:string|null;
        sent_at:string|null}|undefined;
    if(!row)return null;
    try{
      const review=WorkerCapabilityReviewSchema.parse(JSON.parse(row.review_json));
      if(review.candidate.id!==capabilityVersionId||
        hashCanonicalJson(review)!==row.review_hash)
        throw new ImportReviewOutboxError('CORRUPT');
      if(row.provider_endpoint!==null)z.url().parse(row.provider_endpoint);
      return {review,providerEndpoint:row.provider_endpoint,sentAt:row.sent_at};
    }catch{throw new ImportReviewOutboxError('CORRUPT');}
  }

  record(raw:unknown,sellerAccountId:string,providerEndpoint:string|null=null):
    WorkerCapabilityReview{
    const review=WorkerCapabilityReviewSchema.parse(raw);
    const seller=z.uuid().parse(sellerAccountId);
    const endpoint=providerEndpoint===null?null:z.url().parse(providerEndpoint);
    const existing=this.load(review.candidate.id,seller);
    if(existing){
      if(hashCanonicalJson(existing.review)!==hashCanonicalJson(review)||
        existing.providerEndpoint!==endpoint)
        throw new ImportReviewOutboxError('CONFLICT');
      return existing.review;
    }
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare(`INSERT INTO import_review_outbox(capability_version_id,
        seller_account_id,review_json,review_hash,provider_endpoint,created_at)
        VALUES(?,?,?,?,?,?)`)
        .run(review.candidate.id,seller,canonicalJson(review),
          hashCanonicalJson(review),endpoint,new Date().toISOString());
      this.db.exec('COMMIT');
      return review;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }

  markSent(capabilityVersionId:string,sellerAccountId:string):void{
    const version=z.uuid().parse(capabilityVersionId),seller=z.uuid().parse(sellerAccountId);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const row=this.db.prepare(`SELECT 1 FROM import_review_outbox
        WHERE capability_version_id=? AND seller_account_id=?`).get(version,seller);
      if(!row)throw new ImportReviewOutboxError('NOT_FOUND');
      this.db.prepare(`UPDATE import_review_outbox SET sent_at=coalesce(sent_at,?)
        WHERE capability_version_id=? AND seller_account_id=?`)
        .run(new Date().toISOString(),version,seller);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
}
