import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Clear all storage
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Fill wrong credentials
  await page.fill('input[name="email"]', 'aaa@bbb.com');
  await page.fill('input[name="password"]', 'wrongpassword');

  // Track navigations and unmounts
  const navEvents = [];
  page.on('framenavigated', f => navEvents.push(f.url()));

  // Submit
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Check results
  const emailVal = await page.inputValue('input[name="email"]');
  const alertText = await page.locator('[role="alert"]').textContent().catch(() => '');
  const bodyText = await page.textContent('body');

  const emailPreserved = emailVal === 'aaa@bbb.com';
  const errorShown = alertText.length > 0 || bodyText.includes('Invalid') || bodyText.includes('incorrect') || bodyText.includes('failed');

  console.log('--- RESULTS ---');
  console.log('Email preserved:', emailPreserved, `("${emailVal}")`);
  console.log('Error shown:', errorShown, `("${alertText.slice(0, 100)}")`);
  console.log('Navigations:', navEvents);
  console.log('PASS:', emailPreserved && errorShown);

  await browser.close();
  process.exit(emailPreserved && errorShown ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
