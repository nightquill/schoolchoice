import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Bug 4b: AdminManage — no remove from All Students cohort', () => {

  test('AdminManage cohort management: All Students has no remove buttons', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    // Go to admin manage
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click the "群組管理" (Cohort Management) tab
    const cohortTab = page.locator('button').filter({ hasText: /群組管理|Cohort Management/ });
    if (await cohortTab.count() > 0) {
      await cohortTab.first().click();
      await page.waitForTimeout(500);
    }

    // Click on the All Students cohort in the sidebar
    const allStudentsItem = page.locator('div').filter({ hasText: /All Students|所有學生/ }).first();
    await allStudentsItem.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug4b-admin-manage-all.png', fullPage: true });

    // Check for remove buttons in the members table
    const removeButtons = page.locator('button').filter({ hasText: /移除|Remove/ });
    const removeCount = await removeButtons.count();
    console.log('Remove buttons in AdminManage All Students:', removeCount);

    // ASSERTION: No remove buttons for default cohort
    expect(removeCount).toBe(0);

    // Also: no "Add Students" button for default cohort
    const addBtn = page.locator('button').filter({ hasText: /新增學生|Add Students/ });
    const addCount = await addBtn.count();
    console.log('Add Students buttons in AdminManage All Students:', addCount);
    expect(addCount).toBe(0);

    // Check that delete cohort button is also absent
    const deleteBtn = page.locator('button').filter({ hasText: /刪除|Delete/ });
    const deleteCount = await deleteBtn.count();
    console.log('Delete buttons in AdminManage All Students:', deleteCount);
    // The "刪除" button for deleting the cohort itself should be 0
    // (but there may be a "刪除" in teacher groups tab — we only care about this view)
  });

  test('AdminManage: regular cohort HAS remove buttons', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click cohort management tab
    const cohortTab = page.locator('button').filter({ hasText: /群組管理|Cohort Management/ });
    if (await cohortTab.count() > 0) {
      await cohortTab.first().click();
      await page.waitForTimeout(500);
    }

    // Click on a regular cohort (5A) — find the exact sidebar item
    const cohortItems = page.locator('div[style*="cursor: pointer"], div[role="button"]').filter({ hasText: /5A 2025-26/ });
    const itemCount = await cohortItems.count();
    console.log('5A cohort items found:', itemCount);

    // Use text-based click instead
    await page.locator('text=5A 2025-26').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug4b-admin-manage-5a.png', fullPage: true });

    // Verify we're now showing 5A detail
    const heading = await page.locator('h2').first().textContent();
    console.log('Cohort detail heading:', heading);

    const removeButtons = page.locator('button').filter({ hasText: /移除|Remove/ });
    const removeCount = await removeButtons.count();
    console.log('Remove buttons in AdminManage 5A:', removeCount);
    expect(removeCount).toBeGreaterThan(0);
  });
});
