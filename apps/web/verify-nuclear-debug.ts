import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/nuclear-debug');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });

  // Launch with REAL browser settings — no viewport override
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });
  const context = await browser.newContext({
    viewport: null,  // use real window size
    deviceScaleFactor: 2,  // match Retina
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const log = (msg: string) => console.log(msg);

  // Step 1: Nuclear outline debug — outline EVERY element to find what extends past viewport
  log('=== NUCLEAR DEBUG: Finding overflow offenders ===');

  const analysis = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bodyW = document.body.clientWidth;
    const scrollW = document.documentElement.scrollWidth;

    // The classic debug: outline every element
    const offenders: string[] = [];
    const allEls = document.querySelectorAll('*');

    allEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Check if element extends past viewport
      if (rect.right > vw) {
        const path = getPath(el);
        offenders.push(`${path} | right=${Math.round(rect.right)} | width=${Math.round(rect.width)} | overflow=${Math.round(rect.right - vw)}px`);
      }
      // Check if element has negative margins pushing things out
      const style = getComputedStyle(el);
      const ml = parseFloat(style.marginLeft);
      const mr = parseFloat(style.marginRight);
      if (mr < -5 || ml < -5) {
        offenders.push(`NEGATIVE MARGIN: ${getPath(el)} ml=${ml} mr=${mr}`);
      }
      // Check if element width > 100vw
      if (rect.width > vw + 5) {
        offenders.push(`WIDER THAN VW: ${getPath(el)} width=${Math.round(rect.width)} vw=${vw}`);
      }
    });

    // Check computed box model of html, body, #root
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const boxInfo = {
      html: getBoxInfo(html),
      body: getBoxInfo(body),
      root: root ? getBoxInfo(root) : null,
    };

    function getBoxInfo(el: Element) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        scrollWidth: (el as HTMLElement).scrollWidth,
        clientWidth: (el as HTMLElement).clientWidth,
        offsetWidth: (el as HTMLElement).offsetWidth,
        margin: s.margin,
        padding: s.padding,
        border: s.borderWidth,
        boxSizing: s.boxSizing,
        overflow: s.overflow,
        overflowX: s.overflowX,
        display: s.display,
        position: s.position,
      };
    }

    function getPath(el: Element): string {
      const parts: string[] = [];
      let node: Element | null = el;
      for (let i = 0; i < 5 && node && node !== document.documentElement; i++) {
        const tag = node.tagName.toLowerCase();
        const id = node.id ? `#${node.id}` : '';
        const cls = node.className && typeof node.className === 'string'
          ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
        parts.unshift(`${tag}${id}${cls}`);
        node = node.parentElement;
      }
      return parts.join(' > ');
    }

    return {
      vw, bodyW, scrollW,
      hasHScroll: scrollW > vw,
      offenders: offenders.slice(0, 50),
      boxInfo,
    };
  });

  log(`Viewport: ${analysis.vw}px`);
  log(`Body width: ${analysis.bodyW}px`);
  log(`Scroll width: ${analysis.scrollW}px`);
  log(`Has H-scroll: ${analysis.hasHScroll}`);

  log('\n--- Box Model ---');
  for (const [name, info] of Object.entries(analysis.boxInfo)) {
    if (!info) continue;
    log(`${name}: width=${info.width} scrollW=${info.scrollWidth} clientW=${info.clientWidth} offsetW=${info.offsetWidth}`);
    log(`  margin=${info.margin} padding=${info.padding} boxSizing=${info.boxSizing}`);
    log(`  overflow=${info.overflow} overflowX=${info.overflowX} display=${info.display} position=${info.position}`);
  }

  if (analysis.offenders.length > 0) {
    log(`\n--- ${analysis.offenders.length} Overflow Offenders ---`);
    analysis.offenders.forEach(o => log(`  ${o}`));
  } else {
    log('\nNO OVERFLOW OFFENDERS FOUND via getBoundingClientRect');

    // Nuclear step 2: use the red-outline trick to VISUALLY identify
    log('\nApplying red outline to ALL elements for visual debug...');
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.outline = '1px solid rgba(255,0,0,0.15)';
      });
    });
    await page.screenshot({ path: path.join(DIR, '01-all-outlined.png'), fullPage: false });

    // Remove outlines
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.outline = '';
      });
    });
  }

  // Step 3: Check for the VISUAL gap — compare rightmost content edge to viewport edge
  log('\n--- Visual Gap Analysis ---');
  const visualGap = await page.evaluate(() => {
    const vw = window.innerWidth;
    // Get the ACTUAL rightmost pixel of visible content
    // Exclude html/body which are always full-width
    let maxContentRight = 0;
    let maxContentEl = '';

    document.querySelectorAll('nav, nav *, main *, [role="region"] *, section *, .grid *, [class*="Card"] *').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.right > maxContentRight && rect.right <= vw + 50) {
        maxContentRight = rect.right;
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        maxContentEl = `${tag}${id}`;
      }
    });

    // Check each top-level section
    const sections: any[] = [];
    const root = document.getElementById('root');
    if (root) {
      // Walk all visible children recursively at depth 1-2
      const walk = (parent: Element, depth: number) => {
        Array.from(parent.children).forEach(child => {
          const rect = child.getBoundingClientRect();
          if (rect.height > 0 && rect.width > 100) {
            const tag = child.tagName.toLowerCase();
            const id = child.id ? `#${child.id}` : '';
            const cls = child.className && typeof child.className === 'string' ? '.' + child.className.split(' ')[0] : '';
            const rightGap = vw - rect.right;
            if (rightGap > 5) {
              sections.push({
                path: `${'  '.repeat(depth)}${tag}${id}${cls}`,
                right: Math.round(rect.right),
                gap: Math.round(rightGap),
                width: Math.round(rect.width),
              });
            }
            if (depth < 2) walk(child, depth + 1);
          }
        });
      };
      walk(root, 0);
    }

    return { vw, maxContentRight: Math.round(maxContentRight), maxContentEl, visualGap: Math.round(vw - maxContentRight), sections };
  });

  log(`Viewport: ${visualGap.vw}px`);
  log(`Rightmost content: ${visualGap.maxContentRight}px (${visualGap.maxContentEl})`);
  log(`Visual gap: ${visualGap.visualGap}px`);

  if (visualGap.sections.length > 0) {
    log('\nElements with right-side gap:');
    visualGap.sections.forEach(s => log(`  ${s.path}: right=${s.right} gap=${s.gap}px width=${s.width}`));
  }

  await page.screenshot({ path: path.join(DIR, '02-dashboard-maximized.png'), fullPage: false });

  // Step 4: Check other pages
  for (const url of [
    `${BASE}/schools/20000000-0000-0000-0000-000000000001`,
    `${BASE}/data-analysis`,
  ]) {
    const name = url.includes('schools') ? 'school' : 'data-analysis';
    await page.goto(url);
    await page.waitForTimeout(2000);

    const gap = await page.evaluate(() => {
      const vw = window.innerWidth;
      const sections: any[] = [];
      const root = document.getElementById('root');
      if (root) {
        Array.from(root.querySelectorAll('*')).forEach(el => {
          const rect = el.getBoundingClientRect();
          const rightGap = vw - rect.right;
          if (rect.height > 10 && rect.width > 200 && rightGap > 20 && rightGap < vw - 100) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '';
            sections.push({ el: `${tag}${id}${cls}`, gap: Math.round(rightGap), right: Math.round(rect.right), width: Math.round(rect.width) });
          }
        });
      }
      // Dedupe by gap value, keep unique gaps
      const byGap = new Map<number, any>();
      sections.forEach(s => { if (!byGap.has(s.gap)) byGap.set(s.gap, s); });
      return { vw, items: Array.from(byGap.values()).sort((a, b) => b.gap - a.gap).slice(0, 10) };
    });

    log(`\n--- ${name} (${gap.vw}px) ---`);
    if (gap.items.length > 0) {
      gap.items.forEach(s => log(`  ${s.el}: gap=${s.gap}px right=${s.right} width=${s.width}`));
    } else {
      log('  No elements with significant right gap');
    }
    await page.screenshot({ path: path.join(DIR, `03-${name}.png`), fullPage: false });
  }

  await browser.close();
}
main();
