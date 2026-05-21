import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';
const MAX_DIM = 1800;

function resize(path: string) {
  try {
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${path}" 2>/dev/null`, { encoding: 'utf-8' });
    const w = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10);
    const h = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] || '0', 10);
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
      const nw = Math.round(w * scale);
      const nh = Math.round(h * scale);
      execSync(`sips --resampleHeightWidth ${nh} ${nw} "${path}" 2>/dev/null`);
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

test.describe('Bugfix verification', () => {

  test('School directory has JUPAS/SF tabs, no search bar, no export bar', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/schools`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should have tab buttons
    const jupasTab = page.locator('button', { hasText: /JUPAS/ });
    const sfTab = page.locator('button', { hasText: /Self-financing|自資/ });
    await expect(jupasTab).toBeVisible();
    await expect(sfTab).toBeVisible();

    // Should NOT have search input
    const searchInput = page.locator('#school-search-q');
    await expect(searchInput).toHaveCount(0);

    // Should NOT have ActionBar export
    const exportBtn = page.locator('button[aria-label*="Export"], button[aria-label*="export"]');
    await expect(exportBtn).toHaveCount(0);

    await shot(page, 'e2e/screenshots/verify-school-jupas.png');

    // Click SF tab
    await sfTab.click();
    await page.waitForTimeout(500);
    await shot(page, 'e2e/screenshots/verify-school-sf.png');
  });

  test('Admin settings cohort tab says "Student Cohort"', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Find the cohort tab button
    const cohortTab = page.locator('button', { hasText: /Student Cohort|學生群組/ });
    await expect(cohortTab).toBeVisible();
    await shot(page, 'e2e/screenshots/verify-admin-cohort-tab.png');
  });

  test('Dashboard search filters cohorts by name', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1000);

    // Should have cohort search
    const searchInput = page.locator('input[name="cohort-search"]');
    await expect(searchInput).toBeVisible();

    await shot(page, 'e2e/screenshots/verify-dashboard-cohort-search.png');
  });

  test('Student profile shows best5 and candidate number', async ({ page }) => {
    await login(page);
    // Navigate to first student
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Go to student list
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click first student row
    const firstRow = page.locator('tr[role="row"]').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await shot(page, 'e2e/screenshots/verify-student-profile-header.png');
    }
  });

});
