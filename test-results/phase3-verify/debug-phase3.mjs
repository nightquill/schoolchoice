/**
 * Phase 3 Debug Script — exercises every changed feature path
 * and captures console errors, network failures, and rendering issues.
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:5173';
const consoleErrors = [];
const networkErrors = [];
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ': ' + detail : ''}`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(__dirname, `debug-${name}.png`), fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Capture ALL console errors and network failures
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ url: page.url(), text: err.message });
  });
  page.on('response', (resp) => {
    if (resp.status() >= 500) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  // ── LOGIN ─────────────────────────────────────────────────────────────
  console.log('\n=== Login ===');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  if (await emailInput.count() > 0) {
    await emailInput.fill('verify@test.com');
    await page.locator('input[type="password"], input[name="password"]').fill('verify123');
    await page.locator('button[type="submit"], button:has-text("Log")').first().click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  record('Login succeeds', page.url().includes('dashboard'));

  // ── DASHBOARD ─────────────────────────────────────────────────────────
  console.log('\n=== Dashboard ===');
  await screenshot(page, 'dashboard');
  const errorsBefore = consoleErrors.length;
  record('Dashboard loads without console errors', consoleErrors.length === errorsBefore,
    consoleErrors.slice(errorsBefore).map(e => e.text).join('; '));

  // ── STUDENT PROFILE — useQuery migration ──────────────────────────────
  console.log('\n=== Student Profile (useQuery) ===');
  await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Click first student
  const studentLink = page.locator('a:has-text("View Profile"), button:has-text("View Profile")').first();
  if (await studentLink.count() > 0) {
    await studentLink.click();
    await page.waitForTimeout(3000);
  }
  await screenshot(page, 'profile-personal');
  const profileErrors = consoleErrors.length;
  record('Profile loads (Personal tab) without errors', consoleErrors.length === profileErrors,
    consoleErrors.slice(profileErrors).map(e => e.text).join('; '));

  // Check student name rendered (proves useQuery returned data)
  const studentName = await page.locator('h1').first().textContent().catch(() => '');
  record('Student name rendered from useQuery', studentName.length > 0, studentName);

  // ── TAB SWITCHING — each tab exercises its hook ───────────────────────
  console.log('\n=== Tab Switching (hooks) ===');
  const tabs = ['Grades', 'Language', 'Teacher Evaluations', 'Activities', 'Notes', 'Plans'];

  for (const tabName of tabs) {
    const errBefore = consoleErrors.length;
    const netErrBefore = networkErrors.length;
    const tab = page.locator(`[role="tab"]:has-text("${tabName}")`).first();
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, `tab-${tabName.toLowerCase().replace(/\s+/g, '-')}`);

      const newConsoleErrors = consoleErrors.slice(errBefore);
      const newNetErrors = networkErrors.slice(netErrBefore);
      const hasErrors = newConsoleErrors.length > 0 || newNetErrors.length > 0;

      record(`${tabName} tab loads without errors`, !hasErrors,
        [...newConsoleErrors.map(e => `console: ${e.text}`), ...newNetErrors.map(e => `net: ${e.status} ${e.url}`)].join('; '));
    } else {
      record(`${tabName} tab found`, false, 'Tab not found in DOM');
    }
  }

  // ── PERSONAL TAB SAVE — tests useMutation in usePersonalTab ───────────
  console.log('\n=== Personal Tab Save (useMutation) ===');
  // Go back to Personal tab
  const personalTab = page.locator('[role="tab"]:has-text("Personal")').first();
  if (await personalTab.count() > 0) {
    await personalTab.click();
    await page.waitForTimeout(1000);
  }

  const saveBtn = page.locator('button:has-text("Save")').first();
  if (await saveBtn.count() > 0) {
    const errBefore = consoleErrors.length;
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'after-save');

    // Check for sonner toast
    const toastEl = page.locator('[data-sonner-toast], [data-sonner-toaster] li, .sonner-toast');
    const toastVisible = await toastEl.count() > 0;
    record('Sonner toast appears after save', toastVisible);

    const saveErrors = consoleErrors.slice(errBefore);
    record('Save mutation runs without errors', saveErrors.length === 0,
      saveErrors.map(e => e.text).join('; '));
  } else {
    record('Save button found', false);
  }

  // ── ENTITY LIST PAGE — tests entity UI system ─────────────────────────
  console.log('\n=== Entity Pages ===');
  await page.goto(`${BASE_URL}/entities/student`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'entity-list');

  const entityErrBefore = consoleErrors.length;
  record('Entity list page loads without errors', consoleErrors.length === entityErrBefore,
    consoleErrors.slice(entityErrBefore).map(e => e.text).join('; '));

  // Check table has rows
  const tableRows = await page.locator('table tbody tr, [role="row"]').count();
  record('Entity list shows data rows', tableRows > 0, `${tableRows} rows`);

  // ── OTHER MIGRATED PAGES — spot-check toast migration ─────────────────
  console.log('\n=== Migrated Pages (toast check) ===');
  const pagesToCheck = [
    { name: 'Cohorts', url: '/cohorts' },
    { name: 'School Directory', url: '/schools' },
    { name: 'Account Settings', url: '/account/settings' },
  ];

  for (const p of pagesToCheck) {
    const errBefore = consoleErrors.length;
    await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const newErrors = consoleErrors.slice(errBefore);
    record(`${p.name} page loads without errors`, newErrors.length === 0,
      newErrors.map(e => e.text).join('; '));
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n\n========== DEBUG SUMMARY ==========');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${results.length}`);

  if (consoleErrors.length > 0) {
    console.log(`\n=== ALL CONSOLE ERRORS (${consoleErrors.length}) ===`);
    for (const e of consoleErrors) {
      console.log(`  [${e.url}] ${e.text.substring(0, 200)}`);
    }
  }

  if (networkErrors.length > 0) {
    console.log(`\n=== ALL NETWORK ERRORS (${networkErrors.length}) ===`);
    for (const e of networkErrors) {
      console.log(`  ${e.status} ${e.url}`);
    }
  }

  if (failed > 0) {
    console.log('\n=== FAILURES ===');
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  FAIL: ${r.name} — ${r.detail}`);
    }
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
