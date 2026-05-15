import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/scrollbar');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  // Launch non-headless at native resolution — let the OS decide viewport
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: null }); // null = use window size
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Get actual dimensions
  const dims = await page.evaluate(() => ({
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    hasVScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
  }));
  console.log('Dashboard native viewport:', JSON.stringify(dims, null, 2));

  await page.screenshot({ path: path.join(DIR, '01-native-dashboard.png'), fullPage: true });

  if (dims.overflow > 0) {
    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const results: string[] = [];
      const seen = new Set<string>();
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 1) {
          const path = [];
          let node: Element | null = el;
          for (let i = 0; i < 4 && node; i++) {
            const tag = node.tagName.toLowerCase();
            const id = node.id ? `#${node.id}` : '';
            const cls = node.className && typeof node.className === 'string' ? `.${node.className.split(' ')[0]}` : '';
            path.unshift(`${tag}${id}${cls}`);
            node = node.parentElement;
          }
          const key = path.join(' > ');
          if (!seen.has(key)) {
            seen.add(key);
            results.push(`${key} right=${Math.round(rect.right)} overflow=${Math.round(rect.right - vw)}px w=${Math.round(rect.width)}`);
          }
        }
      });
      return results.slice(0, 20);
    });
    console.log('Overflow offenders:');
    offenders.forEach(o => console.log('  ' + o));
  } else {
    console.log('NO OVERFLOW DETECTED');
  }

  // Also check with vertical scroll content to trigger scrollbar
  await page.goto(`${BASE}/data-analysis`);
  await page.waitForTimeout(3000);
  const daDims = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log('Data Analysis native:', JSON.stringify(daDims));
  await page.screenshot({ path: path.join(DIR, '02-native-data-analysis.png'), fullPage: false });

  await browser.close();
}
main();
