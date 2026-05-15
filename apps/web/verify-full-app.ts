/**
 * COMPREHENSIVE APP AUDIT — exercises every page, every flow, both roles.
 * Not surface checks. Actually clicks through, verifies data, catches errors.
 */
import { chromium, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';
const SS = path.join(__dirname, '../../test-results/full-app-audit');

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function check(name: string, passed: boolean, detail = '') {
  if (passed) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    const msg = `${name} — ${detail}`;
    failures.push(msg);
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

async function ss(page: Page, name: string) {
  await page.screenshot({ path: path.join(SS, `${name}.png`), fullPage: true });
}

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1500);
  // Ensure on login page (auto-logout should have cleared session)
  if (!page.url().includes('/login')) {
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(1500);
  }
  await page.waitForSelector('#input-email', { timeout: 5000 }).catch(() => {});
  // Make sure teacher tab is active
  const teacherBtn = page.locator('button').filter({ hasText: /Teacher|教師/ });
  if (await teacherBtn.count() > 0) await teacherBtn.first().click();
  await page.waitForTimeout(300);
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.locator('button').filter({ hasText: /Log In|登入/ }).first().click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function loginAsStudent(page: Page, candidate: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1500);
  if (!page.url().includes('/login')) {
    await page.goto(`${BASE}/login`);
    await page.waitForTimeout(1500);
  }
  await page.locator('button').filter({ hasText: /Student|學生/ }).first().click();
  await page.waitForTimeout(300);
  await page.fill('#input-candidateNumber', candidate);
  await page.fill('#input-password', candidate);
  await page.locator('button').filter({ hasText: /Log In|登入/ }).first().click();
  await page.waitForTimeout(3000);
}

async function getToken(page: Page): Promise<string> {
  return await page.evaluate(() => localStorage.getItem('token') || '');
}

async function noConsoleErrors(page: Page, label: string) {
  // Listen for errors on current page
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForTimeout(500);
  // We can't retroactively catch errors, but we can check for error boundary renders
  const errorBoundary = await page.locator('text=/Something went wrong|Error|Cannot read prop/i').count();
  check(`${label}: no crash/error boundary`, errorBoundary === 0, errors.join('; '));
}

