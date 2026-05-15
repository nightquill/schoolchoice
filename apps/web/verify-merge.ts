import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/merge');
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(DIR, '01-dashboard.png'), fullPage: true });

  // Click plans generated card
  const plansLink = page.locator('a[href="/analytics/plans"]');
  if (await plansLink.count() > 0) {
    console.log('Plans card found, clicking...');
    await plansLink.click();
    await page.waitForTimeout(1500);
    console.log('Navigated to:', page.url());
    await page.screenshot({ path: path.join(DIR, '02-plans-page.png') });
    await page.goBack();
    await page.waitForTimeout(1000);
  }

  // Click pending submissions card
  const subsLink = page.locator('a[href="/submissions"]');
  if (await subsLink.count() > 0) {
    console.log('Submissions card found, clicking...');
    await subsLink.click();
    await page.waitForTimeout(1500);
    console.log('Navigated to:', page.url());
    await page.screenshot({ path: path.join(DIR, '03-submissions-page.png') });
  }

  await browser.close();
  console.log('Done');
}
main();
