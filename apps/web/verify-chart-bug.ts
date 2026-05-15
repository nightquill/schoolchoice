import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/chart-bug';
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

  // Go to plans analytics page
  await page.goto(`${BASE}/analytics/plans`);
  await page.waitForTimeout(2500);

  // Check chart state
  const chartContainer = await page.locator('.recharts-responsive-container').count();
  const chartLines = await page.locator('.recharts-line').count();
  const chartDots = await page.locator('.recharts-dot').count();
  const xAxisTicks = await page.locator('.recharts-xAxis .recharts-cartesian-axis-tick').count();
  const totalText = await page.locator('text=/Total: \\d+/').textContent().catch(() => 'NOT FOUND');
  
  console.log('Chart container:', chartContainer > 0);
  console.log('Chart lines:', chartLines);
  console.log('Chart dots:', chartDots);
  console.log('X-axis ticks:', xAxisTicks);
  console.log('Total text:', totalText);
  
  // Check the data being rendered
  const chartData = await page.evaluate(() => {
    const el = document.querySelector('.recharts-responsive-container');
    return el ? { width: el.clientWidth, height: el.clientHeight } : null;
  });
  console.log('Chart dimensions:', chartData);

  await page.screenshot({ path: `${DIR}/01-plan-chart.png` });
  
  // Try weekly
  const weeklyBtn = page.locator('button:has-text("Weekly")');
  if (await weeklyBtn.count() > 0) {
    await weeklyBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/02-plan-chart-weekly.png` });
  }
  
  // Try monthly
  const monthlyBtn = page.locator('button:has-text("Monthly")');
  if (await monthlyBtn.count() > 0) {
    await monthlyBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/03-plan-chart-monthly.png` });
  }

  await browser.close();
  console.log('Done');
}
main();
