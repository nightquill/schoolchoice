import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/plans-diag';
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message + '\n' + (err.stack?.slice(0, 300) || '')));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().slice(0, 200)); });
  
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1000);
  
  // Direct nav to consultant
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(5000);
  
  console.log('Errors:', errors.length);
  errors.forEach((e, i) => console.log(`Error ${i}:`, e.slice(0, 300)));
  
  const rootHtml = await page.locator('#root').innerHTML();
  console.log('Root has content:', rootHtml.length > 10);
  await page.screenshot({ path: `${DIR}/03-consultant.png` });
  
  await browser.close();
}
main();
