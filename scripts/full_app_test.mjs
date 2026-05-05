/**
 * Full app E2E verification script.
 * Tests every page, key interactions, and plan generation with real LLM call.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
let page, browser;

function log(test, status, detail = '') {
  const line = `${status === 'OK' ? '✓' : '✗'} ${test}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
}

async function getText() {
  return page.textContent('body');
}

async function expectText(test, ...keywords) {
  const body = await getText();
  const missing = keywords.filter(k => !body.includes(k));
  if (missing.length === 0) {
    log(test, 'OK');
    return true;
  } else {
    log(test, 'FAIL', `Missing: ${missing.join(', ')}`);
    return false;
  }
}

async function navAndWait(url, waitMs = 2000) {
  await page.goto(BASE + url);
  await page.waitForTimeout(waitMs);
}

async function checkNoErrors() {
  // Check for page crash / blank screen
  const body = await getText();
  return body.trim().length > 20;
}

(async () => {
  browser = await chromium.launch();
  const context = await browser.newContext();
  page = await context.newPage();

  const pageErrors = [];
  const networkErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message.substring(0, 100)));
  page.on('requestfailed', req => {
    const url = req.url();
    // Ignore favicon
    if (url.includes('favicon')) return;
    networkErrors.push(url.substring(0, 80) + ' ' + (req.failure()?.errorText || ''));
  });

  // ═══════════════════════════════════════════════
  // 1. LOGIN
  // ═══════════════════════════════════════════════
  await navAndWait('/login');
  await expectText('Login page renders', 'Log In', 'Email', 'Password');

  await page.fill('input[name=email]', 'verify@test.com');
  await page.fill('input[name=password]', 'verify123');
  await page.click('button:has-text("Log In")');

  try {
    await page.waitForURL('**/dashboard', { timeout: 8000 });
    log('Login succeeds', 'OK', page.url());
  } catch {
    log('Login succeeds', 'FAIL', 'Did not redirect to dashboard');
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(3000);

  // ═══════════════════════════════════════════════
  // 2. DASHBOARD
  // ═══════════════════════════════════════════════
  await expectText('Dashboard loads', 'Students', 'Total Students');
  const studentCount = await page.locator('button:has-text("View Profile")').count();
  log('Dashboard shows students', studentCount > 0 ? 'OK' : 'FAIL', `${studentCount} students`);

  // ═══════════════════════════════════════════════
  // 3. STUDENT PROFILE (first student)
  // ═══════════════════════════════════════════════
  await page.locator('button:has-text("View Profile")').first().click();
  await page.waitForTimeout(2000);
  const profileUrl = page.url();
  log('Student profile URL', profileUrl.includes('/profile') ? 'OK' : 'FAIL', profileUrl);
  await expectText('Profile has tabs', 'Personal', 'Grades', 'Plans');
  const hasGenPlan = await page.locator('button:has-text("Generate Plan")').count();
  log('Profile has Generate Plan button', hasGenPlan > 0 ? 'OK' : 'FAIL');

  // Save student ID for later
  const studentId = profileUrl.match(/students\/([^/]+)\//)?.[1];

  // ═══════════════════════════════════════════════
  // 3a. STUDENT PROFILE — Each tab
  // ═══════════════════════════════════════════════
  const tabs = ['Personal', 'Grades', 'Language', 'Activities', 'Notes', 'Plans'];
  for (const tab of tabs) {
    const tabBtn = page.locator(`text="${tab}"`).first();
    if (await tabBtn.count() > 0) {
      await tabBtn.click();
      await page.waitForTimeout(500);
      log(`Profile tab: ${tab}`, await checkNoErrors() ? 'OK' : 'FAIL');
    }
  }

  // ═══════════════════════════════════════════════
  // 3b. PLANS TAB — check history and button
  // ═══════════════════════════════════════════════
  await page.click('text="Plans"');
  await page.waitForTimeout(1000);
  await expectText('Plans tab shows saved plans', 'Saved Plans');
  const genNewBtn = await page.locator('button:has-text("Generate New Plan")').count();
  log('Plans tab has Generate New Plan', genNewBtn > 0 ? 'OK' : 'FAIL');

  // Click Generate New Plan -> should go to /consultant
  if (genNewBtn > 0) {
    await page.click('button:has-text("Generate New Plan")');
    await page.waitForTimeout(2000);
    log('Generate New Plan routes to /consultant', page.url().includes('/consultant') ? 'OK' : 'FAIL', page.url());
    await page.goBack();
    await page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════════
  // 4. CONSULTANT PAGE — GENERATE PLAN WITH REAL LLM
  // ═══════════════════════════════════════════════
  await page.click('button:has-text("Generate Plan")');
  await page.waitForTimeout(2000);
  log('Navigate to consultant', page.url().includes('/consultant') ? 'OK' : 'FAIL');

  // Check the button has text (was a bug)
  const consultantGenBtn = page.locator('button:has-text("Generate Plan")');
  const btnVisible = await consultantGenBtn.count();
  log('Consultant Generate Plan button visible', btnVisible > 0 ? 'OK' : 'FAIL');

  if (btnVisible > 0) {
    // Record plan version before
    const bodyBefore = await getText();
    const vBefore = bodyBefore.match(/Plan v(\d+)/)?.[1] || '0';

    // Click Generate Plan
    await consultantGenBtn.first().click();

    // Wait for streaming to start
    let streamStarted = false;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const body = await getText();
      if (body.includes('Generating...') || body.includes('Stop Generation')) {
        streamStarted = true;
        log('SSE streaming starts', 'OK', `after ${i + 1}s`);
        break;
      }
    }
    if (!streamStarted) {
      log('SSE streaming starts', 'FAIL', 'No streaming indicator after 15s');
    }

    // Wait for plan to complete (up to 120s)
    if (streamStarted) {
      let planDone = false;
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(2000);
        const body = await getText();
        if (body.includes('Plan ready')) {
          planDone = true;
          const vAfter = body.match(/Plan v(\d+)/)?.[1] || '?';
          log('Plan generated (LLM call)', 'OK', `v${vBefore} -> v${vAfter}`);
          break;
        }
        if (body.includes('interrupted') || body.includes('Failed to save')) {
          log('Plan generated (LLM call)', 'FAIL', 'Stream interrupted or save failed');
          break;
        }
        if (i % 10 === 9) {
          console.log(`   ... still generating (${(i + 1) * 2}s)`);
        }
      }
      if (!planDone && streamStarted) {
        log('Plan generated (LLM call)', 'FAIL', 'Timed out after 120s');
      }
    }
  }

  // ═══════════════════════════════════════════════
  // 5. TARGET SCHOOLS
  // ═══════════════════════════════════════════════
  await navAndWait(`/students/${studentId}/targets`, 3000);
  log('Target Schools page loads', await checkNoErrors() ? 'OK' : 'FAIL');

  // ═══════════════════════════════════════════════
  // 6. SCHOOL DIRECTORY
  // ═══════════════════════════════════════════════
  await navAndWait('/schools', 3000);
  await expectText('School Directory loads', 'School');

  // Click into a school profile (cards use div[role=button], not <a>)
  const schoolCards = page.locator('div[role=button][aria-label*="View"]');
  const schoolCardCount = await schoolCards.count();
  log('School cards found', schoolCardCount > 0 ? 'OK' : 'FAIL', `${schoolCardCount} schools`);
  if (schoolCardCount > 0) {
    await schoolCards.first().click();
    await page.waitForTimeout(2000);
    log('School Profile page loads', page.url().includes('/schools/') ? 'OK' : 'FAIL', page.url());
    log('School Profile has content', await checkNoErrors() ? 'OK' : 'FAIL');
  }

  // ═══════════════════════════════════════════════
  // 7. COHORTS
  // ═══════════════════════════════════════════════
  await navAndWait('/cohorts', 3000);
  log('Cohorts page loads', await checkNoErrors() ? 'OK' : 'FAIL');

  // ═══════════════════════════════════════════════
  // 8. DATA ANALYSIS
  // ═══════════════════════════════════════════════
  await navAndWait('/data-analysis', 3000);
  log('Data Analysis page loads', await checkNoErrors() ? 'OK' : 'FAIL');

  // ═══════════════════════════════════════════════
  // 9. ACCOUNT SETTINGS
  // ═══════════════════════════════════════════════
  await navAndWait('/account/settings', 3000);
  log('Account Settings page loads', await checkNoErrors() ? 'OK' : 'FAIL');

  // ═══════════════════════════════════════════════
  // 10. ADMIN DATA REFRESH
  // ═══════════════════════════════════════════════
  await navAndWait('/admin/data-refresh', 3000);
  log('Admin Data Refresh page loads', await checkNoErrors() ? 'OK' : 'FAIL');

  // ═══════════════════════════════════════════════
  // 11. OLD URL REDIRECTS
  // ═══════════════════════════════════════════════
  if (studentId) {
    await navAndWait(`/students/${studentId}`, 2000);
    log('/students/:id redirects to /profile', page.url().includes('/profile') ? 'OK' : 'FAIL', page.url());
  }

  // ═══════════════════════════════════════════════
  // 12. SECOND STUDENT
  // ═══════════════════════════════════════════════
  await navAndWait('/dashboard', 3000);
  const viewBtns = page.locator('button:has-text("View Profile")');
  const viewCount = await viewBtns.count();
  if (viewCount >= 2) {
    await viewBtns.nth(1).click();
    await page.waitForTimeout(2000);
    log('Second student profile', page.url().includes('/profile') ? 'OK' : 'FAIL', page.url());
    const hasBtn = await page.locator('button:has-text("Generate Plan")').count();
    log('Second student has Generate Plan', hasBtn > 0 ? 'OK' : 'FAIL');
  }

  // ═══════════════════════════════════════════════
  // 13. REGISTER PAGE (fresh context, no login)
  // ═══════════════════════════════════════════════
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + '/register');
  await page2.waitForTimeout(2000);
  const regBody = await page2.textContent('body');
  log('Register page loads', (regBody.includes('Register') || regBody.includes('Create Account')) ? 'OK' : 'FAIL');
  await page2.close();
  await ctx2.close();

  // ═══════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('VERIFICATION SUMMARY');
  console.log('═'.repeat(50));
  const passed = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${results.length}`);

  if (failed > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗ ${r.test} — ${r.detail}`);
    });
  }

  if (pageErrors.length > 0) {
    console.log('\nPAGE ERRORS:');
    pageErrors.forEach(e => console.log(`  ${e}`));
  }

  if (networkErrors.length > 0) {
    console.log('\nNETWORK ERRORS:');
    networkErrors.forEach(e => console.log(`  ${e}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
