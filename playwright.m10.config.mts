import { defineConfig } from '@playwright/test';
import process from 'node:process';
process.loadEnvFile('.env.local');
if(!process.env.M10_DATABASE_URL)throw new Error('M10_DATABASE_URL is required');
const origin='http://localhost:3336';
process.env.APP_ORIGIN=origin;
process.env.DATABASE_URL=process.env.M10_DATABASE_URL;
process.env.KIVRO_STRIPE_MODE='test';
process.env.KIVRO_LEASE_KEY_VERSION='m10';
process.env.KIVRO_LEASE_KEY_BASE64=Buffer.alloc(32,17).toString('base64');
export default defineConfig({testDir:'./tests/browser-m10',workers:1,retries:0,timeout:120_000,
  use:{baseURL:origin,browserName:'chromium',headless:true,
    launchOptions:process.platform==='darwin'?{
      executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}},
  webServer:{command:'pnpm --filter @kivro/web dev --port 3336',url:`${origin}/discover`,
    reuseExistingServer:false,timeout:30_000,env:{APP_ORIGIN:origin,
      DATABASE_URL:process.env.M10_DATABASE_URL,KIVRO_STRIPE_MODE:'test',
      OBJECT_STORAGE_ENDPOINT:process.env.OBJECT_STORAGE_ENDPOINT,
      OBJECT_STORAGE_BUCKET:process.env.OBJECT_STORAGE_BUCKET,
      OBJECT_STORAGE_REGION:process.env.OBJECT_STORAGE_REGION,
      OBJECT_STORAGE_ACCESS_KEY_ID:process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
      OBJECT_STORAGE_SECRET_ACCESS_KEY:process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      KIVRO_LEASE_KEY_VERSION:'m10',
      KIVRO_LEASE_KEY_BASE64:Buffer.alloc(32,17).toString('base64')}},
});
