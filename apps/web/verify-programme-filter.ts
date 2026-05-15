import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/programme-filter');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"], button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Navigate to cohort first
  const cohortLink = page.locator('text=5E 2025-26').first();
  if (await cohortLink.count() > 0) {
    await cohortLink.click();
    await page.waitForTimeout(2000);
  }

  // Find a student link
  const studentLink = page.locator('a[href*="/students/"]').first();
  if (await studentLink.count() === 0) {
    // Try clicking a row
    const rows = page.locator('tr[style*="cursor"]');
    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(2000);
    }
  } else {
    await studentLink.click();
    await page.waitForTimeout(2000);
  }

  console.log(`Current URL: ${page.url()}`);
  await page.screenshot({ path: path.join(DIR, '00-student-page.png') });

  // Click the Programme Choices tab
  const progTab = page.locator('button:has-text("Programme"), button:has-text("課程")');
  if (await progTab.count() > 0) {
    await progTab.first().click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(DIR, '01-programme-tab.png') });

  // Click "+ add programme" link
  const addLink = page.locator('span:has-text("+ add programme")');
  if (await addLink.count() > 0) {
    await addLink.first().click();
    await page.waitForTimeout(2000);
  } else {
    console.log('No "+ add programme" link found, trying button');
    const addBtn = page.locator('button:has-text("Add Programme"), button:has-text("新增課程")');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(2000);
    }
  }

  // Screenshot: add modal with no filter — should show ALL programmes
  await page.screenshot({ path: path.join(DIR, '02-add-modal-no-filter.png') });

  // Check the count text
  const countText = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => 'NOT FOUND');
  console.log(`Result count (no filter): ${countText}`);

  // Test search for "law"
  const searchInput = page.locator('input[placeholder*="Search by programme"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('law');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, '03-search-law.png') });
    const lawCount = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => 'NOT FOUND');
    console.log(`Result count (search "law"): ${lawCount}`);

    // Clear and search "engineering"
    await searchInput.fill('engineering');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, '04-search-engineering.png') });
    const engCount = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => 'NOT FOUND');
    console.log(`Result count (search "engineering"): ${engCount}`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  }

  // Click Self-Financing toggle
  const sfButton = page.locator('button:has-text("Self-Financing")');
  if (await sfButton.count() > 0) {
    await sfButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(DIR, '05-sf-toggle.png') });
    const sfCount = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => 'NOT FOUND');
    console.log(`Result count (self-financing): ${sfCount}`);
  } else {
    console.log('Self-financing toggle not found');
  }

  // Switch back to JUPAS
  const jupasButton = page.locator('button:has-text("JUPAS")');
  if (await jupasButton.count() > 0) {
    await jupasButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, '06-jupas-toggle-back.png') });
    const jupasCount = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => 'NOT FOUND');
    console.log(`Result count (JUPAS): ${jupasCount}`);
  }

  await browser.close();
  console.log('\nDone. Screenshots in test-results/programme-filter/');
}
main();
