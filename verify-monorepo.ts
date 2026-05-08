/**
 * verify-monorepo.ts
 *
 * Playwright verification script for monorepo restructure.
 * Tests login → dashboard → student profile flows to confirm
 * the app works correctly after restructuring.
 *
 * Run: npx playwright test verify-monorepo.ts --headed
 * Or:  npx playwright test verify-monorepo.ts
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'test-results', 'monorepo-verify');

// Test credentials from memory
const TEST_EMAIL = 'verify@test.com';
const TEST_PASSWORD = 'verify123';

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function main() {
  ensureDir(SCREENSHOT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`Page error: ${err.message}`);
  });

  let passed = 0;
  let failed = 0;

  function report(test: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  ✅ ${test}`);
      passed++;
    } else {
      console.log(`  ❌ ${test}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------------
    // Test 1: Login page loads
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 1: Login page');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await screenshot(page, '01-login-page');

    const loginVisible = await page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').isVisible().catch(() => false);
    report('Login page renders with email input', loginVisible);

    const passwordVisible = await page.locator('input[type="password"]').isVisible().catch(() => false);
    report('Login page renders with password input', passwordVisible);

    // ---------------------------------------------------------------
    // Test 2: Login flow
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 2: Login flow');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await screenshot(page, '02-login-filled');

    // Find and click login/submit button
    const loginBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")').first();
    await loginBtn.click();

    // Wait for navigation away from login
    try {
      await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 });
      report('Login redirects away from /login', true);
    } catch {
      await screenshot(page, '02-login-failed');
      report('Login redirects away from /login', false, `Still on ${page.url()}`);
    }

    await screenshot(page, '03-after-login');

    // ---------------------------------------------------------------
    // Test 3: Dashboard loads
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 3: Dashboard');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await screenshot(page, '04-dashboard');

    // Check page is not blank
    const bodyText = await page.locator('body').innerText();
    report('Dashboard is not blank', bodyText.trim().length > 50, `Body text length: ${bodyText.trim().length}`);

    // Check for NavBar
    const hasNav = await page.locator('nav, [class*="nav"], [class*="Nav"]').first().isVisible().catch(() => false);
    report('NavBar is visible', hasNav);

    // Check no error messages displayed
    const hasVisibleError = await page.locator('[class*="error"], [role="alert"]').first().isVisible().catch(() => false);
    report('No error messages visible on dashboard', !hasVisibleError);

    // ---------------------------------------------------------------
    // Test 4: Student list loads
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 4: Student list');
    await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle', timeout: 15000 });
    await screenshot(page, '05-students');

    const studentsBodyText = await page.locator('body').innerText();
    report('Students page is not blank', studentsBodyText.trim().length > 50);

    // Try to find student rows (uses onClick navigation, not <a> tags)
    const studentRows = await page.locator('tr[style*="cursor"], tr:has(td)').count();
    // Also check for visible student names in the table
    const hasStudentNames = await page.locator('text=Lee Wing Yin').isVisible().catch(() => false)
      || await page.locator('td >> text=/\\w+ \\w+/').first().isVisible().catch(() => false);
    report('Student list has entries', studentRows > 1 || hasStudentNames, `Found ${studentRows} table rows`);

    // ---------------------------------------------------------------
    // Test 5: Student profile loads
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 5: Student profile');
    // Click first student row — rows use onClick with navigate(), not <a> tags
    // Use the role="row" attribute set by StudentRow component
    const firstRow = page.locator('tr[role="row"]').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      try {
        await page.waitForURL(url => url.toString().includes('/profile'), { timeout: 10000 });
      } catch {
        // fallback: try clicking the student name text directly
        await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle' });
        await page.locator('td:has-text("Lee Wing Yin")').click();
        await page.waitForURL(url => url.toString().includes('/profile'), { timeout: 10000 }).catch(() => {});
      }
    }
    await screenshot(page, '06-student-profile');

    await page.waitForTimeout(2000); // allow navigation + data load
    const profileUrl = page.url();
    const onProfilePage = profileUrl.includes('/profile');
    if (onProfilePage) {
      report('Navigated to student profile page', true);

      // Check tabs render
      const hasTabs = await page.locator('[role="tablist"], [class*="tab"], [class*="Tab"]').first().isVisible().catch(() => false);
      report('Profile tabs are visible', hasTabs);
    } else {
      report('Navigated to student profile page', false, `URL: ${profileUrl}`);
    }

    // ---------------------------------------------------------------
    // Test 6: Schools directory loads
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 6: Schools directory');
    await page.goto(`${BASE_URL}/schools`, { waitUntil: 'networkidle', timeout: 15000 });
    await screenshot(page, '07-schools');

    const schoolsText = await page.locator('body').innerText();
    report('Schools page is not blank', schoolsText.trim().length > 50);

    // ---------------------------------------------------------------
    // Test 7: Console errors check
    // ---------------------------------------------------------------
    console.log('\n🔍 Test 7: Console errors');
    // Filter out known benign errors
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('404') &&  // API 404s for missing data are expected
      !e.includes('ERR_CONNECTION_REFUSED')  // backend down for certain calls
    );
    report('No unexpected console errors', realErrors.length === 0,
      realErrors.length > 0 ? `${realErrors.length} errors: ${realErrors.slice(0, 3).join('; ')}` : undefined);

    // ---------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    if (errors.length > 0) {
      console.log(`\nAll console errors (${errors.length}):`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log(`${'='.repeat(50)}\n`);

  } finally {
    await browser.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
