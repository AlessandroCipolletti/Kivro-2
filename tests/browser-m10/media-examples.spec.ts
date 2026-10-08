import { expect,test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Buffer } from 'node:buffer';
import { createHash,randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { S3PrivateObjectStorage } from '../../dist/packages/infrastructure/s3/src/storage.js';
import { PublishedCapabilityVersionSchema } from '../../dist/packages/contracts/src/capability-version.js';
import { MarketplaceSocialRepository } from '../../dist/packages/persistence/src/marketplace-social.js';
import { createSmtpAuthTransport } from '../../dist/apps/web/src/auth/smtp-transport.js';
import { PgAuthMessageOutbox } from '../../dist/apps/web/src/auth/outbox.js';

const media=[
  {key:'image',mime:'image/png',file:'sample.png'},
  {key:'video',mime:'video/mp4',file:'sample.mp4'},
  {key:'audio',mime:'audio/wav',file:'sample.wav'},
  {key:'document',mime:'application/pdf',file:'sample.pdf'},
  {key:'scene',mime:'application/x-blender',file:'sample.blend'},
] as const;

async function verifyBuyerEmail(email:string):Promise<string>{
  const list=await fetch('http://127.0.0.1:18025/api/v1/messages').then((response)=>
    response.json()) as {messages:{ID:string;Subject:string;To:{Address:string}[]}[]};
  const target=list.messages.find((message)=>message.Subject==='Verify your Kivro email'&&
    message.To.some((recipient)=>recipient.Address===email));
  expect(target).toBeDefined();
  const detail=await fetch(`http://127.0.0.1:18025/api/v1/message/${target!.ID}`)
    .then((response)=>response.json()) as {Text:string};
  const link=/https?:\/\/[^\s]+/.exec(detail.Text)?.[0];
  expect(link).toBeTruthy();
  return link!;
}

test('seller-approved media examples use private SeaweedFS bytes and safe desktop/mobile previews',async({page})=>{
  const pool=new pg.Pool({connectionString:process.env.M10_DATABASE_URL!,max:8});
  const social=new MarketplaceSocialRepository(pool);
  const source=(await pool.query<{seller_profile_id:string;account_id:string;
    worker_manifest_hash:string;policy_validation_hash:string;version_snapshot:unknown}>(`
    SELECT c.seller_profile_id,s.account_id,v.worker_manifest_hash,
      v.policy_validation_hash,v.version_snapshot FROM capabilities c
    JOIN seller_profiles s ON s.id=c.seller_profile_id
    JOIN capability_versions v ON v.id=c.current_version_id
    WHERE c.name='Research brief' LIMIT 1`)).rows[0]!;
  const capabilityId=randomUUID(),versionId=randomUUID(),exampleId=randomUUID();
  const slug=`m16-media-${capabilityId}`;
  const original=PublishedCapabilityVersionSchema.parse(source.version_snapshot);
  const fileField=(key:string,mime:string,order:number)=>({key,label:key[0]!.toUpperCase()+key.slice(1),
    order,required:false,type:'FILE' as const,constraints:{maxFiles:1,
      maxFileSizeBytes:1_000_000,maxTotalSizeBytes:1_000_000,
      allowedMimeTypes:[mime],allowedExtensions:[`.${media.find((item)=>item.key===key)!.file.split('.').at(-1)!}`]}});
  const ioContract={contractVersion:1,input:{schemaVersion:1,fields:[
    {key:'brief',label:'Brief',order:0,required:true,type:'LONG_TEXT' as const},
    {key:'format',label:'Output format',order:1,required:true,type:'SELECT' as const,
      constraints:{allowedValues:['image','video']}},
    fileField('image','image/png',2),
    {...fileField('video','video/mp4',3),visibleWhen:{fieldKey:'format',equals:'video'}},
    fileField('scene','application/x-blender',4),
  ]},output:{schemaVersion:1,fields:[
    {key:'summary',label:'Summary',order:0,required:true,type:'MARKDOWN' as const},
    ...media.map((item,index)=>fileField(item.key,item.mime,index+1)),
  ]}};
  const version=PublishedCapabilityVersionSchema.parse({...original,id:versionId,
    capabilityId,versionNumber:1,ioContract,publishedAt:new Date().toISOString()});
  const storage=new S3PrivateObjectStorage({bucket:process.env.OBJECT_STORAGE_BUCKET!,
    region:process.env.OBJECT_STORAGE_REGION!,endpoint:process.env.OBJECT_STORAGE_ENDPOINT!,
    accessKeyId:process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
    secretAccessKey:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
    allowInsecureLoopback:true});
  const ids=new Map<string,string>();
  const inputIds=new Map<string,string>();
  try{
    const email=`m16-media-${randomUUID()}@example.test`;
    const password='M16 media contract buyer 123456!';
    const outbox=new PgAuthMessageOutbox(pool,
      Buffer.from(process.env.AUTH_OUTBOX_KEY_BASE64!,'base64'),
      process.env.APP_ORIGIN!);
    const transport=createSmtpAuthTransport({host:'127.0.0.1',port:11025,
      from:'Kivro Dev <no-reply@kivro.local>',security:'LOCAL_PLAINTEXT',
      production:false});
    await page.goto('/sign-in?mode=create');
    await page.getByRole('textbox',{name:'Your name'}).fill('Media Contract Buyer');
    await page.getByRole('textbox',{name:'Email address'}).fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'Create account'}).click();
    await expect(page.getByRole('heading',{name:'Verify your email'})).toBeVisible();
    await outbox.deliverDue(transport);
    await page.goto(await verifyBuyerEmail(email));
    await page.goto('/sign-in');
    await page.getByRole('textbox',{name:'Email address'}).fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'Sign in'}).click();
    await expect(page).toHaveURL('/account');
    await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
      VALUES($1,$2,$3,'Media examples','Seller-approved format examples','PUBLISHED')`,
    [capabilityId,source.seller_profile_id,slug]);
    await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
      publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
      VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
    [versionId,capabilityId,version,source.worker_manifest_hash,source.policy_validation_hash]);
    await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC' WHERE id=$1`,
      [capabilityId,versionId]);
    await social.setSellerMetadata(capabilityId,source.account_id,{
      category:'MEDIA',shortDescription:'Seller-approved media examples',
      tags:['media'],strengths:[],limitations:[]});
    for(const item of media){
      const assetId=randomUUID();ids.set(item.key,assetId);
      const bytes=readFileSync(new URL(`../fixtures/m16-media/${item.file}`,import.meta.url));
      const key=`private/assets/${assetId}/${randomUUID()}`;
      const sha256=`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      await pool.query(`INSERT INTO assets(id,owner_account_id,kind,state,object_key,
        size_bytes,sha256,detected_mime_type,retain_until,finalized_at)
        VALUES($1,$2,'EXAMPLE','READY',$3,$4,$5,$6,now()+interval '30 days',now())`,
      [assetId,source.account_id,key,bytes.length,sha256,item.mime]);
      await storage.putPrivateObject(key,(async function*(){yield bytes;})(),{
        contentType:item.mime,sizeBytes:bytes.length,sha256});
      expect((await fetch(`${process.env.OBJECT_STORAGE_ENDPOINT}/${process.env.OBJECT_STORAGE_BUCKET}/${key}`)).status)
        .toBe(403);
    }
    for(const item of media.filter((candidate)=>['image','video','scene'].includes(candidate.key))){
      const assetId=randomUUID();inputIds.set(item.key,assetId);
      const bytes=readFileSync(new URL(`../fixtures/m16-media/${item.file}`,import.meta.url));
      const key=`private/assets/${assetId}/${randomUUID()}`;
      const sha256=`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      await pool.query(`INSERT INTO assets(id,owner_account_id,kind,state,object_key,
        size_bytes,sha256,detected_mime_type,retain_until,finalized_at)
        VALUES($1,$2,'EXAMPLE','READY',$3,$4,$5,$6,now()+interval '30 days',now())`,
      [assetId,source.account_id,key,bytes.length,sha256,item.mime]);
      await storage.putPrivateObject(key,(async function*(){yield bytes;})(),{
        contentType:item.mime,sizeBytes:bytes.length,sha256});
    }
    await social.publishSellerCuratedExample({id:exampleId,
      capabilityId,sellerAccountId:source.account_id,title:'Media format sample',
      description:'Approved output and input formats',order:0,
      inputPayload:{values:{brief:'Create a small media package',format:'video'},assets:{
        image:[inputIds.get('image')],video:[inputIds.get('video')],
        scene:[inputIds.get('scene')]}},
      outputPayload:{values:{summary:'# Approved media result'},assets:Object.fromEntries(
        media.map((item)=>[item.key,[ids.get(item.key)]]))}});
    await page.goto(`/capabilities/${slug}`);
    const runInputs=page.locator('.run-fields');
    const videoInput=runInputs.locator('label.run-field > span')
      .getByText('Video',{exact:true});
    await expect(videoInput).toHaveCount(0);
    await runInputs.getByLabel('Output format').selectOption('video');
    await expect(videoInput).toBeVisible();
    await runInputs.getByLabel('Output format').selectOption('image');
    await expect(videoInput).toHaveCount(0);
    const examples=page.locator('.example-card');
    await expect(examples).toContainText('Media format sample');
    await expect(examples.locator('img')).toHaveCount(2);
    await expect(examples.locator('video')).toHaveCount(2);
    await expect(examples.locator('audio')).toHaveCount(1);
    await expect(examples.locator('iframe')).toHaveCount(1);
    for(const item of media){
      const assetId=ids.get(item.key)!;
      const download=await page.request.get(`/api/marketplace/example-asset/${assetId}`);
      expect(download.status()).toBe(200);
      expect(download.headers()['content-disposition']).toContain(`.${item.file.split('.').at(-1)}`);
      expect(download.headers()['content-disposition']).not.toContain(assetId);
      expect(download.headers()['content-security-policy']).toContain("default-src 'none'");
      expect(download.headers()['x-content-type-options']).toBe('nosniff');
      const preview=await page.request.get(`/api/marketplace/example-asset/${assetId}?preview=1`);
      expect(preview.status()).toBe(200);
      expect(preview.headers()['content-disposition']).toContain(
        ['image','video','audio','document'].includes(item.key)?'inline':'attachment');
      expect(Buffer.from(await download.body())).toEqual(
        readFileSync(new URL(`../fixtures/m16-media/${item.file}`,import.meta.url)));
      await expect(examples).toContainText(item.mime);
      await expect(examples).toContainText(`kivro-example-${item.key}`);
      await expect(examples).not.toContainText(assetId);
    }
    await expect(examples.locator('a[download]')).toHaveCount(8);
    expect(await examples.locator('iframe').getAttribute('sandbox')).toBe('');
    await page.screenshot({path:'test-results/m16-media-examples-desktop.png',fullPage:true,
      animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    await expect(examples).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    const audit=await new AxeBuilder({page}).withTags(
      ['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(audit.violations.map((violation)=>violation.id)).toEqual([]);
    await page.screenshot({path:'test-results/m16-media-examples-mobile.png',fullPage:true,
      animations:'disabled'});
    const blender=JSON.parse(readFileSync(new URL('../fixtures/m16-blender-contract.json',
      import.meta.url),'utf8'));
    const blenderId=randomUUID(),blenderVersionId=randomUUID();
    const blenderSlug=`m16-blender-${blenderId}`;
    const blenderVersion=PublishedCapabilityVersionSchema.parse({...original,
      id:blenderVersionId,capabilityId:blenderId,versionNumber:1,
      ioContract:blender,publishedAt:new Date().toISOString()});
    await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
      VALUES($1,$2,$3,'Blender Product Renderer','Render selected Blender scenes','PUBLISHED')`,
    [blenderId,source.seller_profile_id,blenderSlug]);
    await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
      publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
      VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
    [blenderVersionId,blenderId,blenderVersion,source.worker_manifest_hash,
      source.policy_validation_hash]);
    await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC'
      WHERE id=$1`,[blenderId,blenderVersionId]);
    await social.setSellerMetadata(blenderId,source.account_id,{category:'MEDIA',
      shortDescription:'Blender scene rendering',tags:['blender','render'],
      strengths:[],limitations:[]});
    await page.goto(`/capabilities/${blenderSlug}`);
    const contract=page.locator('.detail-contract');
    await expect(page.locator('.run-fields').getByLabel('Resolution'))
      .toHaveValue('1080p');
    for(const label of ['Render instructions','Blender scene','Reference images',
      'Resolution','Rendered images','Modified scene'])
      await expect(contract.getByText(label,{exact:true})).toBeVisible();
    await expect(contract).toContainText('.blend');
    await expect(contract).toContainText('.jpg, .jpeg, .png, .webp');
    await expect(contract).toContainText('500.0 MB each');
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:'test-results/m16-blender-contract-desktop.png',
      fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({path:'test-results/m16-blender-contract-mobile.png',
      fullPage:true,animations:'disabled'});
    const advertising=JSON.parse(readFileSync(new URL(
      '../fixtures/m06-advertising-capability.json',import.meta.url),'utf8'));
    const adId=randomUUID(),adVersionId=randomUUID(),adSlug=`m16-video-ad-${adId}`;
    const adVersion=PublishedCapabilityVersionSchema.parse({...original,
      id:adVersionId,capabilityId:adId,versionNumber:1,
      ioContract:advertising.ioContract,
      publicResearchPolicy:advertising.internetPolicy,
      externalProcessors:['example.com'],
      publicPermissionManifest:{...original.publicPermissionManifest,
        entries:original.publicPermissionManifest.entries.map((entry)=>
          entry.category==='PUBLIC_INTERNET'?{...entry,state:'PUBLIC_RESEARCH_ONLY'}:entry)},
      publishedAt:new Date().toISOString()});
    await pool.query(`INSERT INTO capabilities(id,seller_profile_id,slug,name,description,status)
      VALUES($1,$2,$3,'Competitive Video Ad Generator',
        'A seller-approved video-ad service using bounded public research','PUBLISHED')`,
    [adId,source.seller_profile_id,adSlug]);
    await pool.query(`INSERT INTO capability_versions(id,capability_id,version_number,
      publication_state,version_snapshot,worker_manifest_hash,policy_validation_hash,published_at)
      VALUES($1,$2,1,'PUBLISHED',$3,$4,$5,now())`,
    [adVersionId,adId,adVersion,source.worker_manifest_hash,
      source.policy_validation_hash]);
    await pool.query(`UPDATE capabilities SET current_version_id=$2,visibility='PUBLIC'
      WHERE id=$1`,[adId,adVersionId]);
    await social.setSellerMetadata(adId,source.account_id,{category:'MEDIA',
      shortDescription:'Public research and private video assembly',
      tags:['video','advertising'],strengths:['60-second MP4'],
      limitations:['Restricted sites may be unavailable']});
    await page.goto(`/capabilities/${adSlug}`);
    const adContract=page.locator('.detail-contract');
    for(const label of ['Company name','Company website','Product description',
      'Brand assets','Target audience','60-second video advertisement',
      'Creative strategy','Research sources'])
      await expect(adContract.getByText(label,{exact:true})).toBeVisible();
    await expect(page.getByText('Public research:').first()).toContainText('Declared');
    await expect(page.getByText('Restricted sites may be unavailable')).toBeVisible();
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:'test-results/m16-video-ad-contract-desktop.png',
      fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({path:'test-results/m16-video-ad-contract-mobile.png',
      fullPage:true,animations:'disabled'});
  }finally{storage.destroy();await pool.end();}
});
