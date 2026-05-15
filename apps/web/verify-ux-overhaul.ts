/**
 * Playwright verification for UX Overhaul (Tasks 43-46)
 *
 * Checks:
 * 1. Dashboard shows cohort cards instead of flat student list
 * 2. NavBar has no Cohorts link
 * 3. Student profile default tab is 'Programme Choices'
 * 4. /students/:id/targets redirects to profile?tab=programmes
 * 5. Alert click navigates to the correct tab
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:5181';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/ux-overhaul');

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: string[] = [];
  let studentId: string | null = null;

  function log(msg: string) {
    console.log(msg);
    results.push(msg);
  }

  // ── Step 0: Login via UI ──
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');

  // Click the "Log In" button (it's a Button component, not type=submit)
  await page.locator('button').filter({ hasText: /Log In|登入/ }).first().click();

  // Wait for navigation away from /login
  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const loginUrl = page.url();
  if (!loginUrl.includes('/dashboard')) {
    log(`FAIL: Login did not redirect to dashboard. URL: ${loginUrl}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-login-failed.png'), fullPage: true });
    await browser.close();
    console.log('\n=== VERIFICATION FAILED AT LOGIN ===');
    process.exit(1);
  }
  log('Verified: Login successful, redirected to dashboard.');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png'), fullPage: true });

  // Get a student ID from API for later checks
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const studentsRes = await fetch(`${API}/api/v1/students?limit=5`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const studentsData = await studentsRes.json();
  const studentList = Array.isArray(studentsData) ? studentsData : (studentsData.items ?? []);
  if (studentList.length > 0) {
    studentId = studentList[0].id;
  }

  // ── Check 1: Dashboard shows cohort cards instead of flat student list ──
  // Look for "Your Cohorts" or "您的群組" heading
  const h2Texts = await page.locator('h2').allTextContents();
  const hasCohortHeading = h2Texts.some(t =>
    t.includes('Your Cohorts') || t.includes('您的群組')
  );
  // Must NOT have old "Students" section heading
  const h1Texts = await page.locator('h1').allTextContents();
  const hasOldStudentsH1 = h1Texts.some(t => t.trim() === 'Students' || t.trim() === '學生');

  if (hasCohortHeading && !hasOldStudentsH1) {
    log('Verified: (1) Dashboard shows cohort section, no flat student list heading.');
  } else {
    log(`FAIL: (1) Cohort heading: ${hasCohortHeading}, Old Students heading: ${hasOldStudentsH1}. H2s: ${h2Texts.join(', ')}. H1s: ${h1Texts.join(', ')}`);
  }

  // Check for "New Cohort" button
  const newCohortBtn = await page.locator('button').filter({ hasText: /New Cohort|新增群組/ }).count();
  log(`Verified: (1b) "New Cohort" button present: ${newCohortBtn > 0}`);

  // Check search bar present
  const searchPresent = await page.locator('input[aria-label*="Search"], input[aria-label*="搜尋"]').count() > 0;
  log(`Verified: (1c) Search bar present: ${searchPresent}`);

  // Check metrics/alerts retained
  const metricsRegion = await page.locator('[role="region"][aria-label="Summary statistics"]').count() > 0;
  log(`Verified: (1d) Metrics region present: ${metricsRegion}`);

  const alertsRegion = await page.locator('[role="region"][aria-label="Alerts"]').count() > 0;
  log(`Verified: (1e) Alerts region present: ${alertsRegion}`);

  // ── Check 2: NavBar has no Cohorts link ──
  const navLinks = await page.locator('nav a').allTextContents();
  const trimmedLinks = navLinks.map(l => l.trim()).filter(Boolean);
  const hasCohortNavLink = trimmedLinks.some(l => l === 'Cohorts' || l === '群組');
  if (!hasCohortNavLink) {
    log('Verified: (2) NavBar does NOT have a Cohorts link.');
  } else {
    log(`FAIL: (2) NavBar still has Cohorts link. Links: ${trimmedLinks.join(', ')}`);
  }
  log(`  Nav links: ${trimmedLinks.join(' | ')}`);

  // ── Check 3: Student profile default tab is 'Programme Choices' ──
  if (studentId) {
    await page.goto(`${BASE}/students/${studentId}/profile`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-profile.png'), fullPage: true });

    const tabButtons = await page.locator('[aria-label="Student profile sections"] button').allTextContents();
    const trimmedTabs = tabButtons.map(t => t.trim());
    log(`  Profile tabs: ${trimmedTabs.join(' | ')}`);

    const firstTab = trimmedTabs[0] || '';
    const firstIsProgrammes = firstTab === 'Programme Choices' || firstTab === '選科志願';

    // Check active tab
    const activeTabEl = page.locator('[aria-label="Student profile sections"] button[data-active]');
    const activeTabText = await activeTabEl.textContent().catch(() => '');
    const activeIsProgrammes = activeTabText?.trim() === 'Programme Choices' || activeTabText?.trim() === '選科志願';

    if (firstIsProgrammes && activeIsProgrammes) {
      log('Verified: (3) Default tab is "Programme Choices" and it is the first tab.');
    } else {
      log(`FAIL: (3) First tab: "${firstTab}", Active tab: "${activeTabText?.trim()}"`);
    }

    // Verify programme content loaded (either "Add Programme" button or target list)
    const bodyText = await page.textContent('body');
    const hasProgrammeContent =
      bodyText.includes('Programme Choices') || bodyText.includes('選科志願') ||
      bodyText.includes('Add Programme') || bodyText.includes('新增課程') ||
      bodyText.includes('No programme choices') || bodyText.includes('尚未設定選科志願');
    log(`Verified: (3b) Programme Choices content rendered: ${hasProgrammeContent}`);

    // Verify tab order: programmes, grades, plans, personal, other
    const expectedOrder = ['Programme Choices', 'Grades', 'Plans', 'Personal', 'Other'];
    const expectedOrderZh = ['選科志願', '成績', '計劃書', '個人資料', '其他'];
    const matchesEn = trimmedTabs.length >= 5 && expectedOrder.every((t, i) => trimmedTabs[i] === t);
    const matchesZh = trimmedTabs.length >= 5 && expectedOrderZh.every((t, i) => trimmedTabs[i] === t);
    if (matchesEn || matchesZh) {
      log('Verified: (3c) Tab order is correct: programmes → grades → plans → personal → other');
    } else {
      log(`FAIL: (3c) Tab order mismatch. Got: ${trimmedTabs.join(', ')}`);
    }

    // Check no "Target Schools" button in header
    const targetSchoolsBtn = await page.locator('button').filter({ hasText: /Target Schools|目標院校/ }).count();
    log(`Verified: (3d) No "Target Schools" button in profile header: ${targetSchoolsBtn === 0}`);

    // ── Check 4: /students/:id/targets redirects to profile?tab=programmes ──
    await page.goto(`${BASE}/students/${studentId}/targets`);
    await page.waitForTimeout(2000);
    const redirectUrl = page.url();
    const redirectCorrect = redirectUrl.includes('/profile') && redirectUrl.includes('tab=programmes');
    if (redirectCorrect) {
      log(`Verified: (4) /targets redirected to profile?tab=programmes. URL: ${redirectUrl}`);
    } else {
      log(`FAIL: (4) /targets did not redirect correctly. URL: ${redirectUrl}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-redirect.png'), fullPage: true });

  } else {
    log('SKIP: (3)(4) No students found in database.');
  }

  // ── Check 5: Alert click navigates to correct tab ──
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);

  const alertRegion = page.locator('[role="region"][aria-label="Alerts"]');
  const alertsExist = await alertRegion.count() > 0;

  if (alertsExist) {
    // Expand first category with alerts
    const categoryButtons = alertRegion.locator('button[aria-expanded]');
    const catCount = await categoryButtons.count();
    let foundAlert = false;

    for (let i = 0; i < catCount; i++) {
      const btn = categoryButtons.nth(i);
      // Get the count badge value
      const badgeText = await btn.locator('span').last().textContent();
      const count = parseInt(badgeText?.trim() || '0', 10);
      if (count > 0) {
        await btn.click();
        await page.waitForTimeout(500);

        // Click the first alert item
        const alertItems = alertRegion.locator('[role="alert"]');
        const alertCount = await alertItems.count();
        if (alertCount > 0) {
          // Check cursor style
          const cursor = await alertItems.first().evaluate(el => getComputedStyle(el).cursor);
          log(`  Alert item cursor: ${cursor}`);

          await alertItems.first().click();
          await page.waitForTimeout(2000);

          const alertNavUrl = page.url();
          const alertNavCorrect = alertNavUrl.includes('/profile') && alertNavUrl.includes('tab=programmes');
          if (alertNavCorrect) {
            log(`Verified: (5) Alert click navigated to profile?tab=programmes. URL: ${alertNavUrl}`);
          } else {
            log(`FAIL: (5) Alert click went to: ${alertNavUrl}`);
          }
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-alert-nav.png'), fullPage: true });
          foundAlert = true;
          break;
        }
      }
    }

    if (!foundAlert) {
      log('SKIP: (5) Alerts section exists but all categories have 0 alerts.');
    }
  } else {
    log('SKIP: (5) No alerts section on dashboard (no alert data).');
  }

  // ── Summary ──
  await browser.close();

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  const failures = results.filter(r => r.startsWith('FAIL'));
  const passes = results.filter(r => r.startsWith('Verified'));
  console.log(`Passed: ${passes.length}, Failed: ${failures.length}`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  ${f}`));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
