import { expect,test } from '@playwright/test';
import { randomUUID,createHash } from 'node:crypto';
import { getAuthService } from '../../dist/apps/web/src/auth/server.js';
import { createSmtpAuthTransport } from '../../dist/apps/web/src/auth/smtp-transport.js';

async function verificationLink(email:string):Promise<string>{
  const api=`http://127.0.0.1:${process.env.M13_MAIL_API_PORT}`;
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

test('buyer account manages one-time API secrets and signed webhook endpoints',async({page})=>{
  const auth=getAuthService(),pool=auth.database;
  const email=`m13-browser-${randomUUID()}@example.test`;
  const password='M13 browser password 123456!';
  const transport=createSmtpAuthTransport({host:'127.0.0.1',
    port:Number(process.env.M13_MAIL_SMTP_PORT),
    from:'Kivro Dev <no-reply@kivro.local>',security:'LOCAL_PLAINTEXT',production:false});
  await page.goto('/sign-in?mode=create');
  await page.getByRole('textbox',{name:'Your name'}).fill('M13 Buyer');
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
  await Promise.all([page.waitForResponse((response)=>response.url().endsWith(
    '/api/buyer/integrations/keys')&&response.status()===200),page.reload()]);
  await expect(page.getByRole('heading',{name:'Make Kivro part of your workflow.'})).toBeVisible();
  await page.getByPlaceholder('Production automation').fill('Build client');
  await page.getByRole('button',{name:'Create key'}).click();
  const secret=await page.locator('.integration-secret code').innerText();
  expect(secret).toMatch(/^kv_test_/);
  const account=(await pool.query<{id:string}>('SELECT id FROM accounts WHERE primary_email=$1',
    [email])).rows[0]!.id;
  const stored=(await pool.query<{secret_hash:string}>(`SELECT secret_hash FROM buyer_api_keys
    WHERE account_id=$1`,[account])).rows[0]!;
  expect(stored.secret_hash).toBe(createHash('sha256').update(secret).digest('hex'));
  await page.getByRole('button',{name:'I saved it'}).click();
  await expect(page.getByText(secret)).toHaveCount(0);
  const read=await page.request.get('/v1/capabilities',{
    headers:{authorization:`Bearer ${secret}`}});
  expect(read.status()).toBe(200);
  const noWorker=await page.request.post('/worker/messages',{
    headers:{authorization:`Bearer ${secret}`},data:{}});
  expect(noWorker.status()).not.toBe(200);
  await page.getByRole('button',{name:'Rotate',exact:true}).click();
  const rotated=await page.locator('.integration-secret code').innerText();
  expect(rotated).not.toBe(secret);
  expect((await page.request.get('/v1/capabilities',{
    headers:{authorization:`Bearer ${secret}`}})).status()).toBe(401);
  await page.getByRole('button',{name:'I saved it'}).click();
  const rotatedRow=page.locator('.integration-list article').filter({hasText:rotated.split('_')
    .slice(0,3).join('_')});
  await rotatedRow.getByRole('button',{name:'Revoke',exact:true}).click();
  await expect(rotatedRow).toContainText('Revoked');
  expect((await page.request.get('/v1/capabilities',{
    headers:{authorization:`Bearer ${rotated}`}})).status()).toBe(401);
  await page.getByPlaceholder('https://example.com/kivro/events')
    .fill('https://127.0.0.1/hook');
  await page.getByRole('button',{name:'Add endpoint'}).click();
  await expect(page.locator('.integrations .notice.error')).toContainText('INVALID_DESTINATION');
  await page.getByPlaceholder('https://example.com/kivro/events')
    .fill('https://1.1.1.1/kivro/events');
  await page.getByRole('button',{name:'Add endpoint'}).click();
  const hookSecret=await page.locator('.integration-secret code').innerText();
  expect(hookSecret).toMatch(/^whsec_/);
  await page.getByRole('button',{name:'I saved it'}).click();
  await page.getByRole('button',{name:'Send test'}).click();
  await expect(page.getByRole('status')).toContainText('queued');
  await page.getByRole('button',{name:'Deliveries'}).click();
  await expect(page.getByText('test.ping')).toBeVisible();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('.integration-edit').getByRole('checkbox',{name:'job.failed'}).uncheck();
  await page.getByRole('button',{name:'Save endpoint'}).click();
  await expect(page.locator('.integration-edit')).toHaveCount(0);
  await expect(page.locator('.integration-list article').last()).toContainText('job.completed');
  const subscriptions=(await pool.query<{events:string[]}>(`SELECT events
    FROM buyer_webhook_endpoints WHERE account_id=$1`,[account])).rows[0]!.events;
  expect(subscriptions).toEqual(['job.completed']);
  await page.screenshot({path:'test-results/m13-buyer-integrations-desktop.png',
    fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
  await page.screenshot({path:'test-results/m13-buyer-integrations-mobile.png',
    fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'Remove'}).click();
  await expect(page.getByText('No endpoints yet.')).toBeVisible();
});
