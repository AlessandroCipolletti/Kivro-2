import { defineConfig } from '@playwright/test';
import process from 'node:process';
process.loadEnvFile('.env.local');
if(!process.env.M13_DATABASE_URL)throw new Error('M13_DATABASE_URL is required');
const origin='http://localhost:3338';
process.env.APP_ORIGIN=origin;
process.env.DATABASE_URL=process.env.M13_DATABASE_URL;
process.env.KIVRO_STRIPE_MODE='test';
process.env.KIVRO_WEBHOOK_ENCRYPTION_KEY=Buffer.alloc(32,13).toString('hex');
export default defineConfig({testDir:'./tests/browser-m13',workers:1,retries:0,timeout:90_000,
  use:{baseURL:origin,browserName:'chromium',headless:true,
    launchOptions:process.platform==='darwin'?{
      executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}},
  webServer:{command:'pnpm --filter @kivro/web dev --port 3338',url:`${origin}/sign-in`,
    reuseExistingServer:false,timeout:30_000,env:{APP_ORIGIN:origin,
      DATABASE_URL:process.env.M13_DATABASE_URL,KIVRO_STRIPE_MODE:'test',
      KIVRO_WEBHOOK_ENCRYPTION_KEY:Buffer.alloc(32,13).toString('hex')}},
});
