/**
 * Phase 3 Frontend Stabilization — Playwright Visual Verification
 *
 * Verifies: login, dashboard (desktop+mobile), StudentProfile tabs,
 * entity pages, hamburger nav, responsive layouts.
 *
 * Test credentials: verify@test.com / verify123
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = __dirname;
const BASE_URL = 'http://localhost:5173';
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ': ' + detail : ''}`);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── 1. LOGIN ──────────────────────────────────────────────────────────
  console.log('\n=== 1. Login ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await screenshot(page, '01-login-page');

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passInput = page.locator('input[type="password"], input[name="password"]');

  if (await emailInput.count() > 0) {
    await emailInput.fill('verify@test.com');
    await passInput.fill('verify123');
    await page.locator('button[type="submit"], button:has-text("Log")').first().click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  const atDashboard = page.url().includes('dashboard');
  record('Login and redirect to dashboard', atDashboard, page.url());
  await screenshot(page, '02-dashboard-desktop');

  // ── 2. DASHBOARD DESKTOP ──────────────────────────────────────────────
  console.log('\n=== 2. Dashboard Desktop ===');

  // Check for metric cards
  const cards = await page.locator('[class*="grid"] [class*="Card"], [class*="grid"] .rounded-lg').count()
    .catch(() => 0);
  const gridEl = page.locator('[class*="grid-cols"]').first();
  const hasGrid = await gridEl.count() > 0;
  record('Dashboard has responsive grid', hasGrid);

  // Check NavBar has links visible
  const navLinks = await page.locator('nav a, nav [role="link"]').count();
  record('NavBar shows links on desktop', navLinks > 3, `${navLinks} links found`);

  // ── 3. DASHBOARD MOBILE ───────────────────────────────────────────────
  console.log('\n=== 3. Dashboard Mobile (375px) ===');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await screenshot(page, '03-dashboard-mobile');

  // Check for hamburger icon
  const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]');
  const hamburgerVisible = await hamburger.count() > 0 && await hamburger.first().isVisible();
  record('Hamburger menu visible on mobile', hamburgerVisible);

  // Check no horizontal overflow
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = 375;
  record('No horizontal overflow at 375px (dashboard)', bodyWidth <= viewportWidth + 5,
    `body: ${bodyWidth}px, viewport: ${viewportWidth}px`);

  // ── 4. HAMBURGER NAV ──────────────────────────────────────────────────
  console.log('\n=== 4. Hamburger Nav ===');
  if (hamburgerVisible) {
    await hamburger.first().click();
    await page.waitForTimeout(500);
    await screenshot(page, '04-hamburger-menu-open');

    const mobileMenu = page.locator('[style*="position: absolute"], [style*="z-index: 50"]');
    const menuVisible = await mobileMenu.count() > 0;
    record('Mobile menu opens on hamburger click', menuVisible);

    // Check Dashboard link in mobile menu
    const dashLink = page.locator('a:has-text("Dashboard")');
    const dashVisible = await dashLink.first().isVisible().catch(() => false);
    record('Dashboard link in mobile menu', dashVisible);

    // Close menu
    await hamburger.first().click();
    await page.waitForTimeout(300);
  }

  // ── 5. STUDENT PROFILE + TABS ─────────────────────────────────────────
  console.log('\n=== 5. Student Profile ===');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);

  // Navigate to student list
  await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, '05-student-list');

  // Click first student to open profile
  const studentRow = page.locator('tr[style*="cursor"], table tbody tr, [role="row"]').first();
  if (await studentRow.count() > 0) {
    await studentRow.click();
    await page.waitForTimeout(2000);
  } else {
    // Try direct navigation
    await page.goto(`${BASE_URL}/students/1/profile`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await screenshot(page, '06-student-profile-desktop');

  const profileUrl = page.url();
  const onProfile = profileUrl.includes('student') && profileUrl.includes('profile');
  record('Student profile page loaded', onProfile, profileUrl);

  // Check all 7 tab labels
  const tabLabels = ['Personal', 'Grades', 'Language', 'Teacher Evaluations', 'Activities', 'Notes', 'Plans'];
  for (const label of tabLabels) {
    const tab = page.locator(`[role="tab"]:has-text("${label}"), button:has-text("${label}"), [data-state]:has-text("${label}")`);
    const found = await tab.count() > 0;
    record(`Tab "${label}" present`, found);
  }

  // Click Grades tab
  const gradesTab = page.locator('[role="tab"]:has-text("Grades"), button:has-text("Grades")').first();
  if (await gradesTab.count() > 0) {
    await gradesTab.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '07-student-profile-grades-tab');
    record('Grades tab clickable', true);
  }

  // ── 6. STUDENT PROFILE MOBILE ─────────────────────────────────────────
  console.log('\n=== 6. Student Profile Mobile ===');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await screenshot(page, '08-student-profile-mobile');

  // Check tab bar is scrollable (overflow-x-auto)
  const tabBar = page.locator('[class*="overflow-x-auto"], [style*="overflow-x"]').first();
  const tabBarExists = await tabBar.count() > 0;
  record('Tab bar scrollable on mobile', tabBarExists);

  const profileBodyWidth = await page.evaluate(() => document.body.scrollWidth);
  record('No horizontal overflow at 375px (profile)', profileBodyWidth <= 380,
    `body: ${profileBodyWidth}px`);

  // ── 7. ENTITY PAGES ───────────────────────────────────────────────────
  console.log('\n=== 7. Entity Pages ===');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Try navigating to an entity list page
  await page.goto(`${BASE_URL}/entities/student`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, '09-entity-list-page');

  const entityPageLoaded = !page.url().includes('login');
  record('Entity list page loads (protected)', entityPageLoaded, page.url());

  // ── 8. SHADCN COMPONENTS VISUAL CHECK ─────────────────────────────────
  console.log('\n=== 8. shadcn Components ===');

  // Back to dashboard to check Card components
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Check for shadcn-style elements (rounded borders, consistent styling)
  const shadcnCards = await page.locator('.rounded-lg, .rounded-xl, [class*="card"]').count();
  record('shadcn Card components rendered', shadcnCards > 0, `${shadcnCards} card-styled elements`);

  await screenshot(page, '10-dashboard-final');

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n\n========== VERIFICATION SUMMARY ==========');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${results.length}`);
  console.log('');
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}`);
  }
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
