import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('sport home page loads and shows hero', async ({ page }) => {
    await page.goto('/sport');
    // Heading contains "สนามกีฬา" or "sports fields" depending on locale
    await expect(page.locator('h1').first()).toBeVisible();
    // At least one field card or the skeleton should appear
    await expect(page.locator('body')).toContainText(/88ARENA|ARENA/i);
  });

  test('signin page renders form', async ({ page }) => {
    await page.goto('/sport/auth/signin');
    await expect(page.getByPlaceholder('example@email.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('landing page is reachable', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(500);
  });

  test('protected route redirects when not signed in', async ({ page }) => {
    await page.goto('/sport/admin');
    // Wait for any navigation away from the admin page
    await page.waitForURL((url) => !url.pathname.startsWith('/sport/admin'), { timeout: 10_000 });
    const pathname = new URL(page.url()).pathname;
    expect(pathname).not.toMatch(/^\/sport\/admin/);
    expect(pathname).toMatch(/^\/sport/);
  });
});
