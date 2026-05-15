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
  
  // Top of page
  await page.screenshot({ path: `${DIR}/01-top.png` });
  
  // Scroll through the page
  for (let i = 1; i <= 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/0${i+1}-scroll${i}.png` });
  }
  
  // Check the plan HTML directly
  const planHtml = await page.locator('iframe').first().getAttribute('srcdoc');
  if (planHtml) {
    console.log('Plan has SVG:', planHtml.includes('<svg'));
    console.log('Plan has deadline badge:', planHtml.includes('days</span>'));
    console.log('Plan has Academic Strengths:', planHtml.includes('Academic Strengths'));
    console.log('Plan has NO grade table:', !planHtml.includes('<table class="data-table">'));
  }
  
  await browser.close();
  console.log('Done');
}
main();
