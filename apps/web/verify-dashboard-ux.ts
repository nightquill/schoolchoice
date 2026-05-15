import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/dashboard-ux');

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

  // 1. Check pending submissions count is NOT 0
  const pendingText = await page.locator('text=/Pending Submissions|待審提交/').first().evaluate(el => {
    const card = el.closest('[class*="card"], div');
    return card?.innerText || '';
  });
  console.log(`Pending submissions card text: ${pendingText.replace(/\n/g, ' | ')}`);

  // 2. Screenshot dashboard — check search is below "Your Cohorts"
  await page.screenshot({ path: path.join(DIR, '01-dashboard.png') });

  // 3. Check search placeholder says "Search student by name"
  const searchInput = page.locator('input[name="student-search"]');
  const placeholder = await searchInput.getAttribute('placeholder');
  console.log(`Search placeholder: "${placeholder}"`);

  // 4. Check "Student Data Quality" section title in alerts
  const alertTitle = await page.locator('text=/Student Data Quality|學生數據質量/').count();
  console.log(`Alert section title found: ${alertTitle > 0}`);
  await page.screenshot({ path: path.join(DIR, '02-alerts-section.png') });

  // 5. Click "Plans Generated" card → should navigate to /analytics/plans
  const plansCard = page.locator('a[href="/analytics/plans"]');
  if (await plansCard.count() > 0) {
    await plansCard.click();
    await page.waitForTimeout(1500);
    console.log(`Plans analytics URL: ${page.url()}`);
    await page.screenshot({ path: path.join(DIR, '03-plans-analytics.png') });

    // Check granularity toggle exists
    const dailyBtn = await page.locator('button:has-text("Daily"), button:has-text("每日")').count();
    const weeklyBtn = await page.locator('button:has-text("Weekly"), button:has-text("每週")').count();
    const monthlyBtn = await page.locator('button:has-text("Monthly"), button:has-text("每月")').count();
    console.log(`Granularity buttons: Daily=${dailyBtn}, Weekly=${weeklyBtn}, Monthly=${monthlyBtn}`);

    // Click weekly toggle
    if (weeklyBtn > 0) {
      await page.locator('button:has-text("Weekly"), button:has-text("每週")').click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(DIR, '04-plans-weekly.png') });
    }

    // Go back
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(1500);
  } else {
    console.log('Plans card link NOT found');
  }

  // 6. Click "Pending Submissions" card → should navigate to /analytics/submissions
  const subsCard = page.locator('a[href="/analytics/submissions"]');
  if (await subsCard.count() > 0) {
    await subsCard.click();
    await page.waitForTimeout(1500);
    console.log(`Submissions analytics URL: ${page.url()}`);
    await page.screenshot({ path: path.join(DIR, '05-submissions-analytics.png') });

    // Check for two lines in legend
    const legendItems = await page.locator('.recharts-legend-item').count();
    console.log(`Legend items (should be 2): ${legendItems}`);
  } else {
    console.log('Submissions card link NOT found');
  }

  // 7. Navigate to a student profile, check grades tab uses i18n
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const cohortLink = page.locator('text=5E 2025-26').first();
  if (await cohortLink.count() > 0) {
    await cohortLink.click();
    await page.waitForTimeout(1500);
    const studentRow = page.locator('tr[style*="cursor"]').first();
    if (await studentRow.count() > 0) {
      await studentRow.click();
      await page.waitForTimeout(1500);
      // Click grades tab
      const gradesTab = page.locator('button:has-text("Grades"), button:has-text("成績")');
      if (await gradesTab.count() > 0) {
        await gradesTab.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(DIR, '06-grades-tab.png') });
      }
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots in test-results/dashboard-ux/');
}
main();
