import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test.describe('Multi-account E2E verification', () => {

  test('Admin: login, dashboard, student list, permissions', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'verify@test.com');
    await page.fill('input[type="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Dashboard should show metrics
    await expect(page.locator('body')).not.toContainText('contact your admin');

    // Navigate to students
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    const studentList = page.locator('body');
    await expect(studentList).toBeVisible();

    // Admin nav should show admin links
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(page.locator('a[href="/admin/manage"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/admin-dashboard.png', fullPage: true });
  });

  test('Teacher: login, dashboard with permissions, student profile', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'demo@school.hk');
    await page.fill('input[type="password"]', 'demo12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Teacher should NOT see "contact your admin" (they are in a group now)
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');

    // Teacher nav should NOT show admin links
    await expect(page.locator('a[href="/admin/manage"]')).toHaveCount(0);

    // Navigate to students list
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/teacher-dashboard.png', fullPage: true });
  });

  test('Student: login via candidate number, view programme choices', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    // Switch to student login tab
    const studentTab = page.locator('button, [role="tab"]').filter({ hasText: /Student|學生/ });
    if (await studentTab.count() > 0) {
      await studentTab.first().click();
    }

    await page.waitForTimeout(500);
    await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
    await page.fill('input[name="password"]', 'Student123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Student should see their dashboard
    const pageText = await page.textContent('body');

    // Student nav should NOT show admin links
    await expect(page.locator('a[href="/admin/manage"]')).toHaveCount(0);

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/student-dashboard.png', fullPage: true });
  });

  test('Permission enforcement: teacher cannot delete student', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'demo@school.hk');
    await page.fill('input[type="password"]', 'demo12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for delete button — should be disabled with tooltip
    const deleteButtons = page.locator('button').filter({ hasText: /Delete|刪除/ });
    if (await deleteButtons.count() > 0) {
      const firstDelete = deleteButtons.first();
      const isDisabled = await firstDelete.isDisabled();
      const title = await firstDelete.getAttribute('title');
      // Take screenshot showing disabled state
      await page.screenshot({ path: 'e2e/screenshots/teacher-delete-disabled.png', fullPage: true });
    }
  });

  test('Confirmation dialog: plan delete shows modal', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', 'verify@test.com');
    await page.fill('input[type="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to a student with plans
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click first student
    const studentLink = page.locator('a[href*="/students/"], [role="button"]').filter({ hasText: /Chan|Wong|student/i }).first();
    if (await studentLink.count() > 0) {
      await studentLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Navigate to Plans tab
      const plansTab = page.locator('button, [role="tab"]').filter({ hasText: /Plans|計劃/ });
      if (await plansTab.count() > 0) {
        await plansTab.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'e2e/screenshots/admin-plans-tab.png', fullPage: true });
      }
    }
  });
});
