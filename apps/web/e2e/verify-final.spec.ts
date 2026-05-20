import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test('Final verification: cohort report localized', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto(`${BASE}/cohorts/fa303904-0c50-4eb6-906c-38aab92f7157/report`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/final-cohort-report.png', fullPage: true });

  const bodyText = await page.textContent('body');
  // Subject names should be Chinese
  expect(bodyText).toContain('生物');
  expect(bodyText).toContain('化學');
  expect(bodyText).toContain('中國語文');
});

test('Final verification: admin manage teachers tab has create button', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto(`${BASE}/admin/manage`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Click Teachers tab (third section button)
  const sectionButtons = page.locator('button').filter({ hasText: /教師|Teachers/ });
  if (await sectionButtons.count() === 0) {
    // Might already be on teachers tab or different selector needed
    console.log('Teachers tab not found, taking screenshot of current state');
  } else {
    await sectionButtons.first().click();
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/final-teachers-tab.png', fullPage: true });

  // Should have a create user button
  const createBtn = page.locator('button').filter({ hasText: /Create|建立/ });
  await expect(createBtn.first()).toBeVisible();
});

test('Final verification: All Students cohort detail — no remove buttons', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto(`${BASE}/cohorts/009b56ee-2b15-4a98-b660-8bea6d6c3d43`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/final-all-students.png', fullPage: true });

  // No remove buttons
  const removeButtons = page.locator('button').filter({ hasText: /Remove|移除/ });
  expect(await removeButtons.count()).toBe(0);

  // No add students button
  const addBtn = page.locator('button').filter({ hasText: /Add Students|新增學生/ });
  expect(await addBtn.count()).toBe(0);
});

test('Final verification: account switch admin → teacher → student', async ({ page }) => {
  // Login admin
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Logout
  const logoutBtn = page.locator('a, button').filter({ hasText: /Logout|登出/ }).first();
  await logoutBtn.click();
  await page.waitForURL('**/login');
  await page.waitForTimeout(500);

  // Login teacher
  await page.fill('input[name="email"]', 'demo@school.hk');
  await page.fill('input[name="password"]', 'demo12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  expect(page.url()).toContain('/dashboard');
  await page.screenshot({ path: 'e2e/screenshots/final-teacher-after-switch.png', fullPage: true });

  // Logout teacher
  const logoutBtn2 = page.locator('a, button').filter({ hasText: /Logout|登出/ }).first();
  await logoutBtn2.click();
  await page.waitForURL('**/login');
  await page.waitForTimeout(500);

  // Switch to student tab and login
  const studentTab = page.locator('button[aria-pressed]').filter({ hasText: /Student|學生/ });
  await studentTab.click();
  await page.waitForTimeout(500);
  await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
  await page.fill('input[name="password"]', 'Student123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  expect(page.url()).toContain('/dashboard');
  await page.screenshot({ path: 'e2e/screenshots/final-student-after-switch.png', fullPage: true });
});
