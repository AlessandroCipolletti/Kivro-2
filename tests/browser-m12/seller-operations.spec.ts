import { expect,test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getAuthService } from '../../dist/apps/web/src/auth/server.js';
import { createSmtpAuthTransport } from '../../dist/apps/web/src/auth/smtp-transport.js';
import { buildVersionCandidate } from '../../dist/packages/domain/src/capability-version.js';
import { createJobContractSnapshot } from '../../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from
  '../../dist/packages/contracts/src/capability-version.js';
import { PostgresPriceTierCatalog } from '../../dist/packages/persistence/src/price-tiers.js';
import { PostgresAvailabilityRepository } from '../../dist/packages/persistence/src/availability.js';
import { PostgresAvailabilityMetrics } from
  '../../dist/packages/persistence/src/availability-metrics.js';
import { PostgresFinanceRepository } from '../../dist/packages/persistence/src/finance.js';
import { PostgresSellerPublicationRepository } from
  '../../dist/packages/persistence/src/seller-publication.js';
import { hashCanonicalJson } from '../../dist/packages/contracts/src/canonical-json.js';

async function verificationLink(email:string):Promise<string>{
  const api=`http://127.0.0.1:${process.env.M12_MAIL_API_PORT}`;
  const list=await fetch(`${api}/api/v1/messages`).then((r)=>r.json()) as {
    messages:{ID:string;Subject:string;To:{Address:string}[]}[]};
  const target=list.messages.find((m)=>m.Subject==='Verify your Kivro email'&&
    m.To.some((to)=>to.Address===email));
  expect(target).toBeDefined();
  const detail=await fetch(`${api}/api/v1/message/${target!.ID}`)
    .then((r)=>r.json()) as {Text:string};
  const link=/https?:\/\/[^\s]+/.exec(detail.Text)?.[0];
  expect(link).toBeTruthy();return link!;
}

