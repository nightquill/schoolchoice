import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/layout-fix';
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
  await page.waitForTimeout(1500);

  // Go to Kwok's consultant page (has a plan)
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);

  // Check layout: radar chart should be INSIDE the left column (same container as iframe)
  // AI assistant should be visible alongside
  const radarChart = await page.locator('.recharts-responsive-container').first().boundingBox();
  const chatPanel = await page.locator('.consultant-chat-desktop').first().boundingBox();
  
  if (radarChart && chatPanel) {
    console.log('Radar chart Y:', radarChart.y, 'height:', radarChart.height);
    console.log('Chat panel Y:', chatPanel.y, 'height:', chatPanel.height);
    // They should be at roughly the same Y (side by side, not stacked)
    const sameRow = Math.abs(radarChart.y - chatPanel.y) < 100;
    console.log('Radar & Chat on same row:', sameRow);
  } else {
    console.log('Radar:', !!radarChart, 'Chat:', !!chatPanel);
  }

  await page.screenshot({ path: `${DIR}/01-layout.png` });
  
  // Scroll down to see the plan iframe alongside chat
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/02-scrolled.png` });

  // Test PDF export button
  const pdfBtn = page.locator('button:has-text("Export PDF")');
  if (await pdfBtn.count() > 0) {
    // Listen for new page (popup)
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
      pdfBtn.click(),
    ]);
    if (popup) {
      await popup.waitForTimeout(2000);
      console.log('PDF export opened:', popup.url().slice(0, 50));
      await popup.close();
    } else {
      console.log('PDF export: no popup (may have downloaded)');
    }
  }

  console.log('JS errors:', errors.length, errors.slice(0, 2).join('; '));
  await browser.close();
  console.log('Done');
}
main();
