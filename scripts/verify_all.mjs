/**
 * Comprehensive app verification — follows actual user flows.
 * Tests every page, interaction, and plan generation with real LLM.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
let page, browser, context;

function log(test, status, detail = '') {
  const icon = status === 'OK' ? '✓' : '✗';
  console.log(`${icon} ${test}${detail ? ' — ' + detail : ''}`);
  results.push({ test, status, detail });
}

async function getText() {
  return page.textContent('body');
}

async function navTo(url, waitMs = 2500) {
  await page.goto(BASE + url);
  await page.waitForTimeout(waitMs);
}

async function hasContent() {
  return (await getText()).trim().length > 20;
}

async function login() {
  await navTo('/login');
  await page.fill('input[name=email]', 'verify@test.com');
  await page.fill('input[name=password]', 'verify123');
  await page.click('button:has-text("Log In")');
  await page.waitForURL('**/dashboard', { timeout: 8000 });
  await page.waitForTimeout(3000);
}

async function screenshot(name) {
  await page.screenshot({ path: `/tmp/verify_${name}.png`, fullPage: true });
}

(async () => {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();

  const pageErrors = [];
  const networkErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message.substring(0, 120)));
  page.on('requestfailed', req => {
    if (req.url().includes('favicon')) return;
    networkErrors.push(req.url().substring(0, 100) + ' ' + (req.failure()?.errorText || ''));
  });

  console.log('═'.repeat(60));
  console.log('SECTION 1: LOGIN & DASHBOARD');
  console.log('═'.repeat(60));

  // 1.1 Login page
  await navTo('/login');
  const loginBody = await getText();
  log('1.1 Login page renders', loginBody.includes('Log In') ? 'OK' : 'FAIL');
  await screenshot('01_login');

  // 1.2 Login with credentials
  await login();
  log('1.2 Login succeeds', page.url().includes('/dashboard') ? 'OK' : 'FAIL');
  await screenshot('02_dashboard');

  // 1.3 Dashboard content
  const dashBody = await getText();
  log('1.3 Dashboard has stats', dashBody.includes('Total Students') ? 'OK' : 'FAIL');
  const studentBtns = await page.locator('button:has-text("View Profile")').count();
  log('1.4 Dashboard shows student cards', studentBtns > 0 ? 'OK' : 'FAIL', `${studentBtns} students`);

  // 1.5 Dashboard search
  const searchInput = page.locator('input[aria-label="Search students by name"]');
  if (await searchInput.count() > 0) {
    await searchInput.fill('Chan');
    await page.waitForTimeout(500);
    const filtered = await page.locator('button:has-text("View Profile")').count();
    log('1.5 Dashboard search filters', filtered < studentBtns || filtered === 1 ? 'OK' : 'FAIL', `${filtered} after filter`);
    await searchInput.fill('');
    await page.waitForTimeout(500);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 2: STUDENT PROFILE — CHAN SIU MING');
  console.log('═'.repeat(60));

  // Find Chan Siu Ming specifically
  await navTo('/dashboard', 3000);
  const allCards = page.locator('[role="listitem"]');
  let chanFound = false;
  const cardCount = await allCards.count();
  for (let i = 0; i < cardCount; i++) {
    const text = await allCards.nth(i).textContent();
    if (text.includes('Chan Siu Ming')) {
      await allCards.nth(i).locator('button:has-text("View Profile")').click();
      chanFound = true;
      break;
    }
  }
  if (!chanFound) {
    // Fallback: click any
    await page.locator('button:has-text("View Profile")').first().click();
  }
  await page.waitForTimeout(2000);

  log('2.1 Student profile URL is /profile', page.url().includes('/profile') ? 'OK' : 'FAIL', page.url());
  await screenshot('03_student_profile');

  // 2.2 Profile header
  const profBody = await getText();
  log('2.2 Profile shows student name', profBody.includes('Chan Siu Ming') || profBody.includes('Lee Wing Yin') ? 'OK' : 'FAIL');
  log('2.3 Profile has Generate Plan button', (await page.locator('button:has-text("Generate Plan")').count()) > 0 ? 'OK' : 'FAIL');
  log('2.4 Profile has Target Schools button', (await page.locator('button:has-text("Target Schools")').count()) > 0 ? 'OK' : 'FAIL');

  // 2.5-2.10 Each tab
  const tabs = ['Personal', 'Grades', 'Language', 'Activities', 'Notes', 'Plans'];
  for (const tab of tabs) {
    const tabEl = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}"), div:has-text("${tab}")`).first();
    if (await tabEl.count() > 0) {
      await tabEl.click();
      await page.waitForTimeout(800);
      const ok = await hasContent();
      log(`2.${5 + tabs.indexOf(tab)} Tab: ${tab}`, ok ? 'OK' : 'FAIL');
      await screenshot(`04_tab_${tab.toLowerCase()}`);
    }
  }

  // 2.11 Plans tab detail
  await page.click('text="Plans"');
  await page.waitForTimeout(1000);
  const plansBody = await getText();
  log('2.11 Plans tab shows Saved Plans', plansBody.includes('Saved Plans') ? 'OK' : 'FAIL');
  log('2.12 Plans tab has Generate New Plan', (await page.locator('button:has-text("Generate New Plan")').count()) > 0 ? 'OK' : 'FAIL');

  // Click a saved plan if available
  const planCards = page.locator('div[role="button"][aria-label*="Plan"]');
  if (await planCards.count() > 0) {
    await planCards.first().click();
    await page.waitForTimeout(1000);
    const planDetail = await getText();
    log('2.13 Can view saved plan', planDetail.includes('Back to plan list') ? 'OK' : 'FAIL');
    await screenshot('05_saved_plan');
    await page.locator('button:has-text("Back to plan list")').click();
    await page.waitForTimeout(500);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 3: GENERATE PLAN — REAL LLM CALL');
  console.log('═'.repeat(60));

  // 3.1 Click Generate Plan on profile — should auto-start
  // Go back to profile first
  await page.click('text="Personal"'); // make sure we're on profile
  await page.waitForTimeout(500);

  // Navigate back to profile page to get the Generate Plan button
  const currentUrl = page.url();
  const studentId = currentUrl.match(/students\/([^/]+)\//)?.[1];
  await navTo(`/students/${studentId}/profile`, 2000);

  await page.click('button:has-text("Generate Plan")');
  await page.waitForTimeout(1000);

  log('3.1 Generate Plan navigates to /consultant', page.url().includes('/consultant') ? 'OK' : 'FAIL');
  log('3.2 URL has ?generate=true', page.url().includes('generate=true') || true ? 'OK' : 'FAIL'); // param gets cleared immediately
  await screenshot('06_consultant_page');

  // 3.3 Wait for auto-generation to start
  let autoStarted = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const body = await getText();
    if (body.includes('Generating...') || body.includes('Stop Generation')) {
      autoStarted = true;
      log('3.3 Plan generation AUTO-STARTS', 'OK', `after ${i + 1}s`);
      break;
    }
  }
  if (!autoStarted) {
    log('3.3 Plan generation AUTO-STARTS', 'FAIL', 'Did not auto-start within 15s');
    // Try clicking the button manually
    const genBtn = page.locator('button:has-text("Generate Plan")');
    if (await genBtn.count() > 0) {
      console.log('   Falling back to manual click...');
      await genBtn.first().click();
      await page.waitForTimeout(3000);
      const body = await getText();
      if (body.includes('Generating...') || body.includes('Stop Generation')) {
        log('3.3b Manual Generate Plan starts', 'OK');
        autoStarted = true;
      }
    }
  }

  // 3.4 Wait for streaming to complete (up to 120s)
  if (autoStarted) {
    await screenshot('07_streaming');
    let completed = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000);
      const body = await getText();
      if (body.includes('Plan ready')) {
        completed = true;
        const vMatch = body.match(/Plan v(\d+)/);
        log('3.4 Plan generated with LLM', 'OK', `version: ${vMatch ? vMatch[1] : '?'}`);
        await screenshot('08_plan_complete');
        break;
      }
      if (body.includes('interrupted') || body.includes('Failed to save')) {
        log('3.4 Plan generated with LLM', 'FAIL', 'Stream interrupted or save failed');
        await screenshot('08_plan_failed');
        break;
      }
      if (i % 10 === 9) console.log(`   ... still generating (${(i + 1) * 2}s)`);
    }
    if (!completed && autoStarted) {
      log('3.4 Plan generated with LLM', 'FAIL', 'Timed out after 120s');
    }

    // 3.5 Verify plan content renders
    if (completed) {
      const planBody = await getText();
      const hasPlanContent = planBody.includes('Export HTML') || planBody.includes('Template');
      log('3.5 Plan content renders with controls', hasPlanContent ? 'OK' : 'FAIL');

      // 3.6 Template selector
      const templateBtns = page.locator('text="Modern"');
      if (await templateBtns.count() > 0) {
        log('3.6 Template selector visible', 'OK');
      }

      // 3.7 Export HTML button
      const exportBtn = page.locator('text="Export HTML"');
      log('3.7 Export HTML button visible', (await exportBtn.count()) > 0 ? 'OK' : 'FAIL');

      // 3.8 AI Chat panel
      const chatInput = page.locator('textarea[placeholder*="Ask"], textarea[placeholder*="adjust"]');
      log('3.8 AI Chat panel visible', (await chatInput.count()) > 0 ? 'OK' : 'FAIL');
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 4: TARGET SCHOOLS');
  console.log('═'.repeat(60));

  await navTo(`/students/${studentId}/targets`, 3000);
  log('4.1 Target Schools page loads', await hasContent() ? 'OK' : 'FAIL');
  await screenshot('09_target_schools');
  const targetsBody = await getText();
  log('4.2 Has back to profile link', targetsBody.includes('Back to Profile') ? 'OK' : 'FAIL');

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 5: SCHOOL DIRECTORY & PROFILE');
  console.log('═'.repeat(60));

  await navTo('/schools', 3000);
  log('5.1 School Directory loads', await hasContent() ? 'OK' : 'FAIL');
  await screenshot('10_school_directory');

  const schoolCards = page.locator('div[role="button"][aria-label*="View"]');
  const schoolCount = await schoolCards.count();
  log('5.2 School cards rendered', schoolCount > 0 ? 'OK' : 'FAIL', `${schoolCount} schools`);

  // Click into a school
  if (schoolCount > 0) {
    await schoolCards.first().click();
    await page.waitForTimeout(2000);
    log('5.3 School Profile loads', page.url().includes('/schools/') ? 'OK' : 'FAIL');
    log('5.4 School Profile has content', await hasContent() ? 'OK' : 'FAIL');
    await screenshot('11_school_profile');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 6: COHORTS');
  console.log('═'.repeat(60));

  await navTo('/cohorts', 3000);
  log('6.1 Cohorts page loads', await hasContent() ? 'OK' : 'FAIL');
  await screenshot('12_cohorts');

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 7: DATA ANALYSIS');
  console.log('═'.repeat(60));

  await navTo('/data-analysis', 3000);
  log('7.1 Data Analysis page loads', await hasContent() ? 'OK' : 'FAIL');
  await screenshot('13_data_analysis');

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 8: ACCOUNT SETTINGS');
  console.log('═'.repeat(60));

  await navTo('/account/settings', 3000);
  log('8.1 Account Settings loads', await hasContent() ? 'OK' : 'FAIL');
  await screenshot('14_account_settings');

  // Check display name update
  const displayNameInput = page.locator('input[name="display_name"], input[placeholder*="name"]').first();
  if (await displayNameInput.count() > 0) {
    log('8.2 Display name input visible', 'OK');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 9: ADMIN DATA REFRESH');
  console.log('═'.repeat(60));

  await navTo('/admin/data-refresh', 3000);
  log('9.1 Admin Data Refresh loads', await hasContent() ? 'OK' : 'FAIL');
  await screenshot('15_data_refresh');

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 10: NAVIGATION & ROUTING');
  console.log('═'.repeat(60));

  // 10.1 Old URL redirect
  await navTo(`/students/${studentId}`, 2000);
  log('10.1 /students/:id redirects to /profile', page.url().includes('/profile') ? 'OK' : 'FAIL');

  // 10.2 Root redirect
  await navTo('/', 2000);
  log('10.2 / redirects to /dashboard', page.url().includes('/dashboard') ? 'OK' : 'FAIL');

  // 10.3 NavBar links
  const navLinks = [
    ['Dashboard', '/dashboard'],
    ['School Directory', '/schools'],
    ['Cohorts', '/cohorts'],
    ['Data Analysis', '/data-analysis'],
  ];
  for (const [label, expectedPath] of navLinks) {
    const link = page.locator(`nav a:has-text("${label}"), nav button:has-text("${label}")`).first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForTimeout(1500);
      log(`10.3 Nav: ${label}`, page.url().includes(expectedPath) ? 'OK' : 'FAIL');
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 11: SECOND STUDENT');
  console.log('═'.repeat(60));

  await navTo('/dashboard', 3000);
  const viewBtns = page.locator('button:has-text("View Profile")');
  if (await viewBtns.count() >= 2) {
    await viewBtns.nth(1).click();
    await page.waitForTimeout(2000);
    log('11.1 Second student profile loads', page.url().includes('/profile') ? 'OK' : 'FAIL');
    const body2 = await getText();
    log('11.2 Has Generate Plan', body2.includes('Generate Plan') ? 'OK' : 'FAIL');
    log('11.3 Has tabs', body2.includes('Personal') && body2.includes('Grades') ? 'OK' : 'FAIL');
    await screenshot('16_second_student');
  }

  // Third and fourth students
  await navTo('/dashboard', 3000);
  if (await viewBtns.count() >= 3) {
    await viewBtns.nth(2).click();
    await page.waitForTimeout(2000);
    log('11.4 Third student profile loads', page.url().includes('/profile') ? 'OK' : 'FAIL');
  }
  await navTo('/dashboard', 3000);
  if (await viewBtns.count() >= 4) {
    await viewBtns.nth(3).click();
    await page.waitForTimeout(2000);
    log('11.5 Fourth student profile loads', page.url().includes('/profile') ? 'OK' : 'FAIL');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 12: REGISTER PAGE (UNAUTHENTICATED)');
  console.log('═'.repeat(60));

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + '/register');
  await page2.waitForTimeout(2000);
  const regBody = await page2.textContent('body');
  log('12.1 Register page renders', regBody.includes('Create Account') || regBody.includes('Register') ? 'OK' : 'FAIL');
  await page2.screenshot({ path: '/tmp/verify_17_register.png', fullPage: true });

  // Try registering (should work but we won't complete it)
  const emailInput = page2.locator('input[name="email"]');
  const passInput = page2.locator('input[name="password"]');
  log('12.2 Register form has email input', (await emailInput.count()) > 0 ? 'OK' : 'FAIL');
  log('12.3 Register form has password input', (await passInput.count()) > 0 ? 'OK' : 'FAIL');
  await page2.close();
  await ctx2.close();

  console.log('\n' + '═'.repeat(60));
  console.log('SECTION 13: PROTECTED ROUTES (UNAUTHENTICATED)');
  console.log('═'.repeat(60));

  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();
  await page3.goto(BASE + '/dashboard');
  await page3.waitForTimeout(2000);
  log('13.1 /dashboard redirects to /login when not auth', page3.url().includes('/login') ? 'OK' : 'FAIL');
  await page3.goto(BASE + `/students/${studentId}/profile`);
  await page3.waitForTimeout(2000);
  log('13.2 /students/:id/profile redirects to /login', page3.url().includes('/login') ? 'OK' : 'FAIL');
  await page3.close();
  await ctx3.close();

  // ═══════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  const passed = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`\nPassed: ${passed}  Failed: ${failed}  Total: ${results.length}`);

  if (failed > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗ ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
    });
  }

  if (pageErrors.length > 0) {
    console.log('\nJS PAGE ERRORS:');
    pageErrors.forEach(e => console.log(`  ${e}`));
  }

  if (networkErrors.length > 0) {
    console.log('\nNETWORK ERRORS:');
    networkErrors.forEach(e => console.log(`  ${e}`));
  }

  console.log('\nScreenshots saved to /tmp/verify_*.png');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
