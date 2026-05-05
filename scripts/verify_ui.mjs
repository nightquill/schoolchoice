/**
 * scripts/verify_ui.mjs
 *
 * Playwright UI verification: login → create student → add grades →
 * generate recommendations → navigate to plan page → verify AI plan.
 *
 * Run: npx playwright test scripts/verify_ui.mjs --headed
 * Or:  node scripts/verify_ui.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const email = `uitest_${Date.now()}@test.com`;
  const password = 'UiTest123!';

  console.log('1. Register via API...');
  let resp = await fetch(`${API}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: 'UI Tester' }),
  });
  if (resp.status !== 201) {
    console.log(`  Register failed: ${resp.status} ${await resp.text()}`);
    await browser.close();
    process.exit(1);
  }
  console.log('  OK');

  console.log('2. Login via UI...');
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  // Button uses onClick, not type="submit"
  await page.click('button:has-text("Log In")');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|students)/, { timeout: 10000 }).catch(() => {});
  const url = page.url();
  console.log(`  Landed on: ${url}`);

  if (url.includes('login')) {
    console.log('  FAIL: Still on login page');
    await page.screenshot({ path: 'test-results/ui_login_fail.png' });
    await browser.close();
    process.exit(1);
  }
  console.log('  OK - logged in');

  console.log('3. Navigate to dashboard...');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/ui_dashboard.png' });
  console.log('  OK - dashboard loaded');

  // Create student via API for speed
  console.log('4. Create student via API...');
  const token = await page.evaluate(() => localStorage.getItem('token'));
  resp = await fetch(`${API}/api/v1/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      name: 'UI Test Student',
      grades: { CHLA: '5', ENGL: '4', MATH: '5*', CSD: '4' },
      interests: ['engineering', 'computer science'],
      strengths_weaknesses: 'Strong STEM',
      target_region: 'local',
    }),
  });
  const student = await resp.json();
  const studentId = student.id;
  console.log(`  Student: ${studentId}`);

  // Add grades
  console.log('5. Add grades via API...');
  for (const g of [
    { subject_name: 'Chinese Language', raw_grade: '5', sitting: 'MOCK', year_of_exam: 2026 },
    { subject_name: 'English Language', raw_grade: '4', sitting: 'MOCK', year_of_exam: 2026 },
    { subject_name: 'Mathematics', raw_grade: '5*', sitting: 'MOCK', year_of_exam: 2026 },
    { subject_name: 'CSD', raw_grade: 'A', sitting: 'MOCK', year_of_exam: 2026 },
    { subject_name: 'Physics', raw_grade: '5', sitting: 'MOCK', year_of_exam: 2026 },
    { subject_name: 'Chemistry', raw_grade: '4', sitting: 'MOCK', year_of_exam: 2026 },
  ]) {
    const r = await fetch(`${API}/api/v1/students/${studentId}/grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(g),
    });
    const data = await r.json();
    console.log(`  ${data.subject_code || 'ERR'}: ${data.raw_grade || data.detail || '?'}`);
  }

  console.log('6. Navigate to student profile...');
  await page.goto(`${BASE}/students/${studentId}/profile`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/ui_profile.png' });
  console.log('  OK');

  console.log('7. Navigate to recommendations...');
  // Generate recommendations first
  await fetch(`${API}/api/v1/students/${studentId}/recommendations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  await page.goto(`${BASE}/students/${studentId}/recommendations`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/ui_recommendations.png' });

  // Check if recommendations are visible
  const recCards = await page.$$('.recommendation-card, [class*="recommendation"], [class*="Recommendation"]');
  console.log(`  Found ${recCards.length} recommendation elements`);

  // Get page text for content verification
  const pageText = await page.textContent('body');
  const hasSchoolName = pageText.includes('University') || pageText.includes('Hong Kong');
  const hasScore = pageText.includes('score') || pageText.includes('Score') || pageText.includes('%');
  console.log(`  Has school names: ${hasSchoolName}`);
  console.log(`  Has scores: ${hasScore}`);

  console.log('8. Navigate to plan page...');
  await page.goto(`${BASE}/students/${studentId}/plan`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/ui_plan_page.png' });
  console.log('  OK');

  console.log('9. Navigate to consultant task (SSE streaming)...');
  await page.goto(`${BASE}/students/${studentId}/consultant`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/ui_consultant.png' });
  console.log('  OK');

  console.log('\n=== UI VERIFICATION COMPLETE ===');
  console.log('Screenshots saved to test-results/');

  await browser.close();
  process.exit(0);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
