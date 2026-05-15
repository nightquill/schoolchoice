import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/diag');
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
  await page.waitForTimeout(2500);

  // Check card heights
  const cards = page.locator('[role="region"][aria-label="Summary statistics"] > *');
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const box = await cards.nth(i).boundingBox();
    const text = (await cards.nth(i).innerText()).replace(/\n/g, ' | ');
    console.log(`Card ${i}: height=${box?.height}px text="${text}"`);
  }

  // Check section title
  const importTitle = await page.locator('h2:has-text("Student Data Import"), h2:has-text("學生資料匯入")').count();
  console.log(`\nStudent Data Import title visible: ${importTitle > 0}`);

  await page.screenshot({ path: path.join(DIR, '02-fixed.png'), fullPage: true });
  await browser.close();
  console.log('Done');
}
main();
