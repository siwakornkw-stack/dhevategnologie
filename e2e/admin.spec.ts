import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@88arena.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin1234';

test.describe('SEO and meta', () => {
  test('robots.txt is served', async ({ page }) => {
    const res = await page.goto('/robots.txt');
    expect(res?.status()).toBe(200);
    const body = await page.content();
    expect(body).toMatch(/User-agent/i);
  });

  test('sitemap.xml is served', async ({ page }) => {
    const res = await page.goto('/sitemap.xml');
    expect(res?.status()).toBe(200);
  });

  test('404 page renders branded content', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz123');
    await expect(page.locator('body')).toContainText('404');
    await expect(page.locator('body')).toContainText('88ARENA');
  });
});

test.describe('admin flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sport/auth/signin');
    await page.getByPlaceholder('example@email.com').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /เข้าสู่ระบบ|Sign in/i }).click();
    await page.waitForURL('**/sport', { timeout: 10_000 });
  });

  test('admin can reach dashboard', async ({ page }) => {
    await page.goto('/sport/admin');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/Dashboard/i);
  });

  test('admin can reach bookings page', async ({ page }) => {
    await page.goto('/sport/admin/bookings');
    await expect(page.locator('body')).toContainText(/จองทั้งหมด|All bookings/i);
  });

  test('admin can reach users page', async ({ page }) => {
    await page.goto('/sport/admin/users');
    await expect(page.locator('body')).toContainText(/ผู้ใช้|Users/i);
  });

  test('admin can reach coupons page', async ({ page }) => {
    await page.goto('/sport/admin/coupons');
    await expect(page.locator('body')).toContainText(/คูปอง|Coupons/i);
  });
});
