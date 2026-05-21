import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Bug 4: Cannot delete student from All Students cohort', () => {

  test('All Students cohort has NO remove buttons', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    // Click the All Students cohort card
    const allStudentsCard = page.locator('[role="listitem"]').filter({ hasText: /所有學生/ });
    await allStudentsCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug4-all-students.png', fullPage: true });

    // Verify we're on the All Students cohort page
    const heading = await page.textContent('h1');
    expect(heading).toMatch(/所有學生|All Students/);

    // ASSERTION: No remove buttons should exist
    const removeButtons = page.locator('button').filter({ hasText: /移除|Remove|刪除|Delete/ });
    const count = await removeButtons.count();
    console.log('Remove buttons in All Students:', count);
    expect(count).toBe(0);

    // Also: no "Add Students" button should exist for default cohort
    const addBtn = page.locator('button').filter({ hasText: /新增學生|Add Students/ });
    const addCount = await addBtn.count();
    console.log('Add Students buttons:', addCount);
    expect(addCount).toBe(0);
  });

  test('Regular cohort DOES have remove buttons', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    // Click a non-default cohort (5A 2025-26)
    const regularCohort = page.locator('[role="listitem"]').filter({ hasText: /5A 2025-26/ });
    await regularCohort.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug4-regular-cohort.png', fullPage: true });

    // Regular cohort SHOULD have remove buttons
    const removeButtons = page.locator('button').filter({ hasText: /移除|Remove/ });
    const count = await removeButtons.count();
    console.log('Remove buttons in regular cohort:', count);
    expect(count).toBeGreaterThan(0);
  });
});
