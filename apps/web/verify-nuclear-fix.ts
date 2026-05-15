import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/nuclear-fix');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const pages = [
    { name: '01-dashboard', url: `${BASE}/dashboard` },
    { name: '02-school-profile', url: `${BASE}/schools/20000000-0000-0000-0000-000000000001` },
    { name: '03-data-analysis', url: `${BASE}/data-analysis` },
    { name: '04-submissions', url: `${BASE}/submissions` },
    { name: '05-cohort', url: `${BASE}/cohorts` },
  ];

  for (const p of pages) {
    await page.goto(p.url);
    await page.waitForTimeout(2000);
    const vw = await page.evaluate(() => window.innerWidth);
    await page.screenshot({ path: path.join(DIR, `${p.name}.png`), fullPage: false });
    console.log(`${p.name} at ${vw}px — saved`);
  }

  await browser.close();
}
main();
