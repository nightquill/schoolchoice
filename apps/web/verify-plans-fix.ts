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
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Navigate to plans analytics
  await page.goto(`${BASE}/analytics/plans`);
  await page.waitForTimeout(2500);

  const hasChart = await page.locator('.recharts-responsive-container').count();
  console.log('Chart visible (even with no data):', hasChart > 0);

  const missingList = await page.locator('text=/Students Missing Plan/').count();
  console.log('Missing plan list heading:', missingList > 0);

  const tableRows = await page.locator('table tbody tr').count();
  console.log('Students in missing plan table:', tableRows);

  const genLinks = await page.locator('a:has-text("Generate Plan")').count();
  console.log('Generate Plan links:', genLinks);

  await page.screenshot({ path: path.join(DIR, '04-plans-fixed.png'), fullPage: true });

  // Click a generate link to verify navigation
  if (genLinks > 0) {
    await page.locator('a:has-text("Generate Plan")').first().click();
    await page.waitForTimeout(2000);
    console.log('Generate link navigates to:', page.url());
    const hasContent = await page.locator('#root').innerHTML();
    console.log('Consultant page has content:', hasContent.length > 100);
    await page.screenshot({ path: path.join(DIR, '05-consultant-from-list.png') });
  }

  await browser.close();
  console.log('\nDone');
}
main();
