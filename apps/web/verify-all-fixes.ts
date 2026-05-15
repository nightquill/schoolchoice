import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/all-fixes');

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

  // 1. Dashboard — all 4 alert categories under single "Alerts" heading
  console.log('=== 1. Dashboard Alerts ===');
  const alertsTitle = await page.locator('h2:has-text("Alerts")').count();
  console.log('Alerts heading: ' + (alertsTitle > 0));
  // Check NO "Student Data Quality" separate heading exists
  const dataQualityHeading = await page.locator('h3:has-text("Student Data Quality")').count();
  console.log('Separate Student Data Quality heading (should be 0): ' + dataQualityHeading);
  // Count alert categories
  const alertCategories = await page.locator('[role="region"][aria-label="Alerts"] button[aria-expanded]').count();
  console.log('Alert category buttons: ' + alertCategories);
  await page.screenshot({ path: path.join(DIR, '01-dashboard-alerts.png') });

  // 2. Submissions page — chart merged above pending list
  console.log('\n=== 2. Submissions Page ===');
  await page.goto(`${BASE}/submissions`);
  await page.waitForTimeout(2000);
  const hasChart = await page.locator('.recharts-responsive-container').count();
  console.log('Chart present: ' + (hasChart > 0));
  const hasPendingHeading = await page.locator('h2:has-text("Pending Submissions")').count();
  console.log('Pending Submissions subheading: ' + (hasPendingHeading > 0));
  await page.screenshot({ path: path.join(DIR, '02-submissions-merged.png') });

  // 3. Admin Manage — Settings tab with submission rate
  console.log('\n=== 3. Admin Settings ===');
  await page.goto(`${BASE}/admin/manage`);
  await page.waitForTimeout(1500);
  const settingsBtn = page.locator('button:has-text("Settings"), button:has-text("設定")');
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    await page.waitForTimeout(1000);
    const rateInput = await page.locator('#submission-rate').count();
    console.log('Submission rate input: ' + (rateInput > 0));
    await page.screenshot({ path: path.join(DIR, '03-admin-settings.png') });
  } else {
    console.log('Settings tab not found');
  }

  // 4. Student Profile — Grades tab subject dropdown
  console.log('\n=== 4. Grades Tab ===');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('text=5E 2025-26').first().click();
  await page.waitForTimeout(1500);
  await page.locator('tr[style*="cursor"]').first().click();
  await page.waitForTimeout(1500);
  const gradesTab = page.locator('button:has-text("Grades"), button:has-text("成績")');
  if (await gradesTab.count() > 0) {
    await gradesTab.first().click();
    await page.waitForTimeout(1000);
    // Check dropdown for raw keys
    const selectEl = page.locator('select[name="subject"], select').first();
    if (await selectEl.count() > 0) {
      const options = await selectEl.evaluate((el) =>
        Array.from(el.options).map(o => o.text)
      );
      const rawKeys = options.filter(o => o.startsWith('subjects.'));
      console.log('Raw i18n keys in dropdown: ' + rawKeys.length + (rawKeys.length > 0 ? ' → ' + rawKeys.join(', ') : ''));
      const aplOptions = options.filter(o => o.includes('Applied Learning') || o.includes('應用學習'));
      console.log('APL options (translated): ' + aplOptions.length);
    }
    await page.screenshot({ path: path.join(DIR, '04-grades-subjects.png') });
  }

  // 5. Plans tab — i18n empty state
  console.log('\n=== 5. Plans Tab ===');
  const plansTab = page.locator('button:has-text("Plans"), button:has-text("計劃")');
  if (await plansTab.count() > 0) {
    await plansTab.first().click();
    await page.waitForTimeout(1000);
    const hardcoded = await page.locator('text="No plans saved yet. Click"').count();
    const translated = await page.locator('text=/No plans saved|尚未儲存/').count();
    console.log('Hardcoded string present: ' + (hardcoded > 0));
    console.log('Translated string present: ' + (translated > 0));
    await page.screenshot({ path: path.join(DIR, '05-plans-tab.png') });
  }

  // 6. Programme Choices — i18n strings
  console.log('\n=== 6. Programme Choices ===');
  const progTab = page.locator('button:has-text("Programme"), button:has-text("課程")');
  if (await progTab.count() > 0) {
    await progTab.first().click();
    await page.waitForTimeout(1000);
    const addLink = page.locator('span:has-text("+ add"), span:has-text("+ 新增")');
    if (await addLink.count() > 0) {
      await addLink.first().click();
      await page.waitForTimeout(1500);
      // Check for hardcoded "Search Programmes" vs translated
      const searchLabel = await page.locator('text="Search Programmes"').count();
      const searchLabelZh = await page.locator('text="搜尋課程"').count();
      console.log('Search label (en or zh): ' + (searchLabel + searchLabelZh > 0));
      await page.screenshot({ path: path.join(DIR, '06-programme-modal.png') });
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots in test-results/all-fixes/');
}
main();
