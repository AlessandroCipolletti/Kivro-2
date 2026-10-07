import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { getAuthService } from '../../dist/apps/web/src/auth/server.js';
import { createSmtpAuthTransport } from '../../dist/apps/web/src/auth/smtp-transport.js';

const origin = 'http://localhost:3335';
const mailpit = 'http://127.0.0.1:18025';

async function localMailLink(recipient: string, subject: string): Promise<string> {
  const list = await fetch(`${mailpit}/api/v1/messages`).then((response) => response.json()) as {
    messages: { ID: string; Subject: string; To: { Address: string }[] }[];
  };
  const summary = list.messages.find((item) => item.Subject === subject &&
    item.To.some((address) => address.Address === recipient));
  expect(summary, `Expected ${subject} email`).toBeDefined();
  const detail = await fetch(`${mailpit}/api/v1/message/${summary?.ID}`).then((response) => response.json()) as { Text: string };
  const link = /https?:\/\/[^\s]+/.exec(detail.Text)?.[0];
  expect(link).toBeTruthy();
  if (!link) throw new Error('Missing local mail link');
  expect(new URL(link).origin).toBe(origin);
  return link;
}

test('email registration through final account and one-use recovery', async ({ page }) => {
  expect(process.env.NODE_ENV).toBe('development');
  expect(['localhost', '127.0.0.1']).toContain(new URL(process.env.DATABASE_URL ?? '').hostname);
  const service = getAuthService();
  const transport = createSmtpAuthTransport({ host: '127.0.0.1', port: 11025,
    from: 'Kivro Dev <no-reply@kivro.local>', security: 'LOCAL_PLAINTEXT', production: false });
  await service.database.query('DELETE FROM auth_rate_limits');
  const email = `browser-${randomUUID()}@example.test`;
  const password = 'Browser fixture password 123456!';
  const newPassword = 'Browser changed password 654321!';

  await page.goto('/sign-in?mode=create');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Browser Buyer');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByRole('button', { name: 'Resend verification link' }).click();
  await expect(page.getByRole('status')).toContainText('a new link is on its way');

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#auth-notice[role="alert"]')).toContainText('verify');

  await service.outbox.deliverDue(transport);
  const verifyLink = await localMailLink(email, 'Verify your Kivro email');
  await page.goto(verifyLink);
  await expect(page).toHaveURL(/\/sign-in\?verified=1/);
  await expect(page.getByRole('status')).toContainText('Email verified');
  expect((await page.goto(verifyLink))?.status()).toBe(401);
  await page.goto('/sign-in');

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('link', { name: 'Go to seller workspace' }).click();
  await expect(page).toHaveURL('/seller');
  await expect(page.getByRole('heading', { name: 'Name your seller workspace' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Public seller name' }).fill('Northfield Studio');
  await expect(page.getByRole('button', { name: 'Create seller profile' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /I understand approved jobs will run/ }).check();
  const [sellerResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/seller/profile') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create seller profile' }).click(),
  ]);
  expect(sellerResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Northfield Studio' })).toBeVisible();
  await expect(page.getByText('Nothing is listed or available to buyers.')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/m03-seller-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => page.locator('.seller-heading').evaluate((element) => getComputedStyle(element).position)).toBe('static');
  await page.screenshot({ path: 'test-results/m03-seller-mobile.png', animations: 'disabled' });
  await page.locator('.seller-panel').screenshot({ path: 'test-results/m03-seller-mobile-panel.png', animations: 'disabled' });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await page.goto('/account');
  await expect(page).toHaveURL('/sign-in');
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/sign-in/);

  await page.goto('/reset-password');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('button', { name: 'Send recovery link' }).click();
  await expect(page.getByRole('status')).toContainText('If this address has an account');
  await service.outbox.deliverDue(transport);
  const resetLink = await localMailLink(email, 'Reset your Kivro password');
  await page.goto(resetLink);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('New password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
  await page.goto(resetLink);
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByLabel('New password')).toHaveCount(0);

  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#auth-notice[role="alert"]')).toContainText('could not sign you in');
  await page.getByLabel('Password').fill(newPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/account');
  await service.database.end();
});
