import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/student-e2e';

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  // ============================================================
  // PART A: Teacher releases plan for Kwok Chi Kin
  // ============================================================
  console.log('=== PART A: Teacher releases plan ===');
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Go to Kwok's consultant page and release the plan
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);

  const releaseBtn = page.locator('button:has-text("Release"), button:has-text("發佈")');
  if (await releaseBtn.count() > 0) {
    await releaseBtn.first().click();
    await page.waitForTimeout(500);
    // Fill note in modal
    const textarea = page.locator('textarea[placeholder*="note"], textarea[placeholder*="備註"]');
    if (await textarea.count() > 0) {
      await textarea.fill('Focus on action items 1-3. Prepare interview materials by November.');
    }
    // Click release/confirm button in dialog
    const confirmBtn = page.locator('button:has-text("Release"), button:has-text("發佈")').last();
    await confirmBtn.click();
    await page.waitForTimeout(1500);
    console.log('Plan released for Kwok');
    await page.screenshot({ path: `${DIR}/01-plan-released.png` });
  } else {
    console.log('No release button found');
  }

  // Check PDF export and language toggle visible
  const pdfBtn = await page.locator('button:has-text("Export PDF")').count();
  const langToggle = await page.locator('button:has-text("中 →"), button:has-text("EN →")').count();
  console.log('PDF export visible:', pdfBtn > 0);
  console.log('Language toggle visible:', langToggle > 0);

  // Logout teacher
  await page.locator('text="Logout"').click();
  await page.waitForTimeout(1000);

  // ============================================================
  // PART B: Student login and test all features
  // ============================================================
  console.log('\n=== PART B: Student login (Kwok Chi Kin) ===');
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1000);

  // Toggle to student login if needed
  const studentToggle = page.locator('button:has-text("Student"), button:has-text("學生")');
  if (await studentToggle.count() > 0) {
    await studentToggle.click();
    await page.waitForTimeout(500);
  }

  await page.fill('#input-email, input[name="candidate_number"], input[placeholder*="candidate"], input[placeholder*="Candidate"]', 'HKDSE-2026-E001');
  await page.fill('#input-password, input[type="password"]', 'HKDSE-2026-E001');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Student login URL:', page.url());
  await page.screenshot({ path: `${DIR}/02-student-dashboard.png` });

  // Check student nav links
  const navMyPlan = await page.locator('a[href="/my-plan"], text="My Plan", text="我的計劃"').count();
  const navSchools = await page.locator('a[href="/schools"], text="School Directory"').count();
  const navSubmissions = await page.locator('a[href="/my-submissions"], text="My Submissions"').count();
  console.log('Nav - My Plan:', navMyPlan > 0);
  console.log('Nav - Schools:', navSchools > 0);
  console.log('Nav - Submissions:', navSubmissions > 0);

  // ============================================================
  // TEST 1: My Plan page
  // ============================================================
  console.log('\n=== TEST 1: My Plan ===');
  errors.length = 0;
  await page.goto(`${BASE}/my-plan`);
  await page.waitForTimeout(2000);

  const planContent = await page.locator('iframe').count();
  const releaseNote = await page.locator('text=/counselor|輔導|Focus on/').count();
  console.log('Plan iframe:', planContent > 0);
  console.log('Release note visible:', releaseNote > 0);
  console.log('JS errors:', errors.length, errors.slice(0, 2).join('; '));
  await page.screenshot({ path: `${DIR}/03-my-plan.png` });

  // ============================================================
  // TEST 2: School Directory
  // ============================================================
  console.log('\n=== TEST 2: School Directory ===');
  errors.length = 0;
  await page.goto(`${BASE}/schools`);
  await page.waitForTimeout(2000);

  const schoolCards = await page.locator('a[href*="/schools/"], [role="listitem"]').count();
  console.log('School entries:', schoolCards);
  console.log('JS errors:', errors.length);
  await page.screenshot({ path: `${DIR}/04-schools.png` });

  // ============================================================
  // TEST 3: Student Dashboard — Programme Choices
  // ============================================================
  console.log('\n=== TEST 3: Programme Choices ===');
  errors.length = 0;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);

  const progRows = await page.locator('table tbody tr, text=/JS\d{4}/').count();
  console.log('Programme data visible:', progRows > 0);
  console.log('JS errors:', errors.length, errors.slice(0, 1).join('; '));
  await page.screenshot({ path: `${DIR}/05-programme-choices.png` });

  // ============================================================
  // TEST 4: Grade Builds
  // ============================================================
  console.log('\n=== TEST 4: Grade Builds ===');
  errors.length = 0;
  // Navigate to grades tab if student profile has tabs
  const gradesTab = page.locator('button:has-text("Grades"), button:has-text("成績")');
  if (await gradesTab.count() > 0) {
    await gradesTab.first().click();
    await page.waitForTimeout(1000);
  }

  // Check build selector exists
  const buildSelector = await page.locator('select').first();
  const hasBuildSelector = await buildSelector.count() > 0;
  console.log('Build selector:', hasBuildSelector);

  if (hasBuildSelector) {
    // Try creating a new build
    const newBuildBtn = page.locator('text=/\\+ New|\\+ 新/');
    if (await newBuildBtn.count() > 0) {
      await newBuildBtn.click();
      await page.waitForTimeout(300);
      const nameInput = page.locator('input[placeholder*="Build"], input[placeholder*="組合"]');
      if (await nameInput.count() > 0) {
        await nameInput.fill('Optimistic');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        console.log('Created build "Optimistic"');

        // Set some grades
        const selects = await page.locator('table select').count();
        console.log('Grade dropdowns:', selects);
        if (selects > 0) {
          // Set MATH to 5**
          const mathSelect = page.locator('table select').nth(2); // MATH is 3rd subject
          if (await mathSelect.count() > 0) {
            await mathSelect.selectOption('5**');
            await page.waitForTimeout(500);
          }
        }

        // Check live scores appear
        await page.waitForTimeout(1000);
        const liveScores = await page.locator('text=/Live|即時|\\d+%/').count();
        console.log('Live scores visible:', liveScores > 0);
        await page.screenshot({ path: `${DIR}/06-grade-build.png` });
      }
    }
  }
  console.log('JS errors:', errors.length, errors.slice(0, 2).join('; '));

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('STUDENT E2E SUMMARY');
  console.log('='.repeat(50));
  console.log('Total JS errors across all tests:', errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ERROR:', e.slice(0, 100)));
  }

  await browser.close();
  console.log('Done');
}
main();
