import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/content-width');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
  await page.waitForTimeout(1000);

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Measure every section's width vs viewport
  const layout = await page.evaluate(() => {
    const vw = window.innerWidth;
    const sections: any[] = [];

    // Nav
    const nav = document.querySelector('nav');
    if (nav) {
      const r = nav.getBoundingClientRect();
      sections.push({ name: 'nav', left: r.left, right: r.right, width: r.width, padding: getComputedStyle(nav).padding, vwPct: Math.round(r.width / vw * 100) });
    }

    // Metrics bar (role="region" with summary statistics)
    const metrics = document.querySelector('[aria-label="Summary statistics"]');
    if (metrics) {
      const r = metrics.getBoundingClientRect();
      sections.push({ name: 'metrics', left: r.left, right: r.right, width: r.width, padding: getComputedStyle(metrics).padding, vwPct: Math.round(r.width / vw * 100) });
    }

    // Alerts
    const alerts = document.querySelector('[aria-label="Alerts"]');
    if (alerts) {
      const r = alerts.getBoundingClientRect();
      sections.push({ name: 'alerts', left: r.left, right: r.right, width: r.width, padding: getComputedStyle(alerts).padding, vwPct: Math.round(r.width / vw * 100) });
    }

    // Main content
    const main = document.querySelector('#main-content') || document.querySelector('main');
    if (main) {
      const r = main.getBoundingClientRect();
      sections.push({ name: 'main', left: r.left, right: r.right, width: r.width, padding: getComputedStyle(main).padding, vwPct: Math.round(r.width / vw * 100) });
    }

    // Cohort grid
    const cohortGrid = document.querySelector('[aria-label="Cohort list"]');
    if (cohortGrid) {
      const r = cohortGrid.getBoundingClientRect();
      sections.push({ name: 'cohort-grid', left: r.left, right: r.right, width: r.width, padding: getComputedStyle(cohortGrid).padding, vwPct: Math.round(r.width / vw * 100) });
    }

    return { vw, sections };
  });

  console.log(`Viewport: ${layout.vw}px`);
  console.log('\nSection widths:');
  for (const s of layout.sections) {
    const leftGap = Math.round(s.left);
    const rightGap = Math.round(layout.vw - s.right);
    console.log(`  ${s.name}: ${Math.round(s.width)}px (${s.vwPct}% of vw) | left=${leftGap}px right=${rightGap}px | padding=${s.padding}`);
  }

  await page.screenshot({ path: path.join(DIR, '01-dashboard-fullscreen.png'), fullPage: true });

  // Check school profile too
  await page.goto(`${BASE}/schools/20000000-0000-0000-0000-000000000001`);
  await page.waitForTimeout(2000);

  const schoolLayout = await page.evaluate(() => {
    const vw = window.innerWidth;
    const sections: any[] = [];

    const nav = document.querySelector('nav');
    if (nav) sections.push({ name: 'nav', ...getBounds(nav, vw) });

    // Hero section (first div after nav with school name)
    const allDivs = document.querySelectorAll('nav ~ div');
    if (allDivs[0]) sections.push({ name: 'hero', ...getBounds(allDivs[0], vw) });
    if (allDivs[1]) sections.push({ name: 'content', ...getBounds(allDivs[1], vw) });

    function getBounds(el: Element, vw: number) {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), rightGap: Math.round(vw - r.right), padding: getComputedStyle(el).padding, vwPct: Math.round(r.width / vw * 100) };
    }
    return { vw, sections };
  });

  console.log(`\nSchool Profile (${schoolLayout.vw}px):`);
  for (const s of schoolLayout.sections) {
    console.log(`  ${s.name}: ${s.width}px (${s.vwPct}%) | left=${s.left} rightGap=${s.rightGap}px | padding=${s.padding}`);
  }

  await page.screenshot({ path: path.join(DIR, '02-school-fullscreen.png'), fullPage: false });

  await browser.close();
}
main();
