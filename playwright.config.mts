import { defineConfig } from '@playwright/test';
import process from 'node:process';

process.loadEnvFile('.env.local');
const origin = 'http://localhost:3335';
process.env.APP_ORIGIN = origin;

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: true,
    launchOptions: process.platform === 'darwin'
      ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
      : {},
  },
  webServer: {
    command: 'pnpm --filter @kivro/web dev --port 3335',
    url: `${origin}/sign-in`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { APP_ORIGIN: origin },
  },
});
