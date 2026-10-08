import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import {PostgresSellerInputContractDrafts} from
  '../dist/packages/persistence/src/seller-input-contract-drafts.js';
import {validateInputPayload} from
  '../dist/packages/contracts/src/contract-values.js';

if(!process.env.M14_DATABASE_URL){
  test('seller input-contract persistence requires disposable PostgreSQL',
    {skip:true},()=>{});
}else test('private visual-contract drafts persist, isolate owners and use buyer Core schema',
  async()=>{
    const pool=new pg.Pool({connectionString:process.env.M14_DATABASE_URL,max:4});
    const seller=randomUUID(),other=randomUUID(),profile=randomUUID(),draftId=randomUUID();
    const repository=new PostgresSellerInputContractDrafts(pool);
    const contract={schemaVersion:1,fields:[
      {key:'question',label:'Question',description:'Ask about the document',
        required:true,order:0,type:'LONG_TEXT',constraints:{maxLength:10_000}},
      {key:'document',label:'Document',required:true,order:1,type:'FILE',
        constraints:{minFiles:1,maxFiles:1,maxFileSizeBytes:100_000,
          maxTotalSizeBytes:100_000,allowedMimeTypes:['text/plain'],
          allowedExtensions:['.txt']}}]};
    try{
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at,
        auth_email_verified) VALUES($1,$3,'ACTIVE',now(),true),
        ($2,$4,'ACTIVE',now(),true)`,[seller,other,
        `${seller}@example.test`,`${other}@example.test`]);
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,
        payout_status) VALUES($1,$2,'Contract seller','ACTIVE','READY')`,
      [profile,seller]);
      const saved=await repository.save(seller,draftId,0,contract);
      assert.equal(saved.revision,1);
      assert.deepEqual(await repository.save(seller,draftId,0,contract),saved,
        'retry after lost acknowledgement is idempotent');
      assert.equal((await repository.list(seller)).length,1);
      assert.equal((await repository.list(other)).length,0);
      await assert.rejects(repository.get(other,draftId),{code:'NOT_FOUND'});
      await assert.rejects(repository.save(other,draftId,1,contract),{code:'NOT_FOUND'});
      const changed={...contract,fields:[{...contract.fields[0],label:'New question'},
        contract.fields[1]]};
      const concurrent=await Promise.allSettled([
        repository.save(seller,draftId,1,changed),
        repository.save(seller,draftId,1,{...contract,fields:[
          {...contract.fields[0],label:'Different'},contract.fields[1]]})]);
      assert.equal(concurrent.filter((item)=>item.status==='fulfilled').length,1);
      assert.equal(concurrent.filter((item)=>item.status==='rejected').length,1);
      assert.equal((await repository.get(seller,draftId)).revision,2);
      await assert.rejects(repository.save(seller,draftId,2,{...contract,
        fields:[contract.fields[0],{...contract.fields[1],
          constraints:{...contract.fields[1].constraints,maxFiles:2}}]}));
      assert.deepEqual({...validateInputPayload(saved.contract,{
        values:{question:'Describe this'},assets:{document:[randomUUID()]}}).values},
      {question:'Describe this'});
    }finally{await pool.end();}
  });
