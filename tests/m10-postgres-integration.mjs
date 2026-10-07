import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import { buildVersionCandidate } from '../dist/packages/domain/src/capability-version.js';
import { createJobContractSnapshot } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresAvailabilityRepository } from '../dist/packages/persistence/src/availability.js';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { MarketplaceCatalog } from '../dist/packages/persistence/src/marketplace-catalog.js';
import { MarketplaceSocialRepository } from '../dist/packages/persistence/src/marketplace-social.js';
import { MarketplaceBuyerRepository } from '../dist/packages/persistence/src/marketplace-buyer.js';
import { MarketplaceAssetRepository } from '../dist/packages/persistence/src/marketplace-assets.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';

if(!process.env.M10_DATABASE_URL){test('M10 requires disposable PostgreSQL',{skip:true},()=>{});}else{
  test('M10 catalog, verified social data, buyer quote/purchase, history and isolation',async()=>{
    const pool=new pg.Pool({connectionString:process.env.M10_DATABASE_URL,max:16});
    const finance=new PostgresFinanceRepository(pool,'test');
    const availability=new PostgresAvailabilityRepository(pool,finance);
    const execution=new PostgresJobExecutionRepository(pool,finance,
      new HmacLeaseTokenIssuer({v1:Buffer.alloc(32,17)},'v1'),availability);
    const catalog=new MarketplaceCatalog(pool,availability);
    const social=new MarketplaceSocialRepository(pool);
    const buyerRepo=new MarketplaceBuyerRepository(pool,availability,finance,execution);
    const buyer=randomUUID(),other=randomUUID(),sellerAccount=randomUUID(),seller=randomUUID();
    const worker=randomUUID(),capability=randomUUID(),versionId=randomUUID();
    const hash=`sha256:${'a'.repeat(64)}`,plane='m10-test-plane';
    const slug=`m10-${capability}`;
    try{
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$4,'ACTIVE',now()),($2,$5,'ACTIVE',now()),($3,$6,'ACTIVE',now())`,
      [buyer,other,sellerAccount,`${buyer}@example.test`,`${other}@example.test`,
        `${sellerAccount}@example.test`]);
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
        VALUES($1,$2,'Verified Seller','ACTIVE','READY')`,[seller,sellerAccount]);
      await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_account_id,
        stripe_mode,onboarding_status,transfers_enabled,payouts_enabled,country,last_reconciled_at)
        VALUES($1,'acct_M10TEST','test','READY',true,true,'US',now())`,[seller]);
      await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
        worker_version,status) VALUES($1,$2,'m10-key','M10 Worker','LINUX','test','ONLINE')`,
      [worker,seller]);
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
        VALUES($1,$2,$3,'Research brief','A focused research brief','PUBLISHED')`,
      [capability,seller,slug]);
      const localPackage={packageVersion:1,capabilityId:capability,capabilityVersionId:versionId,
        workerDeviceId:worker,workerManifest:{manifestVersion:1,workerId:randomUUID(),
          capabilityVersionId:versionId,runtime:{type:'openclaw',supportedVersionRange:'>=2026.8.2 <2026.9.0'},
          skills:[],tools:{allow:[],deny:['browser','exec','gateway']},resources:[],
          network:{default:'deny',allow:[]},limits:{timeoutSeconds:120,memoryMb:128,cpu:1,
            maxPids:32,maxInputBytes:1000,maxOutputBytes:1000}},
        dependencyGraph:{graphVersion:1,rootId:'skill',inference:null,alternatives:[],nodes:[
          {id:'skill',type:'SKILL',name:'Skill',requirement:'REQUIRED',sensitivity:'LOW',
            discoveredFrom:['SKILL_METADATA'],dependsOn:[],marketplaceSupport:'UNDETERMINED',
            confidence:'CONFIRMED',selected:false,health:'UNKNOWN'}]},
        permissionPolicy:{policyVersion:1,aiInference:'NONE',publicInternet:'DENY',browser:false,
          proprietaryDatabase:'NONE',privateApi:'NONE',selectedFileResourceIds:[],
          selectedDirectoryResourceIds:[],localSoftware:false,shell:false,
          externalSideEffects:false,buyerFileAccess:false,sellerCredentialRefs:[]},
        sellerInferenceConfigHash:null,ioContract:{contractVersion:1,
          input:{schemaVersion:1,fields:[{key:'question',label:'Question',order:0,
            group:'PROJECT',required:true,type:'SHORT_TEXT'},
            {key:'supportingFile',label:'Supporting file',order:1,group:'SOURCE',
            required:false,type:'FILE',constraints:{minFiles:0,maxFiles:1,
              maxFileSizeBytes:1000,maxTotalSizeBytes:1000,
              allowedMimeTypes:['text/plain'],allowedExtensions:['.txt']}}]},
          output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
            required:true,type:'LONG_TEXT'}]}},
        priceTier:'USD_999',dependencySnapshot:[],concurrencyLimit:1,
        exampleRefs:[],testRefs:[],pauseSupport:'NOT_SUPPORTED'};
      const candidate=buildVersionCandidate({id:versionId,capabilityId:capability,
        versionNumber:1,workerDeviceId:worker,requestedAt:new Date().toISOString(),localPackage,
        selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_999')});
      const fields={...candidate};delete fields.requestedAt;
      const published=PublishedCapabilityVersionSchema.parse({...fields,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:hash});
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [versionId,capability,published,published.workerManifestHash,hash]);
      await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC' WHERE id=$1`,
        [capability,versionId]);
      await availability.setWorkerDefault({workerDeviceId:worker,sellerAccountId:sellerAccount,
        schedule:{mode:'ALWAYS_AVAILABLE',timezone:'UTC',weeklyWindows:[]},paused:false,
        source:'WEB',expectedRevision:null});
      await availability.setCapabilityPolicy({capabilityId:capability,sellerAccountId:sellerAccount,
        policy:{schedule:null,concurrencyLimit:1,queueLimit:2,futureReservationLimit:2,
          estimatedRuntimeSeconds:60,maxWaitSeconds:604800},paused:false,source:'WEB',
        expectedRevision:null});
      await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',sentAt:new Date().toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,capabilityReadiness:[{capabilityVersionId:versionId,
          policyValidationHash:hash,state:'READY',checks:{sandboxVerified:true,
            requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
      await social.setSellerMetadata(capability,sellerAccount,{category:'RESEARCH',
        shortDescription:'A focused research brief',tags:['research','brief'],
        strengths:['Fast scope'],limitations:['No private web access']});
      await assert.rejects(social.publishSellerCuratedExample({id:randomUUID(),
        capabilityId:capability,sellerAccountId:buyer,title:'Forged',description:'',order:0,
        inputPayload:{values:{question:'Example'},assets:{}},
        outputPayload:{values:{answer:'Result'},assets:{}}}),{code:'FORBIDDEN'});
      const publicExampleAsset=randomUUID();
      await pool.query(`INSERT INTO assets(id,owner_account_id,kind,state,object_key,
        size_bytes,sha256,detected_mime_type,retain_until,finalized_at)
        VALUES($1,$2,'EXAMPLE','READY',$3,12,$4,'text/plain',now()+interval '30 days',now())`,
      [publicExampleAsset,sellerAccount,`private/assets/${publicExampleAsset}/${randomUUID()}`,
        `sha256:${createHash('sha256').update('Example file').digest('hex')}`]);
      const exampleId=randomUUID();
      await social.publishSellerCuratedExample({id:exampleId,capabilityId:capability,
        sellerAccountId:sellerAccount,title:'Sample brief',description:'A seller-approved sample',
        order:0,inputPayload:{values:{question:'Example'},
          assets:{supportingFile:[publicExampleAsset]}},
        outputPayload:{values:{answer:'Result'},assets:{}}});
      assert.ok(await social.publicExampleAsset(publicExampleAsset));
      await assert.rejects(social.publishSellerCuratedExample({id:randomUUID(),
        capabilityId:capability,sellerAccountId:sellerAccount,title:'Unsafe path',
        description:'Read /Users/seller/Documents/private.csv',order:1,
        inputPayload:{values:{question:'Example'},assets:{}},
        outputPayload:{values:{answer:'Result'},assets:{}}}),{code:'NOT_ELIGIBLE'});
      const found=await catalog.search({query:'research',category:'RESEARCH',sort:'PRICE_ASC'},buyer);
      assert.equal(found.length,1);assert.equal(found[0].price.buyerAmountMinor,999);
      assert.equal(found[0].rating.average,null);
      assert.deepEqual(found[0].inputTypes,['TEXT','.txt']);
      assert.deepEqual(found[0].outputTypes,['TEXT']);
      assert.equal(found[0].availability.status,'ONLINE');
      assert.equal((await catalog.search({minimumRating:4},buyer)).length,0);
      assert.equal((await catalog.search({minimumPriceMinor:1000},buyer)).length,0);
      assert.equal((await catalog.search({maximumPriceMinor:999,outputType:'TEXT',
        onlineNow:true},buyer)).length,1);
      assert.equal((await catalog.search({offset:1},buyer)).length,0);
      assert.equal((await catalog.categories())[0].count,1);
      assert.equal((await catalog.sellerPublicProfile(seller)).capabilities.length,1);
      const detail=await catalog.detail(slug,buyer);
      assert.equal(detail.version.id,versionId);
      assert.equal(detail.examples[0].id,exampleId);
      assert.equal(JSON.stringify(detail).includes('workerDeviceId'),false);
      const document=await catalog.discoveryDocument(capability);
      assert.equal(document.accepts[0].key,'question');
      assert.equal(document.exampleSummaries[0].title,'Sample brief');
      assert.equal(JSON.stringify(document).includes('workerManifestHash'),false);
      await social.setFavorite(buyer,capability,true);
      await social.setFavorite(buyer,capability,true);
      assert.deepEqual(await social.favorites(buyer),[capability]);
      assert.deepEqual(await social.favorites(other),[]);
      assert.equal((await catalog.search({},buyer))[0].favorite,true);
      assert.equal((await catalog.search({},other))[0].favorite,false);
      const objects=new Map();let puts=0;
      const storage={async putPrivateObject(key,body){puts++;
        const parts=[];for await(const chunk of body)parts.push(Buffer.from(chunk));
        objects.set(key,Buffer.concat(parts));},
      async headPrivateObject(key){const value=objects.get(key);
        return value?{sizeBytes:value.length,claimedSha256:null}:null;},
      async readPrivateObject(key){const value=objects.get(key);
        if(!value)throw new Error('Missing');return (async function*(){yield value;})();},
      async presignPrivateUpload(key){return {url:`https://storage.invalid/${key}`,headers:{}};},
      async copyPrivateObject(source,destination){objects.set(destination,Buffer.from(objects.get(source)));},
      async deletePrivateObject(key){objects.delete(key);}};
      const assetRepo=new MarketplaceAssetRepository(pool,storage);
      const bytes=Buffer.from('supporting text\n');
      const sha256=`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      const upload=await assetRepo.begin({buyerId:buyer,capabilityId:capability,
        fieldKey:'supportingFile',sizeBytes:bytes.length});
      const body=()=> (async function*(){yield bytes;})();
      await assert.rejects(assetRepo.upload({buyerId:other,capabilityId:capability,
        assetId:upload.id,fieldKey:'supportingFile',fileName:'support.txt',
        sizeBytes:bytes.length,sha256,contentType:'text/plain',body:body()}),
      {code:'NOT_FOUND'});
      assert.equal((await assetRepo.upload({buyerId:buyer,capabilityId:capability,
        assetId:upload.id,fieldKey:'supportingFile',fileName:'support.txt',
        sizeBytes:bytes.length,sha256,contentType:'text/plain',body:body()})).mimeType,'text/plain');
      await assetRepo.upload({buyerId:buyer,capabilityId:capability,
        assetId:upload.id,fieldKey:'supportingFile',fileName:'support.txt',
        sizeBytes:bytes.length,sha256,contentType:'text/plain',body:body()});
      assert.equal(puts,1,'READY object is never rewritten by a retry');
      const direct=await assetRepo.beginDirect({buyerId:buyer,capabilityId:capability,
        fieldKey:'supportingFile',fileName:'support.txt',sizeBytes:bytes.length,sha256,
        contentType:'text/plain'});
      const staged=(await pool.query(`SELECT staging_key FROM buyer_direct_uploads
        WHERE asset_id=$1`,[direct.id])).rows[0].staging_key;
      objects.set(staged,bytes);
      await assert.rejects(assetRepo.finalizeDirect({buyerId:other,assetId:direct.id,
        capabilityId:capability,fieldKey:'supportingFile'}),{code:'NOT_FOUND'});
      await assetRepo.finalizeDirect({buyerId:buyer,assetId:direct.id,
        capabilityId:capability,fieldKey:'supportingFile'});
      const badDirect=await assetRepo.beginDirect({buyerId:buyer,capabilityId:capability,
        fieldKey:'supportingFile',fileName:'support.txt',sizeBytes:bytes.length,sha256,
        contentType:'text/plain'});
      const badStage=(await pool.query(`SELECT staging_key FROM buyer_direct_uploads
        WHERE asset_id=$1`,[badDirect.id])).rows[0].staging_key;
      objects.set(badStage,Buffer.alloc(bytes.length,42));
      await assert.rejects(assetRepo.finalizeDirect({buyerId:buyer,assetId:badDirect.id,
        capabilityId:capability,fieldKey:'supportingFile'}),{code:'HASH_MISMATCH'});
      assert.equal((await pool.query('SELECT state FROM assets WHERE id=$1',
        [badDirect.id])).rows[0].state,'PENDING_UPLOAD');
      const finalKey=(await pool.query('SELECT object_key FROM assets WHERE id=$1',
        [direct.id])).rows[0].object_key;
      objects.set(staged,Buffer.from('tampered after finalization'));
      assert.deepEqual(objects.get(finalKey),bytes,
        'signed staging URL cannot overwrite the final READY input');
      await assetRepo.finalizeDirect({buyerId:buyer,assetId:direct.id,
        capabilityId:capability,fieldKey:'supportingFile'});
      await assert.rejects(social.publishSellerCuratedExample({id:randomUUID(),
        capabilityId:capability,sellerAccountId:sellerAccount,title:'Buyer file leak',description:'',order:1,
        inputPayload:{values:{question:'Example'},assets:{supportingFile:[upload.id]}},
        outputPayload:{values:{answer:'Result'},assets:{}}}),
      /Only seller-owned approved example assets may be linked/);
      for(const order of [1,2])await social.publishSellerCuratedExample({id:randomUUID(),
        capabilityId:capability,sellerAccountId:sellerAccount,title:`Sample ${order+1}`,description:'',
        order,inputPayload:{values:{question:'Example'},assets:{}},
        outputPayload:{values:{answer:'Result'},assets:{}}});
      await assert.rejects(social.publishSellerCuratedExample({id:randomUUID(),
        capabilityId:capability,sellerAccountId:sellerAccount,title:'Fourth',description:'',order:2,
        inputPayload:{values:{question:'Example'},assets:{}},
        outputPayload:{values:{answer:'Result'},assets:{}}}),{code:'CONFLICT'});
      const wrong=await assetRepo.begin({buyerId:buyer,capabilityId:capability,
        fieldKey:'supportingFile',sizeBytes:bytes.length});
      await assert.rejects(assetRepo.upload({buyerId:buyer,capabilityId:capability,
        assetId:wrong.id,fieldKey:'supportingFile',fileName:'support.txt',
        sizeBytes:bytes.length,sha256:`sha256:${'0'.repeat(64)}`,
        contentType:'text/plain',body:body()}),{code:'HASH_MISMATCH'});
      assert.equal((await pool.query('SELECT state FROM assets WHERE id=$1',[wrong.id])).rows[0].state,
        'PENDING_UPLOAD');
      await pool.query(`UPDATE capabilities SET visibility='PRIVATE' WHERE id=$1`,[capability]);
      assert.equal(await social.publicExampleAsset(publicExampleAsset),null);
      assert.equal((await catalog.search({},buyer)).length,0);
      assert.equal(await catalog.discoveryDocument(capability),null);
      assert.equal(await catalog.detail(slug,buyer),null);
      assert.deepEqual(await social.favorites(buyer),[]);
      await pool.query(`INSERT INTO capability_private_grants(id,capability_id,buyer_account_id,
        granted_by_account_id) VALUES($1,$2,$3,$4)`,
      [randomUUID(),capability,buyer,sellerAccount]);
      assert.equal((await catalog.detail(slug,buyer)).id,capability);
      assert.ok(await social.publicExampleAsset(publicExampleAsset,buyer));
      assert.equal(await catalog.detail(slug,other),null);
      assert.equal((await catalog.search({},buyer)).length,0,
        'private grants never enter public discovery');
      await pool.query(`UPDATE capability_private_grants SET revoked_at=now()
        WHERE capability_id=$1 AND buyer_account_id=$2`,[capability,buyer]);
      assert.equal(await social.publicExampleAsset(publicExampleAsset,buyer),null);
      assert.equal(await catalog.detail(slug,buyer),null);
      await pool.query(`UPDATE capabilities SET visibility='UNLISTED' WHERE id=$1`,[capability]);
      assert.ok(await social.publicExampleAsset(publicExampleAsset));
      assert.equal((await catalog.detail(slug,null)).id,capability);
      assert.equal((await catalog.search({},buyer)).length,0);
      assert.equal(await catalog.discoveryDocument(capability),null);
      await pool.query(`UPDATE capabilities SET visibility='PUBLIC' WHERE id=$1`,[capability]);
      await buyerRepo.acceptTerms(buyer,randomUUID());
      assert.equal(await buyerRepo.termsStatus(buyer),true);
      await assert.rejects(buyerRepo.preflight({buyerId:other,capabilityId:capability,
        mode:'IMMEDIATE_ONLY',quoteId:randomUUID(),expectedVersionId:versionId,
        payload:{values:{question:'Work'},assets:{}}}),{code:'NOT_ELIGIBLE'});
      await finance.recordTestCreditPurchase(buyer,5000,`test-only:${randomUUID()}`);
      const filePayload={values:{question:'Work with file'},assets:{supportingFile:[upload.id]}};
      const fileQuote=await buyerRepo.preflight({buyerId:buyer,capabilityId:capability,
        mode:'EARLIEST_AVAILABLE',quoteId:randomUUID(),expectedVersionId:versionId,
        payload:filePayload});
      const fileJob=randomUUID();
      await buyerRepo.purchase({buyerId:buyer,quoteId:fileQuote.quote.id,jobId:fileJob,
        reservationId:randomUUID(),manifestId:randomUUID(),payload:filePayload});
      const bookedAsset=(await pool.query(`SELECT a.retain_until,g.expires_at
        FROM assets a JOIN asset_read_grants g ON g.asset_id=a.id
        WHERE a.id=$1 AND g.target_job_id=$2`,[upload.id,fileJob])).rows[0];
      assert.ok(new Date(bookedAsset.retain_until)>new Date(fileQuote.quote.latestStartAt),
        'booking extends pre-uploaded input beyond the immutable start deadline');
      assert.ok(new Date(bookedAsset.expires_at)>new Date(fileQuote.quote.latestStartAt));
      await buyerRepo.cancel(buyer,fileJob,randomUUID());
      await assert.rejects(pool.query(`UPDATE asset_read_grants
        SET expires_at=expires_at+interval '1 day' WHERE target_job_id=$1`,[fileJob]),
      /Scheduled grant extension|one-way asset grant/);
      const lateQuote=await buyerRepo.preflight({buyerId:buyer,capabilityId:capability,
        mode:'EARLIEST_AVAILABLE',quoteId:randomUUID(),expectedVersionId:versionId,
        payload:{values:{question:'Later input'},assets:{}}});
      const lateJob=randomUUID();
      await execution.createJob(createJobContractSnapshot(published,lateJob,buyer,
        new Date().toISOString()));
      await availability.book({quoteId:lateQuote.quote.id,jobId:lateJob,buyerAccountId:buyer,
        reservationId:randomUUID()});
      const lateUpload=await assetRepo.begin({buyerId:buyer,capabilityId:capability,
        fieldKey:'supportingFile',sizeBytes:bytes.length});
      await assetRepo.upload({buyerId:buyer,capabilityId:capability,assetId:lateUpload.id,
        fieldKey:'supportingFile',fileName:'support.txt',sizeBytes:bytes.length,sha256,
        contentType:'text/plain',body:body()});
      await execution.finalizeInputManifest(lateJob,randomUUID(),
        {values:{question:'Later input'},assets:{supportingFile:[lateUpload.id]}});
      const lateAsset=(await pool.query(`SELECT a.retain_until,g.expires_at
        FROM assets a JOIN asset_read_grants g ON g.asset_id=a.id
        WHERE a.id=$1 AND g.target_job_id=$2`,[lateUpload.id,lateJob])).rows[0];
      assert.ok(new Date(lateAsset.retain_until)>new Date(lateQuote.quote.latestStartAt),
        'input finalized after booking inherits the accepted start deadline');
      assert.ok(new Date(lateAsset.expires_at)>new Date(lateQuote.quote.latestStartAt));
      await buyerRepo.cancel(buyer,lateJob,randomUUID());
      const payload={values:{question:'Work'},assets:{}};
      const quoteId=randomUUID();
      const preflight=await buyerRepo.preflight({buyerId:buyer,capabilityId:capability,
        mode:'IMMEDIATE_ONLY',quoteId,expectedVersionId:versionId,payload});
      assert.equal(preflight.canAfford,true);
      await assert.rejects(buyerRepo.preflight({buyerId:buyer,capabilityId:capability,
        mode:'IMMEDIATE_ONLY',quoteId:randomUUID(),expectedVersionId:randomUUID(),payload}),
      {code:'CONFLICT'});
      const jobId=randomUUID(),reservationId=randomUUID(),manifestId=randomUUID();
      const purchased=await buyerRepo.purchase({buyerId:buyer,quoteId,jobId,reservationId,
        manifestId,payload});
      assert.equal(purchased.jobId,jobId);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      const retried=await buyerRepo.purchase({buyerId:buyer,quoteId,jobId,reservationId,
        manifestId,payload});
      assert.equal(retried.jobId,jobId);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,999);
      assert.equal((await buyerRepo.history(buyer)).length,3);
      assert.equal((await buyerRepo.recentlyUsed(buyer))[0],capability);
      assert.equal((await buyerRepo.job(buyer,jobId)).summary.id,jobId);
      await assert.rejects(buyerRepo.job(other,jobId),{code:'NOT_FOUND'});
      await assert.rejects(social.submitReview({id:randomUUID(),jobId,buyerId:buyer,
        rating:5,text:'Too early'}),{code:'NOT_ELIGIBLE'});
      await buyerRepo.cancel(buyer,jobId,randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor,0);
      assert.equal((await buyerRepo.job(buyer,jobId)).summary.status,'CANCELLED');
      await assert.rejects(buyerRepo.reportProblem({id:randomUUID(),buyerId:buyer,jobId,
        category:'OTHER',description:'At least ten characters'}),{code:'NOT_ELIGIBLE'});
      const completedQuote=await buyerRepo.preflight({buyerId:buyer,capabilityId:capability,
        mode:'IMMEDIATE_ONLY',quoteId:randomUUID(),expectedVersionId:versionId,payload});
      const completedJob=randomUUID();
      await buyerRepo.purchase({buyerId:buyer,quoteId:completedQuote.quote.id,
        jobId:completedJob,reservationId:randomUUID(),manifestId:randomUUID(),payload});
      const offer=await execution.offer(completedJob,worker,plane,120);
      await execution.accept(offer.executionId,worker,plane,offer.leaseToken,randomUUID());
      const transition=async(from,to)=>execution.workerTransition({id:randomUUID(),
        jobId:completedJob,from,to,actor:'WORKER',reason:`M10_${to}`,
        attemptId:offer.attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null},offer.executionId,worker,plane,
      offer.leaseToken);
      await transition('ACCEPTED','STARTING');
      await transition('STARTING','RUNNING');
      await transition('RUNNING','UPLOADING_RESULT');
      await execution.finalizeResult({resultManifestId:randomUUID(),jobId:completedJob,
        executionId:offer.executionId,attemptId:offer.attemptId,workerDeviceId:worker,
        controlPlaneId:plane,leaseToken:offer.leaseToken,
        payload:{values:{answer:'Durable answer'},assets:{}},assets:[]},
      {async headPrivateObject(){throw new Error('No files');},
        async readPrivateObject(){throw new Error('No files');}},
      new Date(Date.now()+86_400_000).toISOString());
      await finance.settleDeliveredJob(completedJob);
      assert.equal((await buyerRepo.job(buyer,completedJob)).result.values.answer,'Durable answer');
      await assert.rejects(social.submitReview({id:randomUUID(),jobId:completedJob,
        buyerId:other,rating:5,text:'Forged'}),{code:'NOT_FOUND'});
      const reviewId=randomUUID();
      await social.submitReview({id:reviewId,jobId:completedJob,buyerId:buyer,
        rating:4,text:'Useful and clear'});
      await social.submitReview({id:reviewId,jobId:completedJob,buyerId:buyer,
        rating:4,text:'Useful and clear'});
      await assert.rejects(social.submitReview({id:randomUUID(),jobId:completedJob,
        buyerId:buyer,rating:5,text:'Duplicate'}),{code:'CONFLICT'});
      assert.equal((await catalog.detail(slug,buyer)).rating.average,4);
      assert.equal((await catalog.sellerPublicProfile(seller)).rating.count,1);
      assert.equal(await social.editReview({reviewId,buyerId:buyer,expectedRevision:1,
        rating:5,text:'Excellent result'}),2);
      assert.equal((await catalog.detail(slug,buyer)).rating.average,5);
      const revisions=await pool.query(`SELECT count(*)::int AS n FROM capability_review_revisions
        WHERE review_id=$1`,[reviewId]);
      assert.equal(revisions.rows[0].n,2);
      await buyerRepo.reportProblem({id:randomUUID(),buyerId:buyer,jobId:completedJob,
        category:'QUALITY',description:'The report should be reviewed'});
      assert.equal((await buyerRepo.job(buyer,completedJob)).problemReports.length,1);
      const newVersionId=randomUUID();
      const newPackage={...localPackage,capabilityVersionId:newVersionId,
        workerManifest:{...localPackage.workerManifest,capabilityVersionId:newVersionId},
        ioContract:{...localPackage.ioContract,output:{schemaVersion:1,fields:[
          {key:'answer',label:'Answer',order:0,required:true,type:'MARKDOWN'}]}},
        priceTier:'USD_1499'};
      const nextCandidate=buildVersionCandidate({id:newVersionId,capabilityId:capability,
        versionNumber:2,workerDeviceId:worker,requestedAt:new Date().toISOString(),
        localPackage:newPackage,
        selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_1499')});
      const nextFields={...nextCandidate};delete nextFields.requestedAt;
      const nextPublished=PublishedCapabilityVersionSchema.parse({...nextFields,
        publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
        policyValidationHash:hash});
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,2,'PUBLISHED',$3,$4,$5,now())`,
      [newVersionId,capability,nextPublished,nextPublished.workerManifestHash,hash]);
      await pool.query(`UPDATE capabilities SET current_version_id=$2 WHERE id=$1`,
        [capability,newVersionId]);
      assert.equal((await catalog.detail(slug,buyer)).price.buyerAmountMinor,1499);
      assert.equal((await catalog.detail(slug,buyer)).examples.length,0,
        'old version examples cannot advertise a new published contract');
      await social.publishSellerCuratedExample({id:randomUUID(),capabilityId:capability,
        sellerAccountId:sellerAccount,title:'Current sample',description:'A current-version sample',
        order:0,inputPayload:{values:{question:'Example'},
          assets:{supportingFile:[publicExampleAsset]}},
        outputPayload:{values:{answer:'# Current result\n\n<script>window.__kivroXss=1</script>'},assets:{}}});
      assert.equal((await buyerRepo.job(buyer,completedJob)).summary.priceMinor,999,
        'historical job price is the immutable financial snapshot');
      assert.equal((await buyerRepo.job(buyer,completedJob)).summary.versionId,versionId);
      const latestHeartbeat=(await pool.query(`SELECT latest_heartbeat_reported_at AS at
        FROM worker_devices WHERE id=$1`,[worker])).rows[0].at;
      await new PostgresWorkerHeartbeatRepository(pool).observe({type:'WORKER_HEARTBEAT',
        protocolVersion:WORKER_PROTOCOL_VERSION,messageId:randomUUID(),controlPlaneId:plane,
        workerDeviceId:worker,workerRelease:'test',
        sentAt:new Date(Math.max(Date.now(),latestHeartbeat.getTime()+1000)).toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
        localRevision:0,capabilityReadiness:[{capabilityVersionId:newVersionId,
          policyValidationHash:hash,state:'READY',checks:{sandboxVerified:true,
            requiredSecretsReady:true,runtimeHealthy:true}}]},worker,plane);
      const rerunQuote=await buyerRepo.preflight({buyerId:buyer,capabilityId:capability,
        mode:'IMMEDIATE_ONLY',quoteId:randomUUID(),expectedVersionId:newVersionId,payload});
      assert.equal(rerunQuote.quote.price.buyerAmountMinor,1499);
      const rerunJob=randomUUID();
      await buyerRepo.purchase({buyerId:buyer,quoteId:rerunQuote.quote.id,jobId:rerunJob,
        reservationId:randomUUID(),manifestId:randomUUID(),payload});
      assert.equal((await buyerRepo.job(buyer,rerunJob)).summary.priceMinor,1499);
      assert.equal((await buyerRepo.job(buyer,completedJob)).summary.priceMinor,999);
      await buyerRepo.cancel(buyer,rerunJob,randomUUID());
      await social.setFavorite(buyer,capability,false);
      assert.deepEqual(await social.favorites(buyer),[]);
    }finally{await pool.end();}
  });
}
