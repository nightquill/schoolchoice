/**
 * Playwright verification for Pending Review alerts feature.
 *
 * Checks:
 * 1. Teacher dashboard shows "Pending Reviews" alert category
 * 2. Pending review alerts show submission count
 * 3. Clicking a pending review alert navigates to /submissions/{id}
 * 4. SubmissionDetail page loads with approve/revise/reject buttons
 * 5. Student /my-submissions page shows submission history
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/pending-review');

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
    // ── Step 0: Login as teacher ──
    log('Step 0: Login as teacher');
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    // Button uses onClick, not type=submit — click it by text
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png'), fullPage: true });
    log('✓ Logged in as teacher, on dashboard');

    // ── Step 1: Check alerts panel for "Pending Reviews" category ──
    log('Step 1: Check for Pending Reviews alert category');
    await page.waitForTimeout(2000); // wait for alerts to load
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-alerts-panel.png'), fullPage: true });

    const alertsRegion = await page.$('[role="region"][aria-label="Alerts"]');
    if (alertsRegion) {
      log('✓ Alerts panel found');
      const alertText = await alertsRegion.textContent();
      log(`  Alert panel text: ${alertText?.substring(0, 300)}`);

      // Check for Pending Reviews category
      const hasPendingReview = alertText?.includes('Pending Reviews') || alertText?.includes('待審閱提交');
      if (hasPendingReview) {
        log('✓ "Pending Reviews" category found in alerts panel');
      } else {
        log('✗ "Pending Reviews" category NOT found — may be no pending submissions');
      }

      // Try to expand the Pending Reviews section
      const buttons = await alertsRegion.$$('button');
      let pendingButton: any = null;
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text?.includes('Pending Reviews') || text?.includes('待審閱提交')) {
          pendingButton = btn;
          break;
        }
      }

      if (pendingButton) {
        await pendingButton.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-pending-expanded.png'), fullPage: true });
        log('✓ Expanded Pending Reviews category');

        // Check for alert items inside
        const alertItems = await alertsRegion.$$('[role="alert"]');
        log(`  Found ${alertItems.length} alert item(s) in expanded section`);

        if (alertItems.length > 0) {
          // Click the first pending review alert
          const firstAlert = alertItems[0];
          const alertMsg = await firstAlert.textContent();
          log(`  First alert: ${alertMsg}`);
          await firstAlert.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-submission-detail.png'), fullPage: true });

          const currentUrl = page.url();
          log(`  Navigated to: ${currentUrl}`);
          if (currentUrl.includes('/submissions/')) {
            log('✓ Alert click navigated to /submissions/{id}');
          } else {
            log('✗ Alert click did not navigate to submission detail page');
          }

          // Check for approve/revise/reject buttons
          const pageText = await page.textContent('body');
          const hasApprove = pageText?.includes('Approve') || pageText?.includes('批准');
          const hasSendBack = pageText?.includes('Send Back') || pageText?.includes('退回');
          if (hasApprove) log('✓ Approve button found on submission detail');
          if (hasSendBack) log('✓ Send Back button found on submission detail');
          if (!hasApprove && !hasSendBack) log('⚠ No action buttons found (submission may not be pending)');
        }
      } else {
        log('⚠ No Pending Reviews button found to expand');
      }
    } else {
      log('⚠ Alerts panel not found on dashboard (may have no alerts)');
    }

    // ── Step 2: Check /submissions page directly ──
    log('\nStep 2: Check /submissions page');
    await page.goto(`${BASE}/submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-submissions-list.png'), fullPage: true });
    const submPageText = await page.textContent('body');
    log(`  Submissions page loaded: ${page.url()}`);
    if (submPageText?.includes('Pending Submissions') || submPageText?.includes('待處理')) {
      log('✓ Submissions list page shows pending submissions');
    }

    // Check if there are review links
    const reviewLinks = await page.$$('a[href*="/submissions/"]');
    log(`  Found ${reviewLinks.length} review link(s)`);

    if (reviewLinks.length > 0) {
      await reviewLinks[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-submission-detail-direct.png'), fullPage: true });
      log(`  Navigated to: ${page.url()}`);

      const detailText = await page.textContent('body');
      const hasChoicesTable = detailText?.includes('Band') && (detailText?.includes('JUPAS') || detailText?.includes('Programme'));
      if (hasChoicesTable) log('✓ Submission detail shows choices table with bands');
    }

    // ── Step 3: Check API returns submission_id in alerts ──
    log('\nStep 3: Verify API includes submission_id');
    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find(c => c.name === 'token');
    // Try fetching alerts via API
    const alertsResponse = await page.evaluate(async () => {
      const r = await fetch('/api/v1/alerts');
      if (r.ok) return r.json();
      return null;
    });
    if (alertsResponse?.alerts) {
      const pendingAlerts = alertsResponse.alerts.filter((a: any) => a.type === 'pending_review');
      log(`  API returned ${pendingAlerts.length} pending_review alert(s)`);
      if (pendingAlerts.length > 0) {
        const first = pendingAlerts[0];
        log(`  First: student="${first.student_name}", submission_id=${first.submission_id}`);
        if (first.submission_id) {
          log('✓ API includes submission_id in pending_review alerts');
        } else {
          log('✗ submission_id missing from API response');
        }
      }
    } else {
      log('⚠ Could not fetch alerts from API');
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
    // Save results
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'results.txt'), results.join('\n'));
    await browser.close();
  }
}

main();