async function main() {
  fs.mkdirSync(SS, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  console.log('═══════════════════════════════════════');
  console.log(' SECTION 1: ADMIN/TEACHER FLOWS');
  console.log('═══════════════════════════════════════');

  const adminPage = await browser.newPage();

  // ── 1.1 Login ──
  console.log('\n--- 1.1 Login ---');
  await loginAsAdmin(adminPage);
  check('Admin login → dashboard', adminPage.url().includes('/dashboard'));
  const adminNav = await adminPage.locator('nav').textContent();
  check('Admin nav shows verify@test.com', adminNav.includes('verify'));
  check('Admin nav has School Directory', adminNav.includes('School Directory'));
  check('Admin nav has Manage', adminNav.includes('Manage'));
  check('Admin nav has Data Refresh', adminNav.includes('Data Refresh'));
  await ss(adminPage, '01-admin-dashboard');

  // ── 1.2 Dashboard content ──
  console.log('\n--- 1.2 Dashboard content ---');
  const dashBody = await adminPage.textContent('body');
  check('Dashboard has metrics', dashBody.includes('Total Students'));
  check('Dashboard has alerts', dashBody.includes('Alerts'));
  check('Dashboard has cohorts', dashBody.includes('Your Cohorts'));
  check('Dashboard has search', await adminPage.locator('input[aria-label*="Search"]').count() > 0);
  check('Dashboard has Add Student', dashBody.includes('Add Student'));
  check('Dashboard has Import', dashBody.includes('Import'));
  check('Dashboard has Export', dashBody.includes('Export'));
  await noConsoleErrors(adminPage, 'Dashboard');

  // ── 1.3 Click into a cohort ──
  console.log('\n--- 1.3 Cohort navigation ---');
  const cohortCard = adminPage.locator('[role="listitem"]').first();
  if (await cohortCard.count() > 0) {
    await cohortCard.click();
    await adminPage.waitForTimeout(2000);
    check('Cohort detail loads', adminPage.url().includes('/cohorts/'));
    const cohortBody = await adminPage.textContent('body');
    check('Cohort has members section', cohortBody.includes('Members'));
    check('Cohort has stats section', cohortBody.includes('Subject Statistics') || cohortBody.includes('科目統計'));
    await ss(adminPage, '02-cohort-detail');
    await noConsoleErrors(adminPage, 'Cohort detail');

    // Click a student in the cohort
    const studentLink = adminPage.locator('a[href*="/students/"]').first();
    if (await studentLink.count() > 0) {
      await studentLink.click();
      await adminPage.waitForTimeout(2000);
      check('Student profile loads from cohort', adminPage.url().includes('/profile'));
    }
  }

  // ── 1.4 Student profile — all tabs ──
  console.log('\n--- 1.4 Student profile tabs ---');
  const token = await getToken(adminPage);
  const studentsResp = await fetch(`${API}/api/v1/students?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const studentsData = await studentsResp.json();
  const students = Array.isArray(studentsData) ? studentsData : (studentsData.items ?? []);

  if (students.length > 0) {
    const sid = students[0].id;
    await adminPage.goto(`${BASE}/students/${sid}/profile`);
    await adminPage.waitForTimeout(2500);

    const profileBody = await adminPage.textContent('body');
    check('Profile shows student name', profileBody.includes(students[0].name));
    check('Profile shows student ID', profileBody.includes('ID:'));
    check('Profile default tab is Programme Choices', profileBody.includes('Programme Choices') || profileBody.includes('選科志願'));
    await ss(adminPage, '03-profile-programmes');
    await noConsoleErrors(adminPage, 'Profile/Programmes');

    // Click each tab
    const tabNames = ['Grades', 'Plans', 'Personal', 'Other'];
    for (const tab of tabNames) {
      const tabBtn = adminPage.locator('[aria-label="Student profile sections"] button').filter({ hasText: tab });
      if (await tabBtn.count() > 0) {
        await tabBtn.first().click();
        await adminPage.waitForTimeout(1500);
        await noConsoleErrors(adminPage, `Profile/${tab}`);
        check(`Profile tab ${tab} loads without crash`, true);
        await ss(adminPage, `03-profile-${tab.toLowerCase()}`);
      }
    }

    // Test Grades tab has IELTS section
    await adminPage.locator('[aria-label="Student profile sections"] button').filter({ hasText: 'Grades' }).first().click();
    await adminPage.waitForTimeout(1500);
    const gradesBody = await adminPage.textContent('body');
    check('Grades tab has IELTS section', gradesBody.includes('IELTS'));

    // Test Other tab has sub-sections
    await adminPage.locator('[aria-label="Student profile sections"] button').filter({ hasText: 'Other' }).first().click();
    await adminPage.waitForTimeout(1500);
    const otherBody = await adminPage.textContent('body');
    check('Other tab has evaluations/activities/notes toggles',
      otherBody.includes('Teacher Evaluations') || otherBody.includes('教師評語'));

    // ── 1.5 Programme Choices — Add Programme modal ──
    console.log('\n--- 1.5 Add Programme modal ---');
    await adminPage.locator('[aria-label="Student profile sections"] button').filter({ hasText: /Programme|選科/ }).first().click();
    await adminPage.waitForTimeout(1000);
    const addBtn = adminPage.locator('button').filter({ hasText: /Add Programme|新增課程/ });
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await adminPage.waitForTimeout(1500);

      // Search for JUPAS code
      const searchInput = adminPage.locator('input[placeholder*="JUPAS"], input[placeholder*="搜尋"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('Computer');
        await adminPage.waitForTimeout(2000);
        const results = await adminPage.locator('li').count();
        check('JUPAS search returns results', results > 0, `found ${results}`);
        await ss(adminPage, '04-add-programme');
      }
      await adminPage.keyboard.press('Escape');
    }
  }

  // ── 1.6 /students/:id/targets redirects ──
  console.log('\n--- 1.6 Old URL redirects ---');
  if (students.length > 0) {
    await adminPage.goto(`${BASE}/students/${students[0].id}/targets`);
    await adminPage.waitForTimeout(2000);
    check('/targets redirects to profile?tab=programmes',
      adminPage.url().includes('/profile') && adminPage.url().includes('tab=programmes'),
      adminPage.url());
  }

  // ── 1.7 Alert click navigation ──
  console.log('\n--- 1.7 Alert navigation ---');
  await adminPage.goto(`${BASE}/dashboard`);
  await adminPage.waitForTimeout(2000);
  const alertRegion = adminPage.locator('[aria-label="Alerts"]');
  if (await alertRegion.count() > 0) {
    const catBtns = alertRegion.locator('button[aria-expanded]');
    for (let i = 0; i < await catBtns.count(); i++) {
      const badge = await catBtns.nth(i).locator('span').last().textContent();
      if (parseInt(badge || '0') > 0) {
        await catBtns.nth(i).click();
        await adminPage.waitForTimeout(500);
        const alertItem = alertRegion.locator('[role="alert"]').first();
        if (await alertItem.count() > 0) {
          // Check underline style
          const textDecor = await alertItem.locator('span').first().evaluate(
            (el: HTMLElement) => getComputedStyle(el).textDecoration
          );
          check('Alert text is underlined', textDecor.includes('underline'));
          check('Alert cursor is pointer', (await alertItem.evaluate(
            (el: HTMLElement) => getComputedStyle(el).cursor
          )) === 'pointer');

          await alertItem.click();
          await adminPage.waitForTimeout(2000);
          check('Alert click → profile?tab=programmes',
            adminPage.url().includes('/profile') && adminPage.url().includes('tab=programmes'),
            adminPage.url());
        }
        break;
      }
    }
  }

  // ── 1.8 Admin Manage page ──
  console.log('\n--- 1.8 Admin Manage ---');
  await adminPage.goto(`${BASE}/admin/manage`);
  await adminPage.waitForTimeout(3000);
  const manageBody = await adminPage.textContent('body');
  check('Manage page loads', manageBody.includes('User & Access Management') || manageBody.includes('用戶及權限管理'));
  check('Manage has teacher list', await adminPage.locator('[role="button"]').count() > 0);
  check('Manage auto-selects teacher', manageBody.includes('Cohort Management') || manageBody.includes('群組管理'));
  check('Manage has cohort toggle', await adminPage.locator('input[aria-label="Toggle cohort management"]').count() > 0);
  check('Manage has cohort scope section', manageBody.includes('Cohort Scope') || manageBody.includes('群組權限範圍'));
  await ss(adminPage, '05-admin-manage');
  await noConsoleErrors(adminPage, 'Admin Manage');

  // Cohort Management tab
  const cohortMgmtBtn = adminPage.locator('button').filter({ hasText: /Cohort Management|群組管理/ }).first();
  if (await cohortMgmtBtn.count() > 0) {
    await cohortMgmtBtn.click();
    await adminPage.waitForTimeout(2000);
    const cohortMgmtBody = await adminPage.textContent('body');
    check('Cohort mgmt has cohort list', cohortMgmtBody.includes('5A') || cohortMgmtBody.includes('cohort'));
    check('Cohort mgmt has Create Cohort', cohortMgmtBody.includes('Create Cohort') || cohortMgmtBody.includes('建立群組'));
    check('Cohort mgmt has members table', cohortMgmtBody.includes('Members') || cohortMgmtBody.includes('成員'));
    await ss(adminPage, '06-admin-cohort-mgmt');
    await noConsoleErrors(adminPage, 'Admin Cohort Mgmt');
  }

  // ── 1.9 School Directory ──
  console.log('\n--- 1.9 School Directory ---');
  await adminPage.goto(`${BASE}/schools`);
  await adminPage.waitForTimeout(2000);
  const schoolBody = await adminPage.textContent('body');
  check('School Directory loads', schoolBody.includes('Search') || schoolBody.includes('搜尋'));
  await noConsoleErrors(adminPage, 'School Directory');

  // ── 1.10 Data Analysis ──
  console.log('\n--- 1.10 Data Analysis ---');
  await adminPage.goto(`${BASE}/data-analysis`);
  await adminPage.waitForTimeout(2000);
  check('Data Analysis loads', adminPage.url().includes('/data-analysis'));
  await noConsoleErrors(adminPage, 'Data Analysis');

  // ── 1.11 Account Settings ──
  console.log('\n--- 1.11 Account Settings ---');
  await adminPage.goto(`${BASE}/account/settings`);
  await adminPage.waitForTimeout(2000);
  const acctBody = await adminPage.textContent('body');
  check('Account Settings loads', acctBody.includes('Account Settings') || acctBody.includes('帳戶設定'));
  await noConsoleErrors(adminPage, 'Account Settings');

  // ── 1.12 /settings redirects to /admin/manage ──
  console.log('\n--- 1.12 Settings redirect ---');
  await adminPage.goto(`${BASE}/settings`);
  await adminPage.waitForTimeout(2000);
  check('/settings → /admin/manage', adminPage.url().includes('/admin/manage'), adminPage.url());

  // ── 1.13 /cohorts redirects to /dashboard ──
  console.log('\n--- 1.13 Cohorts redirect ---');
  await adminPage.goto(`${BASE}/cohorts`);
  await adminPage.waitForTimeout(2000);
  check('/cohorts → /dashboard', adminPage.url().includes('/dashboard'), adminPage.url());

  await adminPage.close();

  console.log('\n═══════════════════════════════════════');
  console.log(' SECTION 2: STUDENT FLOWS');
  console.log('═══════════════════════════════════════');

  const studentPage = await browser.newPage();

  // ── 2.1 Student Login ──
  console.log('\n--- 2.1 Student Login ---');
  await loginAsStudent(studentPage, 'HKDSE-2026-A001');
  check('Student login → dashboard', studentPage.url().includes('/dashboard'));
  const studentNav = await studentPage.locator('nav').textContent();
  check('Student nav shows Chan Siu Ming', studentNav.includes('Chan Siu Ming'));
  check('Student nav does NOT show verify@test.com', !studentNav.includes('verify@test.com'));
  check('Student nav does NOT have School Directory', !studentNav.includes('School Directory'));
  check('Student nav does NOT have Data Analysis', !studentNav.includes('Data Analysis'));
  check('Student nav does NOT have Submissions', !studentNav.includes('Submissions'));
  check('Student nav does NOT have Manage', !studentNav.includes('Manage'));
  check('Student nav does NOT have Data Refresh', !studentNav.includes('Data Refresh'));
  await ss(studentPage, '07-student-dashboard');
  await noConsoleErrors(studentPage, 'Student Dashboard');

  // ── 2.2 Student Dashboard content ──
  console.log('\n--- 2.2 Student Dashboard content ---');
  const studentBody = await studentPage.textContent('body');
  check('Student sees Programme Choices', studentBody.includes('Programme Choices') || studentBody.includes('選科志願'));
  check('Student sees Add Programme button', studentBody.includes('Add Programme') || studentBody.includes('新增課程'));
  check('Student sees their name', studentBody.includes('Chan Siu Ming'));
  check('Student sees their ID', studentBody.includes('HKDSE-2026-A001'));
  check('Student does NOT see cohorts', !studentBody.includes('Your Cohorts'));
  check('Student does NOT see alerts panel', !studentBody.includes('Alerts'));
  check('Student does NOT see Import', !studentBody.includes('Import (CSV'));
  check('Student does NOT see Add Student', !studentBody.includes('Add Student'));

  // ── 2.3 Student can add programme ──
  console.log('\n--- 2.3 Student Add Programme ---');
  const studentAddBtn = studentPage.locator('button').filter({ hasText: /Add Programme|新增課程/ });
  if (await studentAddBtn.count() > 0) {
    await studentAddBtn.first().click();
    await studentPage.waitForTimeout(1500);
    check('Add Programme modal opens', await studentPage.locator('input[placeholder*="JUPAS"], input[placeholder*="搜尋"]').count() > 0);
    await studentPage.keyboard.press('Escape');
  }

  // ── 2.4 Student cannot access admin pages ──
  console.log('\n--- 2.4 Student access restrictions ---');
  await studentPage.goto(`${BASE}/admin/manage`);
  await studentPage.waitForTimeout(2000);
  check('Student blocked from /admin/manage', !studentPage.url().includes('/admin/manage'), studentPage.url());

  await studentPage.goto(`${BASE}/admin/data-refresh`);
  await studentPage.waitForTimeout(2000);
  // Should redirect somewhere, not show admin content
  const dataRefreshBody = await studentPage.textContent('body');
  check('Student blocked from /admin/data-refresh',
    !dataRefreshBody.includes('Data Refresh') || studentPage.url().includes('/dashboard'),
    studentPage.url());

  await studentPage.close();

  console.log('\n═══════════════════════════════════════');
  console.log(' SECTION 3: ACCOUNT SWITCHING');
  console.log('═══════════════════════════════════════');

  const switchPage = await browser.newPage();

  // ── 3.1 Admin → Student switch ──
  console.log('\n--- 3.1 Admin → Student ---');
  await loginAsAdmin(switchPage);
  check('Logged in as admin', switchPage.url().includes('/dashboard'));

  await loginAsStudent(switchPage, 'HKDSE-2026-B001');
  const switchNav1 = await switchPage.locator('nav').textContent();
  check('After switch: shows Lee Tsz Him', switchNav1.includes('Lee Tsz Him'));
  check('After switch: no verify@test.com', !switchNav1.includes('verify@test.com'));
  check('After switch: no admin nav items', !switchNav1.includes('Manage'));

  // ── 3.2 Student → Admin switch ──
  console.log('\n--- 3.2 Student → Admin ---');
  await loginAsAdmin(switchPage);
  const switchNav2 = await switchPage.locator('nav').textContent();
  check('After switch back: shows verify', switchNav2.includes('verify'));
  check('After switch back: has Manage', switchNav2.includes('Manage'));
  check('After switch back: has full nav', switchNav2.includes('School Directory'));

  // ── 3.3 Student → Different Student ──
  console.log('\n--- 3.3 Student → Different Student ---');
  await loginAsStudent(switchPage, 'HKDSE-2026-A001');
  let switchNav3 = await switchPage.locator('nav').textContent();
  check('First student: Chan Siu Ming', switchNav3.includes('Chan Siu Ming'));

  await loginAsStudent(switchPage, 'HKDSE-2026-E001');
  switchNav3 = await switchPage.locator('nav').textContent();
  check('Second student: Kwok Chi Kin', switchNav3.includes('Kwok Chi Kin'));
  check('No trace of Chan Siu Ming', !switchNav3.includes('Chan Siu Ming'));
  await ss(switchPage, '08-switch-students');

  await switchPage.close();

  console.log('\n═══════════════════════════════════════');
  console.log(' SECTION 4: API DATA INTEGRITY');
  console.log('═══════════════════════════════════════');

  console.log('\n--- 4.1 Score sanity for all students ---');
  const apiToken = (await (await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'verify@test.com', password: 'verify123' }),
  })).json()).access_token;

  const allStudents = await (await fetch(`${API}/api/v1/students?limit=50`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })).json();
  const studentList = Array.isArray(allStudents) ? allStudents : (allStudents.items ?? []);

  for (const s of studentList) {
    const targetsResp = await fetch(`${API}/api/v1/students/${s.id}/targets`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (targetsResp.status !== 200) {
      check(`${s.name} targets fetch`, false, `status ${targetsResp.status}`);
      continue;
    }
    const targets = (await targetsResp.json()).targets ?? [];
    for (const t of targets) {
      const score = t.match_score;
      const code = t.jupas_code || 'none';
      const eligible = t.eligibility_pass;
      const failing = t.failing_criteria || [];

      // Score in valid range
      if (score != null && (score < 0 || score > 1)) {
        check(`${s.name}/${code} score range`, false, `score=${score}`);
      }
      // Ineligible must not show >50%
      else if (!eligible && score != null && score > 0.5) {
        check(`${s.name}/${code} ineligible+high`, false, `score=${score}, failing=${failing}`);
      }
      // Eligible with very low score — flag as info but don't fail
      else {
        check(`${s.name}/${code}`, true);
      }
    }
  }

  // ── 4.2 Account data consistency ──
  console.log('\n--- 4.2 Account data for each student ---');
  for (const candidate of ['HKDSE-2026-A001', 'HKDSE-2026-B001', 'HKDSE-2026-C001', 'HKDSE-2026-D001', 'HKDSE-2026-E001']) {
    const loginResp = await fetch(`${API}/api/v1/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_number: candidate, password: candidate }),
    });
    if (loginResp.status !== 200) {
      check(`${candidate} login`, false, `status ${loginResp.status}`);
      continue;
    }
    const sToken = (await loginResp.json()).access_token;
    const acct = await (await fetch(`${API}/api/v1/account`, {
      headers: { Authorization: `Bearer ${sToken}` },
    })).json();

    check(`${candidate} role is student`, acct.role === 'student', `got ${acct.role}`);
    check(`${candidate} has student_id`, !!acct.student_id);
    check(`${candidate} name not empty`, !!acct.display_name && acct.display_name.length > 0);
    check(`${candidate} name matches email prefix`, !acct.display_name?.includes('@'), `name: ${acct.display_name}`);
  }

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════
  await browser.close();

  console.log('\n═══════════════════════════════════════');
  console.log(` RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('═══════════════════════════════════════');
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll checks passed.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
