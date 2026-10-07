import { expect,test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getAuthService } from '../../dist/apps/web/src/auth/server.js';
import { createSmtpAuthTransport } from '../../dist/apps/web/src/auth/smtp-transport.js';
import { PostgresFinanceRepository } from '../../dist/packages/persistence/src/finance.js';
import { PostgresWorkerHeartbeatRepository } from '../../dist/packages/persistence/src/worker-heartbeat.js';
import { S3PrivateObjectStorage } from '../../dist/packages/infrastructure/s3/src/storage.js';
import { WORKER_PROTOCOL_VERSION } from '../../dist/packages/worker-protocol/src/messages.js';
import { getMarketplaceService } from '../../dist/apps/web/src/marketplace/server.js';
import { MarketplaceAgentRepository } from '../../dist/packages/persistence/src/marketplace-agent.js';
import { MarketplaceAgentPlanner } from '../../dist/packages/application/src/marketplace-agent-planner.js';
import type { PlatformInferenceRouter } from '../../dist/packages/application/src/platform-inference-router.js';

async function verificationLink(email:string):Promise<string>{
  const list=await fetch('http://127.0.0.1:18025/api/v1/messages').then((r)=>r.json()) as {
    messages:{ID:string;Subject:string;To:{Address:string}[]}[]};
  const target=list.messages.find((m)=>m.Subject==='Verify your Kivro email'&&
    m.To.some((to)=>to.Address===email));
  expect(target).toBeDefined();
  const detail=await fetch(`http://127.0.0.1:18025/api/v1/message/${target!.ID}`)
    .then((r)=>r.json()) as {Text:string};
  const link=/https?:\/\/[^\s]+/.exec(detail.Text)?.[0];
  expect(link).toBeTruthy();return link!;
}
test('buyer discovers, favorites, preflights, purchases, cancels and returns to history',async({page})=>{
  const service=getAuthService(),pool=service.database;
  const finance=new PostgresFinanceRepository(pool,'test');
  const email=`m10-browser-${randomUUID()}@example.test`;
  const password='M10 browser password 123456!';
  const transport=createSmtpAuthTransport({host:'127.0.0.1',port:11025,
    from:'Kivro Dev <no-reply@kivro.local>',security:'LOCAL_PLAINTEXT',production:false});
  try{
    const capability=(await pool.query<{id:string;slug:string;current_version_id:string;
      worker_device_id:string;policy_validation_hash:string}>(`SELECT c.id,c.slug,
      c.current_version_id,v.version_snapshot->>'workerDeviceId' AS worker_device_id,
      v.policy_validation_hash FROM capabilities c JOIN capability_versions v
      ON v.id=c.current_version_id WHERE c.name='Research brief' LIMIT 1`)).rows[0]!;
    const example=(await pool.query<{id:string;object_key:string;sha256:`sha256:${string}`}>(
      `SELECT id,object_key,sha256 FROM assets WHERE kind='EXAMPLE' LIMIT 1`)).rows[0]!;
    const storage=new S3PrivateObjectStorage({bucket:process.env.OBJECT_STORAGE_BUCKET!,
      region:process.env.OBJECT_STORAGE_REGION!,endpoint:process.env.OBJECT_STORAGE_ENDPOINT!,
      accessKeyId:process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
      allowInsecureLoopback:true});
    await storage.putPrivateObject(example.object_key,(async function*(){
      yield Buffer.from('Example file');})(),{contentType:'text/plain',sizeBytes:12,
      sha256:example.sha256});
    storage.destroy();
    await page.goto('/discover');
    await expect(page.getByRole('heading',{name:'Find the right specialist.'})).toBeVisible();
    await expect(page.getByRole('link',{name:/Research brief/})).toBeVisible();
    await expect(page.locator('.market-card-tags')).toContainText('Input:');
    await expect(page.locator('.market-card-tags')).toContainText('Output:');
    await page.getByRole('searchbox',{name:'Search capabilities'}).fill('research');
    await page.getByRole('button',{name:'Search ↗'}).click();
    await expect(page.getByRole('heading',{name:'Results for “research”'})).toBeVisible();
    await page.screenshot({path:'test-results/m10-discover-desktop.png',fullPage:true,
      animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
    await page.screenshot({path:'test-results/m10-discover-mobile.png',fullPage:true,
      animations:'disabled'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.goto(`/capabilities/${capability.slug}`);
    await expect(page.getByRole('heading',{name:'Privacy & access'})).toBeVisible();
    await expect(page.getByRole('link',{name:'Ask Marketplace Agent ↗'})).toHaveAttribute(
      'href',`/ai-request?capabilityId=${capability.id}`);
    await page.goto('/privacy');
    await expect(page.getByRole('heading',{name:'Know where your request goes.'})).toBeVisible();
    await expect(page.getByText(/It does not send your private file bytes/)).toBeVisible();
    await page.goto(`/capabilities/${capability.slug}`);
    await expect(page.getByText('Excellent result')).toBeVisible();
    await expect(page.locator('.example-pair')).toContainText('Question:');
    await expect(page.locator('.example-pair')).toContainText('Supporting file:');
    const exampleDownload=await page.request.get(`/api/marketplace/example-asset/${example.id}`);
    expect(exampleDownload.status()).toBe(200);
    expect(await exampleDownload.text()).toBe('Example file');
    await expect(page.getByText('<script>window.__kivroXss=1</script>')).toBeVisible();
    expect(await page.evaluate(()=>(window as unknown as Record<string,unknown>).__kivroXss)).toBeUndefined();
    await page.screenshot({path:'test-results/m10-detail-mobile.png',fullPage:true,
      animations:'disabled'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.goto('/sign-in?mode=create');
    await page.getByRole('textbox',{name:'Your name'}).fill('Marketplace Buyer');
    await page.getByRole('textbox',{name:'Email address'}).fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'Create account'}).click();
    await expect(page.getByRole('heading',{name:'Verify your email'})).toBeVisible();
    await service.outbox.deliverDue(transport);
    await page.goto(await verificationLink(email));
    await page.goto('/sign-in');
    await page.getByRole('textbox',{name:'Email address'}).fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'Sign in'}).click();
    await expect(page).toHaveURL('/account');
    const buyer=(await pool.query<{id:string}>(
      'SELECT id FROM accounts WHERE primary_email=$1',[email])).rows[0]!.id;
    await finance.recordTestCreditPurchase(buyer,5000,`test-only:browser:${randomUUID()}`);
    const heartbeat=new PostgresWorkerHeartbeatRepository(pool);
    const latest=(await pool.query<{at:Date}>(`SELECT latest_heartbeat_reported_at AS at
      FROM worker_devices WHERE id=$1`,[capability.worker_device_id])).rows[0]?.at;
    await heartbeat.observe({type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
      messageId:randomUUID(),controlPlaneId:'m10-test-plane',
      workerDeviceId:capability.worker_device_id,workerRelease:'test',
      sentAt:new Date(Math.max(Date.now(),(latest?.getTime()??0)+1000)).toISOString(),
      openClawVersion:null,status:'ONLINE',runningJobs:0,capacity:1,policyVersion:1,
      localRevision:0,capabilityReadiness:[{capabilityVersionId:capability.current_version_id,
        policyValidationHash:capability.policy_validation_hash,state:'READY'}]},
    capability.worker_device_id,'m10-test-plane');
    const statusOnCard=async(label:string)=>{
      await page.goto('/discover');
      await expect(page.locator('.market-card .availability-pill')).toHaveText(label);
      await page.goto(`/capabilities/${capability.slug}`);
      await expect(page.locator('.detail-availability strong')).toHaveText(label);
    };
    const report=async(runningJobs:number,ready:boolean)=>{
      const previous=(await pool.query<{at:Date}>(`SELECT latest_heartbeat_reported_at AS at
        FROM worker_devices WHERE id=$1`,[capability.worker_device_id])).rows[0]!.at;
      await heartbeat.observe({type:'WORKER_HEARTBEAT',protocolVersion:WORKER_PROTOCOL_VERSION,
        messageId:randomUUID(),controlPlaneId:'m10-test-plane',
        workerDeviceId:capability.worker_device_id,workerRelease:'test',
        sentAt:new Date(Math.max(Date.now(),previous.getTime()+1000)).toISOString(),
        openClawVersion:null,status:'ONLINE',runningJobs,capacity:1,policyVersion:1,
        localRevision:0,capabilityReadiness:[{capabilityVersionId:capability.current_version_id,
          policyValidationHash:capability.policy_validation_hash,
          state:ready?'READY':'NOT_READY'}]},capability.worker_device_id,'m10-test-plane');
    };
    await statusOnCard('Available now');
    await pool.query(`UPDATE capability_availability_policies SET seller_paused=true
      WHERE capability_id=$1`,[capability.id]);
    await statusOnCard('Paused');
    await pool.query(`UPDATE capability_availability_policies SET seller_paused=false
      WHERE capability_id=$1`,[capability.id]);
    const tomorrow=new Date(Date.now()+86_400_000);
    await pool.query(`UPDATE capability_availability_policies SET schedule_override=$2
      WHERE capability_id=$1`,[capability.id,{mode:'CUSTOM_SCHEDULE',timezone:'UTC',
      weeklyWindows:[{dayOfWeek:tomorrow.getUTCDay()||7,
        startLocalTime:'00:00',endLocalTime:'23:59'}]}]);
    await statusOnCard('Scheduled offline');
    await expect(page.locator('.detail-availability')).toContainText('Next available:');
    await expect(page.getByRole('link',{name:'Schedule a job →'})).toBeVisible();
    await expect(page.getByRole('radio',{name:/Earliest eligible window/})).toBeChecked();
    await page.getByRole('textbox',{name:'Question'}).fill('Run at the next window');
    await page.getByRole('checkbox',{name:/Marketplace use terms/}).check();
    await page.getByRole('radio',{name:/As soon as possible/}).check();
    await page.getByRole('button',{name:'Check price & availability →'}).click();
    await expect(page.locator('.run-panel .notice.error')).toContainText('current schedule is closed');
    await page.getByRole('radio',{name:/Earliest eligible window/}).check();
    await page.getByRole('button',{name:'Check price & availability →'}).click();
    await expect(page.getByText('CURRENT EXECUTION QUOTE')).toBeVisible();
    await expect(page.getByText(/Start time is not guaranteed/)).toBeVisible();
    await expect(page.getByText(/credits will be reserved now/)).toBeVisible();
    await page.getByRole('button',{name:'Confirm purchase & reserve credits →'}).click();
    await expect(page.locator('.job-hero-status strong')).toHaveText('Waiting for schedule');
    await page.getByRole('button',{name:'Cancel this job'}).click();
    await expect(page.locator('.job-hero-status strong')).toHaveText('Cancelled');
    await pool.query(`UPDATE capability_availability_policies SET schedule_override=NULL
      WHERE capability_id=$1`,[capability.id]);
    await pool.query(`UPDATE worker_heartbeats SET reported_at=now()-interval '31 seconds'
      WHERE worker_device_id=$1`,[capability.worker_device_id]);
    await statusOnCard('Worker offline');
    await report(1,true);
    await statusOnCard('Busy · queue open');
    await report(0,false);
    await statusOnCard('Temporarily unavailable');
    await report(0,true);
    await statusOnCard('Available now');
    const marketplace=getMarketplaceService();
    const agentRepo=new MarketplaceAgentRepository(pool);
    const conversationId=randomUUID();
    await agentRepo.createConversation(buyer,conversationId);
    const agentPlanner=new MarketplaceAgentPlanner(marketplace.catalog,
      marketplace.availability,marketplace.getBuyer,agentRepo,{generate:async()=>({
        structuredOutput:{steps:[{key:'research',capabilityId:capability.id,
          dependsOnKeys:[],inputValues:[{fieldKey:'question',value:'Research Acme'}],
          inputAssetIds:[],mappings:[]}]}})} as unknown as PlatformInferenceRouter);
    const agentPlan=(await agentPlanner.propose({buyerId:buyer,conversationId,
      goal:'Research Acme',constraints:{maxTotalSpendMinor:2000,onlineOnly:false,
        outputTypes:[],requiredInputTypes:[],blockedSellerIds:[],preferredCapabilityIds:[],
        permissionLimits:[],timing:{mode:'IMMEDIATE',maxQueueWaitSeconds:0}},
      candidateIds:[capability.id],ownedAssetIds:[]})).plan;
    await page.setViewportSize({width:1280,height:900});
    await page.goto(`/ai-request?planId=${agentPlan.id}`);
    await expect(page.getByRole('heading',{name:'Review the plan'})).toBeVisible();
    await expect(page.locator('.ai-plan-steps')).toContainText('Research brief');
    await expect(page.locator('.ai-plan-total')).toContainText('$20.00');
    await page.screenshot({path:'test-results/m11-agent-plan-desktop.png',fullPage:true,
      animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('.ai-history')).toBeVisible();
    await page.screenshot({path:'test-results/m11-agent-mobile-top.png',
      animations:'disabled'});
    await page.locator('.ai-plan').scrollIntoViewIfNeeded();
    await page.screenshot({path:'test-results/m11-agent-mobile-plan.png',
      animations:'disabled'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.getByRole('checkbox',{name:/I reviewed this plan/}).check();
    await page.getByRole('button',{name:/Approve plan/}).click();
    await expect(page.locator('.ai-plan-steps')).toContainText('In queue');
    await page.getByRole('button',{name:'Cancel remaining work'}).click();
    await expect(page.getByText('No further jobs will start.')).toBeVisible();
    await page.goto(`/capabilities/${capability.slug}`);
    await expect(page.getByRole('heading',{name:'PROJECT'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'SOURCE'})).toBeVisible();
    await page.screenshot({path:'test-results/m10-run-form-mobile.png',fullPage:true,
      animations:'disabled'});
    await page.getByRole('button',{name:'♡ Save'}).click();
    await expect(page.getByRole('button',{name:'♥ Saved'})).toBeVisible();
    await page.goto('/buyer?view=favorites');
    await expect(page.getByRole('heading',{name:'Favorites',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:/Research brief/})).toBeVisible();
    await page.goto(`/capabilities/${capability.slug}`);
    await page.getByRole('link',{name:'Use as template →'}).first().click({timeout:5000});
    await expect(page.getByText('Prefilled from a seller-approved example')).toBeVisible();
    await expect(page.getByRole('textbox',{name:'Question'})).toHaveValue('Example');
    await page.getByRole('textbox',{name:'Question'}).fill('Summarize this company');
    await page.getByLabel('Supporting file').setInputFiles({name:'support.txt',
      mimeType:'text/plain',buffer:Buffer.from('Private buyer attachment\n')});
    if(await page.getByRole('checkbox',{name:/Marketplace use terms/}).count())
      await page.getByRole('checkbox',{name:/Marketplace use terms/}).check();
    const [uploaded]=await Promise.all([
      page.waitForResponse((response)=>response.url().startsWith(process.env.OBJECT_STORAGE_ENDPOINT!)&&
        response.request().method()==='PUT'),
      page.getByRole('button',{name:'Check price & availability →'}).click(),
    ]);
    expect(uploaded.status()).toBe(200);
    await expect(page.getByText('CURRENT EXECUTION QUOTE')).toBeVisible();
    const object=(await pool.query<{id:string;object_key:string}>(`SELECT id,object_key
      FROM assets WHERE owner_account_id=$1 AND kind='BUYER_INPUT' AND state='READY'
      ORDER BY finalized_at DESC LIMIT 1`,[buyer])).rows[0]!;
    expect((await fetch(`${process.env.OBJECT_STORAGE_ENDPOINT}/${process.env.OBJECT_STORAGE_BUCKET}/${object.object_key}`)).status).toBe(403);
    expect((await page.request.get(`/api/marketplace/asset/${object.id}`)).status()).toBe(404);
    await expect(page.getByText('Credits available: $50.00')).toBeVisible();
    await page.route('**/api/marketplace/purchase',async(route)=>{
      const committed=await route.fetch();
      expect(committed.status()).toBe(201);
      await route.abort('failed');
    });
    await page.getByRole('button',{name:'Confirm purchase & reserve credits →'}).click();
    await expect(page).toHaveURL(/\/buyer\/jobs\/[a-f0-9-]+/);
    const jobId=page.url().split('/').at(-1)!;
    await expect(page.getByText('Payment: RESERVED')).toBeVisible();
    await page.screenshot({path:'test-results/m10-job-mobile.png',fullPage:true,
      animations:'disabled'});
    expect((await fetch(`http://localhost:3336/api/marketplace/job/${jobId}`)).status).toBe(401);
    expect((await page.request.get(`/api/marketplace/job/${randomUUID()}`)).status()).toBe(404);
    expect((await page.request.post('/api/marketplace/cancel',{headers:{origin:'https://attacker.invalid'},
      data:{jobId,requestId:randomUUID()}})).status()).toBe(403);
    const [cancelResponse]=await Promise.all([
      page.waitForResponse((response)=>response.url().endsWith('/api/marketplace/cancel')&&
        response.request().method()==='POST'),
      page.getByRole('button',{name:'Cancel this job'}).click(),
    ]);
    expect(cancelResponse.status()).toBe(200);
    await expect(page.locator('.job-hero-status strong')).toHaveText('Cancelled');
    await page.getByRole('link',{name:'Run again →'}).click();
    await expect(page.getByText('Prefilled from your previous job')).toBeVisible();
    const previousVersion=(await pool.query<{id:string}>(`SELECT id FROM capability_versions
      WHERE capability_id=$1 AND version_number=1`,[capability.id])).rows[0]!.id;
    await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
      [capability.id,previousVersion]);
    await page.reload();
    await expect(page.getByText('The published version changed since your previous job.')).toBeVisible();
    await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
      [capability.id,capability.current_version_id]);
    await expect(page.getByRole('textbox',{name:'Question'})).toHaveValue('Summarize this company');
    await expect(page.getByText(/CURRENT PUBLISHED VERSION · \d+/)).toBeVisible();
    await page.goto('/buyer');
    await expect(page.getByRole('heading',{name:'Failed, expired & cancelled'})).toBeVisible();
    await expect(page.getByText('Research brief').first()).toBeVisible();
    await page.goto('/buyer?view=credits');
    await expect(page.getByText('Available balance:')).toContainText('$50.00');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({path:'test-results/m10-buyer-mobile.png',fullPage:true,
      animations:'disabled'});
  }finally{await pool.end();}
});
