import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/profile-diag');
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/login');
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);

  // Header
  await page.screenshot({ path: path.join(DIR, '04-header-fixed.png') });
  
  // Grades
  await page.locator('button:has-text("Grades")').first().click();
  await page.waitForTimeout(1000);
  const subjectCells = await page.locator('table td:first-child').allTextContents();
  console.log('Subject names (should be i18n):', subjectCells.map(s => s.trim()));
  await page.screenshot({ path: path.join(DIR, '05-grades-fixed.png') });

  // Programme choices
  await page.locator('button:has-text("Programme")').first().click();
  await page.waitForTimeout(1000);
  const headers = await page.locator('table th').allTextContents();
  console.log('Programme table headers:', headers.map(h => h.trim()));
  await page.screenshot({ path: path.join(DIR, '06-programmes-fixed.png') });

  await browser.close();
  console.log('Done');
}
main();
