import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/requirements');
const HKU_ID = '20000000-0000-0000-0000-000000000001';

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  try {
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✓ Logged in');

    // 1. School Profile — check requirement badges on programme cards
    log('\n=== School Profile (HKU) — Requirement Badges ===');
    await page.goto(`${BASE}/schools/${HKU_ID}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '01-hku-profile.png'), fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    const hasInterviewBadge = bodyText.includes('Interview');
    const hasPortfolioBadge = bodyText.includes('Portfolio');
    log(`Interview badges on cards: ${hasInterviewBadge ? '✓' : '✗'}`);
    log(`Portfolio badges on cards: ${hasPortfolioBadge ? '✓' : '✗'}`);

    // 2. Click Medicine programme — check detail page badges
    log('\n=== Programme Detail (HKU Medicine) — Full Badges ===');
    const medLink = await page.$('a[href*="/programmes/JS6456"]');
    if (medLink) {
      await medLink.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(DIR, '02-medicine-detail.png'), fullPage: false });

      const medText = await page.textContent('body') ?? '';
      log(`Medicine has Interview badge: ${medText.includes('Interview') ? '✓' : '✗'}`);
    } else {
      log('⚠ Medicine link not found');
    }

    // 3. Check Architecture — should have Portfolio badge
    log('\n=== Programme Detail (HKU Architecture) ===');
    await page.goto(`${BASE}/schools/${HKU_ID}`);
    await page.waitForTimeout(2000);
    const archLink = await page.$('a[href*="/programmes/JS6004"]');
    if (archLink) {
      await archLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(DIR, '03-architecture-detail.png'), fullPage: false });

      const archText = await page.textContent('body') ?? '';
      log(`Architecture has Portfolio badge: ${archText.includes('Portfolio') ? '✓' : '✗'}`);
      log(`Architecture has Interview badge: ${archText.includes('Interview') ? '✓' : '✗'}`);
    }

    // 4. EdUHK — all programmes should show "Interview" (must)
    log('\n=== EdUHK — Must Interview ===');
    const EDUHK_ID = '20000000-0000-0000-0000-000000000010';
    await page.goto(`${BASE}/schools/${EDUHK_ID}`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '04-eduhk-profile.png'), fullPage: true });

    const eduhkText = await page.textContent('body') ?? '';
    const interviewCount = (eduhkText.match(/Interview/g) || []).length;
    log(`EdUHK Interview badge count: ${interviewCount} (expected: ≥20 for all programmes)`);
    if (interviewCount >= 20) log('✓ All EdUHK programmes show Interview badge');

    // 5. ProgrammeChoicesTab — check badges on student's choices
    log('\n=== ProgrammeChoicesTab — Requirement Chips ===');
    // Chan Siu Ming has JS6456 (HKU BBA) as target
    const chanId = '3aa7db89-ca42-476d-bfa6-3be88ff9d367';
    await page.goto(`${BASE}/students/${chanId}/profile?tab=programmes`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '05-choices-tab.png'), fullPage: true });

    const choicesText = await page.textContent('body') ?? '';
    // Chan has JS6456 which is HKU Medicine → must interview
    // Check if any requirement badges appear in the choices table
    const hasBadgeInChoices = choicesText.includes('Interview') || choicesText.includes('Portfolio');
    log(`Requirement badges in choices tab: ${hasBadgeInChoices ? '✓' : '⚠ none (student may not have programmes with requirements)'}`);

    // 6. Cohort default sitting
    log('\n=== Cohort Detail — Default Sitting ===');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    // Find a cohort link
    const cohortLinks = await page.$$('a[href*="/cohorts/"]');
    if (cohortLinks.length > 0) {
      await cohortLinks[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(DIR, '06-cohort-detail.png'), fullPage: true });

      // Check if MOCK is selected by default
      const mockSelected = await page.$eval('select', (sel) => sel.value).catch(() => '');
      log(`Cohort sitting default: ${mockSelected === 'MOCK' ? '✓ MOCK' : `✗ ${mockSelected || 'unknown'}`}`);
    }

    // 7. Data Analysis — elective combinations
    log('\n=== Data Analysis — Elective Combinations ===');
    await page.goto(`${BASE}/data-analysis`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '07-data-analysis.png'), fullPage: true });

    const daText = await page.textContent('body') ?? '';
    const CORE = ['CHLA', 'ENGL', 'MATH', 'CSD'];
    const hasCoreInCombos = CORE.some(c => {
      // Check if core subject appears in the combinations section (after "Subject Combinations" heading)
      const comboSection = daText.split('Subject Combinations')[1] || daText.split('Elective')[1] || '';
      return comboSection.includes(c + ' +') || comboSection.includes('+ ' + c);
    });
    log(`Core subjects in combinations: ${hasCoreInCombos ? '✗ STILL PRESENT' : '✓ elective only'}`);

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
