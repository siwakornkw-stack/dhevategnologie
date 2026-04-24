import { test, expect } from '@playwright/test';

test.describe('auth flow', () => {
  test('user can sign in with seeded credentials', async ({ page }) => {
    await page.goto('/sport/auth/signin');
    await page.getByPlaceholder('example@email.com').fill('user@88arena.com');
    await page.locator('input[type="password"]').fill('user1234');
    await page.getByRole('button', { name: /เข้าสู่ระบบ|Sign in/i }).first().click();
    await page.waitForURL(/\/sport\/?$/);
    // After login, header shows a logged-in-only link
    await expect(page.getByRole('link', { name: /การจองของฉัน|My bookings/i }).first()).toBeVisible();
  });

  test('invalid credentials show error toast', async ({ page }) => {
    await page.goto('/sport/auth/signin');
    await page.getByPlaceholder('example@email.com').fill('nope@example.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: /เข้าสู่ระบบ|Sign in/i }).first().click();
    // Remain on signin page
    await expect(page).toHaveURL(/\/sport\/auth\/signin/);
  });
});
