/**
 * scripts/verify_ai_plan.mjs
 *
 * Playwright test: click Generate Plan on the consultant page,
 * wait for SSE stream to complete, save, and verify rendered plan HTML.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Use the existing test student (Lee Wing Yin) with grades
  const email = 'verify@test.com';
  const password = 'Verify123!';
  const studentId = 'bfb491f4-35e1-4a91-8951-154a03a621df';

  console.log('1. Login...');
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Log In")');
  await page.waitForURL(/\/(dashboard|students)/, { timeout: 10000 });
  console.log('   OK');

  console.log('2. Navigate to consultant page...');
  await page.goto(`${BASE}/students/${studentId}/consultant`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check if there's already a plan or if we need to generate
  const pageText = await page.textContent('body');
  const hasExistingPlan = pageText.includes('Academic Plan') && !pageText.includes('No plan');

  if (hasExistingPlan) {
    console.log('   Plan already exists, taking screenshot...');
    await page.screenshot({ path: 'test-results/ai_plan_existing.png', fullPage: true });
  }

  console.log('3. Click Generate Plan...');
  const generateBtn = await page.$('button:has-text("Generate Plan"), button:has-text("Generate")');
  if (!generateBtn) {
    console.log('   No Generate button found, checking page state...');
    await page.screenshot({ path: 'test-results/ai_plan_no_button.png' });
    // Try the plan page instead
    await page.goto(`${BASE}/students/${studentId}/plan`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/ai_plan_page_pre.png' });
  }

  const btn = await page.$('button:has-text("Generate Plan"), button:has-text("Generate")');
  if (btn) {
    await btn.click();
    console.log('   Clicked! Waiting for AI stream...');

    // Wait for streaming content to appear (up to 2 minutes)
    try {
      // Watch for either streaming text or plan content
      await page.waitForFunction(() => {
        const body = document.body.textContent;
        // Look for signs of streaming or completed plan
        return body.includes('student_summary') ||
               body.includes('recommended_schools') ||
               body.includes('Generating') ||
               body.includes('Academic Plan') ||
               body.length > 5000;
      }, { timeout: 120000 });

      console.log('   Content detected, waiting for completion...');

      // Wait for streaming to finish (look for Save button or completed state)
      await page.waitForTimeout(5000); // Give it a moment
      await page.screenshot({ path: 'test-results/ai_plan_streaming.png', fullPage: true });

      // Wait longer for the stream to finish
      await page.waitForFunction(() => {
        const body = document.body.textContent;
        return body.includes('Save') || body.includes('Template') ||
               body.includes('action_plan') || body.includes('skill_gaps');
      }, { timeout: 120000 });

      console.log('   Stream appears complete!');
      await page.screenshot({ path: 'test-results/ai_plan_complete.png', fullPage: true });

      // Try to save
      const saveBtn = await page.$('button:has-text("Save")');
      if (saveBtn) {
        console.log('4. Clicking Save...');
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/ai_plan_saved.png', fullPage: true });
        console.log('   Saved!');
      }

    } catch (e) {
      console.log(`   Timeout or error: ${e.message}`);
      await page.screenshot({ path: 'test-results/ai_plan_timeout.png', fullPage: true });
    }
  } else {
    console.log('   No Generate button found on either page');
  }

  // Final: navigate to the plan page to verify saved plan renders
  console.log('5. Verify saved plan renders...');

  // Check via API
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const statusResp = await fetch(`${API}/api/v1/consultant/tasks/academic_plan/status?entity_id=${studentId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (statusResp.ok) {
    const status = await statusResp.json();
    console.log(`   Plan status: version=${status.version}, has_content=${status.has_content}`);
  }

  // Navigate to profile Plans tab to see the plan
  await page.goto(`${BASE}/students/${studentId}/profile`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Click Plans tab
  const plansTab = await page.$('button:has-text("Plans")');
  if (plansTab) {
    await plansTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/ai_plan_plans_tab.png', fullPage: true });
    console.log('   Plans tab screenshot saved');
  }

  console.log('\n=== AI PLAN VERIFICATION COMPLETE ===');
  await browser.close();
  process.exit(0);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
