import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/ui-clarity');
const HKU_ID = '20000000-0000-0000-0000-000000000001';

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  try {
    // Login
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✓ Logged in');

    // 1. Dashboard — check nav clarity
    log('\n=== Dashboard — Nav & Layout ===');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, '01-dashboard.png'), fullPage: false });

    // Check nav links exist and are translated
    const navText = await page.textContent('nav') ?? '';
    const hasSubmissions = navText.includes('Submissions') || navText.includes('學生提交');
    const hasManage = navText.includes('User Management') || navText.includes('用戶管理');
    const hasSchoolDir = navText.includes('School Directory') || navText.includes('院校目錄');
    log(`Nav "Submissions" label: ${hasSubmissions ? '✓' : '✗'}`);
    log(`Nav "User Management" (was "Manage"): ${hasManage ? '✓' : '✗'}`);
    log(`Nav "School Directory": ${hasSchoolDir ? '✓' : '✗'}`);

    // Check active nav styling
    const dashLink = await page.$('nav a[href="/dashboard"]');
    if (dashLink) {
      const bg = await dashLink.evaluate((el) => getComputedStyle(el).backgroundColor);
      const hasActiveBg = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      log(`Active nav link has highlight: ${hasActiveBg ? '✓' : '✗'} (${bg})`);
    }

    // 2. Alerts panel — check token-based colors
    log('\n=== Alerts Panel ===');
    const alertsRegion = await page.$('[role="region"][aria-label="Alerts"]');
    if (alertsRegion) {
      log('✓ Alerts panel found with proper aria-label');
    } else {
      log('⚠ No alerts panel (may have 0 alerts)');
    }

    // 3. School Profile — stat cards use CSS vars
    log('\n=== School Profile (HKU) — Color Tokens ===');
    await page.goto(`${BASE}/schools/${HKU_ID}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '02-school-profile.png'), fullPage: false });

    // Check that competitiveness badges render
    const bodyText = await page.textContent('body') ?? '';
    const hasTierBadges = bodyText.includes('Competitive') || bodyText.includes('Moderate') || bodyText.includes('Accessible');
    log(`Competitiveness tier badges: ${hasTierBadges ? '✓' : '✗'}`);

    // Check requirement badges
    const hasReqBadges = bodyText.includes('Interview') || bodyText.includes('Portfolio');
    log(`Requirement badges visible: ${hasReqBadges ? '✓' : '✗'}`);

    // 4. Programme Detail — colors and layout
    log('\n=== Programme Detail (HKU Medicine) ===');
    const medLink = await page.$('a[href*="/programmes/JS6456"]');
    if (medLink) {
      await medLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(DIR, '03-programme-detail.png'), fullPage: false });

      const detailText = await page.textContent('body') ?? '';
      const hasStatCards = detailText.includes('Median Score') && detailText.includes('Upper Quartile');
      log(`Stat cards render: ${hasStatCards ? '✓' : '✗'}`);

      const hasTiers = detailText.includes('Strong Candidates') || detailText.includes('Possible');
      log(`Student tier sections: ${hasTiers ? '✓' : '✗'}`);
    }

    // 5. Submissions page — verify nav label works
    log('\n=== Submissions Page ===');
    await page.goto(`${BASE}/submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, '04-submissions.png'), fullPage: false });

    const submText = await page.textContent('body') ?? '';
    const hasSubmPage = submText.includes('Pending') || submText.includes('Submission');
    log(`Submissions page loads: ${hasSubmPage ? '✓' : '✗'}`);

    // 6. Check CSS variables loaded
    log('\n=== CSS Variable Verification ===');
    const cssVars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        errorBg: style.getPropertyValue('--color-error-bg').trim(),
        successBg: style.getPropertyValue('--color-success-bg').trim(),
        warningBg: style.getPropertyValue('--color-warning-bg').trim(),
        infoBg: style.getPropertyValue('--color-info-bg').trim(),
        purpleBg: style.getPropertyValue('--color-purple-bg').trim(),
        borderHover: style.getPropertyValue('--color-border-hover').trim(),
      };
    });
    log(`--color-error-bg: ${cssVars.errorBg || '✗ MISSING'}`);
    log(`--color-success-bg: ${cssVars.successBg || '✗ MISSING'}`);
    log(`--color-warning-bg: ${cssVars.warningBg || '✗ MISSING'}`);
    log(`--color-info-bg: ${cssVars.infoBg || '✗ MISSING'}`);
    log(`--color-purple-bg: ${cssVars.purpleBg || '✗ MISSING'}`);
    log(`--color-border-hover: ${cssVars.borderHover || '✗ MISSING'}`);

    const allVarsPresent = Object.values(cssVars).every(v => v && v.length > 0);
    log(`All new CSS variables loaded: ${allVarsPresent ? '✓' : '✗'}`);

    // 7. Mobile nav
    log('\n=== Mobile Nav ===');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, '05-mobile-dashboard.png'), fullPage: false });

    const hamburger = await page.$('button[aria-label]');
    if (hamburger) {
      await hamburger.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(DIR, '06-mobile-menu-open.png'), fullPage: false });

      const mobileNavText = await page.textContent('nav') ?? '';
      const mobileHasSubmissions = mobileNavText.includes('Submissions') || mobileNavText.includes('學生提交');
      log(`Mobile nav has "Submissions": ${mobileHasSubmissions ? '✓' : '✗'}`);
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 900 });

    log('\n=== SUMMARY ===');
    const passes = results.filter(r => r.includes('✓')).length;
    const fails = results.filter(r => r.includes('✗')).length;
    log(`Passes: ${passes}, Failures: ${fails}`);

  } catch (err: any) {
    log(`ERROR: ${err.message}`);
    await page.screenshot({ path: path.join(DIR, 'error.png'), fullPage: true });
  } finally {
    fs.writeFileSync(path.join(DIR, 'results.txt'), results.join('\n'));
    await browser.close();
  }
}

main();
