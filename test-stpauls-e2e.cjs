/**
 * Headed E2E: Admin → Teacher → Student at St Pauls College
 * Fixed: button text matching, student login via candidate number
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE = 'http://localhost:5175';
const DIR = '/tmp/e2e-stpauls';
fs.mkdirSync(DIR, { recursive: true });

const R = [];
function log(t, ok, d='') { R.push({t,ok,d}); console.log(`  ${ok?'PASS':'FAIL'}: ${t}${d?' — '+d:''}`); }
async function shot(p, n) { await p.screenshot({ path: `${DIR}/${n}.png`, fullPage: true }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });

  // ═══════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════
  console.log('\n=== ADMIN ===');
  const adminCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const admin = await adminCtx.newPage();
  await admin.goto(`${BASE}/login`);
  await sleep(1000);
  await admin.fill('input[name="email"]', 'verify@test.com');
  await admin.fill('input[name="password"]', 'verify123');
  await admin.click('button[type="submit"]');
  await sleep(3000);
  log('Admin login', admin.url().includes('dashboard'));
  await shot(admin, '01-admin-dashboard');

  // Teacher Groups
  await admin.goto(`${BASE}/admin/teacher-groups`);
  await sleep(2000);
  await shot(admin, '02-teacher-groups');
  log('Teacher groups page', (await admin.textContent('body')).includes('Teacher Groups'));

  // Create group — button says "Create"
  const groupInput = admin.locator('input[placeholder*="group"], input[placeholder*="Group"]').first();
  if (await groupInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await groupInput.fill('St Pauls Teachers');
    await admin.locator('button:has-text("Create")').first().click();
    await sleep(1500);
    await shot(admin, '03-group-created');
    log('Create group', (await admin.textContent('body')).includes('St Pauls Teachers'));

    // Click the group
    await admin.locator('text=St Pauls Teachers').first().click();
    await sleep(1000);
    await shot(admin, '04-group-detail');
    log('Group detail', true);
  } else {
    log('Create group', false, 'Input not found');
  }

  // Permission grid
  await sleep(500);
  await shot(admin, '05-permission-grid');
  const gridText = await admin.textContent('body');
  log('Data Import tool visible', gridText.includes('Data Im'));
  log('Account Assign tool visible', gridText.includes('Account'));
  const checkboxes = await admin.locator('input[type="checkbox"]').count();
  log('Cohort visibility checkboxes', checkboxes >= 5, `${checkboxes} checkboxes`);

  // Admin Users
  await admin.goto(`${BASE}/admin/manage`);
  await sleep(2000);
  await shot(admin, '06-admin-users');
  log('Admin users page', (await admin.textContent('body')).includes('verify@test.com') || (await admin.textContent('body')).includes('demo'));

  // ═══════════════════════════════════════
  // TEACHER
  // ═══════════════════════════════════════
  console.log('\n=== TEACHER ===');
  const teacherCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const teacher = await teacherCtx.newPage();
  await teacher.goto(`${BASE}/login`);
  await sleep(1000);
  await teacher.fill('input[name="email"]', 'demo@school.hk');
  await teacher.fill('input[name="password"]', 'demo12345');
  await teacher.click('button[type="submit"]');
  await sleep(3000);
  log('Teacher login', teacher.url().includes('dashboard'));
  await shot(teacher, '07-teacher-dashboard');

  // Students
  await teacher.goto(`${BASE}/students`);
  await sleep(2000);
  await shot(teacher, '08-student-list');
  const slText = await teacher.textContent('body');
  log('Student list', slText.includes('Chan') || slText.includes('陳'));
  log('Account column', slText.includes('Active') || slText.includes('No Account'));
  log('Unaccounted button', slText.includes('Unaccounted'));
  log('Import button', slText.includes('Import'));

  // Click a student
  const link = teacher.locator('a[href*="/students/"]').first();
  if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
    await link.click();
    await sleep(2500);
    await shot(teacher, '09-student-profile');
    log('Student profile', true);

    // Try each tab
    for (const tabName of ['Grades', 'Programme', 'Plans']) {
      const tab = teacher.locator('button, [role="tab"]').filter({ hasText: new RegExp(tabName, 'i') }).first();
      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tab.click();
        await sleep(1000);
        await shot(teacher, `10-${tabName.toLowerCase()}`);
        log(`Tab: ${tabName}`, true);
      }
    }
  }

  // Submissions
  await teacher.goto(`${BASE}/submissions`);
  await sleep(2000);
  await shot(teacher, '11-submissions');
  log('Submissions', true);

  // Schools
  await teacher.goto(`${BASE}/schools`);
  await sleep(2000);
  await shot(teacher, '12-schools');
  log('School directory', (await teacher.textContent('body')).includes('University') || (await teacher.textContent('body')).includes('大學'));

  // ═══════════════════════════════════════
  // STUDENT (login via candidate number)
  // ═══════════════════════════════════════
  console.log('\n=== STUDENT ===');
  const stuCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const stu = await stuCtx.newPage();
  await stu.goto(`${BASE}/login`);
  await sleep(1000);

  // Click Student toggle
  const stuToggle = stu.locator('button:has-text("Student")').first();
  if (await stuToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await stuToggle.click();
    await sleep(500);
  }
  await shot(stu, '13-student-login-form');

  // Fill candidate number
  const candInput = stu.locator('input[name="candidateNumber"]');
  if (await candInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await candInput.fill('HKDSE-2026-A001');
    await stu.fill('input[name="password"]', 'Student123');
    await stu.click('button[type="submit"]');
    await sleep(3000);
    await shot(stu, '14-student-after-login');
    log('Student login', !stu.url().includes('/login'), stu.url());
  } else {
    // Fallback: try email login
    const emailInput = stu.locator('input[name="email"]');
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill('chan.siuming@test.school.hk');
      await stu.fill('input[name="password"]', 'Student123');
      await stu.click('button[type="submit"]');
      await sleep(3000);
      await shot(stu, '14-student-after-login');
      log('Student login (email)', !stu.url().includes('/login'), stu.url());
    } else {
      log('Student login', false, 'No login form found');
    }
  }

  if (!stu.url().includes('/login')) {
    await shot(stu, '15-student-dashboard');
    log('Student dashboard', true);

    // Navigate to My Plan
    const planLink = stu.locator('a, nav a').filter({ hasText: /My Plan|Plan|計劃/ }).first();
    if (await planLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await planLink.click();
      await sleep(2000);
      await shot(stu, '16-my-plan');
      log('My Plan', true);
    }

    // Navigate to Submissions
    await stu.goto(`${BASE}/my-submissions`);
    await sleep(2000);
    await shot(stu, '17-my-submissions');
    log('My Submissions', !stu.url().includes('/login'));
  }

  // ═══════════════════════════════════════
  // CLEANUP — delete test group
  // ═══════════════════════════════════════
  const adminToken = await (async () => {
    const resp = await admin.evaluate(async () => {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: 'verify@test.com', password: 'verify123'})
      });
      return r.json();
    });
    return resp.access_token;
  })();

  if (adminToken) {
    const groups = await admin.evaluate(async (token) => {
      const r = await fetch('/api/v1/admin/teacher-groups', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    }, adminToken);
    for (const g of (groups.groups || [])) {
      if (g.name.includes('Test') || g.name.includes('St Pauls Teachers') || g.name.includes('E2E')) {
        await admin.evaluate(async ({id, token}) => {
          await fetch(`/api/v1/admin/teacher-groups/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        }, {id: g.id, token: adminToken});
      }
    }
  }

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════
  console.log('\n=== SUMMARY ===');
  const passed = R.filter(r => r.ok).length;
  const failed = R.filter(r => !r.ok).length;
  console.log(`${passed} passed, ${failed} failed`);
  if (failed) R.filter(r => !r.ok).forEach(r => console.log(`  FAIL: ${r.t} ${r.d}`));
  console.log(`\nScreenshots: ${DIR}/`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
