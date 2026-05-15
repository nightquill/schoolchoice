import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/plan-fix';
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

  // Go to consultant page for student WITH a plan (to see radar chart)
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);

  console.log('JS errors:', errors.length, errors.slice(0, 2).join('; '));

  // Check radar chart has programme name in legend
  const legendItems = await page.locator('.recharts-legend-item-text').allTextContents();
  console.log('Radar legend items:', legendItems);

  // Check deadline badge
  const deadlineBadge = await page.locator('text=/days$/').count();
  console.log('Deadline badge:', deadlineBadge > 0);

  // Check Generate Plan and Export buttons
  const genBtn = await page.locator('button:has-text("Generate Plan")').count();
  const pdfBtn = await page.locator('button:has-text("Export PDF")').count();
  console.log('Generate:', genBtn > 0, 'PDF:', pdfBtn > 0);

  await page.screenshot({ path: `${DIR}/01-consultant-fixed.png` });

  await browser.close();
  console.log('Done');
}
main();
