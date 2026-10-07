import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import test from 'node:test';
import pg from 'pg';
import { buildVersionCandidate, createJobContractSnapshot } from '../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from '../dist/packages/contracts/src/capability-version.js';
import { PostgresJobExecutionRepository } from '../dist/packages/persistence/src/job-execution.js';
import { PostgresFinanceRepository } from '../dist/packages/persistence/src/finance.js';
import { PostgresPriceTierCatalog } from '../dist/packages/persistence/src/price-tiers.js';
import { HmacLeaseTokenIssuer } from '../dist/packages/application/src/lease-token.js';
import { PostgresWorkerHeartbeatRepository } from '../dist/packages/persistence/src/worker-heartbeat.js';
import { WORKER_PROTOCOL_VERSION } from '../dist/packages/worker-protocol/src/messages.js';
import { STRIPE_API_VERSION } from '../dist/packages/infrastructure/contracts/src/payment-ports.js';

if (!process.env.M08_DATABASE_URL) {
  test('M08 finance integration requires disposable PostgreSQL', { skip: true }, () => {});
} else {
  test('real ledger gates M07 dispatch, settlement, refund and races', async () => {
    const pool = new pg.Pool({ connectionString: process.env.M08_DATABASE_URL, max: 12 });
    const finance = new PostgresFinanceRepository(pool, 'test');
    const repo = new PostgresJobExecutionRepository(pool, finance,
      new HmacLeaseTokenIssuer({ v1: Buffer.alloc(32, 4) }, 'v1'),
      { async assertEligible() {} });
    const buyer = randomUUID(), sellerAccount = randomUUID(), seller = randomUUID();
    const worker = randomUUID(), capability = randomUUID(), versionId = randomUUID();
    const hash = `sha256:${'a'.repeat(64)}`;
    const plane = 'm08-test-plane';
    try {
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$3,'ACTIVE',now()),($2,$4,'ACTIVE',now())`,
      [buyer, sellerAccount, `${buyer}@example.test`, `${sellerAccount}@example.test`]);
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
        VALUES($1,$2,'M08 Seller','ACTIVE','READY')`, [seller, sellerAccount]);
      await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,stripe_account_id,
        stripe_mode,onboarding_status,transfers_enabled,payouts_enabled,country,last_reconciled_at)
        VALUES($1,'acct_M08TEST','test','READY',true,true,'US',now())`, [seller]);
      await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
        worker_version,status) VALUES($1,$2,'test-key','M08 Worker','LINUX','test','ONLINE')`,
      [worker, seller]);
      await new PostgresWorkerHeartbeatRepository(pool).observe({ type: 'WORKER_HEARTBEAT',
        protocolVersion: WORKER_PROTOCOL_VERSION, messageId: randomUUID(), controlPlaneId: plane,
        workerDeviceId: worker, workerRelease: 'test', openClawVersion: null,
        status: 'ONLINE', runningJobs: 0, capacity: 1, policyVersion: 1, localRevision: 0 }, worker, plane);
      await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,status)
        VALUES($1,$2,$3,'M08 Capability','PUBLISHED')`, [capability, seller, `m08-${capability}`]);
      const localPackage = {
        packageVersion: 1, capabilityId: capability, capabilityVersionId: versionId,
        workerDeviceId: worker, workerManifest: {
          manifestVersion: 1, workerId: randomUUID(), capabilityVersionId: versionId,
          runtime: { type: 'openclaw', supportedVersionRange: '>=2026.8.2 <2026.9.0' },
          skills: [], tools: { allow: [], deny: ['browser','exec','gateway'] }, resources: [],
          network: { default: 'deny', allow: [] }, limits: { timeoutSeconds: 120,
            memoryMb: 128, cpu: 1, maxPids: 32, maxInputBytes: 1000, maxOutputBytes: 1000 },
        }, dependencyGraph: { graphVersion: 1, rootId: 'skill', inference: null,
          alternatives: [], nodes: [{ id: 'skill', type: 'SKILL', name: 'Skill',
            requirement: 'REQUIRED', sensitivity: 'LOW', discoveredFrom: ['SKILL_METADATA'],
            dependsOn: [], marketplaceSupport: 'UNDETERMINED', confidence: 'CONFIRMED',
            selected: false, health: 'UNKNOWN' }] },
        permissionPolicy: { policyVersion: 1, aiInference: 'NONE', publicInternet: 'DENY',
          browser: false, proprietaryDatabase: 'NONE', privateApi: 'NONE',
          selectedFileResourceIds: [], selectedDirectoryResourceIds: [], localSoftware: false,
          shell: false, externalSideEffects: false, buyerFileAccess: false, sellerCredentialRefs: [] },
        sellerInferenceConfigHash: null,
        ioContract: { contractVersion: 1,
          input: { schemaVersion: 1, fields: [{ key: 'question', label: 'Question', order: 0,
            required: true, type: 'SHORT_TEXT' }] },
          output: { schemaVersion: 1, fields: [{ key: 'answer', label: 'Answer', order: 0,
            required: true, type: 'LONG_TEXT' }] } },
        priceTier: 'USD_999', dependencySnapshot: [], concurrencyLimit: 1,
        exampleRefs: [], testRefs: [], pauseSupport: 'NOT_SUPPORTED',
      };
      const candidate = buildVersionCandidate({ id: versionId, capabilityId: capability,
        versionNumber: 1, workerDeviceId: worker, requestedAt: new Date().toISOString(),
        localPackage, selectedPrice: await new PostgresPriceTierCatalog(pool).selected(localPackage.priceTier) });
      const fields = { ...candidate }; delete fields.requestedAt;
      const published = PublishedCapabilityVersionSchema.parse({ ...fields,
        publicationState: 'PUBLISHED', publishedAt: new Date().toISOString(),
        policyValidationHash: hash });
      await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
        publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
        VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
      [versionId, capability, published, published.workerManifestHash, hash]);
      const jobs = [randomUUID(), randomUUID(), randomUUID()];
      for (const jobId of jobs) {
        const snapshot = createJobContractSnapshot(published, jobId, buyer, new Date().toISOString());
        await repo.createJob(snapshot);
        await repo.finalizeInputManifest(jobId, randomUUID(),
          { values: { question: 'Work' }, assets: {} });
      }
      const catalog = new PostgresPriceTierCatalog(pool);
      assert.deepEqual((await catalog.listEnabled()).map((tier)=>[
        tier.buyerAmountMinor,tier.platformFeeMinor,tier.sellerEarningMinor]),
        [[99,19,80],[299,59,240],[499,99,400],[999,199,800],[1499,299,1200],
          [1999,399,1600],[2999,599,2400],[4999,999,4000],[9999,1999,8000]]);
      assert.deepEqual(Object.keys(await catalog.buyerQuote(versionId,
        new Date(Date.now() + 60_000).toISOString())).sort(),
      ['buyerPriceMinor','capabilityId','capabilityVersionId','currency','priceTierId','quoteExpiresAt']);
      assert.equal((await catalog.selected('USD_999')).sellerEarningMinor, 800);
      await assert.rejects(pool.query(`INSERT INTO financial_journals(id,effect_key,kind,currency)
        VALUES($1,$2,'CREDIT_PURCHASE','USD')`,
      [randomUUID(),`empty-journal:${randomUUID()}`]),/Unbalanced financial journal/);
      assert.equal(await catalog.revise({price:{tier:'USD_299',currency:'USD',
        buyerAmountMinor:299,platformFeeMinor:59,sellerEarningMinor:240},
        enabled:false,sortOrder:2,expectedRevision:1}),2);
      await assert.rejects(catalog.selected('USD_299'), { code: 'NOT_ELIGIBLE' });
      assert.equal(await catalog.revise({price:{tier:'USD_19900',currency:'USD',
        buyerAmountMinor:19900,platformFeeMinor:3900,sellerEarningMinor:16000},
        enabled:true,sortOrder:10,expectedRevision:0}),1);
      assert.equal((await catalog.selected('USD_19900')).sellerEarningMinor,16000);
      assert.equal(await catalog.revise({price:{tier:'USD_19900',currency:'USD',
        buyerAmountMinor:19900,platformFeeMinor:3900,sellerEarningMinor:16000},
        enabled:false,sortOrder:10,expectedRevision:1}),2);
      await assert.rejects(catalog.selected('USD_19900'),{code:'NOT_ELIGIBLE'});
      await assert.rejects(pool.query(`UPDATE job_financial_snapshots SET seller_earning_minor=1
        WHERE job_id=$1`, [jobs[0]]), /append-only/);
      await assert.rejects(repo.transition({ id: randomUUID(), jobId: jobs[2], from: 'CREATED',
        to: 'PAYMENT_RESERVED', at: new Date().toISOString(), actor: 'PAYMENT', reason: 'FORGED',
        attemptId: null, correlationId: randomUUID(), paymentReservationId: randomUUID(),
        resultManifestId: null }), { code: 'PAYMENT_NOT_SECURED' });
      await finance.recordTestCreditPurchase(buyer, 1000, `test-only:${randomUUID()}`);
      assert.deepEqual(await finance.buyerBalance(buyer),
        { availableMinor: 1000, reservedMinor: 0, currency: 'USD' });
      const reservations = [randomUUID(), randomUUID()];
      const race = await Promise.allSettled(jobs.slice(0,2).map((jobId,i) =>
        finance.reserveJob(jobId, buyer, reservations[i])));
      assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(race.find((r) => r.status === 'rejected').reason.code, 'INSUFFICIENT_CREDITS');
      const winnerIndex = race.findIndex((r) => r.status === 'fulfilled');
      const jobId = jobs[winnerIndex], reservationId = reservations[winnerIndex];
      assert.equal(await finance.reserveJob(jobId, buyer, reservationId), reservationId);
      await assert.rejects(finance.reserveJob(jobId, buyer, randomUUID()), { code: 'CONFLICT' });
      assert.deepEqual(await finance.buyerBalance(buyer),
        { availableMinor: 1, reservedMinor: 999, currency: 'USD' });
      const client = await pool.connect();
      try { await client.query('BEGIN');
        assert.equal(await finance.isSecured(client, jobId, reservationId), true);
        assert.equal(await finance.isSecured(client, jobId, randomUUID()), false);
        await client.query('COMMIT');
      } finally { client.release(); }
      const event = (from,to,actor,attemptId=null,extra={}) => ({ id: randomUUID(), jobId,
        from,to,actor,reason: `M08_${to}`,at:new Date().toISOString(),attemptId,
        correlationId:randomUUID(),paymentReservationId:null,resultManifestId:null,...extra });
      await repo.transition(event('PAYMENT_RESERVED','QUEUED','CLOUD'));
      await assert.rejects(finance.settleDeliveredJob(jobId), { code: 'NOT_ELIGIBLE' });
      await pool.query('UPDATE seller_connect_profiles SET transfers_enabled=false WHERE seller_profile_id=$1',
        [seller]);
      await assert.rejects(repo.offer(jobId,worker,plane,120),{code:'PAYMENT_NOT_SECURED'});
      await pool.query('UPDATE seller_connect_profiles SET transfers_enabled=true WHERE seller_profile_id=$1',
        [seller]);
      await pool.query(`UPDATE seller_connect_profiles SET
        last_reconciled_at=now()-interval '2 hours' WHERE seller_profile_id=$1`,[seller]);
      await assert.rejects(repo.offer(jobId,worker,plane,120),{code:'PAYMENT_NOT_SECURED'});
      assert.deepEqual(await finance.reconcileStripeProviderState({mode:'test',
        async retrieveConnectAccount(){return {id:'acct_M08TEST',mode:'test',
          transfersEnabled:true,payoutsEnabled:true,detailsSubmitted:true,
          requirementsDue:[],country:'US'};},
        async listPayouts(){return {payouts:[],hasMore:false};}},1),
      {purchases:0,sellers:1});
      const offer = await repo.offer(jobId, worker, plane, 120);
      assert.equal((await repo.materializeOffer(offer.executionId)).paymentSecured, true);
      await repo.accept(offer.executionId, worker, plane, offer.leaseToken, randomUUID());
      const workerEvent = (from,to) => repo.workerTransition(event(from,to,'WORKER',offer.attemptId),
        offer.executionId, worker, plane, offer.leaseToken);
      await assert.rejects(repo.workerTransition({
        ...event('ACCEPTED','STARTING','WORKER',offer.attemptId),
        paymentReservationId:randomUUID()},offer.executionId,worker,plane,offer.leaseToken),
      {code:'PAYMENT_NOT_SECURED'});
      await workerEvent('ACCEPTED','STARTING');
      await workerEvent('STARTING','RUNNING');
      await workerEvent('RUNNING','UPLOADING_RESULT');
      await assert.rejects(repo.workerTransition(
        event('UPLOADING_RESULT','COMPLETED','WORKER',offer.attemptId),
        offer.executionId,worker,plane,offer.leaseToken),{code:'NOT_ELIGIBLE'});
      await assert.rejects(finance.settleDeliveredJob(jobId), { code: 'NOT_ELIGIBLE' });
      const resultId = randomUUID();
      const result = { resultManifestId: resultId, jobId, executionId: offer.executionId,
        attemptId: offer.attemptId, workerDeviceId: worker, controlPlaneId: plane,
        leaseToken: offer.leaseToken, payload: { values: { answer: 'Done' }, assets: {} }, assets: [] };
      const storage = { async headPrivateObject() { throw new Error('unexpected'); },
        async readPrivateObject() { throw new Error('unexpected'); } };
      await repo.finalizeResult(result, storage, new Date(Date.now()+86_400_000).toISOString());
      await repo.finalizeResult(result, storage, new Date(Date.now()+86_400_000).toISOString());
      assert.equal(await catalog.revise({price:{tier:'USD_999',currency:'USD',
        buyerAmountMinor:999,platformFeeMinor:299,sellerEarningMinor:700},
        enabled:true,sortOrder:4,expectedRevision:1}),2);
      await assert.rejects(catalog.revise({price:{tier:'USD_999',currency:'USD',
        buyerAmountMinor:999,platformFeeMinor:199,sellerEarningMinor:800},
        enabled:true,sortOrder:4,expectedRevision:1}),{code:'CONFLICT'});
      await Promise.all(Array.from({length:5}, () => finance.settleDeliveredJob(jobId)));
      assert.equal((await finance.sellerEarnings(seller)).pendingMinor, 800);
      assert.equal((await finance.buyerBalance(buyer)).reservedMinor, 0);
      const settled = await pool.query(`SELECT kind,count(*)::int AS n FROM financial_journals
        WHERE job_id=$1 GROUP BY kind`, [jobId]);
      assert.equal(settled.rows.find((r) => r.kind==='SETTLE').n, 1);
      await assert.rejects(finance.releaseFailedJob(jobId), { code: 'NOT_ELIGIBLE' });
      await Promise.all([finance.refundSettledJob(jobId), finance.refundSettledJob(jobId)]);
      assert.equal((await finance.sellerEarnings(seller)).pendingMinor, 0);
      assert.deepEqual(await finance.buyerBalance(buyer),
        { availableMinor: 1000, reservedMinor: 0, currency: 'USD' });
      const loserId = jobs[1-winnerIndex];
      await finance.reserveJob(loserId, buyer, reservations[1-winnerIndex]);
      await finance.cancelBeforeDispatch(loserId, buyer, randomUUID());
      assert.equal((await finance.buyerBalance(buyer)).availableMinor, 1000);
      const purchaseId = randomUUID();
      await finance.beginCreditPurchase({ purchaseId, buyerId: buyer, amountMinor: 500 });
      await finance.beginCreditPurchase({ purchaseId, buyerId: buyer, amountMinor: 500 });
      await assert.rejects(finance.beginCreditPurchase({ purchaseId, buyerId: buyer,
        amountMinor: 501 }), { code: 'CONFLICT' });
      const intent = { id:'pi_M08PURCHASE', status:'processing', amountMinor:500,
        currency:'usd', customerId:'cus_M08BUYER',
        latestChargeId:'ch_M08PURCHASE',metadata:{kivro_purchase_id:purchaseId}, mode:'test' };
      const gateway = { mode:'test',
        async createCustomer(){ return { id:'cus_M08BUYER' }; },
        async createCreditPaymentIntent(){ return intent; },
        async retrievePaymentIntent(){ return { ...intent,status:'succeeded' }; },
        async retrieveCharge(){return {id:'ch_M08PURCHASE',paymentIntentId:intent.id,
          amountMinor:500,currency:'usd',balanceTransactionId:'txn_M08PURCHASE',mode:'test'};},
        async retrieveBalanceTransaction(){return {id:'txn_M08PURCHASE',feeMinor:30,
          currency:'usd',sourceChargeId:'ch_M08PURCHASE',mode:'test'};},
        async listRefunds(){return {refunds:[],hasMore:false};} };
      assert.equal(await finance.processFinancialOutbox(gateway),1);
      const stamp=Math.floor(Date.now()/1000), secret='whsec_m08test';
      const makeEvent=(id,type)=>{
        const raw=Buffer.from(JSON.stringify({ id,object:'event',type,
          api_version:STRIPE_API_VERSION,livemode:false,created:stamp,
          data:{object:{id:intent.id,object:'payment_intent'}} }));
        const sig=createHmac('sha256',secret).update(Buffer.concat([Buffer.from(`${stamp}.`),raw]))
          .digest('hex');
        return { raw,header:`t=${stamp},v1=${sig}` };
      };
      const succeeded=makeEvent('evt_M08SUCCESS','payment_intent.succeeded');
      await finance.receiveStripeWebhook(succeeded.raw,succeeded.header,secret);
      await finance.receiveStripeWebhook(succeeded.raw,succeeded.header,secret);
      await assert.rejects(finance.receiveStripeWebhook(succeeded.raw,'t=0,v1=bad',secret));
      const failedLate=makeEvent('evt_M08FAILEDLATE','payment_intent.payment_failed');
      await finance.receiveStripeWebhook(failedLate.raw,failedLate.header,secret);
      const restarted=new PostgresFinanceRepository(pool,'test');
      assert.equal(await restarted.reconcileStripeInbox(gateway),2);
      assert.equal((await restarted.buyerBalance(buyer)).availableMinor,1500);
      assert.equal((await restarted.reconcileStripeInbox(gateway)),0);
      assert.equal(await restarted.reconcileStripeProcessingFees(gateway),0);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE effect_key=$1`, [`purchase:${purchaseId}:credit`])).rows[0].n,1);
      assert.deepEqual((await pool.query(`SELECT fee_minor::int AS fee_minor FROM stripe_processing_fees
        WHERE credit_purchase_id=$1`,[purchaseId])).rows.map(({fee_minor})=>fee_minor),[30]);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE effect_key='stripe:charge:ch_M08PURCHASE:processing-fee'`)).rows[0].n,1);
      await pool.query(`UPDATE credit_purchases SET last_reconciled_at=now()-interval '25 hours'
        WHERE id=$1`,[purchaseId]);
      const staleJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,staleJob,buyer,
        new Date().toISOString()));
      await assert.rejects(finance.reserveJob(staleJob,buyer,randomUUID()),
        {code:'STRIPE_NOT_READY'});
      const providerGateway={...gateway,async retrieveConnectAccount(){return {
        id:'acct_M08TEST',mode:'test',transfersEnabled:true,payoutsEnabled:true,
        detailsSubmitted:true,requirementsDue:[],country:'US'};},
        async listPayouts(){return {payouts:[],hasMore:false};}};
      assert.deepEqual(await restarted.reconcileStripeProviderState(providerGateway,1),
        {purchases:1,sellers:1});
      const buyerMethods={...gateway,
        async createSetupIntent(){return {id:'seti_M08',clientSecret:'seti_M08_secret_123456789'};},
        async retrievePaymentMethod(id){return {id,customerId:'cus_M08BUYER',mode:'test'};},
        async setDefaultPaymentMethod(){},async detachPaymentMethod(){},
      };
      assert.equal((await finance.createBuyerSetupIntent(buyer,randomUUID(),buyerMethods)).id,
        'seti_M08');
      await finance.setBuyerDefaultPaymentMethod(buyer,'pm_M08',randomUUID(),buyerMethods);
      assert.equal((await pool.query(`SELECT default_payment_method_id FROM buyer_billing_profiles
        WHERE buyer_account_id=$1`,[buyer])).rows[0].default_payment_method_id,'pm_M08');
      await finance.detachBuyerPaymentMethod(buyer,'pm_M08',randomUUID(),buyerMethods);
      assert.equal((await pool.query(`SELECT default_payment_method_id FROM buyer_billing_profiles
        WHERE buyer_account_id=$1`,[buyer])).rows[0].default_payment_method_id,null);
      await assert.rejects(finance.setBuyerDefaultPaymentMethod(randomUUID(),'pm_M08',
        randomUUID(),buyerMethods),{code:'STRIPE_NOT_READY'});
      const newSellerAccount=randomUUID(),newSeller=randomUUID();
      await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at)
        VALUES($1,$2,'ACTIVE',now())`,[newSellerAccount,`${newSellerAccount}@example.test`]);
      await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
        VALUES($1,$2,'New Seller','DRAFT','NOT_STARTED')`,[newSeller,newSellerAccount]);
      await assert.rejects(finance.beginSellerConnect(newSeller,buyer,'US'),{code:'NOT_ELIGIBLE'});
      await finance.beginSellerConnect(newSeller,newSellerAccount,'US');
      const connectGateway={...gateway,
        async createConnectAccount(){return {id:'acct_M08NEW',mode:'test',
          transfersEnabled:false,payoutsEnabled:false,detailsSubmitted:false,
          requirementsDue:[],country:'US'};},
        async retrieveConnectAccount(){return {id:'acct_M08NEW',mode:'test',
          transfersEnabled:true,payoutsEnabled:true,detailsSubmitted:true,
          requirementsDue:[],country:'US'};},
        async createOnboardingLink(){return {url:'https://connect.stripe.test/onboarding'};},
      };
      assert.equal(await finance.processFinancialOutbox(connectGateway),1);
      assert.equal((await pool.query('SELECT payout_status FROM seller_profiles WHERE id=$1',
        [newSeller])).rows[0].payout_status,'NOT_STARTED');
      await assert.rejects(finance.sellerOnboardingLink(newSeller,buyer,connectGateway,
        'https://kivro.example/refresh','https://kivro.example/return'),{code:'NOT_ELIGIBLE'});
      assert.match(await finance.sellerOnboardingLink(newSeller,newSellerAccount,connectGateway,
        'https://kivro.example/refresh','https://kivro.example/return'),/^https:\/\//);
      const accountRaw=Buffer.from(JSON.stringify({id:'evt_M08ACCOUNT',object:'event',
        type:'account.updated',api_version:STRIPE_API_VERSION,livemode:false,created:stamp,
        data:{object:{id:'acct_M08NEW',object:'account'}}}));
      const accountSig=createHmac('sha256',secret).update(Buffer.concat([
        Buffer.from(`${stamp}.`),accountRaw])).digest('hex');
      await finance.receiveStripeWebhook(accountRaw,`t=${stamp},v1=${accountSig}`,secret);
      assert.equal(await finance.reconcileStripeInbox(connectGateway),1);
      assert.equal((await pool.query('SELECT payout_status FROM seller_profiles WHERE id=$1',
        [newSeller])).rows[0].payout_status,'READY');
      const transferJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,transferJob,buyer,new Date().toISOString()));
      await repo.finalizeInputManifest(transferJob,randomUUID(),
        {values:{question:'Transfer proof'},assets:{}});
      await finance.reserveJob(transferJob,buyer,randomUUID());
      const eventFor=(from,to,actor,attemptId=null)=>({id:randomUUID(),jobId:transferJob,
        from,to,actor,reason:`M08_${to}`,attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null});
      await repo.transition(eventFor('PAYMENT_RESERVED','QUEUED','CLOUD'));
      const offeredTransfer=await repo.offer(transferJob,worker,plane,120);
      await repo.accept(offeredTransfer.executionId,worker,plane,offeredTransfer.leaseToken,randomUUID());
      for(const [from,to] of [['ACCEPTED','STARTING'],['STARTING','RUNNING'],
        ['RUNNING','UPLOADING_RESULT']]) {
        await repo.workerTransition(eventFor(from,to,'WORKER',offeredTransfer.attemptId),
          offeredTransfer.executionId,worker,plane,offeredTransfer.leaseToken);
      }
      await repo.finalizeResult({resultManifestId:randomUUID(),jobId:transferJob,
        executionId:offeredTransfer.executionId,attemptId:offeredTransfer.attemptId,
        workerDeviceId:worker,controlPlaneId:plane,leaseToken:offeredTransfer.leaseToken,
        payload:{values:{answer:'Delivered'},assets:{}},assets:[]},storage,
      new Date(Date.now()+86_400_000).toISOString());
      await finance.settleDeliveredJob(transferJob);
      assert.equal((await finance.sellerEarnings(seller)).pendingMinor,800);
      await assert.rejects(finance.matureSellerEarning(transferJob),{code:'NOT_ELIGIBLE'});
      await pool.query("UPDATE jobs SET completed_at=now()-interval '8 days' WHERE id=$1",[transferJob]);
      await finance.matureSellerEarning(transferJob);
      await finance.matureSellerEarning(transferJob);
      assert.equal((await finance.sellerEarnings(seller)).availableMinor,800);
      const transferId=await finance.queueSellerTransfer(transferJob);
      assert.equal(await finance.queueSellerTransfer(transferJob),transferId);
      let transferCalls=0;
      const stripeTransfer={id:'tr_M08TRANSFER',amountMinor:800,currency:'usd',
        destinationAccountId:'acct_M08TEST',reversed:false,mode:'test'};
      const transferGateway={...gateway,
        async createTransfer(){
          transferCalls++;
          if(transferCalls===1) throw new Error('simulated Stripe timeout after unknown effect');
          return stripeTransfer;
        },
        async retrieveTransfer(){return stripeTransfer;},
        async reverseTransfer(){return {...stripeTransfer,reversed:true};},
      };
      assert.equal(await finance.processFinancialOutbox(transferGateway),0);
      await pool.query("UPDATE financial_outbox SET next_attempt_at=now()-interval '1 second' WHERE subject_id=$1",
        [transferId]);
      assert.equal(await restarted.processFinancialOutbox(transferGateway),1);
      assert.equal((await finance.sellerEarnings(seller)).transferredMinor,800);
      await finance.requestFullRefund(transferJob);
      assert.equal(await finance.processFinancialOutbox(transferGateway),1);
      assert.deepEqual(await finance.sellerEarnings(seller),{pendingMinor:0,availableMinor:0,
        transferredMinor:0,paidOutMinor:0,currency:'USD'});
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,1500);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE job_id=$1 AND kind='REFUND'`,[transferJob])).rows[0].n,1);
      let disputeStatus='LOST';
      const disputeGateway={...gateway,
        async retrieveDispute(){return {id:'du_M08',paymentIntentId:intent.id,
          amountMinor:500,currency:'usd',status:disputeStatus,mode:'test'};},
      };
      const disputeEvent=(id)=>{
        const raw=Buffer.from(JSON.stringify({id,object:'event',type:'charge.dispute.updated',
          api_version:STRIPE_API_VERSION,livemode:false,created:stamp,
          data:{object:{id:'du_M08',object:'dispute'}}}));
        const sig=createHmac('sha256',secret).update(Buffer.concat([Buffer.from(`${stamp}.`),raw]))
          .digest('hex');
        return {raw,header:`t=${stamp},v1=${sig}`};
      };
      const lost=disputeEvent('evt_M08DISPUTELOST');
      await finance.receiveStripeWebhook(lost.raw,lost.header,secret);
      assert.equal(await finance.reconcileStripeInbox(disputeGateway),1);
      assert.equal((await pool.query('SELECT billing_status FROM buyer_billing_profiles WHERE buyer_account_id=$1',
        [buyer])).rows[0].billing_status,'DISPUTED');
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE effect_key='stripe:dispute:du_M08:loss'`)).rows[0].n,1);
      await assert.rejects(finance.reserveJob(jobs[2],buyer,randomUUID()),{code:'NOT_ELIGIBLE'});
      disputeStatus='WON';
      const won=disputeEvent('evt_M08DISPUTEWON');
      await finance.receiveStripeWebhook(won.raw,won.header,secret);
      assert.equal(await finance.reconcileStripeInbox(disputeGateway),1);
      assert.equal((await pool.query('SELECT billing_status FROM buyer_billing_profiles WHERE buyer_account_id=$1',
        [buyer])).rows[0].billing_status,'ACTIVE');
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE effect_key='stripe:dispute:du_M08:recovery'`)).rows[0].n,1);
      const raceJob = jobs[2], raceReservation = randomUUID(), cancelRequest = randomUUID();
      await restarted.reserveJob(raceJob,buyer,raceReservation);
      await repo.transition({ id:randomUUID(),jobId:raceJob,from:'PAYMENT_RESERVED',to:'QUEUED',
        actor:'CLOUD',reason:'M08_QUEUE',attemptId:null,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null });
      const claimCancel=await Promise.allSettled([
        restarted.cancelBeforeDispatch(raceJob,buyer,cancelRequest),
        repo.offer(raceJob,worker,plane,120),
      ]);
      const fulfilled=claimCancel.filter((item)=>item.status==='fulfilled').length;
      // An offer may commit first and then be cancelled before STARTING. Both
      // calls succeeding is valid only when cancellation wins the final state
      // and releases the one reservation; the old exactly-one assertion was
      // nondeterministic and rejected that legitimate serial order.
      assert.ok(fulfilled>=1&&fulfilled<=2);
      const raceState=(await repo.load(raceJob)).status;
      assert.ok(['CANCELLED','DISPATCHED'].includes(raceState));
      if(fulfilled===2)assert.equal(raceState,'CANCELLED');
      const racePayment=await pool.query('SELECT state FROM payment_reservations WHERE job_id=$1',
        [raceJob]);
      assert.equal(racePayment.rows[0].state,raceState==='CANCELLED'?'RELEASED':'RESERVED');
      if (raceState==='CANCELLED') await restarted.releaseFailedJob(raceJob);
      else {
        await assert.rejects(restarted.releaseFailedJob(raceJob), {code:'NOT_ELIGIBLE'});
        const offered=claimCancel[1].value;
        await repo.transition({id:randomUUID(),jobId:raceJob,from:'DISPATCHED',to:'REJECTED',
          actor:'CLOUD',reason:'OFFER_REJECTED_BY_POLICY',attemptId:offered.attemptId,
          correlationId:randomUUID(),paymentReservationId:null,resultManifestId:null});
        await restarted.releaseFailedJob(raceJob);
      }
      await finance.recordTestCreditPurchase(buyer,1000,`test-only:${randomUUID()}`);
      const payoutJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,payoutJob,buyer,new Date().toISOString()));
      await repo.finalizeInputManifest(payoutJob,randomUUID(),
        {values:{question:'Payout proof'},assets:{}});
      await finance.reserveJob(payoutJob,buyer,randomUUID());
      const payoutEvent=(from,to,actor,attemptId=null)=>({id:randomUUID(),jobId:payoutJob,
        from,to,actor,reason:`M08_${to}`,attemptId,correlationId:randomUUID(),
        paymentReservationId:null,resultManifestId:null});
      await repo.transition(payoutEvent('PAYMENT_RESERVED','QUEUED','CLOUD'));
      const payoutOffer=await repo.offer(payoutJob,worker,plane,120);
      await repo.accept(payoutOffer.executionId,worker,plane,payoutOffer.leaseToken,randomUUID());
      for(const [from,to] of [['ACCEPTED','STARTING'],['STARTING','RUNNING'],
        ['RUNNING','UPLOADING_RESULT']]) {
        await repo.workerTransition(payoutEvent(from,to,'WORKER',payoutOffer.attemptId),
          payoutOffer.executionId,worker,plane,payoutOffer.leaseToken);
      }
      await repo.finalizeResult({resultManifestId:randomUUID(),jobId:payoutJob,
        executionId:payoutOffer.executionId,attemptId:payoutOffer.attemptId,
        workerDeviceId:worker,controlPlaneId:plane,leaseToken:payoutOffer.leaseToken,
        payload:{values:{answer:'Delivered'},assets:{}},assets:[]},storage,
      new Date(Date.now()+86_400_000).toISOString());
      await finance.settleDeliveredJob(payoutJob);
      await pool.query("UPDATE jobs SET completed_at=now()-interval '8 days' WHERE id=$1",[payoutJob]);
      await finance.matureSellerEarning(payoutJob);
      await finance.queueSellerTransfer(payoutJob);
      const payoutTransfer={id:'tr_M08PAYOUT',amountMinor:800,currency:'usd',
        destinationAccountId:'acct_M08TEST',reversed:false,mode:'test'};
      const payoutGateway={...gateway,async createTransfer(){return payoutTransfer;},
        async retrieveTransfer(){return payoutTransfer;},
        async retrievePayout(){return {id:'po_M08',amountMinor:800,currency:'usd',
          connectedAccountId:'acct_M08TEST',status:'paid',mode:'test'};},
        async retrieveConnectAccount(id){return {id,mode:'test',
          transfersEnabled:true,payoutsEnabled:true,detailsSubmitted:true,
          requirementsDue:[],country:'US'};},
        async listPayouts(accountId){return {payouts:accountId==='acct_M08TEST' ?
          [{id:'po_M08',amountMinor:800,currency:'usd',
            connectedAccountId:'acct_M08TEST',status:'paid',mode:'test'}] : [],hasMore:false};}};
      assert.equal(await finance.processFinancialOutbox(payoutGateway),1);
      assert.deepEqual(await finance.reconcileStripeProviderState(payoutGateway,2),
        {purchases:1,sellers:2});
      assert.equal((await finance.sellerEarnings(seller)).paidOutMinor,800);
      const payoutRaw=Buffer.from(JSON.stringify({id:'evt_M08PAYOUT',object:'event',
        type:'payout.paid',api_version:STRIPE_API_VERSION,livemode:false,created:stamp,
        account:'acct_M08TEST',data:{object:{id:'po_M08',object:'payout'}}}));
      const payoutSig=createHmac('sha256',secret).update(Buffer.concat([
        Buffer.from(`${stamp}.`),payoutRaw])).digest('hex');
      await finance.receiveStripeWebhook(payoutRaw,`t=${stamp},v1=${payoutSig}`,secret);
      assert.equal(await finance.reconcileStripeInbox(payoutGateway),1);
      assert.equal((await finance.sellerEarnings(seller)).paidOutMinor,800);
      await assert.rejects(finance.refundSettledJob(payoutJob),{code:'NOT_ELIGIBLE'});
      const beforeAdmin=(await finance.buyerBalance(buyer)).availableMinor;
      await finance.requestFullRefund(payoutJob);
      await finance.requestFullRefund(payoutJob);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,beforeAdmin+999);
      assert.equal((await finance.sellerEarnings(seller)).paidOutMinor,800);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE job_id=$1 AND kind='ADMIN_REFUND_PLATFORM_FUNDED'`,[payoutJob])).rows[0].n,1);
      const refund={id:'re_M08CREDIT',paymentIntentId:intent.id,chargeId:'ch_M08PURCHASE',
        amountMinor:500,currency:'usd',status:'succeeded',mode:'test'};
      const refundGateway={...gateway,async retrieveRefund(){return refund;}};
      const refundRaw=Buffer.from(JSON.stringify({id:'evt_M08CREDITREFUND',object:'event',
        type:'refund.updated',api_version:STRIPE_API_VERSION,livemode:false,created:stamp,
        data:{object:{id:refund.id,object:'refund'}}}));
      const refundSig=createHmac('sha256',secret).update(Buffer.concat([
        Buffer.from(`${stamp}.`),refundRaw])).digest('hex');
      const beforeCreditRefund=(await finance.buyerBalance(buyer)).availableMinor;
      await finance.receiveStripeWebhook(refundRaw,`t=${stamp},v1=${refundSig}`,secret);
      await finance.receiveStripeWebhook(refundRaw,`t=${stamp},v1=${refundSig}`,secret);
      assert.equal(await restarted.reconcileStripeInbox(refundGateway),1);
      assert.equal((await finance.buyerBalance(buyer)).availableMinor,beforeCreditRefund-500);
      assert.equal((await pool.query(`SELECT billing_status FROM buyer_billing_profiles
        WHERE buyer_account_id=$1`,[buyer])).rows[0].billing_status,'REFUND_REVIEW');
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE effect_key='stripe:refund:re_M08CREDIT'`)).rows[0].n,1);
      const failedPayoutGateway={...payoutGateway,
        async listPayouts(accountId){return {payouts:accountId==='acct_M08TEST' ?
          [{id:'po_M08',amountMinor:800,currency:'usd',connectedAccountId:'acct_M08TEST',
            status:'failed',mode:'test'}] : [],hasMore:false};}};
      await finance.reconcileStripeProviderState(failedPayoutGateway,2);
      await finance.reconcileStripeProviderState(failedPayoutGateway,2);
      assert.equal((await finance.sellerEarnings(seller)).paidOutMinor,0);
      assert.equal((await finance.sellerEarnings(seller)).transferredMinor,800);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM financial_journals
        WHERE effect_key='stripe:payout:po_M08:failure-reversal'`)).rows[0].n,1);
      const refundPurchaseBefore=(await pool.query('SELECT state FROM credit_purchases WHERE id=$1',
        [purchaseId])).rows[0].state;
      assert.equal(refundPurchaseBefore,'REFUNDED');
      const disputedRefundGateway={...refundGateway,
        async retrieveDispute(){return {id:'du_M08LATE',paymentIntentId:intent.id,
          amountMinor:500,currency:'usd',status:'WON',mode:'test'};}};
      const lateDispute=Buffer.from(JSON.stringify({id:'evt_M08LATE',object:'event',
        type:'charge.dispute.updated',api_version:STRIPE_API_VERSION,livemode:false,
        created:stamp,data:{object:{id:'du_M08LATE',object:'dispute'}}}));
      const lateSig=createHmac('sha256',secret).update(Buffer.concat([
        Buffer.from(`${stamp}.`),lateDispute])).digest('hex');
      await finance.receiveStripeWebhook(lateDispute,`t=${stamp},v1=${lateSig}`,secret);
      const lateCount=await finance.reconcileStripeInbox(disputedRefundGateway);
      assert.equal(lateCount,1,JSON.stringify((await pool.query(
        'SELECT processing_error FROM stripe_inbox WHERE event_id=$1',['evt_M08LATE'])).rows));
      assert.equal((await pool.query('SELECT state FROM credit_purchases WHERE id=$1',
        [purchaseId])).rows[0].state,'REFUNDED');
      const frozenJob=randomUUID();
      await repo.createJob(createJobContractSnapshot(published,frozenJob,buyer,
        new Date().toISOString()));
      await assert.rejects(finance.reserveJob(frozenJob,buyer,randomUUID()),
        {code:'NOT_ELIGIBLE'});
      assert.equal((await finance.reconcileLedger()).unbalancedJournals, 0);
      assert.deepEqual(await finance.reconcileLedger(), { unbalancedJournals: 0,
        negativeProtectedAccounts: 0, reservationMismatches: 0 });
    } finally { await pool.end(); }
  });
}
