import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const results: string[] = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 2) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className ? `.${String(el.className).split(' ')[0]}` : '';
        const id = el.id ? `#${el.id}` : '';
        results.push(`${tag}${id}${cls} right=${Math.round(rect.right)} overflow=${Math.round(rect.right - vw)}px text="${(el.textContent || '').slice(0,40).trim()}"`);
      }
    });
    return results.slice(0, 30);
  });

  console.log('Elements overflowing viewport (1280px):');
  offenders.forEach(o => console.log('  ' + o));
  await browser.close();
}
main();
