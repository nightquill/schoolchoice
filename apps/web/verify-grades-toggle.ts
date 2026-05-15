import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE = 'http://localhost:5173';
const DIR = path.join(__dirname, '../../test-results/grades-toggle');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results: string[] = [];
  const log = (msg: string) => { console.log(msg); results.push(msg); };

  try {
    // Login
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('#input-email', { timeout: 10000 });
    await page.fill('#input-email', 'verify@test.com');
    await page.fill('#input-password', 'verify123');
    await page.click('button:has-text("Log In"), button:has-text("登入")');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    log('✓ Logged in');

    // Go to Chan Siu Ming grades
    const chanId = '3aa7db89-ca42-476d-bfa6-3be88ff9d367';
    await page.goto(`${BASE}/students/${chanId}/profile?tab=grades`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DIR, '01-grades-default.png'), fullPage: true });

    // Check sitting toggle exists
    const toggleBtns = await page.$$eval('button', btns =>
      btns.filter(b => {
        const t = b.textContent?.trim() ?? '';
        return t.includes('MOCK') || t.includes('TRIAL') || t.includes('OFFICIAL') || t.includes('模擬') || t.includes('校內');
      }).map(b => b.textContent?.trim())
    );
    log(`Sitting toggle buttons: ${toggleBtns.join(', ')}`);
    if (toggleBtns.length >= 2) {
      log('✓ Sitting toggle visible with multiple options');
    } else if (toggleBtns.length === 1) {
      log('⚠ Only one sitting type — toggle hidden (correct behavior)');
    } else {
      log('✗ No sitting toggle found');
    }

    // Count visible rows in default view
    const defaultRows = await page.$$('table tbody tr');
    log(`Default view rows: ${defaultRows.length}`);

    // Click TRIAL if available
    const trialBtn = await page.$('button:has-text("TRIAL"), button:has-text("校內試")');
    if (trialBtn) {
      await trialBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(DIR, '02-grades-trial.png'), fullPage: true });
      const trialRows = await page.$$('table tbody tr');
      log(`TRIAL view rows: ${trialRows.length}`);
      log('✓ Switched to TRIAL sitting');
    }

    // Click MOCK
    const mockBtn = await page.$('button:has-text("MOCK"), button:has-text("模擬試")');
    if (mockBtn) {
      await mockBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(DIR, '03-grades-mock.png'), fullPage: true });
      const mockRows = await page.$$('table tbody tr');
      log(`MOCK view rows: ${mockRows.length}`);
      log('✓ Switched to MOCK sitting');
    }

    // Verify no "Sitting" column in table headers
    const headers = await page.$$eval('table thead th', ths => ths.map(th => th.textContent?.trim()));
    log(`Table headers: ${headers.join(', ')}`);
    if (!headers.includes('Sitting') && !headers.includes('考試類別')) {
      log('✓ Sitting column removed from table (implicit from toggle)');
    }

    // Check school directory — no Import button
    log('\nSchool Directory check:');
    await page.goto(`${BASE}/schools`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, '04-school-dir.png'), fullPage: false });
    const importBtn = await page.$('button:has-text("Import Data"), button:has-text("匯入資料")');
    log(`Import button: ${importBtn ? '✗ still visible' : '✓ removed'}`);

    log('\n=== SUMMARY ===');
    const passes = results.filter(r => r.startsWith('✓')).length;
    const fails = results.filter(r => r.startsWith('✗')).length;
    log(`Passes: ${passes}, Failures: ${fails}`);

  } catch (err: any) {
    log(`ERROR: ${err.message}`);
    await page.screenshot({ path: path.join(DIR, 'error.png'), fullPage: true });
  } finally {
    fs.writeFileSync(path.join(DIR, 'results.txt'), results.join('\n'));
    await browser.close();
  }
}

main();
