import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

async function loginAdmin(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

async function loginTeacher(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'demo@school.hk');
  await page.fill('input[name="password"]', 'demo12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Bug 2: Permission toggle in admin reflected in teacher', () => {

  test('Admin changes permission → teacher sees updated access', async ({ page }) => {
    // Step 1: Login as admin, go to teacher groups
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // The page shows teacher groups with permission table
    // Find the permission table
    await page.screenshot({ path: 'e2e/screenshots/tdd-bug2-admin-perms-before.png', fullPage: true });

    // Find the first select dropdown for the "所有學生" (All Students) row
    // We want to change "data_import" permission from current value to "none"
    // The table has rows for each cohort, columns for each permission type
    const allStudentsRow = page.locator('tr').filter({ hasText: /所有學生/ });
    const rowCount = await allStudentsRow.count();
    console.log('All Students rows found:', rowCount);
    expect(rowCount).toBeGreaterThan(0);

    // Get all selects in the All Students row
    const selects = allStudentsRow.first().locator('select');
    const selectCount = await selects.count();
    console.log('Selects in All Students row:', selectCount);

    // Find the select that currently has value 'read_write' for grades (2nd select, index 1)
    // The order is: programme_choices, grades, plan_generation, submissions, reports, cohort_management, data_import...
    // Let's change "grades" (index 1) to "read_only"
    const gradesSelect = selects.nth(1); // grades column
    const currentValue = await gradesSelect.inputValue();
    console.log('Current grades permission value:', currentValue);

    // Change to the opposite
    const newValue = currentValue === 'read_write' ? 'read_only' : 'read_write';
    await gradesSelect.selectOption(newValue);
    console.log('Changed grades to:', newValue);

    // Save
    const saveBtn = page.locator('button').filter({ hasText: /儲存權限|Save/ });
    await saveBtn.first().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug2-admin-perms-after.png', fullPage: true });

    // Step 2: Verify via API that teacher gets updated permissions
    // Logout admin
    const logoutBtn = page.locator('a, button').filter({ hasText: /登出|Logout/ }).first();
    await logoutBtn.click();
    await page.waitForURL('**/login');
    await page.waitForTimeout(500);

    // Login as teacher and check permissions API
    await loginTeacher(page);

    // Fetch the teacher's permissions via API
    const permResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/v1/account/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return resp.json();
    });

    console.log('Teacher permissions:', JSON.stringify(permResponse));

    // Find the All Students cohort in teacher permissions
    const allStudentsPerm = permResponse.cohorts?.find(
      (p: any) => p.cohort_name === 'All Students' || p.cohort_name === '所有學生'
    );
    console.log('Teacher All Students permission:', JSON.stringify(allStudentsPerm));

    // Assert the grades permission matches what we just set
    expect(allStudentsPerm).toBeTruthy();
    expect(allStudentsPerm.grades).toBe(newValue);

    await page.screenshot({ path: 'e2e/screenshots/tdd-bug2-teacher-perms.png', fullPage: true });

    // Step 3: Restore original value — login as admin again
    await page.locator('a, button').filter({ hasText: /登出|Logout/ }).first().click();
    await page.waitForURL('**/login');
    await page.waitForTimeout(500);
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const restoreRow = page.locator('tr').filter({ hasText: /所有學生/ });
    const restoreSelects = restoreRow.first().locator('select');
    await restoreSelects.nth(1).selectOption(currentValue);
    const restoreSaveBtn = page.locator('button').filter({ hasText: /儲存權限|Save/ });
    await restoreSaveBtn.first().click();
    await page.waitForTimeout(1000);
    console.log('Restored grades to:', currentValue);
  });
});
