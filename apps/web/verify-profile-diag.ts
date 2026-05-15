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

  // Navigate to student
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);

  // Bug 1: Check header layout
  console.log('=== Student Profile Header ===');
  const headerArea = await page.locator('h1, [style*="fontSize"]').first().evaluate(el => {
    const parent = el.closest('div');
    return parent ? parent.innerText.slice(0, 200) : el.innerText;
  });
  console.log('Header area text:', headerArea.replace(/\n/g, ' | '));
  await page.screenshot({ path: path.join(DIR, '01-profile-header.png') });

  // Bug 2: Check grades tab for i18n
  const gradesTab = page.locator('button:has-text("Grades")');
  if (await gradesTab.count() > 0) {
    await gradesTab.first().click();
    await page.waitForTimeout(1000);
    // Get all visible subject names in the grades table
    const subjectCells = await page.locator('table td:first-child').allTextContents();
    console.log('\n=== Grades Tab Subject Names ===');
    subjectCells.forEach(s => console.log(' ', s.trim()));
    await page.screenshot({ path: path.join(DIR, '02-grades-subjects.png') });
  }

  // Bug 2b: Check programme names in programme choices tab
  const progTab = page.locator('button:has-text("Programme")');
  if (await progTab.count() > 0) {
    await progTab.first().click();
    await page.waitForTimeout(1000);
    // Get programme names from the table
    const progNames = await page.locator('table td:nth-child(4)').allTextContents();
    console.log('\n=== Programme Names ===');
    progNames.slice(0, 5).forEach(p => console.log(' ', p.trim().slice(0, 80)));
    await page.screenshot({ path: path.join(DIR, '03-programme-names.png') });
  }

  await browser.close();
  console.log('\nDone');
}
main();
