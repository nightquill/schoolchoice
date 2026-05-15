import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://localhost:5173';
const DIR = 'test-results/plan-gen';
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

  // Go to Fung's consultant page directly with force generate
  await page.fill('input[name="student-search"]', 'Fung');
  await page.waitForTimeout(500);
  await page.locator('[role="button"]').first().click();
  await page.waitForTimeout(2000);
  const studentUrl = page.url();
  const studentId = studentUrl.split('/students/')[1]?.split('/')[0];
  console.log('Student ID:', studentId);
  
  // Navigate to consultant page
  await page.goto(`${BASE}/students/${studentId}/consultant`);
  await page.waitForTimeout(3000);
  
  // Screenshot and dump page state
  const bodyText = await page.locator('body').innerText();
  console.log('Page text (first 300):', bodyText.slice(0, 300).replace(/\n/g, ' | '));
  
  // Check all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons.map(b => b.trim()).filter(Boolean));
  
  console.log('JS errors:', errors.length, errors.join('; '));
  await page.screenshot({ path: `${DIR}/05-fung-consultant.png` });
  
  // Is there a Generate Plan button?
  const genBtn = page.locator('button:has-text("Generate")');
  console.log('Generate buttons:', await genBtn.count());
  
  if (await genBtn.count() > 0) {
    console.log('\n=== Starting Plan Generation ===');
    errors.length = 0;
    await genBtn.first().click();
    
    // Monitor every 3 seconds for 90 seconds
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(3000);
      
      // Check state
      const progressText = await page.locator('p').allTextContents();
      const relevantText = progressText.filter(t => t.includes('Analyz') || t.includes('Match') || t.includes('Generat') || t.includes('Format') || t.includes('ready') || t.includes('中斷') || t.includes('error') || t.includes('分析') || t.includes('配對'));
      
      const hasIframe = await page.locator('iframe').count();
      const hasError = await page.locator('text=/中斷|interrupted|Retry/i').count();
      
      if (relevantText.length > 0) {
        console.log(`  ${(i+1)*3}s: ${relevantText[0].trim()}`);
      }
      
      if (hasError > 0) {
        console.log(`  ERROR at ${(i+1)*3}s`);
        await page.screenshot({ path: `${DIR}/06-error.png` });
        
        // Check console errors
        console.log('JS errors:', errors.join('; '));
        break;
      }
      
      if (hasIframe > 0) {
        console.log(`  PLAN READY at ${(i+1)*3}s`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${DIR}/06-plan-ready.png` });
        
        // Verify content
        const radar = await page.locator('.recharts-responsive-container').count();
        const deadline = await page.locator('text=/days$/').count();
        const exportPdf = await page.locator('button:has-text("Export PDF")').count();
        console.log('Radar:', radar > 0, 'Deadline:', deadline > 0, 'PDF:', exportPdf > 0);
        console.log('JS errors:', errors.length);
        break;
      }
    }
  }
  
  await browser.close();
  console.log('Done');
}
main();
