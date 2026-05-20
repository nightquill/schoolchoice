import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test('Teacher dashboard shows pending review alerts', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'demo@school.hk');
  await page.fill('input[name="password"]', 'demo12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'e2e/screenshots/teacher-alerts.png', fullPage: true });

  // Alerts section should be visible
  const alertsRegion = page.locator('[role="region"][aria-label="Alerts"]');
  await expect(alertsRegion).toBeVisible();

  // Should show "Pending Reviews" category with count > 0
  const pendingCategory = page.locator('button').filter({ hasText: /Pending|待審/ });
  await expect(pendingCategory.first()).toBeVisible();

  // Click to expand
  await pendingCategory.first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/screenshots/teacher-alerts-expanded.png', fullPage: true });

  // Should show the actual alert with student name
  const alertText = await page.textContent('[role="region"][aria-label="Alerts"]');
  expect(alertText).toContain('Chan Siu Ming');
});
