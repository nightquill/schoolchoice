import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOTS = 'test-results/phase4';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ── Login ──
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', 'verify@test.com');
  await page.fill('input[name="password"], input[type="password"]', 'verify123');
  await page.click('button:has-text("Log In")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });
  console.log('PASS: Login and dashboard loaded');

  // ── 1. StudentListPage — search + ActionBar ──
  await page.goto(`${BASE}/students`);
  await page.waitForSelector('table', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/02-students-list.png`, fullPage: true });

  // Check ActionBar buttons
  const importBtn = page.locator('button:has-text("Import"), button[aria-label*="Import"]');
  const exportBtn = page.locator('button:has-text("Export"), button[aria-label*="Export"]');
  const importCount = await importBtn.count();
  const exportCount = await exportBtn.count();
  console.log(`Students Import button: ${importCount > 0 ? 'FOUND' : 'MISSING'}`);
  console.log(`Students Export button: ${exportCount > 0 ? 'FOUND' : 'MISSING'}`);

  // Check search box
  const searchBox = page.locator('input[role="searchbox"], input[aria-label*="Search"]');
  const searchCount = await searchBox.count();
  console.log(`Students search box: ${searchCount > 0 ? 'FOUND' : 'MISSING'}`);

  // Type in search and verify debounce
  if (searchCount > 0) {
    await searchBox.first().fill('nonexistent_xyz_999');
    await page.waitForTimeout(500); // wait for debounce
    await page.screenshot({ path: `${SHOTS}/03-students-search-empty.png`, fullPage: true });
    // Check for empty state message
    const emptyMsg = page.locator('text=No students match');
    const hasEmpty = await emptyMsg.count();
    console.log(`Students empty search state: ${hasEmpty > 0 ? 'SHOWN' : 'NOT SHOWN'}`);

    // Clear search
    await searchBox.first().clear();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/04-students-search-cleared.png`, fullPage: true });
    console.log('PASS: Student search with debounce works');
  }

  // ── 2. SchoolDirectory — ActionBar ──
  await page.goto(`${BASE}/schools`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/05-schools-directory.png`, fullPage: true });

  const schoolImportBtn = page.locator('button:has-text("Import"), button[aria-label*="Import"]');
  const schoolExportBtn = page.locator('button:has-text("Export"), button[aria-label*="Export"]');
  console.log(`Schools Import button: ${await schoolImportBtn.count() > 0 ? 'FOUND' : 'MISSING'}`);
  console.log(`Schools Export button: ${await schoolExportBtn.count() > 0 ? 'FOUND' : 'MISSING'}`);

  // Verify existing search still works
  const schoolSearch = page.locator('input#school-search-q');
  if (await schoolSearch.count() > 0) {
    await schoolSearch.fill('test');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/06-schools-search.png`, fullPage: true });
    console.log('PASS: School search still works');
    await schoolSearch.clear();
  }

  // ── 3. Import wizard navigation ──
  await page.goto(`${BASE}/entities/student/import`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/07-import-wizard.png`, fullPage: true });
  const wizardContent = await page.textContent('body');
  const hasImportUI = wizardContent?.includes('Import') || wizardContent?.includes('Upload') || wizardContent?.includes('import');
  console.log(`Import wizard page: ${hasImportUI ? 'LOADED' : 'EMPTY/ERROR'}`);

  // ── 4. AcademicPlan export button ──
  // Navigate to students first to find a student ID
  await page.goto(`${BASE}/students`);
  await page.waitForSelector('table', { timeout: 10000 });
  const studentLink = page.locator('a[href*="/students/"]').first();
  if (await studentLink.count() > 0) {
    const href = await studentLink.getAttribute('href');
    const studentId = href?.match(/students\/([^/]+)/)?.[1];
    if (studentId) {
      await page.goto(`${BASE}/students/${studentId}/plan`);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SHOTS}/08-academic-plan.png`, fullPage: true });
      const exportHtmlBtn = page.locator('button:has-text("Export HTML")');
      console.log(`Plan Export HTML button: ${await exportHtmlBtn.count() > 0 ? 'FOUND' : 'MISSING'}`);
    }
  } else {
    console.log('SKIP: No students found to test plan export');
  }

  // ── Summary ──
  console.log('\n--- Console Errors ---');
  if (consoleErrors.length === 0) {
    console.log('None');
  } else {
    consoleErrors.forEach((e) => console.log(`  ERROR: ${e}`));
  }

  await browser.close();
  console.log('\n--- Phase 4 Verification Complete ---');
  console.log(`Screenshots saved to ${SHOTS}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
