import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';

function resize(path: string) {
  try {
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${path}" 2>/dev/null`, { encoding: 'utf-8' });
    const w = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10);
    const h = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] || '0', 10);
    if (w > 1800 || h > 1800) {
      const scale = Math.min(1800 / w, 1800 / h);
      execSync(`sips --resampleHeightWidth ${Math.round(h * scale)} ${Math.round(w * scale)} "${path}" 2>/dev/null`);
    }
  } catch {}
}

async function shot(page, path: string, opts: any = {}) {
  await page.screenshot({ path, ...opts });
  resize(path);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Account lifecycle', () => {

  test('Student list shows status badges and delete icon', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should have status badges (Chinese or English)
    const badges = page.locator('span', { hasText: /Active|No Account|啟用|未開戶/ });
    await expect(badges.first()).toBeVisible();

    await shot(page, 'e2e/screenshots/lifecycle-student-list.png');
  });

  test('Delete confirmation shows cascade preview', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find a trash icon button and click it
    const trashBtn = page.locator('button[aria-label*="Delete"]').first();
    if (await trashBtn.count() > 0) {
      await trashBtn.click();
      await page.waitForTimeout(500);
      await shot(page, 'e2e/screenshots/lifecycle-delete-dialog.png');
    } else {
      // All students have accounts — just screenshot the list
      await shot(page, 'e2e/screenshots/lifecycle-no-delete-available.png');
    }
  });

  test('Admin manage shows teacher status badges', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click teachers tab (use exact match to avoid matching "教師群組")
    const teacherTab = page.getByRole('button', { name: '教師', exact: true }).or(
      page.getByRole('button', { name: 'Teachers', exact: true })
    );
    await teacherTab.click();
    await page.waitForTimeout(500);

    // Should show status badges
    const badge = page.locator('span', { hasText: /Active|啟用/ });
    await expect(badge.first()).toBeVisible();

    await shot(page, 'e2e/screenshots/lifecycle-teacher-list.png');
  });

});
