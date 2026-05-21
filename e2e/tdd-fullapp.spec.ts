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

test.describe('Full App Audit — every page', () => {

  test('Admin: every page', async ({ page }) => {
    await loginAdmin(page);

    const pages = [
      { url: '/dashboard', name: 'dashboard' },
      { url: '/schools', name: 'schools' },
      { url: '/students', name: 'students' },
      { url: '/data-analysis', name: 'data-analysis' },
      { url: '/submissions', name: 'submissions' },
      { url: '/admin/manage', name: 'admin-manage' },
      { url: '/admin/data-refresh', name: 'admin-data-refresh' },
      { url: '/account/settings', name: 'account-settings' },
      { url: '/analytics/plans', name: 'analytics-plans' },
      { url: '/analytics/submissions', name: 'analytics-submissions' },
    ];

    for (const p of pages) {
      await page.goto(`${BASE}${p.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e/screenshots/fullapp-admin-${p.name}.png`, fullPage: true });
      console.log(`Admin ${p.name}: ${page.url()}`);

      // Check for errors
      const body = await page.textContent('body');
      const hasError = body?.includes('Error') && body?.includes('undefined');
      if (hasError) console.log(`  WARNING: possible error on ${p.name}`);
    }

    // Student profile (first student)
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    const firstStudent = page.locator('a').filter({ hasText: /Chan Siu Ming|Wong Mei Yi/ }).first();
    if (await firstStudent.count() > 0) {
      await firstStudent.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/fullapp-admin-student-profile.png', fullPage: true });

      // Check each tab
      const tabs = page.locator('[role="tab"], button').filter({ hasText: /成績|Grade|計劃|Plan|個人|Personal|活動|Activity|語言|Language|評核|Evaluation|筆記|Note/ });
      const tabCount = await tabs.count();
      for (let i = 0; i < tabCount; i++) {
        const tabText = await tabs.nth(i).textContent();
        await tabs.nth(i).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `e2e/screenshots/fullapp-admin-profile-tab-${i}.png`, fullPage: true });
        console.log(`  Tab ${i}: "${tabText?.trim()}"`);
      }
    }

    // School profile
    await page.goto(`${BASE}/schools`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const firstSchool = page.locator('a[href*="/schools/"]').first();
    if (await firstSchool.count() > 0) {
      await firstSchool.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/fullapp-admin-school-profile.png', fullPage: true });
    }

    // Cohort detail (non-default)
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    const cohortCard = page.locator('[role="listitem"]').filter({ hasText: /5A 2025-26/ });
    if (await cohortCard.count() > 0) {
      await cohortCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/fullapp-admin-cohort-5a.png', fullPage: true });
    }
  });

  test('Teacher: every page', async ({ page }) => {
    await loginTeacher(page);

    const pages = [
      { url: '/dashboard', name: 'dashboard' },
      { url: '/schools', name: 'schools' },
      { url: '/students', name: 'students' },
      { url: '/data-analysis', name: 'data-analysis' },
      { url: '/submissions', name: 'submissions' },
      { url: '/account/settings', name: 'account-settings' },
    ];

    for (const p of pages) {
      await page.goto(`${BASE}${p.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e/screenshots/fullapp-teacher-${p.name}.png`, fullPage: true });
      console.log(`Teacher ${p.name}: ${page.url()}`);
    }

    // Teacher student profile
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    const firstStudent = page.locator('tr a, a').filter({ hasText: /Chan Siu Ming/ }).first();
    if (await firstStudent.count() > 0) {
      await firstStudent.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/fullapp-teacher-student-profile.png', fullPage: true });
    }
  });

  test('Student: every page', async ({ page }) => {
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

    const pages = [
      { url: '/dashboard', name: 'dashboard' },
      { url: '/my-submissions', name: 'my-submissions' },
      { url: '/my-plan', name: 'my-plan' },
      { url: '/grade-sandbox', name: 'grade-sandbox' },
      { url: '/schools', name: 'schools' },
      { url: '/account/settings', name: 'account-settings' },
    ];

    for (const p of pages) {
      await page.goto(`${BASE}${p.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e/screenshots/fullapp-student-${p.name}.png`, fullPage: true });
      console.log(`Student ${p.name}: ${page.url()}`);
    }
  });
});
