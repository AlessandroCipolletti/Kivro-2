import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const accountIdSchema = z.uuid();
const displayNameSchema = z.string().refine(
  (value) => ![...value].some((character) => character.charCodeAt(0) < 32),
  'Display name contains control characters',
).transform((value) => value.trim()).pipe(z.string().min(1).max(120));

export interface SellerProfile {
  readonly id: string;
  readonly accountId: string;
  readonly displayName: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  readonly payoutStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'RESTRICTED' | 'ACTION_REQUIRED' | 'READY' | 'DISABLED';
  readonly executionModelAcknowledged: boolean;
}

type SellerProfileRow = {
  id: string; account_id: string; display_name: string;
  status: SellerProfile['status']; payout_status: SellerProfile['payoutStatus'];
  execution_model_acknowledged: boolean;
};

function profile(row: SellerProfileRow): SellerProfile {
  return Object.freeze({ id: row.id, accountId: row.account_id, displayName: row.display_name,
    status: row.status, payoutStatus: row.payout_status,
    executionModelAcknowledged: row.execution_model_acknowledged });
}

export class SellerProfileError extends Error {
  constructor(readonly code: 'ACCOUNT_NOT_ELIGIBLE' | 'SELLER_INVITE_REQUIRED', message: string) {
    super(message); this.name = 'SellerProfileError';
  }
}

/** The caller must derive accountId from an authenticated Kivro session. */
export async function createSellerProfile(
  database: Pool, accountId: string, rawDisplayName: unknown, executionModelConfirmed: unknown,
): Promise<SellerProfile> {
  const id = accountIdSchema.parse(accountId);
  const displayName = displayNameSchema.parse(rawDisplayName);
  z.literal(true).parse(executionModelConfirmed);
  const client: PoolClient = await database.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query<{ status: string; auth_email_verified: boolean }>(
      'SELECT status, auth_email_verified FROM accounts WHERE id = $1 FOR UPDATE', [id],
    );
    if (account.rowCount !== 1 || account.rows[0]?.status !== 'ACTIVE' ||
      account.rows[0].auth_email_verified !== true) {
      throw new SellerProfileError('ACCOUNT_NOT_ELIGIBLE', 'A verified active account is required');
    }
    const prior = await client.query<{id:string}>(
      'SELECT id FROM seller_profiles WHERE account_id=$1 FOR UPDATE',[id]);
    let consumeInvite=false;
    if(process.env.NODE_ENV==='production' && prior.rowCount===0){
      const invite=await client.query<{account_id:string}>(`SELECT account_id
        FROM seller_onboarding_invites WHERE account_id=$1 AND revoked_at IS NULL
          AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`,[id]);
      if(invite.rowCount!==1)throw new SellerProfileError('SELLER_INVITE_REQUIRED',
        'Private-alpha seller invitation required');
      consumeInvite=true;
    }
    await client.query(
      `INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
       VALUES ($1,$2,$3,'DRAFT','NOT_STARTED') ON CONFLICT (account_id) DO NOTHING`,
      [randomUUID(), id, displayName],
    );
    const result = await client.query<SellerProfileRow>(`SELECT s.id,s.account_id,s.display_name,s.status,s.payout_status,
      EXISTS (SELECT 1 FROM seller_execution_model_acknowledgements a
        WHERE a.seller_profile_id=s.id AND a.statement_version=1) AS execution_model_acknowledged
      FROM seller_profiles s WHERE s.account_id=$1`, [id]);
    if (result.rowCount !== 1 || !result.rows[0]) throw new Error('Seller profile was not persisted');
    await client.query(`INSERT INTO seller_execution_model_acknowledgements(seller_profile_id,statement_version)
      VALUES ($1,1) ON CONFLICT DO NOTHING`, [result.rows[0].id]);
    if(consumeInvite){
      await client.query(`UPDATE seller_onboarding_invites SET consumed_at=now()
        WHERE account_id=$1 AND revoked_at IS NULL AND consumed_at IS NULL`,[id]);
      await client.query(`INSERT INTO platform_audit_events(id,actor_account_id,
        actor_kind,event_code,subject_kind,subject_id,reason_code)
        VALUES($1,$2,'SELLER','SELLER_INVITE_CONSUMED','ACCOUNT',$2,'PRIVATE_ALPHA_INVITE')`,
      [randomUUID(),id]);
    }
    await client.query('COMMIT');
    return profile({ ...result.rows[0], execution_model_acknowledged: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function getSellerProfile(database: Pool, accountId: string): Promise<SellerProfile | null> {
  const id = accountIdSchema.parse(accountId);
  const result = await database.query<SellerProfileRow>(`SELECT s.id,s.account_id,s.display_name,s.status,s.payout_status,
    EXISTS (SELECT 1 FROM seller_execution_model_acknowledgements a
      WHERE a.seller_profile_id=s.id AND a.statement_version=1) AS execution_model_acknowledged
    FROM seller_profiles s WHERE s.account_id=$1`, [id]);
  return result.rows[0] ? profile(result.rows[0]) : null;
}
