import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/align';
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
  await page.waitForTimeout(2500);

  // Measure left edges of all section titles
  const titles = ['Alerts', 'Student Data Import', 'Your Cohorts'];
  for (const t of titles) {
    const el = page.locator(`h2:has-text("${t}")`).first();
    if (await el.count() > 0) {
      const box = await el.boundingBox();
      console.log(`"${t}" left edge: ${box?.x}px`);
    } else {
      console.log(`"${t}" NOT FOUND`);
    }
  }

  await page.screenshot({ path: `${DIR}/01-aligned.png`, fullPage: true });
  await browser.close();
  console.log('Done');
}
main();
