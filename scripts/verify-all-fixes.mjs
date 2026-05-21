/**
 * Comprehensive verification of all fixes.
 * Checks every modified page, captures screenshots, validates specific elements.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:5173';
// Student app removed — students log in through the main web app
const OUT = 'test-results/verify-fixes';
const results = [];

function pass(page, check) { results.push({ page, check, status: 'PASS' }); console.log(`  ✅ ${check}`); }
function fail(page, check, detail) { results.push({ page, check, status: 'FAIL', detail }); console.log(`  ❌ ${check}: ${detail}`); }

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function hasText(page, text, pageName, checkName) {
  const body = await page.textContent('body');
  if (body.includes(text)) { pass(pageName, checkName); return true; }
  fail(pageName, checkName, `"${text}" not found`);
  return false;
}

async function noText(page, text, pageName, checkName) {
  const body = await page.textContent('body');
  if (!body.includes(text)) { pass(pageName, checkName); return true; }
  fail(pageName, checkName, `"${text}" still present`);
  return false;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, slowMo: 50 });

  // ============ ADMIN/TEACHER PORTAL ============
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'verify@test.com');
  await page.fill('input[type="password"]', 'verify123');
  await page.click('button[type="submit"], button:has-text("Log In"), button:has-text("登入")');
  await page.waitForURL(/dashboard|onboarding/, { timeout: 10000 });
  console.log('Logged in as admin\n');

  // --- 1. DASHBOARD ---
  console.log('📄 Dashboard');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '01-dashboard');
  await hasText(page, '學生', 'Dashboard', 'Nav has "學生" (Students) link');
  await hasText(page, '提醒', 'Dashboard', 'Alerts heading is Chinese "提醒"');
  await hasText(page, '您的群組', 'Dashboard', 'Cohorts heading is Chinese "您的群組"');

  // --- 2. ACCOUNT SETTINGS (redirect test) ---
  console.log('\n📄 Account Settings');
  await page.goto(`${BASE}/account`);
  await page.waitForTimeout(2000);
  const accountUrl = page.url();
  if (accountUrl.includes('/account/settings')) {
    pass('Account', '/account redirects to /account/settings');
  } else {
    fail('Account', '/account redirects to /account/settings', `URL is ${accountUrl}`);
  }
  await shot(page, '02-account-settings');
  await hasText(page, '帳戶設定', 'Account', 'Page title is Chinese "帳戶設定"');
  await hasText(page, '個人資料', 'Account', 'Profile section is Chinese "個人資料"');
  await hasText(page, '更改密碼', 'Account', 'Password section is Chinese "更改密碼"');
  await hasText(page, '偏好設定', 'Account', 'Preferences section is Chinese "偏好設定"');
  await hasText(page, '危險區域', 'Account', 'Danger zone is Chinese "危險區域"');

  // --- 3. STUDENT LIST PAGE ---
  console.log('\n📄 Student List');
  await page.goto(`${BASE}/students`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '03-student-list');
  await hasText(page, '班別', 'StudentList', 'Table has "班別" (Class) column');
  await hasText(page, '考生編號', 'StudentList', 'Table has "考生編號" (Candidate No) column');
  await hasText(page, '帳戶', 'StudentList', 'Table has "帳戶" (Account) column');
  await hasText(page, 'Active', 'StudentList', 'Some students show "Active" status');
  await hasText(page, 'No Account', 'StudentList', 'Some students show "No Account" status');

  // --- 4. SUBMISSIONS (i18n fix) ---
  console.log('\n📄 Submissions');
  await page.goto(`${BASE}/submissions`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '04-submissions');
  await hasText(page, '已提交', 'Submissions', 'Summary shows "已提交" (submitted) in Chinese');
  await hasText(page, '已批准', 'Submissions', 'Summary shows "已批准" (approved) in Chinese');
  await noText(page, 'submitted', 'Submissions', 'No English "submitted" in summary');
  await noText(page, 'approved', 'Submissions', 'No English "approved" in summary');

  // --- 5. SCHOOL DIRECTORY (i18n fix for SchoolCard + SF section) ---
  console.log('\n📄 School Directory');
  await page.goto(`${BASE}/schools`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await shot(page, '05-school-directory');
  await hasText(page, '副學位及自資課程', 'SchoolDirectory', 'SF section title is Chinese');
  await hasText(page, '銜接率', 'SchoolDirectory', 'Articulation rate label is Chinese "銜接率"');
  // Check SchoolCard i18n
  await hasText(page, '課程', 'SchoolDirectory', 'Card shows "課程" (Programs) in Chinese');
  await hasText(page, '主修', 'SchoolDirectory', 'Card shows "主修" (Majors) in Chinese');
  await hasText(page, '最低分數', 'SchoolDirectory', 'Card shows "最低分數" (Min score) in Chinese');
  await hasText(page, '提供獎學金', 'SchoolDirectory', 'Card shows "提供獎學金" (Scholarship) in Chinese');

  // --- 6. SCHOOL PROFILE ---
  console.log('\n📄 School Profile');
  const schoolLink = page.locator('a[href*="/schools/"]').first();
  if (await schoolLink.isVisible()) {
    await schoolLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await shot(page, '06-school-profile');
  }

  // --- 7. PROGRAMME DETAIL (was entirely un-i18ned) ---
  console.log('\n📄 Programme Detail');
  const progLink = page.locator('a[href*="/programmes/"]').first();
  if (await progLink.isVisible()) {
    await progLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await shot(page, '07-programme-detail');
    await hasText(page, '入學要求', 'ProgrammeDetail', 'Section title is Chinese "入學要求" (Entry Requirements)');
    await hasText(page, '你的學生', 'ProgrammeDetail', 'Section title is Chinese "你的學生" (Your Students)');
    await noText(page, 'Entry Requirements', 'ProgrammeDetail', 'No English "Entry Requirements"');
    await noText(page, 'Your Students', 'ProgrammeDetail', 'No English "Your Students"');
  }

  // --- 8. SF INSTITUTION ---
  console.log('\n📄 SF Institution');
  await page.goto(`${BASE}/schools`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  // Scroll to SF section and click first SF institution
  const sfLink = page.locator('a[href*="/sf/"]').first();
  if (await sfLink.isVisible()) {
    await sfLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await shot(page, '08-sf-institution');

    // Click first SF programme
    const sfProgLink = page.locator('a[href*="/programmes/"]').first();
    if (await sfProgLink.isVisible()) {
      await sfProgLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await shot(page, '08a-sf-programme-detail');
      await noText(page, 'Loading...', 'SfProgrammeDetail', 'No English "Loading..."');
    }
  }

  // --- 9. DATA ANALYSIS (i18n fix) ---
  console.log('\n📄 Data Analysis');
  await page.goto(`${BASE}/data-analysis`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '09-data-analysis');
  await hasText(page, '畢業去向', 'DataAnalysis', 'Tab label is Chinese "畢業去向" (Graduation Outcomes)');
  await hasText(page, '核心', 'DataAnalysis', 'Category badge shows "核心" (Core)');
  await hasText(page, '選修', 'DataAnalysis', 'Category badge shows "選修" (Elective)');
  await noText(page, 'Graduation Outcomes', 'DataAnalysis', 'No English "Graduation Outcomes"');

  // --- 10. CONSULTANT TASK (milestones i18n) ---
  console.log('\n📄 Consultant Task');
  // Get first student ID
  const studentsRes = await page.evaluate(async () => {
    const r = await fetch('http://localhost:8000/api/v1/students?limit=1');
    return r.json();
  });
  const firstStudent = (studentsRes.items || studentsRes)?.[0];
  if (firstStudent) {
    await page.goto(`${BASE}/students/${firstStudent.id}/consultant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await shot(page, '10-consultant');
  }

  // --- 11. PROGRAMME CHOICES TAB (layout fix) ---
  console.log('\n📄 Programme Choices Tab (layout fix)');
  if (firstStudent) {
    await page.goto(`${BASE}/students/${firstStudent.id}/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '11-student-profile');

    // Click Programmes tab if not already active
    const progTab = page.locator('button:has-text("Programme"), button:has-text("課程選擇")').first();
    if (await progTab.isVisible()) {
      await progTab.click();
      await page.waitForTimeout(500);
    }
    await shot(page, '11a-programme-choices-tab');

    // Measure table width
    const table = page.locator('table').first();
    if (await table.isVisible()) {
      const box = await table.boundingBox();
      if (box) {
        if (box.width > 700) {
          pass('ProgrammeChoices', `Table width is ${Math.round(box.width)}px (>700px minimum)`);
        } else {
          fail('ProgrammeChoices', `Table width is ${Math.round(box.width)}px`, 'Should be >700px');
        }
      }
    }
  }

  // --- 12. ADMIN MANAGE (i18n fix) ---
  console.log('\n📄 Admin Manage');
  await page.goto(`${BASE}/admin/manage`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '12-admin-manage');

  // --- 13. COHORT DETAIL ---
  console.log('\n📄 Cohort Detail');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const cohortCard = page.locator('[role="listitem"]').first();
  if (await cohortCard.isVisible()) {
    await cohortCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '13-cohort-detail');
  }

  // --- 14. PLANS ANALYTICS ---
  console.log('\n📄 Plans Analytics');
  await page.goto(`${BASE}/analytics/plans`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '14-plans-analytics');

  // --- 15. SUBMISSIONS ANALYTICS ---
  console.log('\n📄 Submissions Analytics');
  await page.goto(`${BASE}/analytics/submissions`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '15-submissions-analytics');
  await hasText(page, '已提交', 'SubmissionsAnalytics', 'Summary shows "已提交" not "submitted"');

  // --- 16. IMPORT PAGE ---
  console.log('\n📄 Import Page');
  await page.goto(`${BASE}/import/students`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await shot(page, '16-import');

  await ctx.close();

  // Student login uses the same web app — no separate student portal

  await browser.close();

  // ============ REPORT ============
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 COMPREHENSIVE VERIFICATION REPORT');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');

  console.log(`\n✅ PASSED: ${passed.length}`);
  console.log(`❌ FAILED: ${failed.length}`);
  console.log(`📸 Screenshots: ${fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length}`);

  if (failed.length > 0) {
    console.log('\n--- FAILURES ---');
    for (const f of failed) {
      console.log(`[${f.page}] ${f.check}: ${f.detail}`);
    }
  }

  console.log('\n--- ALL CHECKS ---');
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? '✅' : '❌'} [${r.page}] ${r.check}`);
  }

  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ results, passed: passed.length, failed: failed.length }, null, 2));
  console.log(`\nReport saved to ${OUT}/report.json`);
}

main().catch(console.error);
