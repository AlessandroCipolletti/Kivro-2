import { defineConfig } from '@playwright/test';
import process from 'node:process';
process.loadEnvFile('.env.local');
if(!process.env.M12_DATABASE_URL)throw new Error('M12_DATABASE_URL is required');
const origin='http://localhost:3337';
process.env.APP_ORIGIN=origin;
process.env.DATABASE_URL=process.env.M12_DATABASE_URL;
process.env.KIVRO_STRIPE_MODE='test';
process.env.KIVRO_LEASE_KEY_VERSION='m12';
process.env.KIVRO_LEASE_KEY_BASE64=Buffer.alloc(32,12).toString('base64');
process.env.KIVRO_CONTROL_PLANE_ID='m12-browser-plane';
export default defineConfig({testDir:'./tests/browser-m12',workers:1,retries:0,timeout:90_000,
  use:{baseURL:origin,browserName:'chromium',headless:true,
    launchOptions:process.platform==='darwin'?{
      executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}},
  webServer:{command:'pnpm --filter @kivro/web dev --port 3337',url:`${origin}/sign-in`,
    reuseExistingServer:false,timeout:30_000,env:{APP_ORIGIN:origin,
      DATABASE_URL:process.env.M12_DATABASE_URL,KIVRO_STRIPE_MODE:'test',
      KIVRO_LEASE_KEY_VERSION:'m12',
      KIVRO_LEASE_KEY_BASE64:Buffer.alloc(32,12).toString('base64'),
      KIVRO_CONTROL_PLANE_ID:'m12-browser-plane'}},
});
