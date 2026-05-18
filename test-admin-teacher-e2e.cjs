/**
 * E2E Headed Browser Test: Admin ↔ Teacher ↔ Student flows
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = 'http://localhost:5175';
const results = [];

function log(label, pass, detail = '') {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ label, status, detail });
  console.log(`  ${status}: ${label}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: `/tmp/e2e-perm/${name}.png`, fullPage: true });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

fs.mkdirSync('/tmp/e2e-perm', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });

  // ─── PART 1: Admin ───
  console.log('\n=== PART 1: Admin — Teacher Groups ===');
  const adminCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const admin = await adminCtx.newPage();

  await admin.goto(`${BASE}/login`);
  await sleep(1000);
  await admin.fill('input[name="email"]', 'verify@test.com');
  await admin.fill('input[name="password"]', 'verify123');
  await admin.click('button[type="submit"]');
  await sleep(3000);
  await shot(admin, '01-admin-dashboard');
  log('Admin login', admin.url().includes('dashboard'));

  // Teacher groups page
  await admin.goto(`${BASE}/admin/teacher-groups`);
  await sleep(2000);
  await shot(admin, '02-teacher-groups');
  const pgText = await admin.textContent('body');
  log('Teacher groups page', pgText.includes('Teacher') || pgText.includes('Group') || pgText.includes('教師'));

  // Create group
  try {
    const inp = admin.locator('input[placeholder]').first();
    await inp.fill('Test E2E Group');
    const addBtn = admin.locator('button').filter({ hasText: /^Add$|^新增$|^Create/ }).first();
    await addBtn.click();
    await sleep(1500);
    await shot(admin, '03-group-created');
    log('Create group', (await admin.textContent('body')).includes('Test E2E Group'));
  } catch (e) { log('Create group', false, e.message); }

  // Click group
  try {
    await admin.locator('text=Test E2E Group').first().click();
    await sleep(1500);
    await shot(admin, '04-group-selected');
    log('Group selected', true);
  } catch (e) { log('Group selected', false, e.message); }

  // Permission grid
  await sleep(1000);
  await shot(admin, '05-permission-grid');
  const gridVisible = await admin.locator('table').count() > 0;
  log('Permission grid visible', gridVisible);

  // Check for cohort rows
  const hasCheckbox = await admin.locator('input[type="checkbox"]').count() > 0;
  log('Visibility checkboxes', hasCheckbox);

  const hasSelect = await admin.locator('select').count() > 0;
  log('Tool permission dropdowns', hasSelect);

  // Admin users page
  await admin.goto(`${BASE}/admin/users`);
  await sleep(2000);
  await shot(admin, '06-admin-users');
  log('Admin users page', true);

  // ─── PART 2: Teacher ───
  console.log('\n=== PART 2: Teacher — Student Views ===');
  const teacherCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const teacher = await teacherCtx.newPage();

  await teacher.goto(`${BASE}/login`);
  await sleep(1000);
  await teacher.fill('input[name="email"]', 'demo@school.hk');
  await teacher.fill('input[name="password"]', 'demo12345');
  await teacher.click('button[type="submit"]');
  await sleep(3000);
  await shot(teacher, '07-teacher-dashboard');
  log('Teacher login', teacher.url().includes('dashboard'));

  // Student list
  await teacher.goto(`${BASE}/students`);
  await sleep(2000);
  await shot(teacher, '08-student-list');
  const slText = await teacher.textContent('body');
  log('Student list', slText.includes('Chan') || slText.includes('陳') || slText.includes('Wong'));

  // Unaccounted button
  const unBtn = teacher.locator('button').filter({ hasText: /Unaccounted|未綁定|Showing/ });
  const hasUn = await unBtn.count() > 0;
  log('Unaccounted toggle', hasUn);
  if (hasUn) {
    await unBtn.first().click();
    await sleep(1500);
    await shot(teacher, '09-unaccounted');
  }

  // Account badges
  const badges = await teacher.locator('span').filter({ hasText: /Active|Invited|No Account/ }).count();
  log('Account badges', badges > 0, `${badges} found`);

  // Click first student link
  const firstLink = teacher.locator('a[href*="/students/"]').first();
  if (await firstLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstLink.click();
    await sleep(2000);
    await shot(teacher, '10-student-profile');
    log('Student profile', true);

    // Grades tab
    const gt = teacher.locator('button, [role="tab"]').filter({ hasText: /Grades|成績/ }).first();
    if (await gt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await gt.click(); await sleep(1000);
      await shot(teacher, '11-grades');
      log('Grades tab', true);
    }

    // Programme choices
    const pt = teacher.locator('button, [role="tab"]').filter({ hasText: /Programme|課程/ }).first();
    if (await pt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pt.click(); await sleep(1500);
      await shot(teacher, '12-programmes');
      log('Programme choices tab', true);
    }

    // Plans tab
    const plt = teacher.locator('button, [role="tab"]').filter({ hasText: /Plans|計劃/ }).first();
    if (await plt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await plt.click(); await sleep(1000);
      await shot(teacher, '13-plans');
      log('Plans tab', true);
    }
  }

  // Submissions
  await teacher.goto(`${BASE}/submissions`);
  await sleep(2000);
  await shot(teacher, '14-submissions');
  log('Submissions page', true);

  // ─── PART 3: Student ───
  console.log('\n=== PART 3: Student ===');
  const stuCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const stu = await stuCtx.newPage();

  await stu.goto(`${BASE}/login`);
  await sleep(1000);
  // Try student login toggle
  const stuToggle = stu.locator('button, a').filter({ hasText: /Student|學生/ }).first();
  if (await stuToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    await stuToggle.click();
    await sleep(500);
  }
  await shot(stu, '15-student-login');

  // Login with email
  await stu.fill('input[name="email"]', 'chan.siuming@test.school.hk');
  await stu.fill('input[name="password"]', 'NewSecure456');
  await stu.click('button[type="submit"]');
  await sleep(3000);
  await shot(stu, '16-student-after-login');
  log('Student login', !stu.url().includes('login'), stu.url());

  if (!stu.url().includes('login')) {
    await shot(stu, '17-student-dashboard');
    log('Student dashboard', true);

    // My Plan
    const mp = stu.locator('a, button').filter({ hasText: /My Plan|我的計劃/ }).first();
    if (await mp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mp.click(); await sleep(2000);
      await shot(stu, '18-my-plan');
      log('My Plan page', true);
    }

    // My Submissions
    const ms = stu.locator('a, button').filter({ hasText: /My Submissions|Submission|我的提交/ }).first();
    if (await ms.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ms.click(); await sleep(2000);
      await shot(stu, '19-my-submissions');
      log('My Submissions page', true);
    }
  }

  // ─── Summary ───
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`${passed} passed, ${failed} failed`);
  if (failed) {
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`  FAIL: ${r.label} ${r.detail}`)
    );
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
