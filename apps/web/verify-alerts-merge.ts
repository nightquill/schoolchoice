import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/alerts-merge');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"], button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2500);

  // 1. Dashboard alerts — check section labels and categories
  console.log('=== Dashboard Alerts ===');
  const sectionLabels = await page.locator('div[style*="text-transform: uppercase"]').allTextContents();
  console.log('Section labels:', sectionLabels);

  const alertButtons = await page.locator('[aria-expanded]').allTextContents();
  console.log('Alert categories:', alertButtons.map(t => t.trim().replace(/\s+/g, ' ')));

  // Check "Missing Plan" category exists
  const missingPlan = await page.locator('text=/Missing Plan|未生成計劃/').count();
  console.log('Missing Plan category:', missingPlan > 0);

  await page.screenshot({ path: path.join(DIR, '01-dashboard-alerts.png') });

  // 2. Click "Pending Submissions" metric card — should go to /submissions
  const pendingCard = page.locator('a[href="/submissions"]');
  if (await pendingCard.count() > 0) {
    await pendingCard.first().click();
    await page.waitForTimeout(1500);
    console.log('\nPending card navigates to:', page.url());
    await page.screenshot({ path: path.join(DIR, '02-submissions-page.png') });
  }

  // 3. Go back, click "Pending Reviews" alert header — should nav to /submissions
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  const pendingReviewBtn = page.locator('button:has-text("Pending Review"), button:has-text("待審")').first();
  if (await pendingReviewBtn.count() > 0) {
    await pendingReviewBtn.click();
    await page.waitForTimeout(1500);
    console.log('Pending Review header navigates to:', page.url());
    await page.screenshot({ path: path.join(DIR, '03-pending-review-nav.png') });
  }

  // 4. Student profile — programme filter chip
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  const searchResult = page.locator('[role="button"]').first();
  if (await searchResult.count() > 0) {
    await searchResult.click();
    await page.waitForTimeout(2000);

    const progTab = page.locator('button:has-text("Programme")');
    if (await progTab.count() > 0) {
      await progTab.first().click();
      await page.waitForTimeout(1000);
      const addLink = page.locator('span:has-text("+ add")');
      if (await addLink.count() > 0) {
        await addLink.first().click();
        await page.waitForTimeout(1500);

        // Click "+ Add filter"
        const addFilterBtn = page.locator('button:has-text("+ Add filter")');
        if (await addFilterBtn.count() > 0) {
          await addFilterBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(DIR, '04-filter-categories.png') });

          // Check "Programme Type" option exists
          const progType = await page.locator('text=/Programme Type|課程類別/').count();
          console.log('\nProgramme Type filter option:', progType > 0);

          // Click it
          if (progType > 0) {
            await page.locator('text=/Programme Type|課程類別/').click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(DIR, '05-programme-filter.png') });
          }
        }
      }
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots in test-results/alerts-merge/');
}
main();
