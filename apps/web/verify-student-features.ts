import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/student-features';
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  // Login as counselor
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 1. Check programme URLs in add-programme modal
  console.log('=== Programme URLs ===');
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);
  const progTab = page.locator('button:has-text("Programme")');
  if (await progTab.count() > 0) {
    await progTab.first().click();
    await page.waitForTimeout(1000);
    const addLink = page.locator('span:has-text("+ add")');
    if (await addLink.count() > 0) {
      await addLink.first().click();
      await page.waitForTimeout(1500);
      const jupasLinks = await page.locator('a:has-text("JUPAS")').count();
      console.log('JUPAS links in modal:', jupasLinks);
      await page.locator('button[aria-label="Close"]').click().catch(() => {});
    }
  }

  // 2. Grade builds
  console.log('\n=== Grade Builds ===');
  const gradesTab = page.locator('button:has-text("Grades")');
  if (await gradesTab.count() > 0) {
    await gradesTab.first().click();
    await page.waitForTimeout(1000);
    const buildSelector = await page.locator('select').first().count();
    console.log('Build selector present:', buildSelector > 0);
    const newBuildBtn = await page.locator('text=/\\+ New Build|\\+ 新組合/').count();
    console.log('New Build button:', newBuildBtn > 0);
    await page.screenshot({ path: `${DIR}/01-grades-builds.png` });
  }

  // 3. Release plan
  console.log('\n=== Plan Release ===');
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);
  const releaseBtn = await page.locator('button:has-text("Release"), button:has-text("發佈")').count();
  console.log('Release button:', releaseBtn > 0);
  await page.screenshot({ path: `${DIR}/02-consultant-release.png` });

  // 4. Student nav (check as counselor — student links visible for student role)
  console.log('\n=== Regression ===');
  errors.length = 0;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  console.log('Dashboard errors:', errors.length);

  // 5. Student plan page
  await page.goto(`${BASE}/my-plan`);
  await page.waitForTimeout(2000);
  const planPageContent = await page.locator('#root').innerHTML();
  console.log('My Plan page has content:', planPageContent.length > 100);
  await page.screenshot({ path: `${DIR}/03-my-plan.png` });

  console.log('\nJS errors total:', errors.length, errors.slice(0, 2).join('; '));
  await browser.close();
  console.log('Done');
}
main();
