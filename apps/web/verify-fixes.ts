import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/fixes');

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
  await page.waitForTimeout(2000);

  // 1. Submissions page with chart
  await page.goto(`${BASE}/submissions`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, '01-submissions-merged.png') });
  const hasChart = await page.locator('.recharts-responsive-container').count();
  console.log('Submissions page has chart: ' + (hasChart > 0));

  // 2. Dashboard alerts
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(DIR, '02-dashboard.png') });

  // 3. Student grades tab
  const cohortLink = page.locator('text=5E 2025-26').first();
  if (await cohortLink.count() > 0) {
    await cohortLink.click();
    await page.waitForTimeout(1500);
    const studentRow = page.locator('tr[style*="cursor"]').first();
    if (await studentRow.count() > 0) {
      await studentRow.click();
      await page.waitForTimeout(1500);

      // Grades tab
      const gradesTab = page.locator('button:has-text("Grades"), button:has-text("成績")');
      if (await gradesTab.count() > 0) {
        await gradesTab.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(DIR, '03-grades-tab.png') });
      }

      // Programme choices tab
      const progTab = page.locator('button:has-text("Programme"), button:has-text("課程")');
      if (await progTab.count() > 0) {
        await progTab.first().click();
        await page.waitForTimeout(1000);
        const addLink = page.locator('span:has-text("+ add"), span:has-text("+ 新增")');
        if (await addLink.count() > 0) {
          await addLink.first().click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(DIR, '04-programme-modal.png') });
        }
      }

      // Plans tab
      const plansTab = page.locator('button:has-text("Plans"), button:has-text("計劃")');
      if (await plansTab.count() > 0) {
        await plansTab.first().click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(DIR, '05-plans-tab.png') });
      }
    }
  }

  await browser.close();
  console.log('\nDone. Screenshots in test-results/fixes/');
}
main();
