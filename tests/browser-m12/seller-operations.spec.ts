import { expect,test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getAuthService } from '../../dist/apps/web/src/auth/server.js';
import { createSmtpAuthTransport } from '../../dist/apps/web/src/auth/smtp-transport.js';
import { buildVersionCandidate } from '../../dist/packages/domain/src/capability-version.js';
import { PublishedCapabilityVersionSchema } from
  '../../dist/packages/contracts/src/capability-version.js';
import { PostgresPriceTierCatalog } from '../../dist/packages/persistence/src/price-tiers.js';
import { PostgresAvailabilityRepository } from '../../dist/packages/persistence/src/availability.js';
import { PostgresAvailabilityMetrics } from
  '../../dist/packages/persistence/src/availability-metrics.js';
import { PostgresFinanceRepository } from '../../dist/packages/persistence/src/finance.js';

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
  const seller=randomUUID(),worker=randomUUID();
  await pool.query(`INSERT INTO seller_profiles(id,account_id,display_name,status,payout_status)
    VALUES($1,$2,'M12 Seller','ACTIVE','NOT_STARTED')`,[seller,account]);
  await pool.query(`INSERT INTO seller_execution_model_acknowledgements(seller_profile_id,statement_version)
    VALUES($1,1)`,[seller]);
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
  await expect(page.getByRole('heading',{name:/Build a useful service/})).toHaveCount(0);
  await expect(page.getByText('Studio Worker')).toBeVisible();
  await expect(page.getByText('Research studio')).toBeVisible();
  await expect(page.getByText(/Last 30 days, observed minutes:/)).toBeVisible();
  await expect(page.getByText(/missing periods are unknown/)).toBeVisible();
  await page.screenshot({path:'test-results/m13-seller-availability-metrics.png',
    fullPage:true,animations:'disabled'});
  await expect(page.getByText('$9.99 / job · You earn $8.00 · Marketplace fee $1.99')).toBeVisible();
  await expect(page.getByText('Settled buyer sales')).toBeVisible();
  await expect(page.getByText('Seller revenue')).toHaveCount(0);
  await expect(page.getByText(/Earnings can change after a refund or payment dispute/)).toBeVisible();
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
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
  await page.screenshot({path:'test-results/m12-seller-mobile.png',
    fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'Resume new jobs'}).click();
  await expect(page.locator('.ops-error')).toContainText('NOT_READY');
  expect((await pool.query<{seller_paused:boolean}>(`SELECT seller_paused
    FROM worker_availability_schedules WHERE worker_device_id=$1`,[worker]))
    .rows[0]?.seller_paused).toBe(true,'offline resume fails closed');
});
