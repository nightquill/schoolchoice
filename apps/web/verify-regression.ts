import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/refactor';
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const pages = [
    { name: 'dashboard', url: '/dashboard' },
    { name: 'submissions', url: '/submissions' },
    { name: 'analytics-plans', url: '/analytics/plans' },
    { name: 'analytics-subs', url: '/analytics/submissions' },
    { name: 'data-analysis', url: '/data-analysis' },
    { name: 'schools', url: '/schools' },
    { name: 'admin', url: '/admin/manage' },
  ];

  for (const p of pages) {
    errors.length = 0;
    await page.goto(`${BASE}${p.url}`);
    await page.waitForTimeout(1500);
    const hasContent = (await page.locator('#root').innerHTML()).length > 100;
    console.log(`${p.name}: content=${hasContent}, errors=${errors.length}${errors.length ? ' → ' + errors[0].slice(0, 80) : ''}`);
    await page.screenshot({ path: `${DIR}/reg-${p.name}.png` });
  }

  // Student profile with tabs
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1000);
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);
  errors.length = 0;
  for (const tab of ['Programme', 'Grades', 'Plans', 'Personal']) {
    const btn = page.locator(`button:has-text("${tab}")`);
    if (await btn.count() > 0) {
      await btn.first().click();
      await page.waitForTimeout(800);
    }
  }
  console.log(`student-profile-tabs: errors=${errors.length}${errors.length ? ' → ' + errors[0].slice(0, 80) : ''}`);

  await browser.close();
  console.log('\nRegression complete');
}
main();
