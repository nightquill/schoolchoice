import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Navigate directly to consultant page
  errors.length = 0;
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant?generate=true`);
  await page.waitForTimeout(4000);
  
  console.log('URL:', page.url());
  console.log('Console errors:', errors.length);
  errors.forEach(e => console.log('  ', e.slice(0, 200)));
  
  const html = await page.content();
  console.log('HTML length:', html.length);
  const rootContent = await page.locator('#root').innerHTML();
  console.log('Root innerHTML length:', rootContent.length);
  console.log('Root innerHTML (first 500):', rootContent.slice(0, 500));
  
  await browser.close();
}
main();
