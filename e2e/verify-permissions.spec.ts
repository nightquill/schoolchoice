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

async function shot(page, path: string) {
  await page.screenshot({ path });
  resize(path);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => { sessionStorage.setItem('locale', 'zh-HK'); localStorage.setItem('locale', 'zh-HK'); });
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Permission hardening', () => {

  test('Admin permission grid shows data_export column', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should be on teacher groups tab by default — look for permission grid
    const dataExport = page.locator('th, td', { hasText: /Data Export|資料匯出/ });
    await expect(dataExport.first()).toBeVisible();

    await shot(page, 'e2e/screenshots/perm-admin-grid.png');
  });

  test('Grades tab shows edit controls for admin', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click first student
    await page.locator('tr[role="row"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click grades tab
    const gradesTab = page.locator('button', { hasText: /成績|Grades/ });
    await gradesTab.click();
    await page.waitForTimeout(500);

    // Admin should see edit controls (pencil icon, delete, add grade)
    const pencil = page.locator('button[aria-label*="Edit grade"]');
    const addBtn = page.locator('button', { hasText: /新增成績|Add Grade/ });

    // At least one should be visible for admin
    const hasPencil = await pencil.count() > 0;
    const hasAdd = await addBtn.count() > 0;
    expect(hasPencil || hasAdd).toBeTruthy();

    await shot(page, 'e2e/screenshots/perm-grades-admin.png');
  });

  test('Dashboard export button visible for admin', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(500);

    // Export button should be visible
    const exportBtn = page.locator('button', { hasText: /匯出學生|Export Students/ });
    await expect(exportBtn).toBeVisible();

    await shot(page, 'e2e/screenshots/perm-dashboard-export.png');
  });

});
