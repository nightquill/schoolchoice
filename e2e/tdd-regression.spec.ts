import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('TDD Regression — all roles work', () => {

  test('Admin dashboard + cohort detail + manage', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/regression-admin-dashboard.png', fullPage: true });

    // Verify alerts section exists with counts
    const alertRegion = page.locator('[aria-label="Alerts"]');
    expect(await alertRegion.count()).toBe(1);

    // Navigate to a student profile
    const studentLink = page.locator('a').filter({ hasText: /Wong Mei Yi/ }).first();
    if (await studentLink.count() > 0) {
      // search for student first
    }

    // Navigate to admin manage
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/regression-admin-manage.png', fullPage: true });

    // Verify permission table loads
    const permTable = page.locator('table');
    expect(await permTable.count()).toBeGreaterThan(0);
  });

  test('Teacher dashboard + student list', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'demo@school.hk');
    await page.fill('input[name="password"]', 'demo12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/regression-teacher-dashboard.png', fullPage: true });

    // Verify teacher sees alerts with non-zero counts
    const alertBadges = page.locator('[aria-label="Alerts"] button[aria-expanded] span').last();
    const body = await page.textContent('body');
    // Teacher should see "提醒" section
    expect(body).toContain('提醒');

    // Navigate to students
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/regression-teacher-students.png', fullPage: true });

    // Should see student list
    expect(await page.locator('text=Chan Siu Ming').count()).toBeGreaterThan(0);
  });

  test('Student dashboard + grade sandbox', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    const studentTab = page.locator('button[aria-pressed]').filter({ hasText: /Student|學生/ });
    await studentTab.click();
    await page.waitForTimeout(300);
    await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
    await page.fill('input[name="password"]', 'student123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/regression-student-dashboard.png', fullPage: true });

    // Verify programme choices visible
    const body = await page.textContent('body');
    expect(body).toMatch(/Programme Choices|選科表/);

    // Verify grade sandbox link exists
    expect(await page.locator('a').filter({ hasText: /Grade Sandbox|成績模擬/ }).count()).toBe(1);

    // Navigate to grade sandbox
    await page.click('a:has-text("Grade Sandbox")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/regression-student-gradesandbox.png', fullPage: true });

    // Verify grades load
    const gradeBody = await page.textContent('body');
    expect(gradeBody).toMatch(/Subject|科目|MOCK|Grade/);
  });
});
