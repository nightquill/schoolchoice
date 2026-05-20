import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test.describe('Bug verification — all reported issues', () => {

  test('Bug 1: Account switch — admin logout → teacher login', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Click logout button
    const logoutBtn = page.locator('a, button').filter({ hasText: /Logout|登出/ }).first();
    await logoutBtn.click();
    await page.waitForURL('**/login');
    await page.waitForTimeout(500);

    // Now login as teacher
    await page.fill('input[name="email"]', 'demo@school.hk');
    await page.fill('input[name="password"]', 'demo12345');
    await page.click('button[type="submit"]');

    // Should reach dashboard — not "login failed"
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/bug1-account-switch.png', fullPage: true });
    expect(page.url()).toContain('/dashboard');

    // Verify teacher identity
    const body = await page.textContent('body');
    expect(body).toContain('Demo Counsellor');
  });

  test('Bug 2: Hardcoded English in cohort report page', async ({ page }) => {
    // Login as admin (zh-HK locale)
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to cohort report
    // First find a cohort
    await page.goto(`${BASE}/cohorts/fa303904-0c50-4eb6-906c-38aab92f7157/report`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/bug2-cohort-report.png', fullPage: true });

    // Check for hardcoded English on the page
    const bodyText = await page.textContent('body');
    console.log('Cohort report page text (first 500 chars):', bodyText?.slice(0, 500));
  });

  test('Bug 3: Cannot add teacher account from admin panel', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to user management
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/bug3-admin-manage.png', fullPage: true });

    // Check if "Create User" or equivalent button exists
    const createBtn = page.locator('button').filter({ hasText: /Create|建立|Add|新增/ });
    const createBtnCount = await createBtn.count();
    console.log('Create user buttons found:', createBtnCount);

    // Check if we're on the right page
    const bodyText = await page.textContent('body');
    console.log('Admin manage includes user list:', bodyText?.includes('demo@school.hk'));
  });

  test('Bug 4: Can still delete student from All Students cohort', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to the default "All Students" cohort
    await page.goto(`${BASE}/cohorts/009b56ee-2b15-4a98-b660-8bea6d6c3d43`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/bug4-all-students-detail.png', fullPage: true });

    // Count remove buttons — should be ZERO
    const removeButtons = page.locator('button').filter({ hasText: /Remove|移除|Delete|刪除/ });
    const count = await removeButtons.count();
    console.log('Remove/Delete buttons in All Students cohort:', count);

    // Also check for any red-bordered buttons (delete styling)
    const redButtons = page.locator('button[style*="color-error"], button[style*="border-color: var(--color-error)"]');
    const redCount = await redButtons.count();
    console.log('Red-styled buttons:', redCount);
  });

  test('Bug 5: Can still delete All Students cohort', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to cohort list
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Navigate to admin manage cohort section
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click on "All Students" cohort in the admin panel
    const allStudentsBtn = page.locator('button, [role="button"], div').filter({ hasText: /All Students|所有學生/ }).first();
    if (await allStudentsBtn.count() > 0) {
      await allStudentsBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'e2e/screenshots/bug5-admin-manage-cohort.png', fullPage: true });

    // Look for delete button
    const deleteBtn = page.locator('button').filter({ hasText: /Delete|刪除/ });
    const deleteCount = await deleteBtn.count();
    console.log('Delete buttons visible after selecting All Students:', deleteCount);
  });
});
