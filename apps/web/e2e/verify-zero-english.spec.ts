import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test('Zero English leaks on admin dashboard (zh-HK)', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/zero-english-dashboard.png', fullPage: true });

  const bodyText = await page.textContent('body');
  const forbidden = [
    'Total Students', 'Plans Generated', 'Pending Submissions',
    'Form 5 class', 'academic year',
    'All Students', 'Your Cohorts',
    'Add Student', 'Import', 'Export',
  ];
  let leaks = 0;
  for (const p of forbidden) {
    if (bodyText.includes(p)) {
      console.log(`LEAK: "${p}"`);
      leaks++;
    }
  }
  console.log(`Total English leaks: ${leaks}`);
  expect(leaks).toBe(0);
});

test('Zero English leaks on admin manage (zh-HK)', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto(`${BASE}/admin/manage`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/zero-english-admin.png', fullPage: true });

  const bodyText = await page.textContent('body');
  const forbidden = ['default group', 'All Students', 'member'];
  let leaks = 0;
  for (const p of forbidden) {
    if (bodyText.includes(p)) {
      console.log(`LEAK: "${p}"`);
      leaks++;
    }
  }
  console.log(`Total English leaks on admin: ${leaks}`);
  expect(leaks).toBe(0);
});
