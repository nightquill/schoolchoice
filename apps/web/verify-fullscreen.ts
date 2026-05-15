import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/fullscreen');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  // Use a large viewport like a maximized browser on a standard monitor
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Check overflow at fullscreen
  const dashOverflow = await page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log(`Dashboard 1920px: docW=${dashOverflow.docWidth} clientW=${dashOverflow.clientWidth} overflow=${dashOverflow.overflow}px`);
  await page.screenshot({ path: path.join(DIR, '01-dashboard-1920.png'), fullPage: false });

  if (dashOverflow.overflow > 0) {
    // Find offenders
    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const results: string[] = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 2) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className ? `.${String(el.className).split(' ').slice(0,2).join('.')}` : '';
          const id = el.id ? `#${el.id}` : '';
          const w = Math.round(rect.width);
          const r = Math.round(rect.right);
          results.push(`${tag}${id}${cls} w=${w} right=${r} overflow=${Math.round(r - vw)}px`);
        }
      });
      // Deduplicate by keeping the most specific (deepest) offenders
      return results.slice(0, 30);
    });
    console.log('Offending elements:');
    offenders.forEach(o => console.log('  ' + o));

    // Scroll right to see
    await page.evaluate(() => window.scrollTo(document.documentElement.scrollWidth, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, '02-dashboard-scrolled-right.png'), fullPage: false });
  }

  // Check school profile at fullscreen
  await page.goto(`${BASE}/schools/20000000-0000-0000-0000-000000000001`);
  await page.waitForTimeout(2000);
  const schoolOverflow = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log(`School profile 1920px: overflow=${schoolOverflow.overflow}px`);
  await page.screenshot({ path: path.join(DIR, '03-school-1920.png'), fullPage: false });

  // Check data analysis
  await page.goto(`${BASE}/data-analysis`);
  await page.waitForTimeout(2000);
  const daOverflow = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log(`Data analysis 1920px: overflow=${daOverflow.overflow}px`);
  await page.screenshot({ path: path.join(DIR, '04-data-analysis-1920.png'), fullPage: false });

  await browser.close();
}
main();
