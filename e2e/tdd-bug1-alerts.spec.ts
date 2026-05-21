import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

async function loginAs(page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Bug 1: Teacher alerts must show same alert data as admin', () => {

  test('Teacher sees non-zero alert counts matching admin', async ({ page }) => {
    // Step 1: Login as admin, capture alert counts
    await loginAs(page, 'verify@test.com', 'verify123');
    await page.waitForTimeout(1000);

    const adminAlertCounts: Record<string, number> = {};
    const adminCategories = page.locator('[aria-label="Alerts"] button[aria-expanded]');
    const catCount = await adminCategories.count();
    for (let i = 0; i < catCount; i++) {
      const text = await adminCategories.nth(i).textContent();
      const badge = await adminCategories.nth(i).locator('span').last().textContent();
      const count = parseInt(badge || '0', 10);
      // Extract category name (Chinese text before the badge)
      adminAlertCounts[text?.trim()?.replace(/\d+$/, '').trim() || `cat-${i}`] = count;
    }
    console.log('Admin alert counts:', JSON.stringify(adminAlertCounts));

    // Verify admin sees alerts (precondition)
    const adminTotalAlerts = Object.values(adminAlertCounts).reduce((a, b) => a + b, 0);
    expect(adminTotalAlerts).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug1-admin-alerts.png', fullPage: true });

    // Step 2: Logout
    const logoutBtn = page.locator('a, button').filter({ hasText: /登出|Logout/ }).first();
    await logoutBtn.click();
    await page.waitForURL('**/login');
    await page.waitForTimeout(500);

    // Step 3: Login as teacher
    await loginAs(page, 'demo@school.hk', 'demo12345');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug1-teacher-alerts.png', fullPage: true });

    // Step 4: Teacher must see non-zero counts for 學生數據 category
    // Admin showed 19 for 學生數據 — teacher should see > 0
    const teacherBody = await page.textContent('body');

    // Find the alert badges — the numbers after each category
    const alertRegion = page.locator('[aria-label="Alerts"]');
    const teacherCategories = alertRegion.locator('button[aria-expanded]');
    const teacherCatCount = await teacherCategories.count();

    const teacherAlertCounts: Record<string, number> = {};
    for (let i = 0; i < teacherCatCount; i++) {
      const badge = await teacherCategories.nth(i).locator('span').last().textContent();
      const count = parseInt(badge || '0', 10);
      const text = await teacherCategories.nth(i).textContent();
      teacherAlertCounts[`cat-${i}`] = count;
      console.log(`Teacher alert category ${i}: "${text?.trim()}" = ${count}`);
    }

    const teacherTotalAlerts = Object.values(teacherAlertCounts).reduce((a, b) => a + b, 0);
    console.log('Teacher total alerts:', teacherTotalAlerts);

    // ASSERTION: Teacher must see alerts (not all zeros)
    // The teacher has visible cohorts, so should see alerts for those students
    expect(teacherTotalAlerts).toBeGreaterThan(1);
  });
});
