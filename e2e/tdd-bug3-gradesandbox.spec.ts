import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Bug 3: Grade sandbox needs its own page for students', () => {

  test('Student can navigate to dedicated grade sandbox page', async ({ page }) => {
    // Login as student via candidate number
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');

    // Click the Student tab
    const studentTab = page.locator('button[aria-pressed]').filter({ hasText: /Student|學生/ });
    await studentTab.click();
    await page.waitForTimeout(300);

    await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
    await page.fill('input[name="password"]', 'student123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug3-student-login.png', fullPage: true });
    console.log('Student URL after login:', page.url());

    // Should reach dashboard
    expect(page.url()).toContain('/dashboard');

    // Student should have a nav link for grade sandbox
    const gradeLink = page.locator('a').filter({ hasText: /成績模擬|Grade Sandbox/ });
    const gradeLinkCount = await gradeLink.count();
    console.log('Grade sandbox links found:', gradeLinkCount);
    expect(gradeLinkCount).toBeGreaterThan(0);

    // Click the grade sandbox link
    await gradeLink.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should navigate to /grade-sandbox
    expect(page.url()).toContain('/grade-sandbox');

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug3-grade-sandbox-page.png', fullPage: true });

    // The page should show grade editing UI
    const body = await page.textContent('body');
    expect(body).toMatch(/成績|Grade|科目|Subject/);
  });

  test('Grade sandbox NOT embedded in student dashboard', async ({ page }) => {
    // Login as student
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
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug3-student-dashboard.png', fullPage: true });

    // GradesTab should NOT be on the dashboard — it should be on /grade-sandbox
    // Check that there is no grade build UI embedded in the dashboard
    const gradeBuildsOnDashboard = page.locator('text=Grade Build').or(page.locator('text=成績組合'));
    const count = await gradeBuildsOnDashboard.count();
    console.log('Grade build elements on dashboard:', count);
    // Should be 0 — grades are on their own page now
    expect(count).toBe(0);
  });
});
