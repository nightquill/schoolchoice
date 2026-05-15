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
  await page.waitForTimeout(1000);

  // ConsultantTask
  errors.length = 0;
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);
  console.log('ConsultantTask — errors:', errors.length, errors.join('; '));
  console.log('  Generate btn:', await page.locator('button:has-text("Generate Plan")').count() > 0);
  console.log('  Back link:', await page.locator('a:has-text("Back to")').count() > 0);
  await page.screenshot({ path: `${DIR}/03-consultant-final.png` });

  // AcademicPlan
  errors.length = 0;
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/plan`);
  await page.waitForTimeout(3000);
  console.log('AcademicPlan — errors:', errors.length, errors.join('; '));
  console.log('  Generate btn:', await page.locator('button:has-text("Generate")').count() > 0);
  console.log('  Back link:', await page.locator('a:has-text("Back to")').count() > 0);
  await page.screenshot({ path: `${DIR}/04-academic-plan-final.png` });

  // Dashboard still works
  errors.length = 0;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  console.log('Dashboard — errors:', errors.length);
  await page.screenshot({ path: `${DIR}/05-dashboard-regression.png` });

  await browser.close();
  console.log('Done');
}
main();
