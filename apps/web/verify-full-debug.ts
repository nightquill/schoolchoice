import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOTS = 'test-results/debug';

interface Finding {
  page: string;
  severity: 'BUG' | 'WARN' | 'INFO';
  description: string;
  evidence: string;
}

const findings: Finding[] = [];
const consoleErrors: { page: string; msg: string }[] = [];

function bug(page: string, description: string, evidence: string) {
  findings.push({ page, severity: 'BUG', description, evidence });
  console.log(`  BUG: ${description}`);
}
function warn(page: string, description: string, evidence: string) {
  findings.push({ page, severity: 'WARN', description, evidence });
  console.log(`  WARN: ${description}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  let currentRoute = '';
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: currentRoute, msg: msg.text() });
    }
  });

  page.on('response', (resp) => {
    if (resp.status() >= 500) {
      bug(currentRoute, `Server error ${resp.status()} on ${resp.url()}`, `${resp.status()}`);
    }
  });

  // ── Login ──
  currentRoute = '/login';
  console.log('\n=== Login ===');
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button:has-text("Log In")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('  OK: Login successful');

  // ── Dashboard ──
  currentRoute = '/dashboard';
  console.log('\n=== Dashboard ===');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });
  // Check for broken links / empty sections
  const dashCards = await page.locator('[class*="card"], [style*="border-radius"]').count();
  console.log(`  Cards/sections found: ${dashCards}`);

  // ── Student List ──
  currentRoute = '/students';
  console.log('\n=== Student List ===');
  await page.goto(`${BASE}/students`);
  await page.waitForSelector('table', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/02-students.png`, fullPage: true });
  const studentRows = await page.locator('tbody tr').count();
  console.log(`  Student rows: ${studentRows}`);

  // Test Import button navigation
  const importBtn = page.locator('button:has-text("Import Data"), button[aria-label*="Import"]');
  if (await importBtn.count() > 0) {
    await importBtn.first().click();
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!url.includes('/entities/student/import')) {
      bug('/students', 'Import button does not navigate to import wizard', `Navigated to: ${url}`);
    } else {
      console.log('  OK: Import button navigates correctly');
    }
    await page.screenshot({ path: `${SHOTS}/03-import-wizard-from-students.png`, fullPage: true });
    await page.goBack();
    await page.waitForSelector('table', { timeout: 5000 });
  } else {
    bug('/students', 'Import button not found', 'No button matching Import Data or aria-label Import');
  }

  // Test search
  const searchBox = page.locator('input[role="searchbox"]');
  if (await searchBox.count() > 0) {
    // Search for existing student
    const firstStudentName = await page.locator('tbody tr td:first-child').first().textContent();
    if (firstStudentName) {
      const searchTerm = firstStudentName.split(' ')[0]; // First word of name
      await searchBox.fill(searchTerm);
      await page.waitForTimeout(500);
      const filteredRows = await page.locator('tbody tr').count();
      // Should have at least 1 result
      const hasResults = filteredRows > 0;
      // Check for loading/empty states that contain the search term
      const bodyText = await page.locator('tbody').textContent();
      if (!hasResults || bodyText?.includes('No students match')) {
        bug('/students', `Search for "${searchTerm}" returned no results but student exists`, `Body: ${bodyText?.slice(0, 100)}`);
      } else {
        console.log(`  OK: Search "${searchTerm}" returned ${filteredRows} rows`);
      }
      await searchBox.clear();
      await page.waitForTimeout(500);
    }
  }

  // ── Student Profile ──
  currentRoute = '/students/:id/profile';
  console.log('\n=== Student Profile ===');
  const studentLink = page.locator('a[href*="/students/"]').first();
  let studentId: string | null = null;
  if (await studentLink.count() > 0) {
    const href = await studentLink.getAttribute('href');
    studentId = href?.match(/students\/([^/]+)/)?.[1] ?? null;
    await studentLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/04-student-profile.png`, fullPage: true });

    // Check tabs render
    const tabs = await page.locator('[role="tab"], button[data-state]').count();
    const tabTexts = await page.locator('[role="tab"], button[data-state]').allTextContents();
    console.log(`  Tabs found: ${tabs} — ${tabTexts.join(', ')}`);

    // Click each tab and check for errors
    for (const tabText of ['Personal', 'Grades', 'Language', 'Activities', 'Notes', 'Plans']) {
      const tab = page.locator(`[role="tab"]:has-text("${tabText}"), button:has-text("${tabText}")`).first();
      if (await tab.count() > 0) {
        await tab.click();
        await page.waitForTimeout(500);
        const tabScreenshot = `${SHOTS}/05-tab-${tabText.toLowerCase()}.png`;
        await page.screenshot({ path: tabScreenshot, fullPage: true });
        // Check if tab content loaded (not empty/error)
        const contentArea = page.locator('main, [role="tabpanel"], .tab-content').first();
        if (await contentArea.count() > 0) {
          const text = await contentArea.textContent();
          if (text && text.includes('Error')) {
            bug(`/students/:id/profile#${tabText}`, `${tabText} tab shows error`, text.slice(0, 200));
          }
        }
      } else {
        warn('/students/:id/profile', `Tab "${tabText}" not found`, '');
      }
    }
  }

  // ── School Directory ──
  currentRoute = '/schools';
  console.log('\n=== School Directory ===');
  await page.goto(`${BASE}/schools`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/06-schools.png`, fullPage: true });
  const schoolCards = await page.locator('[role="listitem"]').count();
  console.log(`  School cards: ${schoolCards}`);

  // Test type filter
  const typeSelect = page.locator('#school-search-type');
  if (await typeSelect.count() > 0) {
    await typeSelect.selectOption('POLYTECHNIC');
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SHOTS}/07-schools-filtered.png`, fullPage: true });
    const filteredCards = await page.locator('[role="listitem"]').count();
    console.log(`  Filtered by POLYTECHNIC: ${filteredCards} cards`);
    // Reset
    await typeSelect.selectOption('');
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1000);
  }

  // ── School Profile ──
  currentRoute = '/schools/:id';
  console.log('\n=== School Profile ===');
  const schoolLink = page.locator('a[href*="/schools/"]').first();
  if (await schoolLink.count() > 0) {
    await schoolLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/08-school-profile.png`, fullPage: true });
    const profileContent = await page.textContent('body');
    if (profileContent?.includes('Error') || profileContent?.includes('not found')) {
      bug('/schools/:id', 'School profile shows error', profileContent.slice(0, 200));
    } else {
      console.log('  OK: School profile loaded');
    }
  }

  // ── Target Schools ──
  if (studentId) {
    currentRoute = `/students/${studentId}/targets`;
    console.log('\n=== Target Schools ===');
    await page.goto(`${BASE}/students/${studentId}/targets`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/09-targets.png`, fullPage: true });
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('Error') && !bodyText?.includes('No target')) {
      bug('/students/:id/targets', 'Target schools page error', bodyText.slice(0, 200));
    } else {
      console.log('  OK: Target schools page loaded');
    }
  }

  // ── Academic Plan ──
  if (studentId) {
    currentRoute = `/students/${studentId}/plan`;
    console.log('\n=== Academic Plan ===');
    await page.goto(`${BASE}/students/${studentId}/plan`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/10-plan.png`, fullPage: true });
    // Check Export HTML button
    const exportBtn = page.locator('button:has-text("Export HTML")');
    console.log(`  Export HTML button: ${await exportBtn.count() > 0 ? 'FOUND' : 'MISSING'}`);
    // Check template selector
    const templateBtns = page.locator('button:has-text("Professional"), button:has-text("Modern"), button:has-text("Minimal")');
    console.log(`  Template buttons: ${await templateBtns.count()}`);
  }

  // ── Cohorts ──
  currentRoute = '/cohorts';
  console.log('\n=== Cohorts ===');
  await page.goto(`${BASE}/cohorts`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/11-cohorts.png`, fullPage: true });
  const cohortContent = await page.textContent('body');
  console.log(`  Page loaded: ${cohortContent?.length ?? 0} chars`);

  // ── Account Settings ──
  currentRoute = '/account/settings';
  console.log('\n=== Account Settings ===');
  await page.goto(`${BASE}/account/settings`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/12-account-settings.png`, fullPage: true });

  // ── Admin Settings ──
  currentRoute = '/settings';
  console.log('\n=== Admin Settings ===');
  await page.goto(`${BASE}/settings`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/13-admin-settings.png`, fullPage: true });
  // Check if redirected (non-admin user)
  if (page.url().includes('/dashboard')) {
    console.log('  OK: Non-admin redirected to dashboard');
  } else {
    console.log(`  Current URL: ${page.url()}`);
  }

  // ── Data Analysis ──
  currentRoute = '/data-analysis';
  console.log('\n=== Data Analysis ===');
  await page.goto(`${BASE}/data-analysis`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/14-data-analysis.png`, fullPage: true });

  // ── Import Wizard (school) ──
  currentRoute = '/entities/school/import';
  console.log('\n=== Import Wizard (school) ===');
  await page.goto(`${BASE}/entities/school/import`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/15-import-school.png`, fullPage: true });
  const wizardText = await page.textContent('body');
  if (wizardText?.includes('Import') && wizardText?.includes('Upload')) {
    console.log('  OK: School import wizard loaded');
  } else {
    bug('/entities/school/import', 'School import wizard failed to load', wizardText?.slice(0, 200) ?? '');
  }

  // ── Consultant Task ──
  if (studentId) {
    currentRoute = `/students/${studentId}/consultant`;
    console.log('\n=== Consultant Task ===');
    await page.goto(`${BASE}/students/${studentId}/consultant`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/16-consultant.png`, fullPage: true });
    console.log('  Page loaded');
  }

  // ── Mobile viewport check (375px) ──
  console.log('\n=== Mobile Viewport (375px) ===');
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto(`${BASE}/students`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/17-mobile-students.png`, fullPage: true });
  // Check for horizontal overflow
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hasOverflow) {
    bug('/students (mobile)', 'Horizontal overflow at 375px', `scrollWidth > clientWidth`);
  } else {
    console.log('  OK: No horizontal overflow on students');
  }

  await page.goto(`${BASE}/schools`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/18-mobile-schools.png`, fullPage: true });
  const schoolsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (schoolsOverflow) {
    bug('/schools (mobile)', 'Horizontal overflow at 375px', `scrollWidth > clientWidth`);
  } else {
    console.log('  OK: No horizontal overflow on schools');
  }

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 800 });

  // ── Summary ──
  console.log('\n\n========================================');
  console.log('           DEBUG REPORT');
  console.log('========================================\n');

  const bugs = findings.filter(f => f.severity === 'BUG');
  const warns = findings.filter(f => f.severity === 'WARN');

  console.log(`BUGS: ${bugs.length}`);
  bugs.forEach((b, i) => console.log(`  ${i + 1}. [${b.page}] ${b.description}\n     Evidence: ${b.evidence}`));

  console.log(`\nWARNINGS: ${warns.length}`);
  warns.forEach((w, i) => console.log(`  ${i + 1}. [${w.page}] ${w.description}`));

  console.log(`\nCONSOLE ERRORS: ${consoleErrors.length}`);
  // Deduplicate
  const unique = [...new Set(consoleErrors.map(e => `[${e.page}] ${e.msg}`))];
  unique.forEach((e) => console.log(`  ${e}`));

  console.log(`\nScreenshots saved to ${SHOTS}/`);

  await browser.close();

  // Exit with error code if bugs found
  if (bugs.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
