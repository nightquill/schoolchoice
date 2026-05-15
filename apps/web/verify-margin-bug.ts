import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/margin-bug');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  console.log('✓ Logged in');

  // Check each page for horizontal overflow
  const pages = [
    { name: 'dashboard', url: `${BASE}/dashboard` },
    { name: 'school-profile', url: `${BASE}/schools/20000000-0000-0000-0000-000000000001` },
    { name: 'submissions', url: `${BASE}/submissions` },
    { name: 'data-analysis', url: `${BASE}/data-analysis` },
  ];

  for (const p of pages) {
    await page.goto(p.url);
    await page.waitForTimeout(2000);

    // Check for horizontal scrollbar / overflow
    const overflow = await page.evaluate(() => {
      return {
        docWidth: document.documentElement.scrollWidth,
        viewWidth: document.documentElement.clientWidth,
        bodyWidth: document.body.scrollWidth,
        hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    console.log(`${p.name}: docW=${overflow.docWidth} viewW=${overflow.viewWidth} bodyW=${overflow.bodyWidth} hScroll=${overflow.hasHScroll}`);
    await page.screenshot({ path: path.join(DIR, `${p.name}.png`), fullPage: false });

    if (overflow.hasHScroll) {
      // Scroll right to see the margin
      await page.evaluate(() => window.scrollTo(document.documentElement.scrollWidth, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(DIR, `${p.name}-scrolled-right.png`), fullPage: false });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }

  await browser.close();
}

main();
