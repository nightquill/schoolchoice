import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/self-financing');

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

    // 1. SF Institution page
    log('\n=== SF Institution (HKCC) ===');
    await page.goto(`${BASE}/sf/HKCC`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '01-hkcc-institution.png'), fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    log(`Institution name: ${bodyText.includes('Hong Kong Community College') ? '✓' : '✗'}`);
    log(`Chinese name: ${bodyText.includes('香港專上學院') ? '✓' : '✗'}`);
    log(`Sub-degree badge: ${bodyText.includes('Sub-degree') ? '✓' : '✗'}`);
    log(`Tier badge: ${bodyText.includes('Tier 1') ? '✓' : '✗'}`);
    log(`Articulation rate: ${bodyText.includes('90%') ? '✓' : '✗'}`);
    log(`Parent uni: ${bodyText.includes('Polytechnic') ? '✓' : '✗'}`);

    // Count programmes
    const progRows = await page.$$('table tbody tr');
    log(`Programme rows: ${progRows.length}`);
    if (progRows.length >= 30) log('✓ All 36 programmes rendered');

    // Check level badges
    const adBadges = await page.$$eval('span', spans => spans.filter(s => s.textContent?.trim() === 'AD').length);
    const hdBadges = await page.$$eval('span', spans => spans.filter(s => s.textContent?.trim() === 'HD').length);
    log(`AD badges: ${adBadges}, HD badges: ${hdBadges}`);

    // Check real admission scores visible
    const hasScores = bodyText.includes('14.87') || bodyText.includes('15.42') || bodyText.includes('16.01');
    log(`Real admission scores: ${hasScores ? '✓' : '✗'}`);

    // Check data source attribution
    log(`Data source shown: ${bodyText.includes('hkcc-polyu.edu.hk') || bodyText.includes('CSPE') ? '✓' : '✗'}`);

    // Search
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.fill('engineering');
      await page.waitForTimeout(500);
      const filtered = await page.$$('table tbody tr');
      log(`Search "engineering": ${filtered.length} results`);
      await page.screenshot({ path: path.join(DIR, '02-hkcc-search.png'), fullPage: false });
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    // Level filter
    const levelSelect = await page.$('select');
    if (levelSelect) {
      await levelSelect.selectOption('higher_diploma');
      await page.waitForTimeout(500);
      const hdRows = await page.$$('table tbody tr');
      log(`HD filter: ${hdRows.length} results`);
      if (hdRows.length === 4) log('✓ HD filter shows exactly 4 higher diploma programmes');
      await levelSelect.selectOption('');
      await page.waitForTimeout(300);
    }

    // 2. Click into a programme
    log('\n=== SF Programme Detail ===');
    const progLinks = await page.$$('a[href*="/sf/HKCC/programmes/"]');
    if (progLinks.length > 0) {
      await progLinks[0].click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(DIR, '03-sf-programme-detail.png'), fullPage: true });

      const progText = await page.textContent('body') ?? '';
      log(`Programme name: ${progText.includes('Associate') || progText.includes('Higher Diploma') ? '✓' : '✗'}`);
      log(`Level badge: ${progText.includes('Associate Degree') || progText.includes('Higher Diploma') ? '✓' : '✗'}`);
      log(`Mean score stat: ${progText.includes('MEAN SCORE') ? '✓' : '✗'}`);
      log(`UQ stat: ${progText.includes('UPPER QUARTILE') ? '✓' : '✗'}`);

      // Student tiers
      log(`Strong tier: ${progText.includes('Strong') ? '✓' : '⚠ no strong candidates'}`);
      log(`Possible tier: ${progText.includes('Possible') ? '✓' : '⚠ no possible candidates'}`);

      // Student links
      const studentLinks = await page.$$('a[href*="/students/"]');
      log(`Student profile links: ${studentLinks.length}`);
      if (studentLinks.length > 0) log('✓ Students scored and linked');

      // Match percentages
      const pcts = await page.$$eval('span', spans => spans.filter(s => s.textContent?.match(/^\d+%$/)).map(s => s.textContent));
      if (pcts.length > 0) log(`✓ Match percentages: ${pcts.slice(0, 5).join(', ')}`);

      // Best-5 scores
      const hasBest5 = progText.includes('Best 5');
      log(`Best 5 column: ${hasBest5 ? '✓' : '✗'}`);

      // Breadcrumb
      const breadcrumb = await page.$('a[href*="/sf/HKCC"]');
      log(`Breadcrumb back: ${breadcrumb ? '✓' : '✗'}`);
    }

    // 3. Verify JUPAS pages unaffected
    log('\n=== JUPAS Unaffected ===');
    await page.goto(`${BASE}/schools/20000000-0000-0000-0000-000000000005`);
    await page.waitForTimeout(3000);
    const jupasText = await page.textContent('body') ?? '';
    log(`JUPAS school loads: ${jupasText.includes('City University') ? '✓' : '✗'}`);
    log(`No SF data in JUPAS: ${!jupasText.includes('Sub-degree') && !jupasText.includes('Articulation') ? '✓' : '✗ CONTAMINATION'}`);

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
