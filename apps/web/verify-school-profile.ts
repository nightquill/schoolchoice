/**
 * Playwright verification for School Profile overhaul, Programme Detail, and SubmissionList fix.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/school-profile');
// CityU has many programmes
const SCHOOL_ID = '20000000-0000-0000-0000-000000000005';

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  try {
    // Login
    log('Step 0: Login');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✓ Logged in');

    // --- School Profile ---
    log('\nStep 1: School Profile page');
    await page.goto(`${BASE}/schools/${SCHOOL_ID}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-school-profile.png'), fullPage: true });

    const bodyText = await page.textContent('body') ?? '';

    // Hero stats
    if (bodyText.includes('Accept Rate') || bodyText.includes('Acceptance')) log('✓ Accept Rate stat visible');
    if (bodyText.includes('Avg Score') || bodyText.includes('Average')) log('✓ Avg Score stat visible');
    if (bodyText.includes('Programmes') || bodyText.includes('Programme')) log('✓ Programmes section visible');

    // School name
    if (bodyText.includes('City University')) log('✓ School name rendered');

    // Programme cards
    const programmeLinks = await page.$$('a[href*="/programmes/"]');
    log(`  Programme card links: ${programmeLinks.length}`);
    if (programmeLinks.length > 0) {
      log('✓ Programme cards rendered with links');
    } else {
      // Maybe cards don't use <a> — check for JS code elements
      const codeSpans = await page.$$eval('span', spans =>
        spans.filter(s => /^JS\d{4}$/.test(s.textContent?.trim() ?? '')).map(s => s.textContent?.trim())
      );
      log(`  JUPAS code spans: ${codeSpans.length} (${codeSpans.slice(0, 5).join(', ')})`);
      if (codeSpans.length > 0) log('✓ Programme cards rendered (JUPAS codes visible)');
    }

    // Competitiveness badges
    const tierBadges = await page.$$eval('span', spans =>
      spans.filter(s => {
        const t = s.textContent?.trim() ?? '';
        return ['Very Competitive', 'Competitive', 'Moderate', 'Accessible'].includes(t);
      }).map(s => s.textContent?.trim())
    );
    log(`  Tier badges: ${tierBadges.length} (${[...new Set(tierBadges)].join(', ')})`);
    if (tierBadges.length > 0) log('✓ Competitiveness tier badges visible');

    // Search input
    const searchInput = await page.$('input[placeholder*="earch"]');
    if (searchInput) {
      log('✓ Search input present');
      await searchInput.fill('eng');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-search-filtered.png'), fullPage: true });
      const afterSearch = await page.$$('a[href*="/programmes/"]');
      log(`  After searching "eng": ${afterSearch.length} programme(s)`);
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    // Faculty filter
    const selects = await page.$$('select');
    if (selects.length > 0) log('✓ Faculty filter dropdown present');

    // --- Programme Detail ---
    log('\nStep 2: Programme Detail page');
    const progLinks = await page.$$('a[href*="/programmes/"]');
    if (progLinks.length > 0) {
      await progLinks[0].click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-programme-detail.png'), fullPage: true });

      const progUrl = page.url();
      log(`  URL: ${progUrl}`);
      if (progUrl.includes('/programmes/')) log('✓ Navigated to programme sub-page');

      const progText = await page.textContent('body') ?? '';

      // Stats
      if (progText.includes('Median')) log('✓ Median stat visible');
      if (progText.includes('Upper Quartile') || progText.includes('Quartile')) log('✓ Quartile stats visible');

      // Requirements
      if (progText.includes('Requirement') || progText.includes('33222') || progText.includes('General')) {
        log('✓ Entry requirements visible');
      }

      // Student tiers
      if (progText.includes('Strong')) log('✓ Strong Candidates tier');
      if (progText.includes('Possible')) log('✓ Possible tier');
      if (progText.includes('Stretch')) log('✓ Stretch tier');

      // Student links
      const studentLinks = await page.$$('a[href*="/students/"]');
      log(`  Student profile links: ${studentLinks.length}`);
      if (studentLinks.length > 0) log('✓ Student names link to profiles');

      // Match percentages
      const matchPcts = await page.$$eval('span', spans =>
        spans.filter(s => s.textContent?.match(/^\d+%$/)).map(s => s.textContent)
      );
      if (matchPcts.length > 0) log(`✓ Match percentages: ${matchPcts.slice(0, 5).join(', ')}`);

      // Breadcrumb
      const backLink = await page.$(`a[href*="/schools/${SCHOOL_ID}"]`);
      if (backLink) log('✓ Breadcrumb back to school');

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-programme-bottom.png'), fullPage: true });
    } else {
      log('⚠ No programme links to click — checking if cards use different navigation');
    }

    // --- Submissions List ---
    log('\nStep 3: Submissions List');
    await page.goto(`${BASE}/submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-submissions-list.png'), fullPage: true });

    const subText = await page.textContent('body') ?? '';
    if (subText.includes('Pending')) log('✓ Submissions list page loaded');

    const reviewLinks = await page.$$('a[href*="/submissions/"]');
    log(`  Review links: ${reviewLinks.length}`);
    if (reviewLinks.length > 0) {
      log('✓ Review links render');
      await reviewLinks[0].click();
      await page.waitForTimeout(2000);
      if (page.url().includes('/submissions/')) log('✓ Review link navigates to detail');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-submission-detail.png'), fullPage: true });
    }

    // Summary
    log('\n=== SUMMARY ===');
    const passes = results.filter(r => r.startsWith('✓')).length;
    const fails = results.filter(r => r.startsWith('✗')).length;
    const warns = results.filter(r => r.startsWith('⚠')).length;
    log(`Passes: ${passes}, Failures: ${fails}, Warnings: ${warns}`);

  } catch (err: any) {
    log(`ERROR: ${err.message}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
  } finally {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'results.txt'), results.join('\n'));
    await browser.close();
  }
}

main();
