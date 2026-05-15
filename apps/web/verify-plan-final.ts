import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/plan-final';
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
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/01-top.png` });

  // Check inside iframe
  const iframe = page.locator('iframe').first();
  const frame = await iframe.contentFrame();
  if (frame) {
    // Scroll to see the radar chart inside plan
    await frame.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/02-plan-header.png` });
    
    await frame.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/03-radar-in-plan.png` });
    
    // Check content
    const hasSvg = await frame.locator('svg').count();
    const hasDeadline = await frame.locator('text=/days$/').count();
    const hasAcademicStrengths = await frame.locator('text="Your Academic Strengths"').count();
    console.log('SVG in plan:', hasSvg > 0);
    console.log('Deadline in plan header:', hasDeadline > 0);
    console.log('Academic Strengths heading:', hasAcademicStrengths > 0);
    
    await frame.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/04-school-cards.png` });
  }
  
  await browser.close();
  console.log('Done');
}
main();
