/**
 * Bug reproduction test — the three-wall system runs this.
 * Session cannot end, commits cannot land, pushes cannot happen
 * until this test exits 0.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Reproduction: three reported bugs', () => {

  test('BUG 1: All Students cohort has ZERO remove/delete buttons for members', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to All Students cohort
    await page.goto(`${BASE}/cohorts/009b56ee-2b15-4a98-b660-8bea6d6c3d43`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // The member table must have ZERO buttons (no remove, no delete)
    const memberTable = page.locator('table').first();
    const tableButtons = await memberTable.locator('button').all();
    expect(tableButtons.length).toBe(0);

    // No "Add Students" button in the header
    const addBtn = page.locator('button').filter({ hasText: /Add Students|新增學生/ });
    expect(await addBtn.count()).toBe(0);
  });

  test('BUG 2: Dashboard has ZERO hardcoded English when locale is zh-HK', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');

    // These English strings must NOT appear anywhere on the dashboard
    const forbidden = [
      'Total Students',
      'Plans Generated',
      'Pending Submissions',
      'Form 5 class',
      'academic year',
      'All Students',
      'Your Cohorts',
      'default group',
    ];

    for (const phrase of forbidden) {
      expect(bodyText, `Found forbidden English: "${phrase}"`).not.toContain(phrase);
    }
  });

  test('BUG 3: Student dashboard shows grade sandbox (grade builds)', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    // Switch to student tab
    const studentTab = page.locator('button[aria-pressed]').filter({ hasText: /Student|學生/ });
    await studentTab.click();
    await page.waitForTimeout(500);

    await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
    await page.fill('input[name="password"]', 'Student123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Grade section must be visible
    // Look for the grade build selector ("Actual Grades" dropdown) or grade table
    const gradeElements = page.locator('select, table').filter({ hasText: /Actual Grades|實際成績|Grade|成績|Subject|科目/ });
    expect(await gradeElements.count(), 'Grade sandbox elements not found on student dashboard').toBeGreaterThan(0);
  });
});
