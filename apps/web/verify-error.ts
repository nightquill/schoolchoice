import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    console.log('STACK:', err.stack?.slice(0, 500));
  });
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(4000);
  await browser.close();
}
main();
