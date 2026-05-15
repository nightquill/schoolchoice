import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/plan-gen');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });

  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#input-email');
  await page.fill('#input-email', 'verify@test.com');
  await page.fill('#input-password', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Navigate to a student who has NO plan yet (use second student)
  // First find a student via search
  await page.fill('input[name="student-search"]', 'Fung');
  await page.waitForTimeout(500);
  const searchResult = page.locator('[role="button"]').first();
  if (await searchResult.count() === 0) {
    console.log('No student "Fung" found, trying "Lee"');
    await page.fill('input[name="student-search"]', 'Lee');
    await page.waitForTimeout(500);
  }
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);
  console.log('Student URL:', page.url());
  await page.screenshot({ path: path.join(DIR, '00-student-profile.png') });

  // Click Generate Plan button (in profile header)
  const genPlanBtn = page.locator('button:has-text("Generate Plan"), a:has-text("Generate Plan")');
  if (await genPlanBtn.count() > 0) {
    console.log('\n=== Clicking Generate Plan ===');
    await genPlanBtn.first().click();
    await page.waitForTimeout(2000);
    console.log('Navigated to:', page.url());
    await page.screenshot({ path: path.join(DIR, '01-consultant-page.png') });

    // Click the Generate Plan button on the consultant page
    const consultantGenBtn = page.locator('button:has-text("Generate Plan")');
    if (await consultantGenBtn.count() > 0) {
      console.log('Clicking Generate on consultant page...');
      errors.length = 0;
      consoleErrors.length = 0;
      await consultantGenBtn.click();
      await page.waitForTimeout(2000);

      // Check if progress screen appeared
      const progressBar = await page.locator('text=/Analyzing|Matching|Generating|Formatting|分析|配對|生成|排版/').count();
      console.log('Progress screen visible:', progressBar > 0);
      await page.screenshot({ path: path.join(DIR, '02-progress-screen.png') });

      // Wait for generation to complete (up to 60s)
      console.log('Waiting for generation (up to 60s)...');
      let completed = false;
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(5000);
        
        // Check for error
        const errorMsg = await page.locator('text=/中斷|interrupted|error|failed/i').count();
        if (errorMsg > 0) {
          const errText = await page.locator('text=/中斷|interrupted|error|failed/i').first().textContent().catch(() => '');
          console.log(`ERROR at ${(i+1)*5}s: ${errText}`);
          await page.screenshot({ path: path.join(DIR, `03-error-${i}.png`) });
          break;
        }

        // Check for plan ready
        const planReady = await page.locator('text="Plan ready!", text="計劃已完成"').count();
        const hasPlanContent = await page.locator('iframe, text=/UNIVERSITY APPLICATION|Application Strategy/i').count();
        if (planReady > 0 || hasPlanContent > 0) {
          console.log(`Plan generated at ${(i+1)*5}s!`);
          completed = true;
          await page.waitForTimeout(2000); // let it settle
          break;
        }

        // Check progress stage
        const stageText = await page.locator('text=/Analyzing|Matching|Generating|Formatting|分析|配對|生成|排版/').first().textContent().catch(() => 'unknown');
        console.log(`  ${(i+1)*5}s: stage="${stageText}"`);
      }

      await page.screenshot({ path: path.join(DIR, '03-after-generation.png') });

      if (completed) {
        // Verify plan content
        console.log('\n=== Verifying Plan Content ===');
        
        // Check radar chart
        const radarChart = await page.locator('.recharts-responsive-container').count();
        console.log('Radar chart:', radarChart > 0);

        // Check plan iframe or content
        const iframe = await page.locator('iframe').count();
        const planContent = await page.locator('text=/Application Strategy|Recommended|Action Plan/i').count();
        console.log('Plan iframe:', iframe > 0, 'Plan text content:', planContent > 0);

        // Check deadline badge
        const deadline = await page.locator('text=/days$/').count();
        console.log('Deadline badge:', deadline > 0);

        // Check Export buttons
        const exportPdf = await page.locator('button:has-text("Export PDF")').count();
        const exportHtml = await page.locator('button:has-text("Export HTML")').count();
        console.log('Export PDF:', exportPdf > 0, 'Export HTML:', exportHtml > 0);

        // Check template selector
        const templates = await page.locator('text=/Professional|Modern|Minimal/').count();
        console.log('Template buttons:', templates);

        // Scroll down to see more
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(DIR, '04-plan-scrolled.png') });
      }

      console.log('\nJS errors:', errors.length, errors.slice(0, 3).join('; '));
      console.log('Console errors:', consoleErrors.length, consoleErrors.slice(0, 3).join('; '));
    }
  } else {
    console.log('No Generate Plan button found on student profile');
  }

  await browser.close();
  console.log('\nDone');
}
main();
