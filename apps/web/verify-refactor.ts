import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/refactor';
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Test ConsultantTask page
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);
  
  const hasNav = await page.locator('text="Academic Advisor"').count();
  const hasBackLink = await page.locator('a:has-text("Back to")').count();
  const hasGenBtn = await page.locator('button:has-text("Generate Plan")').count();
  const hasEmptyState = await page.locator('text=/No plan|generated yet/').count();
  
  console.log('Nav:', hasNav > 0);
  console.log('Back link:', hasBackLink > 0);
  console.log('Generate button:', hasGenBtn > 0);
  console.log('Empty state:', hasEmptyState > 0);
  console.log('JS errors:', errors.length, errors.join('; '));
  
  await page.screenshot({ path: `${DIR}/01-consultant-refactored.png` });

  // Test AcademicPlan page (should still work unchanged)
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/plan`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/02-academic-plan.png` });
  console.log('AcademicPlan JS errors:', errors.length);

  await browser.close();
  console.log('Done');
}
main();
