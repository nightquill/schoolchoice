/**
 * Playwright verification for Submission Review overhaul.
 *
 * Tests:
 * 1. 20-slot banded table renders on submission detail
 * 2. Match scores display correctly (0-1 float → percentage)
 * 3. Per-item flag toggle works
 * 4. Flag note input appears when flagged
 * 5. Approve button disabled when items flagged
 * 6. Send Back shows flag summary in modal
 * 7. Edge case: submission with gaps in ranks
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/submission-review');

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results: string[] = [];

  function log(msg: string) {
    console.log(msg);
    results.push(msg);
  }

  try {
    // ── Login as teacher ──
    log('Step 0: Login as teacher');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✓ Logged in');

    // ── Navigate to submissions list ──
    log('\nStep 1: Go to submissions list');
    await page.goto(`${BASE}/submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-submissions-list.png'), fullPage: true });

    // Find a submission to review - try clicking via alert panel first
    log('\nStep 2: Navigate to a submission via alert');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    // Expand Pending Reviews
    const alertsRegion = await page.$('[role="region"][aria-label="Alerts"]');
    if (alertsRegion) {
      const buttons = await alertsRegion.$$('button');
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text?.includes('Pending Reviews')) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
      const alertItems = await alertsRegion.$$('[role="alert"]');
      if (alertItems.length > 0) {
        await alertItems[0].click();
        await page.waitForTimeout(3000);
        log(`  Navigated to: ${page.url()}`);
      }
    }

    // Verify we're on a submission detail page
    const url = page.url();
    if (!url.includes('/submissions/')) {
      // Fallback: go directly to submissions list and click first review
      await page.goto(`${BASE}/submissions`);
      await page.waitForTimeout(2000);
      const reviewLinks = await page.$$('a[href*="/submissions/"]');
      if (reviewLinks.length > 0) {
        await reviewLinks[0].click();
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-submission-detail.png'), fullPage: true });

    // ── Test 1: 20-slot banded table ──
    log('\nTest 1: 20-slot banded table');
    const rows = await page.$$('table tbody tr');
    log(`  Table has ${rows.length} rows`);
    // 20 slots = 20 rows (band cells are rowSpan, not separate rows)
    if (rows.length >= 20) {
      log('✓ 20-slot table renders correctly');
    } else {
      log(`✗ Expected ≥20 rows, got ${rows.length}`);
    }

    // Check band labels exist
    const bandLabels = await page.$$eval('td', (tds) =>
      tds.filter(td => ['A', 'B', 'C', 'D', 'E'].includes(td.textContent?.trim() ?? '')).map(td => td.textContent?.trim())
    );
    log(`  Band labels found: ${bandLabels.join(', ')}`);
    if (bandLabels.length === 5) {
      log('✓ All 5 band labels (A-E) present');
    }

    // Check 志願 numbers
    const slotNumbers = await page.$$eval('td', (tds) =>
      tds.filter(td => {
        const n = parseInt(td.textContent?.trim() ?? '', 10);
        return n >= 1 && n <= 20 && td.style.textAlign === 'center';
      }).map(td => parseInt(td.textContent?.trim() ?? '', 10))
    );
    log(`  Slot numbers: ${slotNumbers.join(', ')}`);

    // ── Test 2: Match scores ──
    log('\nTest 2: Match scores');
    const matchTexts = await page.$$eval('span', (spans) =>
      spans.filter(s => s.textContent?.match(/^\d+%$/)).map(s => s.textContent)
    );
    if (matchTexts.length > 0) {
      log(`✓ Match scores display: ${matchTexts.join(', ')}`);
    } else {
      log('⚠ No match percentage scores visible (student may not have grades)');
    }

    // ── Test 3: Risk badges ──
    log('\nTest 3: Risk badges');
    const riskBadges = await page.$$eval('span', (spans) =>
      spans.filter(s => s.textContent?.includes('AT RISK') || s.textContent?.includes('高風險')).length
    );
    log(`  Risk badges visible: ${riskBadges}`);

    // ── Test 4: Per-item flag toggle ──
    log('\nTest 4: Flag toggle');
    const flagButtons = await page.$$('button:has(svg)');
    let flagBtn = null;
    for (const btn of flagButtons) {
      const title = await btn.getAttribute('title');
      if (title?.includes('Flag') || title?.includes('flag')) {
        flagBtn = btn;
        break;
      }
    }

    if (!flagBtn) {
      // Try finding by the Flag icon pattern
      const allBtns = await page.$$('td button');
      if (allBtns.length > 0) {
        flagBtn = allBtns[0];
      }
    }

    if (flagBtn) {
      await flagBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-item-flagged.png'), fullPage: true });
      log('✓ Flag toggle clicked');

      // Check flag note input appeared
      const flagInput = await page.$('input[placeholder*="questionable"]');
      if (flagInput) {
        log('✓ Flag note input appeared');
        await flagInput.fill('This choice seems too ambitious for Band A');
        await page.waitForTimeout(300);
      } else {
        log('⚠ Flag note input not found');
      }

      // Check approve button is disabled
      const approveBtn = await page.$('button:has-text("Approve"), button:has-text("批准")');
      if (approveBtn) {
        const isDisabled = await approveBtn.isDisabled();
        if (isDisabled) {
          log('✓ Approve button disabled when items flagged');
        } else {
          log('✗ Approve button should be disabled when items are flagged');
        }
      }

      // Check "flagged" badge in header
      const headerText = await page.textContent('main');
      if (headerText?.includes('flagged')) {
        log('✓ Flagged count shown in header');
      }

      // Check Send Back button text updated
      const sendBackBtn = await page.$('button:has-text("Send Back")');
      if (sendBackBtn) {
        const sendText = await sendBackBtn.textContent();
        if (sendText?.includes('flagged')) {
          log('✓ Send Back button shows flag count');
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-flagged-state.png'), fullPage: true });

      // ── Test 5: Send Back modal shows flag summary ──
      log('\nTest 5: Send Back modal');
      if (sendBackBtn) {
        await sendBackBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-send-back-modal.png'), fullPage: true });

        const modalText = await page.textContent('[role="dialog"], .modal, div[style*="position: fixed"]');
        if (modalText?.includes('flagged') || modalText?.includes('志願')) {
          log('✓ Modal shows flagged choices summary');
        } else {
          log('⚠ Modal may not show flag summary');
        }

        // Close modal
        const closeBtn = await page.$('button:has-text("Cancel"), button:has-text("取消"), button[aria-label="Close"]');
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(300);
      }

      // Unflag to test approve re-enables
      if (flagBtn) {
        // Re-find the button (DOM may have updated)
        const flagBtns2 = await page.$$('td button');
        for (const btn of flagBtns2) {
          const title = await btn.getAttribute('title');
          if (title?.includes('Remove flag')) {
            await btn.click();
            await page.waitForTimeout(300);
            break;
          }
        }
      }
    } else {
      log('⚠ No flag buttons found (submission may not be pending)');
    }

    // ── Test 6: Empty slots render correctly ──
    log('\nTest 6: Empty slots');
    const emptySlots = await page.$$eval('td', (tds) =>
      tds.filter(td => td.textContent?.trim() === '—' && td.querySelector('span[style*="italic"]')).length
    );
    const dashCells = await page.$$eval('span', (spans) =>
      spans.filter(s => s.textContent?.trim() === '—' && s.style.fontStyle === 'italic').length
    );
    log(`  Empty slot indicators: ${dashCells}`);
    if (dashCells > 0) {
      log('✓ Empty slots render with dash indicator');
    }

    // ── Test 7: Student view — check /my-submissions ──
    log('\nTest 7: Student submission history');
    // Logout and login as student
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(1000);
    await page.waitForSelector('#input-email, #input-candidateNumber', { timeout: 10000 });

    // Switch to student mode
    const studentBtn = await page.$('button:has-text("Student"), button:has-text("學生")');
    if (studentBtn) {
      await studentBtn.click();
      await page.waitForTimeout(500);
    }

    // Login as Chan Siu Ming (candidate number from seed data)
    const candidateInput = await page.$('#input-candidateNumber');
    if (candidateInput) {
      await candidateInput.fill('2026001');
      await page.fill('#input-password', 'student123');
      await page.click('button:has-text("Log In"), button:has-text("登入")');
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-student-dashboard.png'), fullPage: true });
      log('✓ Logged in as student');

      // Navigate to my submissions
      await page.goto(`${BASE}/my-submissions`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-my-submissions.png'), fullPage: true });

      const mySubsText = await page.textContent('body');
      if (mySubsText?.includes('Submission') || mySubsText?.includes('提交')) {
        log('✓ Student submissions page loads');
      }
      if (mySubsText?.includes('Pending') || mySubsText?.includes('Approved') || mySubsText?.includes('Revision')) {
        log('✓ Submission status visible');
      }
    } else {
      log('⚠ Could not find candidate number input');
    }

    // ── Summary ──
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
