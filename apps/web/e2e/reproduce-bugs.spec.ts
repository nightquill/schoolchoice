import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5177';

test.describe('Bug reproduction — click through and capture what user sees', () => {

  test('BUG 1: All Students cohort — check for remove buttons', async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot the dashboard first
    await page.screenshot({ path: 'e2e/screenshots/repro-1a-dashboard.png', fullPage: true });

    // Find and click the "All Students" / "所有學生" cohort card
    const allStudentsCard = page.locator('div').filter({ hasText: /所有學生|All Students/ }).first();
    console.log('All Students card found:', await allStudentsCard.count() > 0);

    // Navigate directly to the All Students cohort by ID
    await page.goto(`${BASE}/cohorts/009b56ee-2b15-4a98-b660-8bea6d6c3d43`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot the cohort detail page
    await page.screenshot({ path: 'e2e/screenshots/repro-1b-all-students-detail.png', fullPage: true });

    // Count ALL buttons on the page
    const allButtons = await page.locator('button').all();
    console.log('Total buttons on page:', allButtons.length);
    for (const btn of allButtons) {
      const text = await btn.textContent();
      const visible = await btn.isVisible();
      if (visible && text.trim()) {
        console.log(`  Button: "${text.trim()}" visible=${visible}`);
      }
    }

    // Specifically look for remove/delete buttons in the member table
    const memberTable = page.locator('table').first();
    const tableButtons = await memberTable.locator('button').all();
    console.log('\nButtons inside member table:', tableButtons.length);
    for (const btn of tableButtons) {
      const text = await btn.textContent();
      console.log(`  Table button: "${text.trim()}"`);
    }
  });

  test('BUG 2: Hardcoded English — check multiple pages in zh-HK locale', async ({ page }) => {
    // Login as admin (has zh-HK locale)
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'verify@test.com');
    await page.fill('input[name="password"]', 'verify123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot dashboard
    await page.screenshot({ path: 'e2e/screenshots/repro-2a-dashboard-zh.png', fullPage: true });

    // Check dashboard text for English leaks
    const dashText = await page.textContent('body');
    const englishPatterns = [
      'Total Students', 'Plans Generated', 'Pending Submissions',
      'Missing', 'Conservative', 'Ambitious',
      'Add Student', 'Import', 'Export',
      'Form 5 class', 'academic year',
      'Your Cohorts', 'students',
      'All Students',
    ];
    console.log('\n=== ENGLISH LEAKS ON DASHBOARD ===');
    for (const p of englishPatterns) {
      if (dashText.includes(p)) {
        console.log(`  FOUND: "${p}"`);
      }
    }

    // Navigate to cohort report
    await page.goto(`${BASE}/cohorts/fa303904-0c50-4eb6-906c-38aab92f7157/report`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/repro-2b-cohort-report-zh.png', fullPage: true });

    const reportText = await page.textContent('body');
    console.log('\n=== ENGLISH LEAKS ON COHORT REPORT ===');
    const reportPatterns = [
      'Biology', 'Chemistry', 'Chinese Language', 'Physics', 'Mathematics',
      'The University of Hong Kong', 'City University',
      'Target Distribution', 'Risk Breakdown', 'Subject Performance',
    ];
    for (const p of reportPatterns) {
      if (reportText.includes(p)) {
        console.log(`  FOUND: "${p}"`);
      }
    }

    // Navigate to student list
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/repro-2c-students-zh.png', fullPage: true });

    // Navigate to admin manage
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/repro-2d-admin-manage-zh.png', fullPage: true });

    const adminText = await page.textContent('body');
    console.log('\n=== ENGLISH LEAKS ON ADMIN MANAGE ===');
    const adminPatterns = [
      'default group', 'member', 'counsellor', 'All Students',
      'Delete', 'Remove', 'Create',
    ];
    for (const p of adminPatterns) {
      if (adminText.includes(p)) {
        console.log(`  FOUND: "${p}"`);
      }
    }
  });

  test('BUG 3: Student grade sandbox visibility', async ({ page }) => {
    // Login as student
    await page.goto(`${BASE}/login`);

    // Switch to student tab
    const studentTab = page.locator('button[aria-pressed]').filter({ hasText: /Student|學生/ });
    await studentTab.click();
    await page.waitForTimeout(500);

    await page.fill('input[name="candidateNumber"]', 'HKDSE-2026-A001');
    await page.fill('input[name="password"]', 'Student123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot the full student dashboard
    await page.screenshot({ path: 'e2e/screenshots/repro-3a-student-dashboard.png', fullPage: true });

    // Scroll to bottom to see if grades section is there
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/repro-3b-student-dashboard-bottom.png', fullPage: true });

    // Check for grade-related elements
    const bodyText = await page.textContent('body');
    console.log('\n=== STUDENT DASHBOARD CONTENT CHECK ===');
    console.log('Contains "Grade":', bodyText.includes('Grade') || bodyText.includes('成績'));
    console.log('Contains "Build":', bodyText.includes('Build') || bodyText.includes('組合'));
    console.log('Contains "Sandbox":', bodyText.includes('Sandbox') || bodyText.includes('sandbox'));
    console.log('Contains "Actual Grades":', bodyText.includes('Actual Grades') || bodyText.includes('實際成績'));
    console.log('Contains "New Build":', bodyText.includes('New Build') || bodyText.includes('新組合'));

    // Look for grade-related elements specifically
    const gradeSection = page.locator('text=/Grade|成績|Build|組合/');
    console.log('Grade-related elements found:', await gradeSection.count());
  });
});
