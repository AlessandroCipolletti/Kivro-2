import type {Pool} from 'pg';
import {z} from 'zod';
import {InputContractSchema,type InputContract} from
  '../../contracts/src/capability-io.js';
import {hashCanonicalJson} from '../../contracts/src/canonical-json.js';

export class SellerInputContractDraftError extends Error {
  constructor(readonly code:'NOT_FOUND'|'REVISION_CONFLICT'){
    super(code);this.name='SellerInputContractDraftError';
  }
}

type Row={id:string;input_contract:unknown;revision:number;updated_at:Date};
function project(row:Row){return {id:row.id,
  contract:InputContractSchema.parse(row.input_contract),revision:row.revision,
  updatedAt:row.updated_at.toISOString()};}

/** Browser authoring remains a private draft. Only a separately tested Worker
 * package and seller publication action can make this contract buyer-facing. */
export class PostgresSellerInputContractDrafts {
  constructor(private readonly pool:Pool){}
  async list(sellerAccountId:string){
    const rows=await this.pool.query<Row>(`SELECT id,input_contract,revision,updated_at
      FROM seller_input_contract_drafts WHERE seller_account_id=$1
      ORDER BY updated_at DESC LIMIT 50`,[z.uuid().parse(sellerAccountId)]);
    return rows.rows.map(project);
  }
  async get(sellerAccountId:string,draftId:string){
    const rows=await this.pool.query<Row>(`SELECT id,input_contract,revision,updated_at
      FROM seller_input_contract_drafts WHERE seller_account_id=$1 AND id=$2`,
      [z.uuid().parse(sellerAccountId),z.uuid().parse(draftId)]);
    if(!rows.rows[0])throw new SellerInputContractDraftError('NOT_FOUND');
    return project(rows.rows[0]);
  }
  async save(sellerAccountId:string,draftId:string,expectedRevision:number,
    rawContract:unknown){
    const owner=z.uuid().parse(sellerAccountId),id=z.uuid().parse(draftId);
    const revision=z.number().int().nonnegative().parse(expectedRevision);
    const contract:InputContract=InputContractSchema.parse(rawContract);
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const prior=await client.query<Row>(`SELECT id,input_contract,revision,updated_at
        FROM seller_input_contract_drafts WHERE id=$1 FOR UPDATE`,[id]);
      if(prior.rows[0]){
        if((await client.query<{seller_account_id:string}>(`SELECT seller_account_id
          FROM seller_input_contract_drafts WHERE id=$1`,[id])).rows[0]
          ?.seller_account_id!==owner)
          throw new SellerInputContractDraftError('NOT_FOUND');
        if(hashCanonicalJson(InputContractSchema.parse(prior.rows[0].input_contract))===
          hashCanonicalJson(contract)){
          await client.query('COMMIT');return project(prior.rows[0]);
        }
        if(prior.rows[0].revision!==revision)
          throw new SellerInputContractDraftError('REVISION_CONFLICT');
        const updated=await client.query<Row>(`UPDATE seller_input_contract_drafts
          SET input_contract=$3,revision=revision+1,updated_at=now()
          WHERE id=$1 AND seller_account_id=$2
          RETURNING id,input_contract,revision,updated_at`,[id,owner,contract]);
        await client.query('COMMIT');return project(updated.rows[0]!);
      }
      if(revision!==0)throw new SellerInputContractDraftError('REVISION_CONFLICT');
      const inserted=await client.query<Row>(`INSERT INTO seller_input_contract_drafts
        (id,seller_account_id,input_contract) VALUES($1,$2,$3)
        RETURNING id,input_contract,revision,updated_at`,[id,owner,contract]);
      await client.query('COMMIT');return project(inserted.rows[0]!);
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
}