test('verified seller can stop new work from web while Worker is offline',async({page})=>{
  const auth=getAuthService(),pool=auth.database;
  const email=`m12-browser-${randomUUID()}@example.test`;
  const password='M12 browser password 123456!';
  const transport=createSmtpAuthTransport({host:'127.0.0.1',
    port:Number(process.env.M12_MAIL_SMTP_PORT),
    from:'Kivro Dev <no-reply@kivro.local>',security:'LOCAL_PLAINTEXT',production:false});
  await page.goto('/sign-in?mode=create');
  const createTab=page.getByRole('tab',{name:'Create account'});
  await expect(createTab).toHaveAttribute('aria-selected','true');
  await createTab.press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Sign in'})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'Sign in'}).press('ArrowRight');
  await expect(createTab).toHaveAttribute('aria-selected','true');
  await page.getByRole('textbox',{name:'Your name'}).fill('M12 Seller');
  await page.getByRole('textbox',{name:'Email address'}).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Create account'}).click();
  await expect(page.getByRole('heading',{name:'Verify your email'})).toBeVisible();
  await auth.outbox.deliverDue(transport);
  await page.goto(await verificationLink(email));
  await page.goto('/sign-in');
  await page.getByRole('textbox',{name:'Email address'}).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page).toHaveURL('/account');
  const account=(await pool.query<{id:string}>(
    'SELECT id FROM accounts WHERE primary_email=$1',[email])).rows[0]!.id;
  await page.goto('/seller');
  await expect(page.getByRole('heading',{name:'Name your seller workspace'})).toBeVisible();
  expect(await page.getByRole('heading',{name:/Build a useful service/}).evaluate((element)=>
    element.getBoundingClientRect().top)).toBeLessThan(300);
  await page.screenshot({path:'test-results/m14-seller-onboarding-desktop.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
  await page.screenshot({path:'test-results/m14-seller-onboarding-mobile.png',
    fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  expect(await page.locator('.seller-step p').first().evaluate((element)=>
    parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
  await page.getByLabel('Public seller name').fill('M12 Seller');
  await page.getByRole('checkbox',{name:/I understand approved jobs/}).check();
  await page.getByRole('button',{name:'Create seller profile'}).click();
  await expect(page.getByRole('button',{name:'Create one-time pairing code'})).toBeVisible();
  await page.getByRole('button',{name:'Create one-time pairing code'}).click();
  await expect(page.getByText('Pairing code',{exact:true})).toBeVisible();
  await expect(page.getByText(/pnpm worker pair [A-F0-9-]+/)).toBeVisible();
  await expect(page.getByText('kivro-worker import guided')).toBeVisible();
  expect(await page.getByRole('heading',{name:/Build a useful service/}).evaluate((element)=>
    element.getBoundingClientRect().top)).toBeLessThan(300);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  const storedCodes=await pool.query<{code_hash:string}>(
    'SELECT code_hash FROM worker_pairing_codes ORDER BY created_at DESC LIMIT 1');
  expect(storedCodes.rows[0]?.code_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  await page.screenshot({path:'test-results/m14-seller-pairing-mobile.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:1280,height:720});
  const seller=(await pool.query<{id:string}>(
    'SELECT id FROM seller_profiles WHERE account_id=$1',[account])).rows[0]!.id;
  await pool.query("UPDATE seller_profiles SET status='ACTIVE' WHERE id=$1",[seller]);
  const worker=randomUUID();
  await pool.query(`INSERT INTO worker_devices(id,seller_profile_id,public_key,name,platform,
    worker_version,status) VALUES($1,$2,$3,'Studio Worker','MACOS','0.0.0-dev','OFFLINE')`,
  [worker,seller,`test-only-${worker}`]);
  const capability=randomUUID(),version=randomUUID();
  await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
    VALUES($1,$2,$3,'Research studio','Seller reviewed service','PUBLISHED')`,
  [capability,seller,`m12-${capability}`]);
  const localPackage={packageVersion:1,capabilityId:capability,capabilityVersionId:version,
    workerDeviceId:worker,workerManifest:{manifestVersion:1,workerId:randomUUID(),
      capabilityVersionId:version,runtime:{type:'openclaw',supportedVersionRange:'>=2026.8.2 <2026.9.0'},
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
        group:'PROJECT',required:true,type:'SHORT_TEXT'}]},
      output:{schemaVersion:1,fields:[{key:'answer',label:'Answer',order:0,
        required:true,type:'LONG_TEXT'}]}},priceTier:'USD_999',dependencySnapshot:[],
    concurrencyLimit:1,exampleRefs:[],testRefs:[],pauseSupport:'NOT_SUPPORTED'};
  const candidate=buildVersionCandidate({id:version,capabilityId:capability,
    versionNumber:1,workerDeviceId:worker,requestedAt:new Date().toISOString(),localPackage,
    selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_999')});
  const fields={...candidate};delete (fields as {requestedAt?:string}).requestedAt;
  const hash=`sha256:${'a'.repeat(64)}`;
  const published=PublishedCapabilityVersionSchema.parse({...fields,
    publicationState:'PUBLISHED',publishedAt:new Date().toISOString(),
    policyValidationHash:hash});
  await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
    publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
    VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
  [version,capability,published,published.workerManifestHash,hash]);
  await pool.query('UPDATE capabilities SET current_version_id=$2 WHERE id=$1',
    [capability,version]);
  const buyer=randomUUID(),reportedJob=randomUUID();
  const buyerEmail=`m15-buyer-${buyer}@example.test`;
  await pool.query(`INSERT INTO accounts(id,primary_email,status,email_verified_at,
    auth_email_verified) VALUES($1,$2,'ACTIVE',now(),true)`,[buyer,buyerEmail]);
  const snapshot=createJobContractSnapshot(published,reportedJob,buyer,new Date().toISOString());
  await pool.query(`INSERT INTO jobs(id,buyer_account_id,capability_version_id,worker_device_id,
    status,contract_snapshot) VALUES($1,$2,$3,$4,'CREATED',$5)`,
  [reportedJob,buyer,version,worker,snapshot]);
  await pool.query("UPDATE seller_profiles SET payout_status='READY' WHERE id=$1",[seller]);
  await pool.query("UPDATE capabilities SET visibility='PUBLIC' WHERE id=$1",[capability]);
  const availability=new PostgresAvailabilityRepository(pool,new PostgresFinanceRepository(pool,'test'));
  await availability.setWorkerDefault({workerDeviceId:worker,sellerAccountId:account,
    schedule:{mode:'ALWAYS_AVAILABLE',timezone:'Europe/Zurich',weeklyWindows:[]},
    paused:false,source:'WEB',expectedRevision:null});
  await availability.setCapabilityPolicy({capabilityId:capability,sellerAccountId:account,
    policy:{schedule:null,concurrencyLimit:1,queueLimit:2,futureReservationLimit:2,
      estimatedRuntimeSeconds:60,maxWaitSeconds:604800},paused:false,
    source:'WEB',expectedRevision:null});
  await new PostgresAvailabilityMetrics(pool,availability).sample();
  await page.goto('/seller');
  await expect(page.getByRole('heading',{name:'Your work, at a glance.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Review before buyers can see it.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No reviewed package yet'})).toBeVisible();
  await page.getByText('View buyer-visible access for this version').click();
  await expect(page.getByText('Seller database')).toBeVisible();
  await expect(page.getByText('Not used').first()).toBeVisible();
  expect(await page.locator('.ops-job>div:first-child>small').first().evaluate((element)=>
    getComputedStyle(element).display)).toBe('block');
  await page.screenshot({path:'test-results/m14-seller-permissions-desktop.png',
    fullPage:true,animations:'disabled'});
  await expect(page.getByRole('heading',{name:/Build a useful service/})).toHaveCount(0);
  await expect(page.getByText('Studio Worker')).toBeVisible();
  await expect(page.locator('.ops-state.offline').first()).toHaveText('Offline');
  await expect(page.getByText('Research studio').first()).toBeVisible();
  const [reportResponse]=await Promise.all([page.waitForResponse((response)=>
    response.url().endsWith('/api/seller/operations/report-abuse')&&
    response.request().method()==='POST'),
  page.getByRole('button',{name:'Report unsafe job'}).click()]);
  expect(reportResponse.status()).toBe(201);
  await expect(page.getByRole('status')).toHaveText('Safety report received for review.');
  const report=await pool.query<{reporter_account_id:string;category:string}>(
    'SELECT reporter_account_id,category FROM abuse_reports WHERE job_id=$1',[reportedJob]);
  expect(report.rows).toEqual([{reporter_account_id:account,category:'MALICIOUS_INPUT'}]);
  await page.getByText('View availability history').click();
  await expect(page.getByText(/Last 30 days, observed minutes:/)).toBeVisible();
  await expect(page.getByText(/missing periods are unknown/)).toBeVisible();
  await page.screenshot({path:'test-results/m13-seller-availability-metrics.png',
    fullPage:true,animations:'disabled'});
  await page.getByText('View availability history').click();
  await expect(page.getByText('$9.99 / job · You earn $8.00 · Marketplace fee $1.99')).toBeVisible();
  await expect(page.getByText('Settled buyer sales')).toBeVisible();
  await expect(page.getByText('Seller revenue')).toHaveCount(0);
  await expect(page.getByText(/Earnings can change after a refund or payment dispute/)).toBeVisible();
  expect(await page.getByRole('button',{name:'Refresh status'}).evaluate((element)=>
    element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.getByLabel('Maintenance until').first().evaluate((element)=>
    element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:'Edit service hours and capacity'}).click();
  await expect(page.getByText(/Kivro does not wake it/)).toBeVisible();
  await page.getByLabel('Availability').selectOption('CUSTOM_SCHEDULE');
  await page.getByRole('button',{name:'Add window'}).first().click();
  await expect(page.getByLabel('Monday start 1')).toHaveValue('20:00');
  await expect(page.getByLabel('Monday end 1')).toHaveValue('07:00');
  await page.getByRole('button',{name:'Copy Monday to weekdays'}).click();
  await page.getByRole('button',{name:'Save availability'}).click();
  await expect(page.getByRole('button',{name:'Edit service hours and capacity'})).toHaveAttribute(
    'aria-expanded','false');
  const scheduled=await pool.query<{schedule_override:{mode:string;timezone:string;
    weeklyWindows:{dayOfWeek:number}[]}}>(`SELECT schedule_override FROM capability_availability_policies
    WHERE capability_id=$1`,[capability]);
  expect(scheduled.rows[0]?.schedule_override.weeklyWindows).toHaveLength(5);
  await expect(page.getByRole('button',{name:'Pause all new jobs'})).toBeVisible();
  await page.getByRole('button',{name:'Pause all new jobs'}).click();
  await expect(page.getByRole('button',{name:'Resume new jobs'})).toBeVisible();
  const state=await pool.query<{seller_paused:boolean}>(`SELECT seller_paused
    FROM worker_availability_schedules WHERE worker_device_id=$1`,[worker]);
  expect(state.rows[0]?.seller_paused).toBe(true);
  const planned=new Date(Date.now()+3_600_000);
  const localInput=new Date(planned.getTime()-planned.getTimezoneOffset()*60_000)
    .toISOString().slice(0,16);
  await page.getByLabel('Maintenance until').first().fill(localInput);
  await page.getByRole('button',{name:'Schedule maintenance'}).first().click();
  await expect(page.getByText('Maintenance scheduled to end')).toBeVisible();
  const maintenance=await pool.query<{maintenance_until:Date}>(`SELECT maintenance_until
    FROM worker_availability_schedules WHERE worker_device_id=$1`,[worker]);
  expect(maintenance.rows[0]?.maintenance_until).toBeInstanceOf(Date);
  await page.getByLabel('Maintenance until').nth(1).fill(localInput);
  await page.getByRole('button',{name:'Schedule maintenance'}).nth(1).click();
  const publicState=await availability.publicStatus(capability);
  expect(publicState.status).toBe('PAUSED');
  expect(publicState.maintenanceUntil).toBeTruthy();
  expect(publicState.acceptingImmediate).toBe(false);
  await page.screenshot({path:'test-results/m12-seller-desktop.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:768,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(768);
  await page.screenshot({path:'test-results/m14-seller-tablet.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
  await page.screenshot({path:'test-results/m12-seller-mobile.png',
    fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.locator('.mobile-nav summary').click();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'})
    .getByRole('link',{name:'My jobs'})).toBeVisible();
  await page.getByRole('button',{name:'Resume new jobs'}).click();
  await expect(page.locator('.ops-error')).toContainText('NOT_READY');
  expect((await pool.query<{seller_paused:boolean}>(`SELECT seller_paused
    FROM worker_availability_schedules WHERE worker_device_id=$1`,[worker]))
    .rows[0]?.seller_paused).toBe(true,'offline resume fails closed');

  // A synthetic signed-review fixture exercises the seller approval UI and SQL
  // transaction only. It does not claim a real Worker publication test run.
  const reviewCapability=randomUUID(),reviewVersion=randomUUID();
  const reviewBudget={providerId:'synthetic',modelId:'review-model',
    credentialRef:'seller:review',maxRequestsPerJob:2,maxInputTokensPerRequest:8192,
    maxOutputTokensPerRequest:256,maxEstimatedSpendMicroUsdPerJob:100_000,
    inputPriceMicroUsdPerMillionTokens:1_000_000,
    outputPriceMicroUsdPerMillionTokens:1_000_000};
  const graphNode=(id:string,type:string,dependsOn:string[]=[])=>({id,type,name:id,
    requirement:'REQUIRED',sensitivity:'MEDIUM',discoveredFrom:['SELLER_DECLARATION'],
    dependsOn,marketplaceSupport:'SUPPORTED',confidence:'CONFIRMED',
    selected:true,health:'READY'});
  const reviewedPackage={...localPackage,capabilityId:reviewCapability,
    capabilityVersionId:reviewVersion,workerManifest:{...localPackage.workerManifest,
      capabilityVersionId:reviewVersion,skills:[{name:'research',contentHash:hash}]},
    dependencyGraph:{graphVersion:1,rootId:'skill',inference:{mode:'REMOTE_PROVIDER',
      dependencyId:'model',provider:'synthetic',model:'review-model',
      credentialRef:'credential',billingOwner:'SELLER'},alternatives:[],nodes:[
      graphNode('skill','SKILL',['model']),graphNode('model','AI_MODEL',['provider','credential']),
      graphNode('provider','AI_PROVIDER'),graphNode('credential','CREDENTIAL')]},
    permissionPolicy:{...localPackage.permissionPolicy,aiInference:'SELLER',
      sellerCredentialRefs:['seller:review'],providerBudget:reviewBudget},
    sellerInferenceConfigHash:hash,dependencySnapshot:[{id:'research',
      version:'v1',contentHash:hash}],testRefs:[randomUUID()]};
  const reviewCandidate=buildVersionCandidate({id:reviewVersion,
    capabilityId:reviewCapability,versionNumber:1,workerDeviceId:worker,
    requestedAt:new Date().toISOString(),localPackage:reviewedPackage,
    selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_999'),
    externalProcessors:['Synthetic provider']});
  const reviewTests={testedPackageHash:reviewCandidate.localPackageHash,
    testedManifestHash:reviewCandidate.workerManifestHash,
    testedPermissionPolicyHash:reviewCandidate.permissionPolicyHash,
    testedDependencyGraphHash:reviewCandidate.dependencyGraphHash,
    observedDependencyGraphHash:reviewCandidate.dependencyGraphHash,
    dependencyHealth:hash,representativeJob:hash,observedVsDeclared:hash,
    securityProbes:hash,outputContract:hash,testedAt:new Date().toISOString(),
    approvedImageDigest:hash,openClawVersion:'2026.8.2'};
  const review={type:'CAPABILITY_REVIEW',protocolVersion:'kivro-worker/1',
    messageId:randomUUID(),controlPlaneId:'m12-browser',workerDeviceId:worker,
    candidate:reviewCandidate,inferenceMode:'REMOTE_PROVIDER',
    requiredConsents:reviewedPackage.dependencyGraph.nodes.map((node)=>({
      dependencyId:node.id,permissionType:node.type,permissionValueRef:node.id,
      sellerLabel:node.name})),providerCost:{estimatedMicroUsd:null,
      estimateSource:'UNKNOWN',maxMicroUsdPerJob:100_000,maxRequestsPerJob:2,
      maxDailyMicroUsd:null},tests:reviewTests};
  await new PostgresSellerPublicationRepository(pool)
    .stageFromAuthenticatedWorker(review,worker);
  await pool.query(`INSERT INTO seller_connect_profiles(seller_profile_id,
    stripe_account_id,stripe_mode,onboarding_status,transfers_enabled,
    payouts_enabled,last_reconciled_at)
    VALUES($1,'acct_M12BROWSER','test','READY',true,true,now())`,[seller]);
  await page.goto('/seller');
  await expect(page.getByRole('heading',{name:'Ready for your review'})).toBeVisible();
  await expect(page.getByText('Estimated provider cost')).toBeVisible();
  await expect(page.getByText('Unknown',{exact:true}).first()).toBeVisible();
  await page.getByText('Input, output and processing contract').click();
  await expect(page.getByRole('heading',{name:'Buyer-visible access summary'})).toBeVisible();
  await expect(page.locator('.publication-public-access li')).toHaveCount(11);
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
  await page.screenshot({path:'test-results/m14-seller-publication-review-desktop.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/m14-seller-publication-review-mobile.png',
    fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByText('Preview the buyer view').click();
  const preview=page.locator('.publication-preview-surface');
  await expect(preview).toContainText('Private preview · version 1');
  await expect(preview).toContainText('$9.99 per job');
  await expect(preview.getByRole('group',{name:'Buyer provides'})
    .getByLabel('Question · required')).toBeDisabled();
  await expect(preview).toContainText('This preview does not purchase a job');
  await page.getByLabel('Public name').fill('Reviewed research');
  await page.getByLabel('Short description').fill(
    'A narrow reviewed research service for company questions.');
  await expect(preview).toContainText('Reviewed research');
  await preview.screenshot({path:'test-results/m14-seller-buyer-preview-mobile.png',
    animations:'disabled'});
  await page.getByLabel('Public name').scrollIntoViewIfNeeded();
  await expect(page.getByLabel('Public name')).toBeVisible();
  await page.screenshot({path:'test-results/m14-seller-publication-form-mobile.png',
    animations:'disabled'});
  await page.locator('.publication-consents').scrollIntoViewIfNeeded();
  await expect(page.getByText(`kivro-worker import permissions ${reviewVersion}`)).toBeVisible();
  await expect(page.getByRole('checkbox',
    {name:/I reviewed this version’s exact local access/})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:/I understand that my provider/})).toBeVisible();
  await page.screenshot({path:'test-results/m14-seller-publication-consent-mobile.png',
    animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByLabel('Public name').fill('Reviewed research');
  await page.getByLabel('URL slug').fill(`review-${reviewCapability}`);
  await page.getByLabel('Short description').fill('A narrow reviewed research service for company questions.');
  await page.getByLabel('What the service does').fill('Too short');
  const consentBoxes=page.locator('.publication-consents input[type=checkbox]');
  for(let index=0;index<await consentBoxes.count();index++)await consentBoxes.nth(index).check();
  await page.getByRole('checkbox',
    {name:/I reviewed this version’s exact local access/}).check();
  await page.getByRole('checkbox',{name:/I understand that my provider/}).check();
  await page.getByRole('button',{name:'Publish reviewed version'}).click();
  await expect(page.getByLabel('What the service does')).toHaveAttribute('aria-invalid','true');
  await expect(page.getByLabel('What the service does')).toHaveAttribute(
    'aria-describedby','publication-form-error');
  await expect(page.getByRole('heading',{name:'Ready for your review'})).toBeVisible();
  await page.getByLabel('What the service does').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/m14-seller-publication-error-mobile.png',
    animations:'disabled'});
  await page.getByLabel('What the service does').fill(
    'A reviewed research service with a narrow buyer question and a short answer.');
  await expect(page.getByLabel('What the service does')).not.toHaveAttribute('aria-invalid','true');
  await page.getByRole('button',{name:'Publish reviewed version'}).click();
  await expect(page.getByRole('heading',{name:'Published version'})).toBeVisible();
  const current=await pool.query<{current_version_id:string;visibility:string}>(
    'SELECT current_version_id,visibility FROM capabilities WHERE id=$1',[reviewCapability]);
  expect(current.rows[0]).toMatchObject({current_version_id:reviewVersion,
    visibility:'PRIVATE'});
  const consents=await pool.query<{n:number}>(`SELECT count(*)::int AS n
    FROM capability_permission_consents WHERE capability_version_id=$1`,[reviewVersion]);
  expect(consents.rows[0]?.n).toBe(4);
  const stored=await pool.query<{version_snapshot:unknown}>(
    'SELECT version_snapshot FROM capability_versions WHERE id=$1',[reviewVersion]);
  expect(hashCanonicalJson((stored.rows[0]?.version_snapshot as {price:unknown}).price)).toBe(
    hashCanonicalJson(reviewCandidate.price));

  const nextVersion=randomUUID();
  const nextPackage={...reviewedPackage,capabilityVersionId:nextVersion,
    priceTier:'USD_1499',
    workerManifest:{...reviewedPackage.workerManifest,capabilityVersionId:nextVersion},
    dependencySnapshot:[{id:'research',version:'v2',contentHash:hash}],
    testRefs:[randomUUID()]};
  const nextCandidate=buildVersionCandidate({id:nextVersion,
    capabilityId:reviewCapability,versionNumber:2,workerDeviceId:worker,
    requestedAt:new Date().toISOString(),localPackage:nextPackage,
    selectedPrice:await new PostgresPriceTierCatalog(pool).selected('USD_1499'),
    externalProcessors:['Synthetic provider']});
  const nextReview={...review,messageId:randomUUID(),candidate:nextCandidate,
    tests:{...reviewTests,testedPackageHash:nextCandidate.localPackageHash,
      testedManifestHash:nextCandidate.workerManifestHash,
      testedPermissionPolicyHash:nextCandidate.permissionPolicyHash,
      testedDependencyGraphHash:nextCandidate.dependencyGraphHash,
      observedDependencyGraphHash:nextCandidate.dependencyGraphHash,
      testedAt:new Date().toISOString()}};
  const repository=new PostgresSellerPublicationRepository(pool);
  const stagedNext=await repository.stageFromAuthenticatedWorker(nextReview,worker);
  await page.goto('/seller');
  const changePreview=page.getByRole('region',
    {name:'Changes from current published version'});
  await expect(changePreview.getByRole('heading',
    {name:'Changes from live version 1'})).toBeVisible();
  await expect(changePreview).toContainText('Economics: buyer $9.99 → $14.99');
  await expect(changePreview).toContainText('Dependency versions or content changed');
  await expect(page.getByText(`kivro-worker import permissions ${nextVersion} --against ${reviewVersion}`)).toBeVisible();
  await expect(changePreview.getByRole('checkbox',
    {name:'I reviewed the changes from the live version.'})).not.toBeChecked();
  await page.setViewportSize({width:390,height:844});
  await changePreview.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'test-results/m14-seller-publication-diff-mobile.png',
    animations:'disabled'});
  await repository.publish(account,{reviewId:stagedNext.reviewId,
    capabilityVersionId:nextVersion,candidateHash:stagedNext.candidateHash,
    manifestHash:nextCandidate.workerManifestHash,packageHash:nextCandidate.localPackageHash,
    policyValidationHash:stagedNext.policyValidationHash,
    slug:`review-${reviewCapability}`,name:'Reviewed research',
    description:'A reviewed research service with a narrow buyer question and a short answer.',
    category:'RESEARCH',shortDescription:'A narrow reviewed research service for company questions.',
    tags:['research'],strengths:['Narrow contract'],limitations:['No personal browser'],
    visibility:'PRIVATE',availability:{schedule:null,concurrencyLimit:1,queueLimit:0,
      futureReservationLimit:0,estimatedRuntimeSeconds:null,maxWaitSeconds:3600},
    consentDependencyIds:nextReview.requiredConsents.map((item)=>item.dependencyId),
    providerCostAcknowledged:true,localPermissionReviewAcknowledged:true,
    versionChangeAcknowledged:true,
    approvedAt:new Date().toISOString()});
  await page.goto('/seller');
  const history=page.locator('.seller-version-control details')
    .filter({hasText:'Reviewed research'});
  await expect(history).toBeVisible();
  await history.locator('summary').click();
  await expect(history.getByText('v2 · active')).toBeVisible();
  await expect(history.getByText('Buyer price $14.99 → $9.99')).toBeVisible();
  await expect(history.getByRole('heading',{name:'Who can find this capability'})).toBeVisible();
  await history.getByLabel('Verified buyer email').fill(buyerEmail);
  await history.getByRole('button',{name:'Grant access'}).click();
  await expect(history.getByText(buyerEmail)).toBeVisible();
  await history.locator('.seller-visibility-control').screenshot({
    path:'test-results/m14-private-access-mobile.png',animations:'disabled'});
  await page.setViewportSize({width:1280,height:900});
  await history.locator('.seller-visibility-control').screenshot({
    path:'test-results/m14-private-access-desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await history.getByRole('button',{name:'Revoke'}).click();
  await expect(history.getByText(buyerEmail)).toHaveCount(0);
  await history.getByLabel('Verified buyer email').fill(buyerEmail);
  await history.getByRole('button',{name:'Grant access'}).click();
  await expect(history.getByText(buyerEmail)).toBeVisible();
  await history.getByRole('combobox',{name:'Visibility'}).selectOption('UNLISTED');
  await history.getByRole('button',{name:'Save visibility'}).click();
  await expect(history.getByText('This capability is available by its direct link.')).toBeVisible();
  expect((await pool.query<{revoked_at:Date|null}>(`SELECT revoked_at
    FROM capability_private_grants WHERE capability_id=$1 ORDER BY granted_at DESC LIMIT 1`,
  [reviewCapability])).rows[0]?.revoked_at).toBeInstanceOf(Date);
  await history.getByRole('combobox',{name:'Visibility'}).selectOption('PUBLIC');
  await history.getByRole('button',{name:'Save visibility'}).click();
  await expect(history.getByText(/Public listing needs fresh Worker and sandbox readiness/)).toBeVisible();
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'test-results/m14-seller-version-history-desktop.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/m14-seller-version-history-mobile.png',
    fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await history.getByRole('checkbox',{name:/I reviewed this version/}).check();
  await history.getByRole('button',{name:'Make v1 active'}).click();
  await expect(page.getByText(/Rollback blocked: this version needs fresh Worker/)).toBeVisible();
  expect((await pool.query<{current_version_id:string}>(
    'SELECT current_version_id FROM capabilities WHERE id=$1',[reviewCapability]))
    .rows[0]?.current_version_id).toBe(nextVersion);
});
