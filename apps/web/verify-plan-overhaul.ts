import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/plan-overhaul');
async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 1. Dashboard — plan history count
  console.log('=== Plan History Count ===');
  await page.goto(`${BASE}/analytics/plans`);
  await page.waitForTimeout(2000);
  const totalText = await page.locator('text=/Total: \\d+/').textContent().catch(() => 'NOT FOUND');
  console.log('Plan history total:', totalText);
  const chart = await page.locator('.recharts-responsive-container').count();
  console.log('Chart visible:', chart > 0);
  await page.screenshot({ path: path.join(DIR, '01-plan-history.png') });

  // 2. Admin settings — plan detail level
  console.log('\n=== Admin Settings ===');
  await page.goto(`${BASE}/admin/manage`);
  await page.waitForTimeout(1500);
  const settingsBtn = page.locator('button:has-text("Settings")');
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    await page.waitForTimeout(800);
    const radioA = await page.locator('input[value="A"]').count();
    const radioB = await page.locator('input[value="B"]').count();
    const radioC = await page.locator('input[value="C"]').count();
    console.log('Detail level radios: A=' + radioA + ' B=' + radioB + ' C=' + radioC);
    await page.screenshot({ path: path.join(DIR, '02-admin-settings.png') });
  }

  // 3. Consultant page — progress screen, deadline badge, export PDF, radar chart
  console.log('\n=== Consultant Page ===');
  errors.length = 0;
  await page.goto(`${BASE}/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/consultant`);
  await page.waitForTimeout(3000);

  // Deadline badge
  const deadlineBadge = await page.locator('text=/days$/').count();
  console.log('Deadline badge visible:', deadlineBadge > 0);

  // Generate Plan button
  const genBtn = await page.locator('button:has-text("Generate Plan")').count();
  console.log('Generate button:', genBtn > 0);

  // Export PDF button (only shows when plan exists)
  const pdfBtn = await page.locator('button:has-text("Export PDF")').count();
  console.log('Export PDF button:', pdfBtn > 0);

  console.log('JS errors:', errors.length, errors.slice(0, 2).join('; '));
  await page.screenshot({ path: path.join(DIR, '03-consultant.png') });

  // 4. Plans tab — PDF download per version
  console.log('\n=== Plans Tab ===');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1000);
  await page.fill('input[name="student-search"]', 'Kwok');
  await page.waitForTimeout(500);
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);
  const plansTab = page.locator('button:has-text("Plans")');
  if (await plansTab.count() > 0) {
    await plansTab.first().click();
    await page.waitForTimeout(1000);
    const downloadBtns = await page.locator('text=/Download PDF|下載 PDF/').count();
    console.log('Download PDF buttons in plans tab:', downloadBtns);
    await page.screenshot({ path: path.join(DIR, '04-plans-tab.png') });
  }

  // 5. Regression: dashboard still works
  console.log('\n=== Regression ===');
  errors.length = 0;
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  console.log('Dashboard errors:', errors.length);
  await page.goto(`${BASE}/submissions`);
  await page.waitForTimeout(1500);
  console.log('Submissions errors:', errors.length);

  await browser.close();
  console.log('\nDone');
}
main();
