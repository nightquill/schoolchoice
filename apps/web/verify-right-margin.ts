import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/right-margin');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });

  // Use maximized window to simulate real fullscreen
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  // Maximize the window
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
  await page.waitForTimeout(3000);

  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  // Get actual window/viewport dimensions
  const dims = await page.evaluate(() => ({
    screenW: screen.width,
    screenH: screen.height,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    outerW: window.outerWidth,
    outerH: window.outerHeight,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    bodyClientW: document.body.clientWidth,
    bodyOffsetW: document.body.offsetWidth,
    rootScrollW: document.getElementById('root')?.scrollWidth ?? 0,
    rootClientW: document.getElementById('root')?.clientWidth ?? 0,
    rootOffsetW: document.getElementById('root')?.offsetWidth ?? 0,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    rootOverflowX: getComputedStyle(document.getElementById('root')!).overflowX,
  }));
  log(`Screen: ${dims.screenW}x${dims.screenH}`);
  log(`Window inner: ${dims.innerW}x${dims.innerH}`);
  log(`HTML scrollW: ${dims.scrollW}, clientW: ${dims.clientW}, overflow: ${dims.scrollW - dims.clientW}`);
  log(`Body scrollW: ${dims.bodyScrollW}, clientW: ${dims.bodyClientW}, offsetW: ${dims.bodyOffsetW}`);
  log(`#root scrollW: ${dims.rootScrollW}, clientW: ${dims.rootClientW}, offsetW: ${dims.rootOffsetW}`);
  log(`Overflow-x: html=${dims.htmlOverflowX}, body=${dims.bodyOverflowX}, root=${dims.rootOverflowX}`);

  await page.screenshot({ path: path.join(DIR, '01-maximized-dashboard.png'), fullPage: false });

  // Check if there's a visible gap: find rightmost pixel of any element vs viewport
  const gapInfo = await page.evaluate(() => {
    const vw = window.innerWidth;
    let maxRight = 0;
    let maxEl = '';
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > maxRight) {
        maxRight = rect.right;
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
        maxEl = `${tag}${id}${cls}`;
      }
    });

    // Also check: is there a scrollbar taking space?
    const hasVScrollbar = window.innerWidth !== document.documentElement.clientWidth;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Check if nav extends further than content
    const nav = document.querySelector('nav');
    const main = document.querySelector('main') || document.querySelector('#main-content');
    const navRight = nav ? nav.getBoundingClientRect().right : 0;
    const mainRight = main ? main.getBoundingClientRect().right : 0;

    return { vw, maxRight: Math.round(maxRight), maxEl, hasVScrollbar, scrollbarWidth, navRight: Math.round(navRight), mainRight: Math.round(mainRight) };
  });

  log(`Viewport width: ${gapInfo.vw}`);
  log(`Max element right edge: ${gapInfo.maxRight} (${gapInfo.maxEl})`);
  log(`Gap from max element to viewport edge: ${gapInfo.vw - gapInfo.maxRight}px`);
  log(`Vertical scrollbar present: ${gapInfo.hasVScrollbar} (width: ${gapInfo.scrollbarWidth}px)`);
  log(`Nav right edge: ${gapInfo.navRight}, Main right edge: ${gapInfo.mainRight}`);

  // Now check every major section's right edge
  const sections = await page.evaluate(() => {
    const vw = window.innerWidth;
    const results: string[] = [];
    // Check direct children of #root
    const root = document.getElementById('root');
    if (root) {
      Array.from(root.children).forEach((child, i) => {
        const rect = child.getBoundingClientRect();
        const tag = child.tagName.toLowerCase();
        const cls = child.className && typeof child.className === 'string' ? child.className.split(' ').slice(0,2).join(' ') : '';
        results.push(`root child ${i}: ${tag}.${cls} left=${Math.round(rect.left)} right=${Math.round(rect.right)} width=${Math.round(rect.width)} gap=${Math.round(vw - rect.right)}px`);
      });
    }
    return results;
  });
  log('\nRoot children layout:');
  sections.forEach(s => log('  ' + s));

  // Scroll to far right if possible
  const canScrollRight = await page.evaluate(() => {
    const before = window.scrollX;
    window.scrollTo(99999, 0);
    const after = window.scrollX;
    window.scrollTo(0, 0);
    return after > before ? after : 0;
  });
  log(`\nHorizontal scroll possible: ${canScrollRight > 0 ? `YES (${canScrollRight}px)` : 'NO'}`);

  if (canScrollRight > 0) {
    await page.evaluate(() => window.scrollTo(99999, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, '02-scrolled-right.png'), fullPage: false });
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // Check other pages too
  const pages = [
    { name: 'school-profile', url: `${BASE}/schools/20000000-0000-0000-0000-000000000001` },
    { name: 'data-analysis', url: `${BASE}/data-analysis` },
  ];
  for (const p of pages) {
    await page.goto(p.url);
    await page.waitForTimeout(2000);
    const info = await page.evaluate(() => {
      const vw = window.innerWidth;
      let maxRight = 0;
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > maxRight) maxRight = rect.right;
      });
      const canScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      return { vw, maxRight: Math.round(maxRight), gap: Math.round(vw - maxRight), canScroll };
    });
    log(`\n${p.name}: viewport=${info.vw} maxRight=${info.maxRight} gap=${info.gap}px hScroll=${info.canScroll}`);
    await page.screenshot({ path: path.join(DIR, `03-${p.name}.png`), fullPage: false });
  }

  log('\n=== VERDICT ===');
  const hasGap = gapInfo.vw - gapInfo.maxRight > 5;
  const hasScroll = canScrollRight > 0;
  log(`Right margin gap: ${hasGap ? `✗ YES (${gapInfo.vw - gapInfo.maxRight}px)` : '✓ none'}`);
  log(`Horizontal scroll: ${hasScroll ? `✗ YES (${canScrollRight}px)` : '✓ none'}`);

  fs.writeFileSync(path.join(DIR, 'results.txt'), results.join('\n'));
  await browser.close();
}
main();
