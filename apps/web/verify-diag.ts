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

  // Bug 1: Measure card heights
  const cards = page.locator('[role="region"][aria-label="Summary statistics"] > *');
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const box = await cards.nth(i).boundingBox();
    const text = (await cards.nth(i).innerText()).replace(/\n/g, ' | ');
    console.log(`Card ${i}: height=${box?.height}px text="${text}"`);
  }

  // Bug 2: Check for "student data import" or "Student Import" section title
  const importTitle = await page.locator('text=/student data import|Student Import|Student Data Import/i').count();
  console.log(`\nStudent data import title visible: ${importTitle > 0}`);

  // Check what's between action bar and cohorts
  const actionBar = page.locator('text="Add Student"').first();
  const actionBarBox = await actionBar.boundingBox();
  console.log(`Action bar Y: ${actionBarBox?.y}`);

  // Look at the toolbar area
  const toolbar = page.locator('div:has(> button:has-text("Add Student"))').first();
  const toolbarText = await toolbar.innerText();
  console.log(`Toolbar contents: "${toolbarText.replace(/\n/g, ' | ')}"`);

  await page.screenshot({ path: path.join(DIR, '01-dashboard.png') });
  await browser.close();
  console.log('\nDone');
}
main();
