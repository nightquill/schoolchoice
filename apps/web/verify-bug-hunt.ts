/**
 * Headed browser bug hunt — click through every surface of the new features,
 * capture console errors, network failures, and visual anomalies.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/bug-hunt');
const SCHOOL_ID = '20000000-0000-0000-0000-000000000005'; // CityU

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  // Capture network failures
  page.on('requestfailed', (req) => {
    networkErrors.push(`NETWORK FAIL: ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  // Capture 4xx/5xx responses
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      networkErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });

  try {
    // === LOGIN ===
    log('=== LOGIN ===');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✓ Logged in');

    // === 1. SCHOOL PROFILE ===
    log('\n=== SCHOOL PROFILE (CityU) ===');
    consoleErrors.length = 0;
    networkErrors.length = 0;
    await page.goto(`${BASE}/schools/${SCHOOL_ID}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-school-profile-top.png'), fullPage: false });

    // Check hero section
    const heroText = await page.textContent('body') ?? '';
    log(`School name: ${heroText.includes('City University') ? '✓' : '✗ MISSING'}`);
    log(`Chinese name: ${heroText.includes('城市大學') || heroText.includes('香港城市大學') ? '✓' : '⚠ not visible'}`);
    log(`Accept Rate stat: ${heroText.includes('Accept') ? '✓' : '✗'}`);
    log(`Avg Score stat: ${heroText.includes('Avg Score') || heroText.includes('Average') ? '✓' : '✗'}`);
    log(`Programme count stat: ${heroText.includes('Programme') ? '✓' : '✗'}`);

    // Check back link
    const backLink = await page.$('a[href="/schools"]');
    log(`Back to Directory link: ${backLink ? '✓' : '✗'}`);

    // Count programmes
    const progLinks = await page.$$('a[href*="/programmes/"]');
    log(`Programme cards: ${progLinks.length}`);

    // Check tier badge distribution
    const tierTexts = await page.$$eval('span', spans =>
      spans.map(s => s.textContent?.trim()).filter(t =>
        ['Very Competitive', 'Competitive', 'Moderate', 'Accessible'].includes(t ?? '')
      )
    );
    const tierCounts: Record<string, number> = {};
    tierTexts.forEach(t => { tierCounts[t!] = (tierCounts[t!] || 0) + 1; });
    log(`Tier distribution: ${JSON.stringify(tierCounts)}`);

    // Check median scores visible
    const medianTexts = await page.$$eval('div', divs =>
      divs.filter(d => {
        const t = d.textContent?.trim() ?? '';
        return /^\d+(\.\d+)?$/.test(t) && d.querySelector('div');
      }).length
    );

    // Test search filter
    const searchInput = await page.$('input[placeholder*="earch"]');
    if (searchInput) {
      await searchInput.fill('law');
      await page.waitForTimeout(500);
      const lawResults = await page.$$('a[href*="/programmes/"]');
      log(`Search "law": ${lawResults.length} results`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-search-law.png'), fullPage: false });
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    // Test faculty filter
    const facultySelect = await page.$('select');
    if (facultySelect) {
      const options = await facultySelect.$$eval('option', opts => opts.map(o => o.textContent?.trim()));
      log(`Faculty options: ${options.length} (${options.slice(0, 5).join(', ')}...)`);
      if (options.length > 1) {
        await facultySelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        const filteredCount = (await page.$$('a[href*="/programmes/"]')).length;
        log(`Faculty filter (${options[1]}): ${filteredCount} results`);
        await facultySelect.selectOption({ index: 0 }); // reset
        await page.waitForTimeout(300);
      }
    }

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-school-profile-bottom.png'), fullPage: false });

    // Console/network errors on this page
    if (consoleErrors.length > 0) log(`⚠ Console errors: ${consoleErrors.join(' | ')}`);
    if (networkErrors.length > 0) log(`⚠ Network errors: ${networkErrors.join(' | ')}`);

    // === 2. PROGRAMME DETAIL — test 3 different programmes ===
    log('\n=== PROGRAMME DETAIL ===');
    const allProgLinks = await page.$$('a[href*="/programmes/"]');
    const testIndices = [0, Math.floor(allProgLinks.length / 2), allProgLinks.length - 1];

    for (let idx = 0; idx < testIndices.length; idx++) {
      const i = testIndices[idx];
      consoleErrors.length = 0;
      networkErrors.length = 0;

      await page.goto(`${BASE}/schools/${SCHOOL_ID}`);
      await page.waitForTimeout(2000);

      const links = await page.$$('a[href*="/programmes/"]');
      if (i >= links.length) continue;

      const linkText = await links[i].textContent();
      await links[i].click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `04-prog-${idx + 1}.png`), fullPage: true });

      const progText = await page.textContent('body') ?? '';
      const progUrl = page.url();
      log(`\nProgramme ${idx + 1}: ${progUrl.split('/programmes/')[1] ?? '?'}`);

      // Check key elements
      log(`  JUPAS code badge: ${progText.match(/JS\d{4}/) ? '✓' : '✗'}`);
      log(`  Tier badge: ${['Very Competitive', 'Competitive', 'Moderate', 'Accessible'].some(t => progText.includes(t)) ? '✓' : '✗'}`);
      log(`  Median stat: ${progText.includes('Median') || progText.includes('MEDIAN') ? '✓' : '✗'}`);
      log(`  Requirements: ${progText.includes('Requirement') || progText.includes('General') ? '✓' : '✗'}`);

      // Student tiers
      const hasStudents = progText.includes('Your Students') || progText.includes('Scored against');
      log(`  Student section: ${hasStudents ? '✓' : '✗'}`);

      const strongMatch = progText.match(/Strong.*?(\d+)\s*student/i);
      const possibleMatch = progText.match(/Possible.*?(\d+)\s*student/i);
      const stretchMatch = progText.match(/Stretch.*?(\d+)\s*student/i);
      log(`  Strong: ${strongMatch ? strongMatch[1] : '0'}, Possible: ${possibleMatch ? possibleMatch[1] : '0'}, Stretch: ${stretchMatch ? stretchMatch[1] : '0'}`);

      // Check student links work
      const studentLinks = await page.$$('a[href*="/students/"]');
      if (studentLinks.length > 0) {
        const href = await studentLinks[0].getAttribute('href');
        log(`  Student link: ${href}`);
      }

      // Check breadcrumb works
      const breadcrumb = await page.$('a[href*="/schools/"]');
      if (breadcrumb) {
        log(`  Breadcrumb: ✓`);
      }

      // Check for "show" toggle on stretch tier
      const showToggle = await page.$('span:has-text("show"), div:has-text("show")');
      if (stretchMatch && parseInt(stretchMatch[1]) > 0) {
        if (showToggle) {
          log(`  Stretch collapsed with show toggle: ✓`);
          // Click to expand
          await showToggle.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `05-stretch-expanded-${idx + 1}.png`), fullPage: true });
          log(`  Stretch expanded: ✓`);
        } else {
          log(`  ⚠ Stretch has students but no show toggle`);
        }
      }

      // Console/network errors
      if (consoleErrors.length > 0) log(`  ⚠ Console errors: ${consoleErrors.join(' | ')}`);
      if (networkErrors.length > 0) log(`  ⚠ Network errors: ${networkErrors.join(' | ')}`);
    }

    // === 3. PROGRAMME DETAIL — edge cases ===
    log('\n=== EDGE CASES ===');

    // Invalid JUPAS code
    consoleErrors.length = 0;
    networkErrors.length = 0;
    await page.goto(`${BASE}/schools/${SCHOOL_ID}/programmes/JS9999`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-invalid-code.png'), fullPage: true });
    const invalidText = await page.textContent('body') ?? '';
    log(`Invalid code (JS9999): ${invalidText.includes('not found') || invalidText.includes('Error') || invalidText.includes('404') ? '✓ shows error' : '⚠ no error shown'}`);
    if (consoleErrors.length > 0) log(`  Console errors: ${consoleErrors.join(' | ')}`);

    // === 4. SUBMISSIONS LIST ===
    log('\n=== SUBMISSIONS LIST ===');
    consoleErrors.length = 0;
    networkErrors.length = 0;
    await page.goto(`${BASE}/submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-submissions.png'), fullPage: true });

    const subText = await page.textContent('body') ?? '';
    log(`Page title: ${subText.includes('Pending Submissions') ? '✓' : '✗'}`);

    const reviewLinks = await page.$$('a[href*="/submissions/"]');
    log(`Review links: ${reviewLinks.length}`);

    if (reviewLinks.length > 0) {
      await reviewLinks[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-submission-detail.png'), fullPage: true });
      log(`Review navigates: ${page.url().includes('/submissions/') ? '✓' : '✗'}`);
    }

    if (consoleErrors.length > 0) log(`⚠ Console errors: ${consoleErrors.join(' | ')}`);
    if (networkErrors.length > 0) log(`⚠ Network errors: ${networkErrors.join(' | ')}`);

    // === 5. PENDING REVIEW ALERTS ===
    log('\n=== PENDING REVIEW ALERTS ===');
    consoleErrors.length = 0;
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    const alertsRegion = await page.$('[role="region"][aria-label="Alerts"]');
    if (alertsRegion) {
      const alertText = await alertsRegion.textContent() ?? '';
      log(`Pending Reviews in alerts: ${alertText.includes('Pending Review') ? '✓' : '✗'}`);

      // Expand and check
      const buttons = await alertsRegion.$$('button');
      for (const btn of buttons) {
        const t = await btn.textContent();
        if (t?.includes('Pending Review')) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-alerts-pending.png'), fullPage: false });
    }

    // === 6. STUDENT DASHBOARD ===
    log('\n=== STUDENT DASHBOARD (Chan Siu Ming) ===');
    consoleErrors.length = 0;
    networkErrors.length = 0;
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(1000);
    const studentBtn = await page.$('button:has-text("Student"), button:has-text("學生")');
    if (studentBtn) await studentBtn.click();
    await page.waitForTimeout(500);
    await page.fill('#input-candidateNumber', 'HKDSE-2026-A001');
    await page.fill('#input-password', 'HKDSE-2026-A001');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-student-dashboard.png'), fullPage: true });

    const studentText = await page.textContent('body') ?? '';
    log(`Student name: ${studentText.includes('Chan Siu Ming') ? '✓' : '✗'}`);
    log(`Submission status: ${studentText.includes('Revision Requested') || studentText.includes('Pending') || studentText.includes('Draft') ? '✓' : '⚠ no status'}`);
    log(`Submit button: ${studentText.includes('Submit to Teacher') || studentText.includes('Awaiting') ? '✓' : '✗'}`);

    // My Submissions
    await page.goto(`${BASE}/my-submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-my-submissions.png'), fullPage: true });
    const mySubText = await page.textContent('body') ?? '';
    log(`My Submissions page: ${mySubText.includes('My Submissions') ? '✓' : '✗'}`);
    log(`Has history entries: ${mySubText.includes('Revision Requested') || mySubText.includes('Approved') || mySubText.includes('Pending') ? '✓' : '✗'}`);

    if (consoleErrors.length > 0) log(`⚠ Console errors: ${consoleErrors.join(' | ')}`);
    if (networkErrors.length > 0) log(`⚠ Network errors: ${networkErrors.join(' | ')}`);

    // === SUMMARY ===
    log('\n=== BUG HUNT SUMMARY ===');
    const passes = results.filter(r => r.includes('✓')).length;
    const fails = results.filter(r => r.includes('✗')).length;
    const warns = results.filter(r => r.includes('⚠')).length;
    log(`Checks: ${passes} pass, ${fails} fail, ${warns} warnings`);

  } catch (err: any) {
    log(`FATAL ERROR: ${err.message}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error.png'), fullPage: true });
  } finally {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'results.txt'), results.join('\n'));
    await browser.close();
  }
}

main();
