import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/cleanup');

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

    // 1. School Directory — no custom school features
    log('\n=== School Directory Cleanup ===');
    await page.goto(`${BASE}/schools`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, '01-directory.png'), fullPage: false });

    const bodyText = await page.textContent('body') ?? '';
    const hasAddCustom = bodyText.includes('Add Custom') || bodyText.includes('新增自訂');
    log(`"Add Custom School" button: ${hasAddCustom ? '✗ STILL PRESENT' : '✓ removed'}`);

    const hasDeleteBtn = await page.$('button:has-text("Delete")');
    log(`Delete buttons: ${hasDeleteBtn ? '✗ STILL PRESENT' : '✓ removed'}`);

    const hasCustomBadge = bodyText.includes('Custom') && bodyText.includes('Delete');
    log(`Custom badges: ${hasCustomBadge ? '✗ STILL PRESENT' : '✓ removed'}`);

    // Verify export still works
    const exportBtn = await page.$('button:has-text("Export"), button:has-text("匯出")');
    log(`Export button: ${exportBtn ? '✓ present' : '✗ missing'}`);

    // 2. SF section visible at bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(DIR, '02-directory-bottom.png'), fullPage: false });

    const hasSfSection = bodyText.includes('Sub-degree') && bodyText.includes('Self-financing');
    log(`SF section: ${hasSfSection ? '✓ visible' : '✗ missing'}`);

    // Check HKCC card shows parent university context
    const hkccCard = bodyText.includes('Hong Kong Community College');
    const hasPolyU = bodyText.includes('PolyU') || bodyText.includes('Polytechnic');
    log(`HKCC card: ${hkccCard ? '✓' : '✗'}`);
    log(`PolyU context on card: ${hasPolyU ? '✓' : '✗ missing'}`);

    // 3. Click into HKCC — check naming
    log('\n=== HKCC Institution Page ===');
    const hkccLink = await page.$('a[href="/sf/HKCC"]');
    if (hkccLink) {
      await hkccLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(DIR, '03-hkcc.png'), fullPage: false });

      const hkccText = await page.textContent('body') ?? '';
      log(`Name: ${hkccText.includes('Hong Kong Community College') ? '✓' : '✗'}`);
      log(`Parent uni prominent: ${hkccText.includes('Under The Hong Kong Polytechnic University') || hkccText.includes('Under PolyU') ? '✓' : '✗'}`);
      log(`Chinese name: ${hkccText.includes('香港專上學院') ? '✓' : '✗'}`);

      // 4. Click into a programme — verify scorer doesn't use JUPAS
      const progLinks = await page.$$('a[href*="/sf/HKCC/programmes/"]');
      if (progLinks.length > 0) {
        // Find HD Social Work (highest mean — 16.01)
        let targetLink = progLinks[0];
        for (const link of progLinks) {
          const text = await link.textContent();
          if (text?.includes('Social Work')) { targetLink = link; break; }
        }
        await targetLink.click();
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(DIR, '04-sf-programme.png'), fullPage: true });

        const progText = await page.textContent('body') ?? '';

        // Verify SF scoring (best-5 based), NOT JUPAS scoring
        log('\n=== SF Scorer Verification ===');
        log(`Uses "Best 5" column: ${progText.includes('Best 5') ? '✓' : '✗'}`);
        log(`Shows mean score: ${progText.includes('MEAN SCORE') ? '✓' : '✗'}`);

        // JUPAS-specific terms should NOT appear
        const hasJupasTerms = progText.includes('JUPAS') || progText.includes('Weighted Score');
        log(`No JUPAS terms on SF page: ${hasJupasTerms ? '✗ CONTAMINATED' : '✓ clean'}`);

        // Student scores should be best-5 integers (10-35 range), not JUPAS weighted scores
        const scoreTexts = await page.$$eval('td', tds =>
          tds.map(td => td.textContent?.trim()).filter(t => {
            const n = parseInt(t ?? '', 10);
            return n >= 10 && n <= 35;
          })
        );
        log(`Best-5 scores visible (10-35 range): ${scoreTexts.length > 0 ? '✓' : '⚠ none'} — ${scoreTexts.slice(0, 5).join(', ')}`);

        // Match percentages should reflect SF model (not JUPAS probabilities)
        const matchPcts = await page.$$eval('span', spans =>
          spans.filter(s => s.textContent?.match(/^\d+%$/)).map(s => parseInt(s.textContent ?? '0', 10))
        );
        log(`Match percentages: ${matchPcts.slice(0, 5).join('%, ')}%`);

        // Breadcrumb goes back to SF page, not JUPAS
        const breadcrumb = await page.$('a[href="/sf/HKCC"]');
        log(`Breadcrumb to /sf/HKCC: ${breadcrumb ? '✓' : '✗'}`);
      }
    }

    // 5. Verify JUPAS school pages still work and are uncontaminated
    log('\n=== JUPAS Isolation Check ===');
    await page.goto(`${BASE}/schools/20000000-0000-0000-0000-000000000005`);
    await page.waitForTimeout(3000);
    const jupasText = await page.textContent('body') ?? '';
    log(`JUPAS school loads: ${jupasText.includes('City University') ? '✓' : '✗'}`);
    log(`No "Sub-degree" on JUPAS: ${!jupasText.includes('Sub-degree') ? '✓' : '✗ CONTAMINATED'}`);
    log(`No "Best 5" on JUPAS: ${!jupasText.includes('Best 5') ? '✓' : '✗ CONTAMINATED'}`);
    log(`No "Articulation" on JUPAS: ${!jupasText.includes('Articulation') ? '✓' : '✗ CONTAMINATED'}`);

    // Click a JUPAS programme to verify it uses JUPAS scorer
    const jupasProgLinks = await page.$$('a[href*="/programmes/"]');
    if (jupasProgLinks.length > 0) {
      await jupasProgLinks[0].click();
      await page.waitForTimeout(3000);
      const jupasProgText = await page.textContent('body') ?? '';
      log(`JUPAS prog uses "Weighted Score": ${jupasProgText.includes('Weighted Score') || jupasProgText.includes('WEIGHTED') ? '✓' : '⚠ column name differs'}`);
      log(`JUPAS prog has no "Best 5": ${!jupasProgText.includes('Best 5') ? '✓' : '✗'}`);
    }

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
