import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test('Switch between admin and teacher accounts', async ({ page }) => {
  // Login as admin
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');

  // Verify admin is logged in
  const adminBody = await page.textContent('body');
  expect(adminBody).toContain('verify@test.com');

  // Take screenshot
  await page.screenshot({ path: 'e2e/screenshots/switch-1-admin-logged-in.png', fullPage: true });

  // Now navigate to login to switch accounts
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1000); // Wait for logout effect

  // Take screenshot of login page
  await page.screenshot({ path: 'e2e/screenshots/switch-2-login-page.png', fullPage: true });

  // Login as teacher
  await page.fill('input[name="email"]', 'demo@school.hk');
  await page.fill('input[name="password"]', 'demo12345');
  await page.click('button[type="submit"]');

  // Wait for either dashboard or error
  await page.waitForTimeout(3000);

  // Take screenshot of result
  await page.screenshot({ path: 'e2e/screenshots/switch-3-teacher-result.png', fullPage: true });

  // Check if we landed on dashboard or got an error
  const currentUrl = page.url();
  const bodyText = await page.textContent('body');
  console.log('Current URL after teacher login:', currentUrl);
  console.log('Has error:', bodyText.includes('failed') || bodyText.includes('Failed') || bodyText.includes('error'));

  // Should be on dashboard
  expect(currentUrl).toContain('/dashboard');
});

test('Switch from admin to student account', async ({ page }) => {
  // Login as admin
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Switch to student login
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1000);

  // Click student tab
  const studentTab = page.locator('button[aria-pressed]').filter({ hasText: /Student|學生/ });
  await studentTab.click();
  await page.waitForTimeout(500);

  await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
  await page.fill('input[name="password"]', 'Student123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'e2e/screenshots/switch-4-student-result.png', fullPage: true });

  const currentUrl = page.url();
  console.log('Current URL after student login:', currentUrl);
  expect(currentUrl).toContain('/dashboard');
});
