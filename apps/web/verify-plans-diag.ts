import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/plans-diag');
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Bug 1: Click "Plans Generated" card → navigate to /analytics/plans
  console.log('=== Bug 1: Plans analytics page ===');
  await page.goto(`${BASE}/analytics/plans`);
  await page.waitForTimeout(2000);
  const pageText = await page.locator('main, #root').first().innerText();
  console.log('Page content (first 300 chars):', pageText.slice(0, 300));
  const hasChart = await page.locator('.recharts-responsive-container').count();
  console.log('Chart container present:', hasChart > 0);
  const noDataMsg = await page.locator('text="No data for this period"').count();
  console.log('"No data" message:', noDataMsg > 0);
  await page.screenshot({ path: path.join(DIR, '01-plans-analytics.png') });

  // Bug 2: Navigate to student plan generate page
  console.log('\n=== Bug 2: Student plan generate ===');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  // Find a student via search
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  const result = page.locator('[role="button"]').first();
  if (await result.count() > 0) {
    await result.click();
    await page.waitForTimeout(2000);
    console.log('Student profile URL:', page.url());
    
    // Click "Generate Plan" button
    const genBtn = page.locator('button:has-text("Generate Plan"), a:has-text("Generate Plan")');
    if (await genBtn.count() > 0) {
      console.log('Generate Plan button found, clicking...');
      await genBtn.first().click();
      await page.waitForTimeout(3000);
      console.log('After click URL:', page.url());
      const bodyText = await page.locator('body').innerText();
      const isEmpty = bodyText.trim().length < 50;
      console.log('Page blank:', isEmpty);
      console.log('Body text (first 200):', bodyText.slice(0, 200));
      // Check console errors
      await page.screenshot({ path: path.join(DIR, '02-plan-generate.png') });
    } else {
      console.log('No Generate Plan button found');
    }
  }

  await browser.close();
  console.log('\nDone');
}
main();
