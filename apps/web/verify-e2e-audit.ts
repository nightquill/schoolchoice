import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/e2e-audit');

interface Finding {
  page: string;
  severity: 'ERROR' | 'WARN' | 'INFO';
  issue: string;
}

const findings: Finding[] = [];
const jsErrors: string[] = [];

function fail(page: string, issue: string) { findings.push({ page, severity: 'ERROR', issue }); }
function warn(page: string, issue: string) { findings.push({ page, severity: 'WARN', issue }); }
function info(page: string, issue: string) { findings.push({ page, severity: 'INFO', issue }); }

async function checkPage(page: Page, name: string, url: string, checks: (p: Page) => Promise<void>) {
  jsErrors.length = 0;
  await page.goto(`${BASE}${url}`);
  await page.waitForTimeout(2500);
  
  // Check for blank page
  const rootHtml = await page.locator('#root').innerHTML().catch(() => '');
  if (rootHtml.length < 50) {
    fail(name, 'BLANK PAGE — #root has no content');
    await page.screenshot({ path: path.join(DIR, `${name}-BLANK.png`) });
    return;
  }
  
  // Check for JS errors
  if (jsErrors.length > 0) {
    jsErrors.forEach(e => fail(name, `JS ERROR: ${e.slice(0, 150)}`));
  }
  
  // Check for raw i18n keys visible on page
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const rawKeyMatches = bodyText.match(/\b(nav|auth|dashboard|profile|grades|submissions|alerts|cohorts|plans|targets|programmes|analytics|settings|common|sfInstitution|recommendations|entityList|studentList|schoolProfile)\.\w+\b/g);
  if (rawKeyMatches && rawKeyMatches.length > 0) {
    const unique = [...new Set(rawKeyMatches)];
    fail(name, `RAW I18N KEYS visible: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? ` (+${unique.length - 5} more)` : ''}`);
  }
  
  // Check for "undefined", "[object Object]", "NaN" in visible text
  if (bodyText.includes('undefined') && !bodyText.includes('is undefined')) {
    warn(name, 'Text "undefined" visible on page');
  }
  if (bodyText.includes('[object Object]')) {
    fail(name, '"[object Object]" visible on page');
  }
  if (/\bNaN\b/.test(bodyText)) {
    fail(name, '"NaN" visible on page');
  }
  
  // Run page-specific checks
  await checks(page);
  
  await page.screenshot({ path: path.join(DIR, `${name}.png`) });
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('404')) jsErrors.push(msg.text()); });

  // === LOGIN ===
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email', { timeout: 10000 });
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);
  info('login', 'Login successful');

  // === 1. DASHBOARD ===
  await checkPage(page, '01-dashboard', '/dashboard', async (p) => {
    // Metric cards present with numbers
    const cards = p.locator('[role="region"][aria-label="Summary statistics"] > *');
    const cardCount = await cards.count();
    if (cardCount < 3) fail('01-dashboard', `Only ${cardCount} metric cards (expected ≥3)`);
    
    // Check pending submissions is NOT 0 when submissions exist
    const pendingCard = await p.locator('text=/Pending Submissions/').first().evaluate(el => {
      const card = el.closest('a') || el.closest('div');
      return card?.innerText || '';
    }).catch(() => '');
    if (pendingCard.includes('\n0\n') || pendingCard.match(/\n0$/)) {
      warn('01-dashboard', 'Pending Submissions shows 0');
    }
    
    // Alerts section exists
    const alerts = await p.locator('[role="region"][aria-label="Alerts"]').count();
    if (alerts === 0) warn('01-dashboard', 'No Alerts section');
    
    // Student Data Import title
    const importTitle = await p.locator('h2:has-text("Student Data Import"), h2:has-text("學生資料匯入")').count();
    if (importTitle === 0) warn('01-dashboard', 'Student Data Import title missing');
    
    // Search input present below cohorts
    const searchInput = await p.locator('input[name="student-search"]').count();
    if (searchInput === 0) fail('01-dashboard', 'Search input missing');
    
    // Cohort cards present
    const cohortCards = await p.locator('[role="list"][aria-label="Cohort list"] [role="listitem"]').count();
    if (cohortCards === 0) warn('01-dashboard', 'No cohort cards');
    else info('01-dashboard', `${cohortCards} cohort cards`);
    
    // Clickable metric cards
    const plansLink = await p.locator('a[href="/analytics/plans"]').count();
    const subsLink = await p.locator('a[href="/submissions"]').count();
    if (plansLink === 0) fail('01-dashboard', 'Plans Generated card not clickable');
    if (subsLink === 0) fail('01-dashboard', 'Pending Submissions card not clickable');
  });

  // === 2. SUBMISSIONS (merged with chart) ===
  await checkPage(page, '02-submissions', '/submissions', async (p) => {
    const chart = await p.locator('.recharts-responsive-container').count();
    if (chart === 0) fail('02-submissions', 'Submission history chart missing');
    
    const pendingHeading = await p.locator('h2:has-text("Pending")').count();
    if (pendingHeading === 0) warn('02-submissions', 'Pending Submissions heading missing');
    
    // Table with data
    const rows = await p.locator('table tbody tr').count();
    info('02-submissions', `${rows} pending submission rows`);
    
    // Granularity toggle
    const dailyBtn = await p.locator('button[aria-pressed]').count();
    if (dailyBtn === 0) warn('02-submissions', 'No granularity toggle buttons');
  });

  // === 3. PLANS ANALYTICS ===
  await checkPage(page, '03-plans-analytics', '/analytics/plans', async (p) => {
    const chart = await p.locator('.recharts-responsive-container').count();
    if (chart === 0) fail('03-plans-analytics', 'Plan history chart missing');
    
    const missingList = await p.locator('h2:has-text("Missing Plan")').count();
    if (missingList === 0) fail('03-plans-analytics', 'Students Missing Plan list missing');
    
    const studentRows = await p.locator('table tbody tr').count();
    info('03-plans-analytics', `${studentRows} students missing plan`);
    
    // Generate Plan links work
    const genLinks = await p.locator('a:has-text("Generate Plan")').count();
    if (studentRows > 0 && genLinks === 0) fail('03-plans-analytics', 'No Generate Plan action links');
  });

  // === 4. DATA ANALYSIS ===
  await checkPage(page, '04-data-analysis', '/data-analysis', async (p) => {
    const hasContent = await p.locator('table, .recharts-responsive-container, h1, h2').count();
    if (hasContent === 0) fail('04-data-analysis', 'No visible content (tables or charts)');
  });

  // === 5. SCHOOL DIRECTORY ===
  await checkPage(page, '05-schools', '/schools', async (p) => {
    const schoolCards = await p.locator('[role="listitem"], table tbody tr, a[href*="/schools/"]').count();
    if (schoolCards === 0) warn('05-schools', 'No school entries visible');
    else info('05-schools', `${schoolCards} school entries`);
  });

  // === 6. ADMIN MANAGE ===
  await checkPage(page, '06-admin', '/admin/manage', async (p) => {
    // Teachers tab
    const teacherRows = await p.locator('table tbody tr').count();
    info('06-admin', `${teacherRows} teacher rows`);
    
    // Settings tab exists
    const settingsBtn = p.locator('button:has-text("Settings"), button:has-text("設定")');
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      await p.waitForTimeout(800);
      const rateInput = await p.locator('#submission-rate').count();
      if (rateInput === 0) fail('06-admin', 'Submission rate limit input missing in Settings');
    } else {
      fail('06-admin', 'Settings tab missing');
    }
  });

  // === 7. STUDENT PROFILE — full tab walkthrough ===
  // Navigate via search
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  const searchResult = page.locator('[role="button"]').first();
  if (await searchResult.count() === 0) {
    fail('07-student', 'Search returned no results for "Kwok"');
  } else {
    await searchResult.click();
    await page.waitForTimeout(2000);
    
    // Header layout
    jsErrors.length = 0;
    const headerText = await page.locator('h1').first().innerText().catch(() => '');
    if (!headerText.includes('Kwok')) fail('07-student-header', 'Student name not in header');
    
    const idBadge = await page.locator('text=/HKDSE/').count();
    if (idBadge === 0) warn('07-student-header', 'Student ID badge not visible');
    
    const classBadge = await page.locator('text=/Class 5/').count();
    if (classBadge === 0) warn('07-student-header', 'Class badge not visible');
    
    await page.screenshot({ path: path.join(DIR, '07-student-header.png') });
    
    // === 7a. Programme Choices Tab ===
    const progTab = page.locator('button:has-text("Programme")');
    if (await progTab.count() > 0) {
      await progTab.first().click();
      await page.waitForTimeout(1000);
      jsErrors.length = 0;
      
      // Table has rows
      const progRows = await page.locator('table tbody tr').count();
      if (progRows === 0) fail('07a-programmes', 'No programme rows in table');
      else info('07a-programmes', `${progRows} programme slots`);
      
      // Check match scores are numbers
      const scores = await page.locator('text=/\\d+%/').count();
      info('07a-programmes', `${scores} match score percentages visible`);
      
      // Test add programme modal
      const addLink = page.locator('span:has-text("+ add"), span:has-text("+ 新增")');
      if (await addLink.count() > 0) {
        await addLink.first().click();
        await page.waitForTimeout(1500);
        
        // Modal opened
        const modalTitle = await page.locator('text=/Add Programme/').count();
        if (modalTitle === 0) warn('07a-programmes', 'Add programme modal title missing');
        
        // JUPAS/SF toggle
        const jupasBtn = await page.locator('button:has-text("JUPAS")').count();
        const sfBtn = await page.locator('button:has-text("Self-Financing")').count();
        if (jupasBtn === 0 || sfBtn === 0) fail('07a-programmes', 'JUPAS/SF toggle missing');
        
        // Programme count shows 370
        const countText = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => '');
        if (!countText.includes('370')) warn('07a-programmes', `Expected 370 programmes, got: "${countText}"`);
        
        // Filter button
        const filterBtn = await page.locator('button:has-text("+ Add filter")').count();
        if (filterBtn === 0) warn('07a-programmes', 'Add filter button missing');
        else {
          await page.locator('button:has-text("+ Add filter")').click();
          await page.waitForTimeout(300);
          const progTypeOption = await page.locator('text=/Programme Type|課程類別/').count();
          if (progTypeOption === 0) fail('07a-programmes', 'Programme Type filter option missing');
          await page.keyboard.press('Escape');
        }
        
        // Search for "law"
        const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="搜尋"]');
        if (await searchInput.count() > 0) {
          await searchInput.first().fill('law');
          await page.waitForTimeout(500);
          const lawCount = await page.locator('text=/\\d+ of \\d+ programmes/').textContent().catch(() => '');
          if (lawCount && parseInt(lawCount) < 3) warn('07a-programmes', `"law" search returned too few: ${lawCount}`);
          info('07a-programmes', `Search "law": ${lawCount}`);
          await searchInput.first().fill('');
        }
        
        // Close modal
        await page.locator('button[aria-label="Close"]').click().catch(() => {});
        await page.waitForTimeout(500);
      }
      
      await page.screenshot({ path: path.join(DIR, '07a-programmes.png') });
      if (jsErrors.length > 0) jsErrors.forEach(e => fail('07a-programmes', `JS: ${e.slice(0, 100)}`));
    }
    
    // === 7b. Grades Tab ===
    const gradesTab = page.locator('button:has-text("Grades")');
    if (await gradesTab.count() > 0) {
      await gradesTab.first().click();
      await page.waitForTimeout(1000);
      jsErrors.length = 0;
      
      const gradeRows = await page.locator('table tbody tr').count();
      if (gradeRows === 0) warn('07b-grades', 'No grade rows');
      else info('07b-grades', `${gradeRows} grade rows`);
      
      // Subject names should be readable (not raw codes)
      const firstSubject = await page.locator('table tbody td:first-child').first().textContent().catch(() => '');
      if (firstSubject.length < 3 || firstSubject.match(/^[A-Z]{2,6}$/)) {
        fail('07b-grades', `Subject shows raw code: "${firstSubject}"`);
      } else {
        info('07b-grades', `First subject: "${firstSubject}"`);
      }
      
      await page.screenshot({ path: path.join(DIR, '07b-grades.png') });
      if (jsErrors.length > 0) jsErrors.forEach(e => fail('07b-grades', `JS: ${e.slice(0, 100)}`));
    }
    
    // === 7c. Plans Tab ===
    const plansTab = page.locator('button:has-text("Plans")');
    if (await plansTab.count() > 0) {
      await plansTab.first().click();
      await page.waitForTimeout(1000);
      jsErrors.length = 0;
      
      // Should show empty state OR plan list
      const emptyState = await page.locator('text=/No plans|尚未儲存/').count();
      const planItems = await page.locator('table tbody tr, [role="listitem"]').count();
      if (emptyState === 0 && planItems === 0) warn('07c-plans', 'Neither empty state nor plan list visible');
      
      // Generate button exists
      const genBtn = await page.locator('button:has-text("Generate")').count();
      if (genBtn === 0) warn('07c-plans', 'Generate New Plan button missing');
      
      await page.screenshot({ path: path.join(DIR, '07c-plans.png') });
      if (jsErrors.length > 0) jsErrors.forEach(e => fail('07c-plans', `JS: ${e.slice(0, 100)}`));
    }
    
    // === 7d. Personal Tab ===
    const personalTab = page.locator('button:has-text("Personal")');
    if (await personalTab.count() > 0) {
      await personalTab.first().click();
      await page.waitForTimeout(1000);
      jsErrors.length = 0;
      await page.screenshot({ path: path.join(DIR, '07d-personal.png') });
      if (jsErrors.length > 0) jsErrors.forEach(e => fail('07d-personal', `JS: ${e.slice(0, 100)}`));
    }
  }

  // === 8. CONSULTANT TASK (plan generation page) ===
  await checkPage(page, '08-consultant', '/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant', async (p) => {
    const genBtn = await p.locator('button:has-text("Generate Plan")').count();
    if (genBtn === 0) fail('08-consultant', 'Generate Plan button missing');
    
    const backLink = await p.locator('a:has-text("Back to")').count();
    if (backLink === 0) warn('08-consultant', 'Back link missing');
    
    const studentName = await p.locator('text="Kwok Chi Kin"').count();
    if (studentName === 0) warn('08-consultant', 'Student name not visible');
  });

  // === 9. ACADEMIC PLAN PAGE ===
  await checkPage(page, '09-academic-plan', '/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/plan', async (p) => {
    const genBtn = await p.locator('button:has-text("Generate")').count();
    if (genBtn === 0) fail('09-academic-plan', 'Generate button missing');
    
    const backLink = await p.locator('a:has-text("Back")').count();
    if (backLink === 0) warn('09-academic-plan', 'Back link missing');
  });

  // === 10. SUBMISSION DETAIL (if any submissions exist) ===
  await page.goto(`${BASE}/submissions`);
  await page.waitForTimeout(1500);
  const reviewLink = page.locator('a:has-text("Review")').first();
  if (await reviewLink.count() > 0) {
    await reviewLink.click();
    await page.waitForTimeout(2000);
    jsErrors.length = 0;
    
    const hasChoices = await page.locator('table tbody tr').count();
    if (hasChoices === 0) warn('10-submission-detail', 'No choices visible in submission detail');
    
    await page.screenshot({ path: path.join(DIR, '10-submission-detail.png') });
    if (jsErrors.length > 0) jsErrors.forEach(e => fail('10-submission-detail', `JS: ${e.slice(0, 100)}`));
  }

  // === 11. SELF-FINANCING INSTITUTIONS ===
  await checkPage(page, '11-sf-institutions', '/sf/HKCC', async (p) => {
    const hasContent = await p.locator('table, h1, h2').count();
    if (hasContent === 0) warn('11-sf-institutions', 'No content visible');
  });

  // === 12. API HEALTH CHECK ===
  const apiChecks = [
    { name: 'students', url: '/api/v1/students?limit=1' },
    { name: 'submissions', url: '/api/v1/submissions' },
    { name: 'alerts', url: '/api/v1/alerts' },
    { name: 'cohorts', url: '/api/v1/cohorts' },
    { name: 'jupas-all', url: '/api/v1/jupas/all' },
    { name: 'analytics-plan-history', url: '/api/v1/analytics/plan-history' },
    { name: 'analytics-submission-history', url: '/api/v1/analytics/submission-history' },
    { name: 'hkdse-trends', url: '/api/v1/analytics/hkdse-trends' },
  ];
  
  for (const api of apiChecks) {
    const resp = await page.evaluate(async (url) => {
      const token = localStorage.getItem('token');
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      return { status: res.status, ok: res.ok };
    }, `${BASE}${api.url}`);
    
    if (!resp.ok) {
      fail('12-api', `${api.name} returned ${resp.status}`);
    } else {
      info('12-api', `${api.name}: ${resp.status} OK`);
    }
  }

  await browser.close();

  // === REPORT ===
  console.log('\n' + '='.repeat(70));
  console.log('E2E AUDIT REPORT');
  console.log('='.repeat(70));
  
  const errors = findings.filter(f => f.severity === 'ERROR');
  const warns = findings.filter(f => f.severity === 'WARN');
  const infos = findings.filter(f => f.severity === 'INFO');
  
  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    errors.forEach(f => console.log(`  [${f.page}] ${f.issue}`));
  }
  
  if (warns.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warns.length}):`);
    warns.forEach(f => console.log(`  [${f.page}] ${f.issue}`));
  }
  
  console.log(`\n✅ PASSED (${infos.length}):`);
  infos.forEach(f => console.log(`  [${f.page}] ${f.issue}`));
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOTAL: ${errors.length} errors, ${warns.length} warnings, ${infos.length} passed`);
  console.log(`VERDICT: ${errors.length === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('='.repeat(70));
  
  // Write report to file
  const report = findings.map(f => `[${f.severity}] [${f.page}] ${f.issue}`).join('\n');
  fs.writeFileSync(path.join(DIR, 'REPORT.txt'), report);
}

main();
