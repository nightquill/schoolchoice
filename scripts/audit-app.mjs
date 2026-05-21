/**
 * Full App Audit Script
 * Visits every page, takes screenshots, logs bugs against the spec.
 * Run: node scripts/audit-app.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000/api/v1';
const ADMIN_CREDS = { email: 'verify@test.com', password: 'verify123' };
const OUT_DIR = 'test-results/audit';

const bugs = [];
function bug(page, severity, desc) {
  bugs.push({ page, severity, desc });
  console.log(`  🐛 [${severity}] ${desc}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  // Check if there's a mode toggle for teacher/admin
  const teacherToggle = page.locator('button:has-text("Teacher"), button:has-text("Admin"), [data-mode="teacher"]').first();
  if (await teacherToggle.isVisible().catch(() => false)) {
    await teacherToggle.click();
  }

  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', ADMIN_CREDS.email);
  await page.fill('input[type="password"], input[name="password"]', ADMIN_CREDS.password);
  await page.click('button[type="submit"], button:has-text("Log In"), button:has-text("Login")');
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 });
}

async function screenshot(page, name) {
  const dir = path.join(OUT_DIR, path.dirname(name));
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function checkI18n(page, pageName) {
  // Check for common hardcoded English patterns that should be translated
  const bodyText = await page.textContent('body');

  // Check for raw translation keys like "nav.dashboard" or "auth.login"
  const keyPattern = /\b[a-z]+\.[a-z]+\.[a-z]+\b/g;
  const suspiciousKeys = bodyText.match(keyPattern) || [];
  for (const key of suspiciousKeys) {
    if (key.includes('localhost') || key.includes('http')) continue;
    // Only flag if it looks like a translation key path
    if (/^[a-z]+\.[a-z]+$/.test(key)) {
      bug(pageName, 'LOW', `Possible untranslated key: "${key}"`);
    }
  }

  // Check for undefined/null/NaN rendering
  const badPatterns = ['undefined', '[object Object]', 'NaN', 'null'];
  for (const pat of badPatterns) {
    if (bodyText.includes(pat)) {
      bug(pageName, 'HIGH', `Found "${pat}" in page text`);
    }
  }
}

async function checkPage(page, route, name, checks = []) {
  console.log(`\n📄 Auditing: ${name} (${route})`);
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000); // Let dynamic content load
    await screenshot(page, name);

    // Check for error states
    const errorEl = page.locator('.error, [role="alert"]:not([data-sonner-toast]), text="Something went wrong"').first();
    if (await errorEl.isVisible().catch(() => false)) {
      const errorText = await errorEl.textContent().catch(() => '');
      bug(name, 'HIGH', `Error visible on page: "${errorText.trim().slice(0, 100)}"`);
    }

    // Check for blank page (only navbar visible)
    const mainContent = page.locator('main, [role="main"], #root > div > div:nth-child(2)').first();
    const mainText = await mainContent.textContent().catch(() => '');
    if (mainText.trim().length < 10) {
      bug(name, 'HIGH', `Page appears blank/empty — only ${mainText.trim().length} chars of content`);
    }

    // i18n check
    await checkI18n(page, name);

    // Run page-specific checks
    for (const check of checks) {
      await check(page, name);
    }

    // Console error check
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleLogs.push(msg.text());
    });

  } catch (err) {
    bug(name, 'CRITICAL', `Page failed to load: ${err.message.slice(0, 200)}`);
    await screenshot(page, `${name}-error`).catch(() => {});
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), text: msg.text().slice(0, 200) });
    }
  });

  // === LOGIN ===
  console.log('\n🔐 Logging in as admin...');
  await login(page);
  await screenshot(page, '01-dashboard-after-login');
  console.log('✅ Logged in successfully');

  // === DASHBOARD ===
  await checkPage(page, '/dashboard', '02-dashboard', [
    async (p, n) => {
      // Check metric cards
      const metrics = p.locator('[aria-label="Summary statistics"], .grid').first();
      if (!await metrics.isVisible().catch(() => false)) {
        bug(n, 'MEDIUM', 'Summary statistics section not found');
      }

      // Check alerts panel
      const alerts = p.locator('text="Alerts"').first();
      if (!await alerts.isVisible().catch(() => false)) {
        bug(n, 'MEDIUM', 'Alerts panel not found');
      }

      // Check cohort section
      const cohorts = p.locator('text="Your Cohorts", text="Cohorts"').first();
      if (!await cohorts.isVisible().catch(() => false)) {
        bug(n, 'MEDIUM', 'Cohorts section not found');
      }
    }
  ]);

  // === Get student list for further navigation ===
  let students = [];
  try {
    const token = await page.evaluate(() => sessionStorage.getItem('token') || localStorage.getItem('token'));
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/v1/students?limit=10');
      return r.json();
    });
    students = res.items || res || [];
    console.log(`\n📊 Found ${students.length} students`);
  } catch (e) {
    console.log('⚠️ Could not fetch students:', e.message);
  }

  // === STUDENT PROFILE (first student) ===
  if (students.length > 0) {
    const s = students[0];
    const profileBase = `/students/${s.id}/profile`;

    await checkPage(page, profileBase, '03-student-profile-programmes', [
      async (p, n) => {
        // Check tab navigation exists
        const tabs = p.locator('[role="tablist"], .tabs');
        if (!await tabs.isVisible().catch(() => false)) {
          bug(n, 'HIGH', 'Tab navigation not found on student profile');
        }

        // Check programme choices tab
        const progTab = p.locator('text="Programme Choices", text="Programmes", [data-tab="programmes"]').first();
        if (await progTab.isVisible().catch(() => false)) {
          await progTab.click().catch(() => {});
          await p.waitForTimeout(500);
          await screenshot(p, '03a-programmes-tab');

          // Check if content is too narrow (user bug #2)
          const table = p.locator('table, .programme-list, [class*="programme"]').first();
          if (await table.isVisible().catch(() => false)) {
            const box = await table.boundingBox();
            if (box && box.width < 400) {
              bug(n, 'HIGH', `Programme choices view too narrow: ${Math.round(box.width)}px (user bug #2)`);
            }
          }
        }
      }
    ]);

    // Click through tabs
    const tabNames = ['Grades', 'Plans', 'Personal', 'Other'];
    for (const tab of tabNames) {
      try {
        const tabEl = page.locator(`text="${tab}"`).first();
        if (await tabEl.isVisible().catch(() => false)) {
          await tabEl.click();
          await page.waitForTimeout(500);
          await screenshot(page, `03-student-profile-${tab.toLowerCase()}`);
        }
      } catch (e) {
        bug('student-profile', 'MEDIUM', `Tab "${tab}" failed to click: ${e.message.slice(0, 100)}`);
      }
    }

    // === ACADEMIC PLAN ===
    await checkPage(page, `/students/${s.id}/consultant`, '04-consultant');
    await checkPage(page, `/students/${s.id}/plan`, '04-academic-plan');
  }

  // === SCHOOL DIRECTORY ===
  await checkPage(page, '/schools', '05-school-directory', [
    async (p, n) => {
      const cards = p.locator('.school-card, [class*="school"], a[href*="/schools/"]');
      const count = await cards.count();
      if (count === 0) {
        bug(n, 'MEDIUM', 'No school cards visible in directory');
      }
    }
  ]);

  // Navigate to first school profile
  try {
    const schoolLink = page.locator('a[href*="/schools/"]').first();
    if (await schoolLink.isVisible().catch(() => false)) {
      await schoolLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await screenshot(page, '05a-school-profile');

      // Navigate to first programme
      const progLink = page.locator('a[href*="/programmes/"]').first();
      if (await progLink.isVisible().catch(() => false)) {
        await progLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        await screenshot(page, '05b-programme-detail');
      }
    }
  } catch (e) {
    bug('school-directory', 'MEDIUM', `School navigation failed: ${e.message.slice(0, 100)}`);
  }

  // === SUBMISSIONS ===
  await checkPage(page, '/submissions', '06-submissions');

  // === COHORTS (navigate from dashboard) ===
  await checkPage(page, '/dashboard', '07-cohorts-nav');
  try {
    const cohortCard = page.locator('[role="listitem"]').first();
    if (await cohortCard.isVisible().catch(() => false)) {
      await cohortCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await screenshot(page, '07a-cohort-detail');
    }
  } catch (e) {
    bug('cohorts', 'MEDIUM', `Cohort navigation failed: ${e.message.slice(0, 100)}`);
  }

  // === ANALYTICS ===
  await checkPage(page, '/analytics/plans', '08-plans-analytics');
  await checkPage(page, '/analytics/submissions', '08a-submissions-analytics');
  await checkPage(page, '/data-analysis', '09-data-analysis');

  // === ADMIN ===
  await checkPage(page, '/admin/manage', '10-admin-manage', [
    async (p, n) => {
      // Check for teacher groups tab
      const tabs = ['Teacher Groups', 'Cohorts', 'Teachers', 'Settings'];
      for (const tab of tabs) {
        const el = p.locator(`text="${tab}"`).first();
        if (!await el.isVisible().catch(() => false)) {
          bug(n, 'MEDIUM', `Admin tab "${tab}" not found`);
        }
      }

      // Click Teacher Groups and check permissions
      const tgTab = p.locator('text="Teacher Groups"').first();
      if (await tgTab.isVisible().catch(() => false)) {
        await tgTab.click();
        await p.waitForTimeout(500);
        await screenshot(p, '10a-admin-teacher-groups');
      }

      // Click Settings tab
      const settingsTab = p.locator('text="Settings"').first();
      if (await settingsTab.isVisible().catch(() => false)) {
        await settingsTab.click();
        await p.waitForTimeout(500);
        await screenshot(p, '10b-admin-settings');
      }
    }
  ]);

  // === IMPORT ===
  await checkPage(page, '/import/students', '11-import-students');

  // === ACCOUNT SETTINGS ===
  await checkPage(page, '/account', '12-account-settings');

  // === METHODOLOGY ===
  await checkPage(page, '/methodology', '13-methodology');

  // === STUDENT PORTAL (if we can log in as student) ===
  console.log('\n🎓 Testing student portal...');
  try {
    // Try to log in as a student
    const studentRes = await page.evaluate(async () => {
      const r = await fetch('/api/v1/students?limit=5');
      const data = await r.json();
      return data.items || data || [];
    });

    if (studentRes.length > 0 && studentRes[0].candidate_number) {
      const candNum = studentRes[0].candidate_number;

      // Logout first
      await page.goto(`${BASE}/login`);
      await page.waitForTimeout(500);

      // Switch to student mode
      const studentToggle = page.locator('button:has-text("Student")').first();
      if (await studentToggle.isVisible().catch(() => false)) {
        await studentToggle.click();
        await page.waitForTimeout(300);

        await page.fill('input[placeholder*="candidate" i], input[name="candidateNumber"], input:first-of-type', candNum);
        await page.fill('input[type="password"]', candNum);
        await page.click('button[type="submit"], button:has-text("Log In")');
        await page.waitForTimeout(3000);
        await screenshot(page, '14-student-login-result');

        // Check what page we're on
        const url = page.url();
        console.log(`  Student login → ${url}`);

        if (url.includes('dashboard') || url.includes('grades') || url.includes('choices')) {
          await screenshot(page, '14a-student-dashboard');

          // Try grade sandbox
          const gradesLink = page.locator('a[href*="grades"], text="My Grades", text="Grades"').first();
          if (await gradesLink.isVisible().catch(() => false)) {
            await gradesLink.click();
            await page.waitForTimeout(1000);
            await screenshot(page, '14b-student-grades');
          }
        }
      }
    }
  } catch (e) {
    bug('student-portal', 'MEDIUM', `Student login/navigation failed: ${e.message.slice(0, 100)}`);
  }

  // === WRITE REPORT ===
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 AUDIT REPORT');
  console.log('='.repeat(60));

  if (bugs.length === 0) {
    console.log('\n✅ No bugs found!');
  } else {
    const critical = bugs.filter(b => b.severity === 'CRITICAL');
    const high = bugs.filter(b => b.severity === 'HIGH');
    const medium = bugs.filter(b => b.severity === 'MEDIUM');
    const low = bugs.filter(b => b.severity === 'LOW');

    console.log(`\nTotal: ${bugs.length} bugs`);
    console.log(`  CRITICAL: ${critical.length}`);
    console.log(`  HIGH: ${high.length}`);
    console.log(`  MEDIUM: ${medium.length}`);
    console.log(`  LOW: ${low.length}`);

    console.log('\n--- All bugs ---');
    for (const b of bugs) {
      console.log(`[${b.severity}] ${b.page}: ${b.desc}`);
    }
  }

  if (consoleErrors.length > 0) {
    console.log(`\n--- Console errors (${consoleErrors.length}) ---`);
    for (const e of consoleErrors) {
      console.log(`  ${e.url}: ${e.text}`);
    }
  }

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    bugs,
    consoleErrors,
    screenshotDir: OUT_DIR
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n📸 Screenshots saved to ${OUT_DIR}/`);
  console.log(`📄 Report saved to ${OUT_DIR}/report.json`);

  await browser.close();
}

main().catch(console.error);
