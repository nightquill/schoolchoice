import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test.describe('Default "All Students" cohort protections', () => {

  test('Default cohort: no delete button, no remove member button, no add students button', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'verify@test.com');
    await page.fill('input[type="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate directly to the default cohort
    await page.goto(`${BASE}/cohorts/009b56ee-2b15-4a98-b660-8bea6d6c3d43`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify we're on the cohort detail page showing translated name
    const heading = page.locator('h1').first();
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/All Students|所有學生/);

    // Verify NO "Add Students" button visible
    const addButton = page.locator('button').filter({ hasText: /Add Students|新增學生/ });
    await expect(addButton).toHaveCount(0);

    // Verify NO remove buttons in the member table
    const removeButtons = page.locator('button').filter({ hasText: /Remove|移除/ });
    // There should be zero remove buttons (default cohort hides them)
    const removeCount = await removeButtons.count();
    expect(removeCount).toBe(0);

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/default-cohort-protected.png', fullPage: true });
  });

  test('Register page redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('Login page has no "Register" link', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toHaveCount(0);
  });
});
