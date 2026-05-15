/**
 * Verify student-side submission view with correct credentials from TEST_ACCOUNTS.md
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/student-submissions');

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  try {
    // Login as Chan Siu Ming (has pending submission)
    log('Step 1: Login as Chan Siu Ming');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });

    // Switch to student mode
    const studentBtn = await page.$('button:has-text("Student"), button:has-text("學生")');
    if (studentBtn) await studentBtn.click();
    await page.waitForTimeout(500);

    await page.fill('#input-candidateNumber', 'HKDSE-2026-A001');
    await page.fill('#input-password', 'HKDSE-2026-A001');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-student-dashboard.png'), fullPage: true });
    log('✓ Logged in as Chan Siu Ming');

    // Check dashboard shows submission status
    const dashText = await page.textContent('body');
    if (dashText?.includes('Pending') || dashText?.includes('Awaiting')) {
      log('✓ Dashboard shows pending submission status');
    }
    if (dashText?.includes('Submit to Teacher') || dashText?.includes('Awaiting Review')) {
      log('✓ Submit button shows correct state');
    }

    // Navigate to My Submissions
    log('\nStep 2: Navigate to My Submissions');
    await page.goto(`${BASE}/my-submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-my-submissions.png'), fullPage: true });

    const subText = await page.textContent('body');
    if (subText?.includes('My Submissions') || subText?.includes('Submission History')) {
      log('✓ My Submissions page loaded');
    }
    if (subText?.includes('Pending Review') || subText?.includes('Approved') || subText?.includes('Draft')) {
      log('✓ Submission statuses visible');
    }

    // Check table has rows
    const tableRows = await page.$$('table tbody tr');
    log(`  Found ${tableRows.length} submission(s) in history`);
    if (tableRows.length > 0) {
      log('✓ Submission history has entries');
    }

    // Now test the Send Back flow: login as teacher, flag + send back, then check student sees it
    log('\nStep 3: Teacher sends back with flags');
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(1000);
    // Switch to teacher mode
    const teacherBtn = await page.$('button:has-text("Teacher"), button:has-text("教師")');
    if (teacherBtn) await teacherBtn.click();
    await page.waitForTimeout(500);

    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Go to Chan Siu Ming's submission via alerts
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    const alertsRegion = await page.$('[role="region"][aria-label="Alerts"]');
    if (alertsRegion) {
      // Expand pending reviews
      const buttons = await alertsRegion.$$('button');
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text?.includes('Pending Reviews')) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
      // Find Chan Siu Ming's alert
      const alertItems = await alertsRegion.$$('[role="alert"]');
      for (const item of alertItems) {
        const text = await item.textContent();
        if (text?.includes('Chan Siu Ming')) {
          await item.click();
          await page.waitForTimeout(3000);
          log(`✓ Navigated to Chan Siu Ming's submission: ${page.url()}`);
          break;
        }
      }
    }

    if (page.url().includes('/submissions/')) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-chan-submission.png'), fullPage: true });

      // Flag choice #1 and send back
      const flagBtns = await page.$$('td button');
      if (flagBtns.length > 0) {
        await flagBtns[0].click();
        await page.waitForTimeout(300);

        const flagInput = await page.$('input[placeholder*="questionable"]');
        if (flagInput) {
          await flagInput.fill('Consider swapping with a stronger programme for Band A');
          log('✓ Flagged choice #1 with note');
        }

        // Click Send Back
        const sendBackBtn = await page.$('button:has-text("Send Back")');
        if (sendBackBtn) {
          await sendBackBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-send-back-modal.png'), fullPage: true });

          // Add global notes and confirm
          const textarea = await page.$('textarea');
          if (textarea) {
            await textarea.fill('Please review your Band A choices — choice #1 needs attention.');
          }

          const confirmBtn = await page.$('button:has-text("Send Revision")');
          if (confirmBtn) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            log('✓ Sent back for revision');
          }
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-after-send-back.png'), fullPage: true });
    }

    // Now check student sees the flagged items
    log('\nStep 4: Student sees flagged items');
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(1000);
    const studentBtn2 = await page.$('button:has-text("Student"), button:has-text("學生")');
    if (studentBtn2) await studentBtn2.click();
    await page.waitForTimeout(500);

    await page.fill('#input-candidateNumber', 'HKDSE-2026-A001');
    await page.fill('#input-password', 'HKDSE-2026-A001');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-student-after-revision.png'), fullPage: true });

    const dashText2 = await page.textContent('body');
    if (dashText2?.includes('Revision Requested') || dashText2?.includes('revision_requested')) {
      log('✓ Student dashboard shows Revision Requested status');
    }

    await page.goto(`${BASE}/my-submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-student-sees-flags.png'), fullPage: true });

    const mySubText = await page.textContent('body');
    if (mySubText?.includes('flagged') || mySubText?.includes('⚑')) {
      log('✓ Student sees flagged choices in submission history');
    }
    if (mySubText?.includes('Band A') || mySubText?.includes('志願')) {
      log('✓ Student sees flag details (志願 number)');
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
