import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/plan-content';
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Go to Kwok's consultant page
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/01-top.png` });

  // Scroll to see the plan content inside iframe
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/02-plan-content.png` });

  // Scroll more to see school cards
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/03-school-cards.png` });

  // Check: NO "Academic Strengths" table visible in iframe
  const iframe = page.locator('iframe').first();
  if (await iframe.count() > 0) {
    const frame = await iframe.contentFrame();
    if (frame) {
      const hasAcademicTable = await frame.locator('text="Academic Strengths"').count();
      console.log('Academic Strengths in plan HTML:', hasAcademicTable);
      const schoolCards = await frame.locator('.school-card').count();
      console.log('School cards in plan:', schoolCards);
    }
  }

  await browser.close();
  console.log('Done');
}
main();
