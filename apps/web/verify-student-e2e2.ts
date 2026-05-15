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

  // === Student login ===
  console.log('=== Student Login (Kwok Chi Kin) ===');
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1000);
  // Toggle to student
  await page.locator('button:has-text("Student")').click();
  await page.waitForTimeout(300);
  await page.fill('#input-email', 'HKDSE-2026-E001');
  await page.fill('#input-password', 'HKDSE-2026-E001');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('URL after login:', page.url());
  await page.screenshot({ path: `${DIR}/10-student-dashboard.png` });

  // Check nav
  const navLinks = await page.locator('nav a, a[href]').allTextContents();
  console.log('Nav links:', navLinks.filter(l => l.trim()).map(l => l.trim()));

  // === TEST 1: My Plan ===
  console.log('\n=== TEST 1: My Plan ===');
  errors.length = 0;
  await page.goto(`${BASE}/my-plan`);
  await page.waitForTimeout(2000);
  const hasIframe = await page.locator('iframe').count();
  const hasNote = await page.locator('text=/counselor|note|備註|Focus/i').count();
  const hasEmptyState = await page.locator('text=/not released|尚未發佈/i').count();
  console.log('Plan iframe:', hasIframe > 0);
  console.log('Release note:', hasNote > 0);
  console.log('Empty state:', hasEmptyState > 0);
  console.log('JS errors:', errors.length, errors.slice(0, 2).join('; '));
  await page.screenshot({ path: `${DIR}/11-my-plan.png` });

  // === TEST 2: School Directory ===
  console.log('\n=== TEST 2: School Directory ===');
  errors.length = 0;
  await page.goto(`${BASE}/schools`);
  await page.waitForTimeout(2000);
  const schoolCount = await page.locator('a[href*="/schools/"]').count();
  console.log('School links:', schoolCount);
  console.log('JS errors:', errors.length, errors.slice(0, 1).join('; '));
  await page.screenshot({ path: `${DIR}/12-schools.png` });

  // === TEST 3: Student Dashboard ===
  console.log('\n=== TEST 3: Dashboard ===');
  errors.length = 0;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  const hasProgChoices = bodyText.includes('JS') || bodyText.includes('Band') || bodyText.includes('Programme');
  console.log('Dashboard has programme data:', hasProgChoices);
  console.log('JS errors:', errors.length, errors.slice(0, 1).join('; '));
  await page.screenshot({ path: `${DIR}/13-dashboard.png` });

  // === TEST 4: Submissions ===
  console.log('\n=== TEST 4: My Submissions ===');
  errors.length = 0;
  await page.goto(`${BASE}/my-submissions`);
  await page.waitForTimeout(2000);
  console.log('Submissions page loaded');
  console.log('JS errors:', errors.length, errors.slice(0, 1).join('; '));
  await page.screenshot({ path: `${DIR}/14-submissions.png` });

  // === SUMMARY ===
  console.log('\n' + '='.repeat(50));
  console.log('STUDENT E2E COMPLETE');
  console.log('='.repeat(50));
  await browser.close();
  console.log('Done');
}
main();
