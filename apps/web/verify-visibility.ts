import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/visibility');
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '01-dashboard.png') });

  // Submissions
  await page.goto(`${BASE}/submissions`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '02-submissions.png') });

  // Plans analytics
  await page.goto(`${BASE}/analytics/plans`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '03-plans.png') });

  // Student profile
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1000);
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  const result = page.locator('[role="button"]').first();
  if (await result.count() > 0) {
    await result.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, '04-student-profile.png') });
  }

  // Data analysis
  await page.goto(`${BASE}/data-analysis`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '05-data-analysis.png') });

  await browser.close();
  console.log('Done');
}
main();
