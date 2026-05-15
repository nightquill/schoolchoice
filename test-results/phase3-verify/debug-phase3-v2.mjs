/**
 * Phase 3 Debug v2 — direct navigation to student profile,
 * exercises every tab hook + save mutation + entity pages.
 * Captures console errors at each boundary.
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
  await page.screenshot({ path: path.join(__dirname, `debug2-${name}.png`), fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

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

  // Navigate to student list and get first student's ID
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Find View Profile link on dashboard
  const viewProfileBtn = page.locator('a:has-text("View Profile"), button:has-text("View Profile")').first();
  let studentProfileUrl = null;
  if (await viewProfileBtn.count() > 0) {
    studentProfileUrl = await viewProfileBtn.getAttribute('href');
  }

  // Fallback: click the first student card to navigate
  if (!studentProfileUrl) {
    if (await viewProfileBtn.count() > 0) {
      await viewProfileBtn.click();
      await page.waitForTimeout(2000);
      studentProfileUrl = new URL(page.url()).pathname;
    }
  }

  // If click navigated us, use current URL
  if (!studentProfileUrl && page.url().includes('/profile')) {
    studentProfileUrl = new URL(page.url()).pathname;
  }
  // Last resort: click through the View Profile button directly
  if (!studentProfileUrl && await viewProfileBtn.count() > 0) {
    await viewProfileBtn.click();
    await page.waitForTimeout(3000);
    if (page.url().includes('/profile')) {
      studentProfileUrl = new URL(page.url()).pathname;
    }
  }

  record('Found student profile URL', !!studentProfileUrl, studentProfileUrl || page.url());

  if (!studentProfileUrl) {
    console.log('WARN: Skipping profile tests — no student found');
    // Jump to entity page tests
  }

  // ── STUDENT PROFILE — useQuery for student data ───────────────────────
  console.log('\n=== Student Profile (useQuery) ===');
  const errBefore = consoleErrors.length;
  await page.goto(`${BASE_URL}${studentProfileUrl}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await screenshot(page, 'profile-loaded');

  const profileErrors = consoleErrors.slice(errBefore);
  record('Profile page loads without console errors', profileErrors.length === 0,
    profileErrors.map(e => e.text.substring(0, 150)).join('; '));

  // Verify student name from useQuery
  const h1 = await page.locator('h1').first().textContent().catch(() => '');
  record('Student name rendered (useQuery returned data)', h1.length > 2 && h1 !== 'Students', h1);

  // Verify QueryBoundary not showing error
  const errorAlert = await page.locator('[role="alert"]').count();
  const loadingSpinner = await page.locator('[role="status"]').count();
  record('No error/loading state visible', errorAlert === 0 && loadingSpinner === 0);

  // ── TAB SWITCHING — exercises each hook ───────────────────────────────
  console.log('\n=== Tab Switching ===');
  const tabTests = [
    { name: 'Grades', checkFor: 'table, [class*="grade"], h2, h3' },
    { name: 'Language', checkFor: 'input, select, label' },
    { name: 'Teacher Evaluations', checkFor: 'button, [class*="eval"], h2, h3' },
    { name: 'Activities', checkFor: 'button, input, h2, h3' },
    { name: 'Notes', checkFor: 'textarea, input' },
    { name: 'Plans', checkFor: 'button, [class*="plan"], h2, h3, p' },
  ];

  for (const t of tabTests) {
    const before = consoleErrors.length;
    const tab = page.locator(`[role="tab"]:has-text("${t.name}")`).first();
    if (await tab.count() === 0) {
      record(`${t.name} tab: found in DOM`, false, 'role="tab" not found');
      continue;
    }
    await tab.click();
    await page.waitForTimeout(2000);
    await screenshot(page, `tab-${t.name.toLowerCase().replace(/\s+/g, '-')}`);

    const tabErrors = consoleErrors.slice(before);
    record(`${t.name} tab: loads without errors`, tabErrors.length === 0,
      tabErrors.map(e => e.text.substring(0, 150)).join('; '));

    // Check tab content rendered something
    const content = await page.locator(`${t.checkFor}`).count();
    record(`${t.name} tab: has content`, content > 0, `${content} elements`);
  }

  // ── PERSONAL TAB SAVE — tests useMutation ─────────────────────────────
  console.log('\n=== Personal Tab Save (useMutation) ===');
  const personalTab = page.locator('[role="tab"]:has-text("Personal")').first();
  await personalTab.click();
  await page.waitForTimeout(1500);

  const saveBtn = page.locator('button:has-text("Save")').first();
  if (await saveBtn.count() > 0 && await saveBtn.isVisible()) {
    const before = consoleErrors.length;
    const netBefore = networkErrors.length;
    await saveBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'after-save');

    const saveErrors = consoleErrors.slice(before);
    const saveNetErrors = networkErrors.slice(netBefore);
    record('Save mutation: no console errors', saveErrors.length === 0,
      saveErrors.map(e => e.text.substring(0, 150)).join('; '));
    record('Save mutation: no 500 errors', saveNetErrors.length === 0,
      saveNetErrors.map(e => `${e.status} ${e.url}`).join('; '));

    // Check for sonner toast
    await page.waitForTimeout(500);
    const toasts = await page.locator('[data-sonner-toast], [data-sonner-toaster] li').count();
    record('Sonner toast appeared after save', toasts > 0, `${toasts} toast(s)`);
  } else {
    record('Save button found and visible', false);
  }

  // ── ENTITY LIST PAGE — verify button nesting fixed ────────────────────
  console.log('\n=== Entity Page (button nesting fix) ===');
  const entityBefore = consoleErrors.length;
  await page.goto(`${BASE_URL}/entities/student`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'entity-list');

  const entityErrors = consoleErrors.slice(entityBefore);
  const buttonNestingError = entityErrors.find(e => e.text.includes('cannot be a descendant') || e.text.includes('cannot contain'));
  record('Entity page: no button nesting error', !buttonNestingError,
    buttonNestingError?.text?.substring(0, 150) || '');

  const asChildError = entityErrors.find(e => e.text.includes('asChild'));
  record('Entity page: no asChild prop warning', !asChildError,
    asChildError?.text?.substring(0, 150) || '');

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n\n========== DEBUG v2 SUMMARY ==========');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${results.length}`);

  if (consoleErrors.length > 0) {
    console.log(`\n=== ALL CONSOLE ERRORS (${consoleErrors.length}) ===`);
    for (const e of consoleErrors) {
      console.log(`  [${e.url}] ${e.text.substring(0, 200)}`);
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
